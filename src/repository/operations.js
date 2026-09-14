import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { extractReferences, rewriteReference } from './references.js';
import { scanRepository } from './graph.js';
import { scanConnections, getSanitizedConnection } from './connections.js';
import { previewChanges, applyChanges } from './transactions.js';
import { setField } from '../core/edit.js';

export function planArtifactMove(ctx, {
  sourcePath,
  sourceRepositoryPath,
  sourceArtifactKind,
  targetRepositoryPath,
  apply = false
}) {
  const sourceId = ctx.repositoryPaths.resolveArtifact({
    path: sourcePath,
    repositoryPath: sourceRepositoryPath,
    artifactKind: sourceArtifactKind
  }, { write: false });

  const targetId = ctx.repositoryPaths.resolveArtifact({
    repositoryPath: targetRepositoryPath,
    artifactKind: sourceId.artifactKind
  }, { write: true });

  const changes = [];
  const issues = [];

  // 1. Read source XML and update internal name
  const sourceXml = readFileSync(sourceId.physicalPath, 'utf8');
  const updatedSourceXml = sourceXml.replace(/<name>.*?<\/name>/, `<name>${targetId.name}</name>`);

  // Target file gets new XML content
  changes.push({
    physicalPath: targetId.physicalPath,
    afterContent: updatedSourceXml
  });

  // Source file is deleted (unless target physicalPath is identical)
  if (sourceId.physicalPath.toLowerCase() !== targetId.physicalPath.toLowerCase()) {
    changes.push({
      physicalPath: sourceId.physicalPath,
      afterContent: null
    });
  }

  // 2. Find incoming references to sourceId and update them
  const graphScan = scanRepository(ctx);
  const incomingEdges = graphScan.edges.filter(e =>
    e.targetRepositoryPath === sourceId.repositoryPath && e.targetKind === sourceId.artifactKind
  );

  const callerChanges = new Map();
  for (const edge of incomingEdges) {
    const callerId = ctx.repositoryPaths.resolveArtifact({
      repositoryPath: edge.sourceRepositoryPath,
      artifactKind: edge.sourceArtifactKind
    }, { write: false });

    let callerXml = callerChanges.get(callerId.physicalPath);
    if (!callerXml) {
      callerXml = readFileSync(callerId.physicalPath, 'utf8');
    }

    try {
      const rewritten = rewriteReference(callerXml, {
        ownerKind: callerId.artifactKind,
        elementName: edge.elementName,
        target: targetId
      });
      callerChanges.set(callerId.physicalPath, rewritten);
    } catch (err) {
      issues.push({ code: 'REWRITE_FAILED', file: callerId.physicalPath, message: err.message });
    }
  }

  for (const [physicalPath, afterContent] of callerChanges.entries()) {
    changes.push({ physicalPath, afterContent });
  }

  const preview = previewChanges(ctx, changes);
  preview.issues.push(...issues);
  preview.complete = graphScan.complete && issues.length === 0;

  if (apply && preview.issues.length === 0) {
    const applyRes = applyChanges(ctx, { manifest: preview });
    return { ...preview, applied: true, applyResult: applyRes };
  }

  return { ...preview, applied: false };
}

export function planConnectionRename(ctx, { name, newName, apply = false }) {
  const root = ctx.root;
  const oldSanitized = getSanitizedConnection(ctx, name);

  const oldPath = oldSanitized.physicalPath;
  const newPath = ctx.resolveWrite(`${newName}.kdb`);

  const changes = [];
  const issues = [];

  // Read old .kdb XML and update name tag
  const oldKdbXml = readFileSync(oldPath, 'utf8');
  const newKdbXml = oldKdbXml.replace(/<name>.*?<\/name>/, `<name>${newName}</name>`);

  changes.push({ physicalPath: newPath, afterContent: newKdbXml });
  if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
    changes.push({ physicalPath: oldPath, afterContent: null });
  }

  // Update consumer jobs and transformations
  const connScan = scanConnections(ctx);
  const consumers = connScan.usages.filter(u => u.name.toLowerCase() === name.toLowerCase());

  const callerChanges = new Map();
  for (const cons of consumers) {
    const artId = ctx.repositoryPaths.resolveArtifact({
      repositoryPath: cons.artifactRepositoryPath,
      artifactKind: cons.artifactKind
    }, { write: false });

    let xml = callerChanges.get(artId.physicalPath);
    if (!xml) {
      xml = readFileSync(artId.physicalPath, 'utf8');
    }

    const updated = xml.replaceAll(`<name>${name}</name>`, `<name>${newName}</name>`);
    callerChanges.set(artId.physicalPath, updated);
  }

  for (const [physicalPath, afterContent] of callerChanges.entries()) {
    changes.push({ physicalPath, afterContent });
  }

  const preview = previewChanges(ctx, changes);
  preview.complete = connScan.complete;

  if (apply && preview.issues.length === 0) {
    const applyRes = applyChanges(ctx, { manifest: preview });
    return { ...preview, applied: true, applyResult: applyRes };
  }

  return { ...preview, applied: false };
}

export function planMigration(ctx, { repositoryDirectory = '/', apply = false } = {}) {
  const scan = scanRepository(ctx, { repositoryDirectory });
  const changes = [];
  const issues = [];

  for (const edge of scan.edges) {
    if (edge.status === 'LEGACY_FILE_REFERENCE' && edge.filename) {
      const callerId = ctx.repositoryPaths.resolveArtifact({
        repositoryPath: edge.sourceRepositoryPath,
        artifactKind: edge.sourceArtifactKind
      }, { write: false });

      try {
        const resolvedTarget = ctx.repositoryPaths.resolveArtifact({
          path: edge.filename,
          artifactKind: edge.targetKind
        }, { write: false });

        const xml = readFileSync(callerId.physicalPath, 'utf8');
        const rewritten = rewriteReference(xml, {
          ownerKind: callerId.artifactKind,
          elementName: edge.elementName,
          target: resolvedTarget
        });

        changes.push({ physicalPath: callerId.physicalPath, afterContent: rewritten });
      } catch (err) {
        issues.push({ code: 'MIGRATION_UNRESOLVED', file: callerId.physicalPath, message: err.message });
      }
    }
  }

  const preview = previewChanges(ctx, changes);
  preview.issues.push(...issues);
  preview.complete = scan.complete && issues.length === 0;

  if (apply && preview.issues.length === 0) {
    const applyRes = applyChanges(ctx, { manifest: preview });
    return { ...preview, applied: true, applyResult: applyRes };
  }

  return { ...preview, applied: false };
}
