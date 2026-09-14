import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { extractReferences } from './references.js';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.pentaho-mcp',
  '.meta',
  '.kettle',
  '.gemini',
  'brain',
  'scratch',
  '.system_generated'
]);

function walkFiles(dir, rootDir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkFiles(full, rootDir, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.kjb' || ext === '.ktr') {
        files.push(full);
      }
    }
  }
  return files;
}

export function scanRepository(ctx, { repositoryDirectory = '/' } = {}) {
  const root = ctx.root;
  const targetDirId = ctx.repositoryPaths.resolveDirectory({ repositoryDirectory });
  const physicalFiles = walkFiles(targetDirId.physicalPath, root);

  const artifacts = [];
  const edges = [];
  const issues = [];
  let complete = true;

  // 1. Build artifact identities map
  const artifactMap = new Map();
  for (const file of physicalFiles) {
    try {
      const id = ctx.repositoryPaths.fromPhysical(file);
      const key = `${id.artifactKind}:${id.repositoryPath}`;
      artifactMap.set(key, id);
      artifacts.push(id);
    } catch (err) {
      issues.push({ code: 'INVALID_ARTIFACT_PATH', file, message: err.message });
      complete = false;
    }
  }

  // 2. Scan references in each artifact
  for (const id of artifacts) {
    try {
      const xml = readFileSync(id.physicalPath, 'utf8');
      const refs = extractReferences(xml, id);

      for (const ref of refs) {
        const edge = {
          sourceRepositoryPath: id.repositoryPath,
          sourceArtifactKind: id.artifactKind,
          elementName: ref.elementName,
          ownerType: ref.ownerType,
          targetKind: ref.targetKind,
          targetRepositoryPath: ref.targetRepositoryPath,
          status: ref.status
        };
        edges.push(edge);

        if (ref.status === 'MANAGED_REPO_REFERENCE' && ref.targetRepositoryPath) {
          const targetKey = `${ref.targetKind}:${ref.targetRepositoryPath}`;
          if (!artifactMap.has(targetKey)) {
            issues.push({
              code: 'MISSING_TARGET',
              sourceRepositoryPath: id.repositoryPath,
              sourceArtifactKind: id.artifactKind,
              elementName: ref.elementName,
              targetRepositoryPath: ref.targetRepositoryPath,
              targetKind: ref.targetKind
            });
          }
        } else if (ref.status === 'UNRESOLVED_REFERENCE' || ref.status === 'LEGACY_FILE_REFERENCE') {
          issues.push({
            code: ref.status,
            sourceRepositoryPath: id.repositoryPath,
            sourceArtifactKind: id.artifactKind,
            elementName: ref.elementName,
            targetRepositoryPath: ref.targetRepositoryPath,
            targetKind: ref.targetKind
          });
        } else if (ref.status === 'STREAMING_CALLER_UNSUPPORTED') {
          issues.push({
            code: 'STREAMING_CALLER_UNSUPPORTED',
            sourceRepositoryPath: id.repositoryPath,
            sourceArtifactKind: id.artifactKind,
            elementName: ref.elementName,
            ownerType: ref.ownerType
          });
        }
      }
    } catch (err) {
      issues.push({ code: 'READ_ERROR', file: id.physicalPath, message: err.message });
      complete = false;
    }
  }

  return {
    repositoryDirectory: targetDirId.repositoryDirectory,
    artifacts,
    edges,
    issues,
    complete
  };
}

export function dependencyClosure(scan, startIdentity) {
  const startKey = `${startIdentity.artifactKind}:${startIdentity.repositoryPath}`;
  const artifactByKeys = new Map(scan.artifacts.map(a => [`${a.artifactKind}:${a.repositoryPath}`, a]));

  const visited = new Set();
  const queue = [startKey];
  const closureArtifacts = [];
  const closureEdges = [];
  const closureIssues = [];
  let hasCycle = false;

  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (visited.has(currentKey)) {
      hasCycle = true;
      continue;
    }
    visited.add(currentKey);

    const art = artifactByKeys.get(currentKey);
    if (art) {
      closureArtifacts.push(art);
    }

    const [kind, repoPath] = currentKey.split(':');
    const outgoing = scan.edges.filter(e => e.sourceArtifactKind === kind && e.sourceRepositoryPath === repoPath);

    for (const edge of outgoing) {
      closureEdges.push(edge);
      if (edge.targetRepositoryPath && edge.targetKind) {
        const nextKey = `${edge.targetKind}:${edge.targetRepositoryPath}`;
        if (visited.has(nextKey)) {
          hasCycle = true;
        } else {
          queue.push(nextKey);
        }
      }
    }
  }

  const visitedArtifactKeys = new Set(closureArtifacts.map(a => `${a.artifactKind}:${a.repositoryPath}`));
  for (const issue of scan.issues) {
    if (issue.sourceRepositoryPath && issue.sourceArtifactKind) {
      if (visitedArtifactKeys.has(`${issue.sourceArtifactKind}:${issue.sourceRepositoryPath}`)) {
        closureIssues.push(issue);
      }
    }
  }

  return {
    start: startIdentity,
    artifacts: closureArtifacts,
    edges: closureEdges,
    issues: closureIssues,
    hasCycle,
    complete: scan.complete
  };
}
