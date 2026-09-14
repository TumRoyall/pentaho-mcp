import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { scanRepository } from './graph.js';
import { text, toArray } from '../core/model.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  '
});

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function getPasswordStatus(rawPassword) {
  if (!rawPassword || rawPassword.trim() === '') return 'empty';
  if (rawPassword.trim().startsWith('${')) return 'variable';
  if (rawPassword.trim().startsWith('Encrypted ')) return 'encrypted';
  return 'present';
}

function isSecretAttribute(code) {
  if (!code || typeof code !== 'string') return false;
  const lower = code.toLowerCase();
  return lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower.includes('pwd') || lower.includes('key');
}

export function parseSanitizedConnectionXml(xml, physicalPath) {
  const doc = parser.parse(xml);
  const conn = doc.connection;
  if (!conn) throw new Error(`Invalid .kdb connection format in ${physicalPath}`);

  const rawName = text(conn.name);
  const rawPassword = text(conn.password);
  const passwordStatus = getPasswordStatus(rawPassword);
  const hash = sha256(xml);

  const attributes = toArray(conn.attributes?.attribute).map(a => {
    const code = text(a.code);
    const val = text(a.attribute);
    return {
      code,
      attribute: isSecretAttribute(code) ? '***MASKED***' : val
    };
  });

  return {
    name: rawName,
    physicalPath,
    passwordStatus,
    hash,
    rawPassword,
    definition: {
      name: rawName,
      server: text(conn.server),
      type: text(conn.type),
      access: text(conn.access),
      database: text(conn.database),
      port: text(conn.port),
      username: text(conn.username),
      attributes
    }
  };
}

export function scanConnections(ctx) {
  const root = ctx.root;
  const connections = [];
  const usages = [];
  const issues = [];
  let complete = true;

  // 1. Scan root .kdb files
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (err) {
    issues.push({ code: 'DIR_READ_ERROR', file: root, message: err.message });
    complete = false;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.kdb')) {
      const fullPath = path.join(root, entry.name);
      try {
        const xml = readFileSync(fullPath, 'utf8');
        const parsed = parseSanitizedConnectionXml(xml, fullPath);
        connections.push(parsed);
      } catch (err) {
        issues.push({ code: 'INVALID_KDB_FILE', file: fullPath, message: err.message });
        complete = false;
      }
    }
  }

  // 2. Scan usages across repository artifacts
  const graphScan = scanRepository(ctx);
  if (!graphScan.complete) complete = false;

  for (const id of graphScan.artifacts) {
    try {
      const xml = readFileSync(id.physicalPath, 'utf8');
      const doc = parser.parse(xml);
      const rootNode = doc.job || doc.transformation;
      if (!rootNode) continue;

      const connList = toArray(rootNode.connection);
      for (const c of connList) {
        const connName = text(c.name);
        if (!connName) continue;

        // Check if matching .kdb exists in root
        const rootKdb = connections.find(k => k.name.toLowerCase() === connName.toLowerCase());
        const provenance = rootKdb ? 'repository' : 'embedded';

        usages.push({
          name: connName,
          artifactRepositoryPath: id.repositoryPath,
          artifactKind: id.artifactKind,
          provenance
        });
      }
    } catch (err) {
      issues.push({ code: 'ARTIFACT_READ_ERROR', file: id.physicalPath, message: err.message });
    }
  }

  // Remove raw password from public output connection list
  const sanitizedConnections = connections.map(({ rawPassword, ...rest }) => rest);

  return {
    connections: sanitizedConnections,
    usages,
    issues,
    complete
  };
}

export function getSanitizedConnection(ctx, name) {
  const root = ctx.root;
  const targetPath = path.join(root, `${name}.kdb`);
  if (!existsSync(targetPath)) {
    // Case-insensitive fallback lookup
    const entries = readdirSync(root).filter(e => e.toLowerCase().endsWith('.kdb'));
    const match = entries.find(e => e.slice(0, -4).toLowerCase() === name.toLowerCase());
    if (!match) {
      throw new Error(`Connection not found: ${name}`);
    }
    const realPath = path.join(root, match);
    const xml = readFileSync(realPath, 'utf8');
    const { rawPassword, ...sanitized } = parseSanitizedConnectionXml(xml, realPath);
    return sanitized;
  }

  const xml = readFileSync(targetPath, 'utf8');
  const { rawPassword, ...sanitized } = parseSanitizedConnectionXml(xml, targetPath);
  return sanitized;
}

export function putConnection(ctx, { name, definition, expectedHash }) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Connection name must be a non-empty string');
  }
  const root = ctx.root;
  const targetPath = ctx.resolveWrite(`${name}.kdb`);

  let existing = null;
  if (existsSync(targetPath)) {
    const existingXml = readFileSync(targetPath, 'utf8');
    existing = parseSanitizedConnectionXml(existingXml, targetPath);
    if (expectedHash && existing.hash !== expectedHash) {
      throw new Error(`Connection "${name}" was modified concurrently (hash mismatch)`);
    }
  }

  if (definition.password && definition.password.trim() !== '') {
    const p = definition.password.trim();
    if (!p.startsWith('${')) {
      throw new Error('Plaintext passwords are not allowed. Passwords must be empty or a ${VARIABLE} placeholder.');
    }
  }

  const mergedPassword = definition.password !== undefined
    ? definition.password
    : (existing ? existing.rawPassword : '');

  const connObj = {
    connection: {
      name,
      server: definition.server ?? existing?.definition.server ?? '',
      type: definition.type ?? existing?.definition.type ?? '',
      access: definition.access ?? existing?.definition.access ?? 'Native',
      database: definition.database ?? existing?.definition.database ?? '',
      port: definition.port ?? existing?.definition.port ?? '',
      username: definition.username ?? existing?.definition.username ?? '',
      password: mergedPassword,
      attributes: {
        attribute: (definition.attributes || existing?.definition.attributes || []).map(a => ({
          code: a.code,
          attribute: a.attribute === '***MASKED***' ? '' : a.attribute
        }))
      }
    }
  };

  const newXml = `<?xml version="1.0" encoding="UTF-8"?>\n` + builder.build(connObj);
  writeFileSync(targetPath, newXml, 'utf8');

  const { rawPassword, ...sanitized } = parseSanitizedConnectionXml(newXml, targetPath);
  return sanitized;
}

export function deleteConnection(ctx, { name, expectedHash }) {
  const report = scanConnections(ctx);
  const conn = report.connections.find(c => c.name.toLowerCase() === name.toLowerCase());

  if (!conn) {
    throw new Error(`Connection not found: ${name}`);
  }

  if (expectedHash && conn.hash !== expectedHash) {
    throw new Error(`Connection "${name}" hash mismatch (modified concurrently)`);
  }

  const activeUsages = report.usages.filter(u => u.name.toLowerCase() === name.toLowerCase());
  if (activeUsages.length > 0) {
    throw new Error(`Cannot delete connection "${name}"; it is referenced by existing artifacts: ${activeUsages.map(u => u.artifactRepositoryPath).join(', ')}`);
  }

  unlinkSync(conn.physicalPath);
  return { deleted: true, name: conn.name, physicalPath: conn.physicalPath };
}
