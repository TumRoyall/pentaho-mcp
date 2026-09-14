import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateXml } from '../core/validate.js';
import { unifiedDiff } from '../core/edit.js';

function sha256(content) {
  if (content == null) return null;
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function stagingDirFor(ctx, id) {
  return path.join(ctx.root, '.pentaho-mcp', 'transactions', id);
}

export function previewChanges(ctx, changes) {
  const id = `tx_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const stagingDir = stagingDirFor(ctx, id);
  mkdirSync(stagingDir, { recursive: true });

  const manifestChanges = [];
  const journalEntries = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const physicalPath = change.physicalPath;
    const relPath = path.relative(ctx.root, physicalPath).replace(/\\/g, '/');

    const beforeContent = existsSync(physicalPath) ? readFileSync(physicalPath, 'utf8') : null;
    const afterContent = change.afterContent; // string or null for deletion

    const beforeHash = sha256(beforeContent);
    const afterHash = sha256(afterContent);

    const diff = (beforeContent != null && afterContent != null)
      ? unifiedDiff(beforeContent, afterContent, relPath)
      : (afterContent == null ? `- [DELETE] ${relPath}` : `+ [NEW] ${relPath}`);

    const beforeFile = path.join(stagingDir, `${i}_before.txt`);
    const afterFile = path.join(stagingDir, `${i}_after.txt`);

    if (beforeContent != null) writeFileSync(beforeFile, beforeContent, 'utf8');
    if (afterContent != null) writeFileSync(afterFile, afterContent, 'utf8');

    manifestChanges.push({
      physicalPath,
      repositoryPath: '/' + relPath.replace(/\.(ktr|kjb|kdb)$/i, ''),
      beforeHash,
      afterHash,
      diff
    });

    journalEntries.push({
      index: i,
      physicalPath,
      beforeHash,
      afterHash,
      beforeFile: beforeContent != null ? beforeFile : null,
      afterFile: afterContent != null ? afterFile : null,
    });
  }

  const journal = {
    id,
    createdAt: new Date().toISOString(),
    status: 'previewed',
    entries: journalEntries
  };

  writeFileSync(path.join(stagingDir, 'journal.json'), JSON.stringify(journal, null, 2), 'utf8');

  return {
    id,
    changes: manifestChanges,
    issues: []
  };
}

export function applyChanges(ctx, { manifest }) {
  const stagingDir = stagingDirFor(ctx, manifest.id);
  const journalPath = path.join(stagingDir, 'journal.json');
  if (!existsSync(journalPath)) {
    throw new Error(`Transaction journal not found: ${manifest.id}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));

  // 1. Verify beforeHash for all files (optimistic concurrency check)
  const candidateFiles = new Map();
  for (const entry of journal.entries) {
    const currentContent = existsSync(entry.physicalPath) ? readFileSync(entry.physicalPath, 'utf8') : null;
    const currentHash = sha256(currentContent);

    if (currentHash !== entry.beforeHash) {
      throw new Error(`Concurrent modification detected on ${entry.physicalPath} during transaction apply`);
    }

    const proposedContent = entry.afterFile ? readFileSync(entry.afterFile, 'utf8') : null;
    candidateFiles.set(entry.physicalPath, proposedContent);
  }

  // 2. Candidate validation
  for (const entry of journal.entries) {
    if (entry.afterFile) {
      const proposedContent = readFileSync(entry.afterFile, 'utf8');
      if (/\.(ktr|kjb)$/i.test(entry.physicalPath)) {
        const report = validateXml(proposedContent, entry.physicalPath, {
          dir: path.dirname(entry.physicalPath),
          repositoryContext: ctx,
          candidateFiles
        });
        if (report.summary.errors > 0) {
          throw new Error(`Candidate validation failed for ${entry.physicalPath}: ${report.issues[0].message}`);
        }
      }
    }
  }

  // 3. Write changes
  for (const entry of journal.entries) {
    if (entry.afterFile) {
      const proposedContent = readFileSync(entry.afterFile, 'utf8');
      mkdirSync(path.dirname(entry.physicalPath), { recursive: true });
      writeFileSync(entry.physicalPath, proposedContent, 'utf8');
    } else {
      if (existsSync(entry.physicalPath)) {
        unlinkSync(entry.physicalPath);
      }
    }
  }

  journal.status = 'applied';
  journal.appliedAt = new Date().toISOString();
  writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf8');

  return {
    applied: true,
    id: manifest.id,
    changesCount: manifest.changes.length
  };
}

export function recoverChanges(ctx, { transactionId }) {
  const stagingDir = stagingDirFor(ctx, transactionId);
  const journalPath = path.join(stagingDir, 'journal.json');
  if (!existsSync(journalPath)) {
    throw new Error(`Transaction journal not found for recovery: ${transactionId}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));

  // Restore original contents
  for (const entry of journal.entries) {
    if (entry.beforeFile && existsSync(entry.beforeFile)) {
      const original = readFileSync(entry.beforeFile, 'utf8');
      mkdirSync(path.dirname(entry.physicalPath), { recursive: true });
      writeFileSync(entry.physicalPath, original, 'utf8');
    } else {
      if (existsSync(entry.physicalPath)) {
        try { unlinkSync(entry.physicalPath); } catch {}
      }
    }
  }

  try {
    rmSync(stagingDir, { recursive: true, force: true });
  } catch {}

  return {
    recovered: true,
    transactionId
  };
}
