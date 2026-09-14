import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function hashString(content) {
  if (content === null || content === undefined) return 'absent';
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function normalizePath(p) {
  if (!p) return '';
  let str = p.trim();
  if (str.startsWith('file:///')) {
    str = str.slice(8);
  } else if (str.startsWith('file:/')) {
    str = str.slice(6);
  }
  const resolved = path.resolve(str);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function samePath(p1, p2) {
  const norm1 = normalizePath(p1);
  const norm2 = normalizePath(p2);
  if (process.platform === 'win32') {
    return norm1.toLowerCase() === norm2.toLowerCase();
  }
  return norm1 === norm2;
}

export function getRegistryCandidates({ environment = process.env, cwd = process.cwd(), javaProperties } = {}) {
  const candidates = [];
  const added = new Set();

  function addCandidate(filePath, provenance) {
    if (!filePath) return;
    const resolved = path.resolve(filePath);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (!added.has(key)) {
      added.add(key);
      candidates.push({ path: resolved, provenance, exists: existsSync(resolved) });
    }
  }

  // 1. Local registry in cwd
  if (cwd) {
    addCandidate(path.join(cwd, 'repositories.xml'), 'local');
  }

  // 2. KETTLE_HOME / USERPROFILE / HOME registries
  const kettleHome = javaProperties?.['KETTLE_HOME'] || javaProperties?.['kettle.home'] || environment.KETTLE_HOME;
  if (kettleHome) {
    addCandidate(path.join(kettleHome, '.kettle', 'repositories.xml'), 'kettle_home');
    addCandidate(path.join(kettleHome, 'repositories.xml'), 'kettle_home');
  }

  const userHome = environment.USERPROFILE || environment.HOME;
  if (userHome) {
    addCandidate(path.join(userHome, '.kettle', 'repositories.xml'), 'kettle_home');
  }

  return candidates;
}

export function parseRepositoriesXml(xmlContent) {
  if (!xmlContent) return [];
  const repositories = [];
  const repoRegex = /<repository>([\s\S]*?)<\/repository>/gi;
  let match;

  while ((match = repoRegex.exec(xmlContent)) !== null) {
    const block = match[1];
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(block);
    const typeMatch = /<type>([\s\S]*?)<\/type>/i.exec(block);
    const baseDirMatch = /<base_directory>([\s\S]*?)<\/base_directory>/i.exec(block);
    const readOnlyMatch = /<read_only>([\s\S]*?)<\/read_only>/i.exec(block);
    const isDefaultMatch = /<is_default>([\s\S]*?)<\/is_default>/i.exec(block);
    const descriptionMatch = /<description>([\s\S]*?)<\/description>/i.exec(block);

    if (nameMatch) {
      const readOnlyVal = readOnlyMatch ? readOnlyMatch[1].trim().toUpperCase() : 'N';
      repositories.push({
        name: nameMatch[1].trim(),
        type: typeMatch ? typeMatch[1].trim() : 'KettleFileRepository',
        baseDirectory: baseDirMatch ? baseDirMatch[1].trim() : '',
        readOnly: readOnlyVal === 'Y' || readOnlyVal === 'TRUE',
        isDefault: isDefaultMatch ? isDefaultMatch[1].trim().toUpperCase() === 'Y' : false,
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
      });
    }
  }

  return repositories;
}

export function detectRepository(ctx, { environment = process.env, cwd = process.cwd(), javaProperties } = {}) {
  const candidates = getRegistryCandidates({ environment, cwd, javaProperties });
  const targetName = ctx.repositoryName || environment.PENTAHO_REPOSITORY_NAME || javaProperties?.['PENTAHO_REPOSITORY_NAME'];

  // Parse candidate files keeping track of provenance
  const candidateLists = [];
  for (const candidate of candidates) {
    if (!candidate.exists) continue;
    try {
      const xml = readFileSync(candidate.path, 'utf8');
      const entries = parseRepositoriesXml(xml).map(e => ({
        ...e,
        registryPath: candidate.path,
        provenance: candidate.provenance,
      }));
      if (entries.length > 0) {
        candidateLists.push({ candidate, entries });
      }
    } catch {
      // Ignore unreadable registry candidate
    }
  }

  if (targetName) {
    for (const { candidate, entries } of candidateLists) {
      const matchedByName = entries.filter(e => e.name === targetName);
      if (matchedByName.length > 0) {
        const matched = matchedByName.find(e => samePath(e.baseDirectory, ctx.root));
        if (matched) {
          return {
            status: 'READY',
            registryPath: matched.registryPath,
            provenance: matched.provenance,
            repository: {
              name: matched.name,
              type: matched.type,
              baseDirectory: matched.baseDirectory,
              readOnly: matched.readOnly,
              isDefault: matched.isDefault,
            },
            issues: [],
          };
        }
        const existing = matchedByName[0];
        return {
          status: 'MISMATCH',
          registryPath: existing.registryPath,
          provenance: existing.provenance,
          repository: {
            name: existing.name,
            type: existing.type,
            baseDirectory: existing.baseDirectory,
            readOnly: existing.readOnly,
          },
          issues: [`Repository '${targetName}' registered in ${existing.registryPath} points to '${existing.baseDirectory}', but workspace root is '${ctx.root}'`],
        };
      }
    }

    return {
      status: 'UNREGISTERED',
      registryPath: null,
      provenance: null,
      repository: null,
      issues: [`Repository '${targetName}' is not defined in any detected repositories.xml`],
    };
  }

  // No target name explicitly set: match by base_directory in precedence order
  for (const { candidate, entries } of candidateLists) {
    const matchedByRoot = entries.filter(e => samePath(e.baseDirectory, ctx.root));
    if (matchedByRoot.length === 1) {
      const matched = matchedByRoot[0];
      return {
        status: 'READY',
        registryPath: matched.registryPath,
        provenance: matched.provenance,
        repository: {
          name: matched.name,
          type: matched.type,
          baseDirectory: matched.baseDirectory,
          readOnly: matched.readOnly,
          isDefault: matched.isDefault,
        },
        issues: [],
      };
    }
    if (matchedByRoot.length > 1) {
      return {
        status: 'AMBIGUOUS',
        registryPath: matchedByRoot[0].registryPath,
        provenance: matchedByRoot[0].provenance,
        repository: null,
        issues: [`Multiple repository definitions match workspace root '${ctx.root}' in ${candidate.path}: ${matchedByRoot.map(e => e.name).join(', ')}`],
      };
    }
  }

  return {
    status: 'UNREGISTERED',
    registryPath: null,
    provenance: null,
    repository: null,
    issues: [`No repository definition in detected repositories.xml matches workspace root '${ctx.root}'`],
  };
}

export function planRegistration(ctx, { name, registryPath, environment = process.env, cwd = process.cwd(), javaProperties, apply = false } = {}) {
  if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_\-\.\s]+$/.test(name.trim())) {
    throw new Error(`Invalid repository name: ${name}`);
  }
  const repoName = name.trim();

  // Determine target registry file
  let targetPath = registryPath;
  if (!targetPath) {
    const kettleHome = javaProperties?.['KETTLE_HOME'] || javaProperties?.['kettle.home'] || environment.KETTLE_HOME;
    const userHome = environment.USERPROFILE || environment.HOME;
    const homeDir = kettleHome || userHome;
    if (!homeDir) throw new Error('Cannot determine home directory for repositories.xml registration');
    targetPath = path.resolve(homeDir, '.kettle', 'repositories.xml');
  } else {
    targetPath = path.resolve(targetPath);
  }

  // Security authorization check: targetPath must end with repositories.xml
  if (path.basename(targetPath).toLowerCase() !== 'repositories.xml') {
    throw new Error('Registration target must be a repositories.xml file');
  }

  let existingXml = null;
  if (existsSync(targetPath)) {
    existingXml = readFileSync(targetPath, 'utf8');
  }

  const beforeHash = hashString(existingXml);
  const existingEntries = parseRepositoriesXml(existingXml);

  const existingSameName = existingEntries.find(e => e.name === repoName);
  if (existingSameName) {
    if (samePath(existingSameName.baseDirectory, ctx.root)) {
      const planResult = {
        registryPath: targetPath,
        name: repoName,
        beforeHash,
        afterHash: beforeHash,
        proposedXml: existingXml,
        alreadyRegistered: true,
        issues: [],
      };
      if (apply) {
        return applyRegistration(ctx, planResult);
      }
      return planResult;
    }
    throw new Error(`Repository '${repoName}' is already registered in ${targetPath} pointing to '${existingSameName.baseDirectory}'`);
  }

  // Construct new XML
  let proposedXml;
  const newRepoBlock = `  <repository>
    <id>KettleFileRepository</id>
    <name>${repoName}</name>
    <description>${repoName}</description>
    <is_default>N</is_default>
    <type>KettleFileRepository</type>
    <base_directory>${ctx.root}</base_directory>
    <read_only>N</read_only>
  </repository>\n`;

  if (existingXml && existingXml.includes('</repositories>')) {
    proposedXml = existingXml.replace('</repositories>', `${newRepoBlock}</repositories>`);
  } else {
    proposedXml = `<?xml version="1.0" encoding="UTF-8"?>
<repositories>
${newRepoBlock}</repositories>
`;
  }

  const afterHash = hashString(proposedXml);

  const planResult = {
    registryPath: targetPath,
    name: repoName,
    beforeHash,
    afterHash,
    proposedXml,
    alreadyRegistered: false,
    issues: [],
  };

  if (apply) {
    return applyRegistration(ctx, planResult);
  }

  return planResult;
}

export function applyRegistration(ctx, plan) {
  const { registryPath, name, beforeHash, proposedXml } = plan;
  const currentContent = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : null;
  const currentHash = hashString(currentContent);

  if (currentHash !== beforeHash) {
    throw new Error(`Stale registration target ${registryPath}: expected hash ${beforeHash}, found ${currentHash}`);
  }

  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, proposedXml, 'utf8');

  return {
    applied: true,
    registryPath,
    name,
    repository: {
      name,
      type: 'KettleFileRepository',
      baseDirectory: ctx.root,
      readOnly: false,
    },
  };
}
