import path from 'node:path';
import { existsSync } from 'node:fs';

class RepositoryPathError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RepositoryPathError';
    this.code = code;
  }
}

/**
 * Creates repository path resolver wrapping workspace boundary.
 * @param {import('../workspace/boundary.js').WorkspaceBoundary} boundary
 */
export function createRepositoryPaths(boundary) {
  const root = boundary.root;

  function normalizeRepoPath(repoPath) {
    if (typeof repoPath !== 'string' || !repoPath.startsWith('/')) {
      throw new RepositoryPathError(`Repository path must start with '/': ${repoPath}`, 'INVALID_REPOSITORY_PATH');
    }
    if (repoPath.includes('\\') || repoPath.includes('\0') || /[a-zA-Z]:/.test(repoPath)) {
      throw new RepositoryPathError(`Invalid character in repository path: ${repoPath}`, 'INVALID_REPOSITORY_PATH');
    }
    const segments = repoPath.split('/');
    for (const seg of segments) {
      if (seg === '.' || seg === '..') {
        throw new RepositoryPathError(`Relative path segment '${seg}' not allowed in repository path`, 'INVALID_REPOSITORY_PATH');
      }
    }
    if (/\.(ktr|kjb)$/i.test(repoPath)) {
      throw new RepositoryPathError(`Repository path must not contain extension suffix: ${repoPath}`, 'INVALID_REPOSITORY_PATH');
    }
    // normalize multiple slashes
    const clean = '/' + segments.filter(Boolean).join('/');
    return clean;
  }

  function validateArtifactName(name) {
    if (!name || typeof name !== 'string') {
      throw new RepositoryPathError('Artifact name must be a non-empty string', 'INVALID_ARTIFACT_NAME');
    }
    if (/[\/\\:*?"<>|\0]/.test(name) || name === '.' || name === '..') {
      throw new RepositoryPathError(`Invalid character in artifact name: ${name}`, 'INVALID_ARTIFACT_NAME');
    }
  }

  function resolveArtifact(selector, { write = false } = {}) {
    if (!selector || typeof selector !== 'object') {
      throw new RepositoryPathError('Artifact selector must be an object', 'INVALID_SELECTOR');
    }

    const physicalKey = selector.path ? 'path' : (selector.artifact ? 'artifact' : null);
    const hasPhysical = Boolean(physicalKey);
    const hasRepo = Boolean(selector.repositoryPath);

    if (hasPhysical && hasRepo) {
      throw new RepositoryPathError('Both physical path and repositoryPath provided; mutually exclusive selector modes', 'INVALID_SELECTOR');
    }

    if (!hasPhysical && !hasRepo) {
      throw new RepositoryPathError('Either path or repositoryPath must be provided', 'MISSING_SELECTOR');
    }

    let kind = selector.artifactKind;
    if (kind && kind !== 'job' && kind !== 'trans') {
      throw new RepositoryPathError(`Invalid artifactKind '${kind}'; expected 'job' or 'trans'`, 'INVALID_ARTIFACT_KIND');
    }

    if (hasPhysical) {
      const physicalInput = selector[physicalKey];
      const ext = path.extname(physicalInput).toLowerCase();
      if (ext === '.kjb') kind = kind || 'job';
      else if (ext === '.ktr') kind = kind || 'trans';

      const physicalPath = write
        ? boundary.resolveWrite(physicalInput)
        : boundary.resolveRead(physicalInput);

      const relPath = path.relative(root, physicalPath).replace(/\\/g, '/');
      const relExt = path.extname(relPath);
      const stem = relExt ? relPath.slice(0, -relExt.length) : relPath;
      const repositoryPath = '/' + stem;
      const directory = path.posix.dirname(repositoryPath);
      const name = path.posix.basename(repositoryPath);
      const resolvedKind = kind || (relExt.toLowerCase() === '.kjb' ? 'job' : relExt.toLowerCase() === '.ktr' ? 'trans' : null);

      if (!resolvedKind) {
        throw new RepositoryPathError(`Runtime artifact must end in .kjb or .ktr: ${physicalInput}`, 'INVALID_ARTIFACT_KIND');
      }

      return {
        physicalPath,
        repositoryPath,
        artifactKind: resolvedKind,
        name,
        directory
      };
    }

    // Repository path selector
    const cleanRepoPath = normalizeRepoPath(selector.repositoryPath);
    if (cleanRepoPath === '/') {
      throw new RepositoryPathError("Repository path '/' denotes a directory, not an artifact", 'INVALID_REPOSITORY_PATH');
    }

    const directory = path.posix.dirname(cleanRepoPath);
    const name = path.posix.basename(cleanRepoPath);
    validateArtifactName(name);

    const relDir = directory === '/' ? '' : directory.substring(1);
    const physKtr = path.join(root, relDir, `${name}.ktr`);
    const physKjb = path.join(root, relDir, `${name}.kjb`);

    if (!kind) {
      const hasKtr = existsSync(physKtr);
      const hasKjb = existsSync(physKjb);

      if (hasKtr && hasKjb) {
        throw new RepositoryPathError(`Ambiguous artifact: both .ktr and .kjb exist for ${cleanRepoPath}`, 'AMBIGUOUS_ARTIFACT');
      }
      if (hasKtr) {
        kind = 'trans';
      } else if (hasKjb) {
        kind = 'job';
      } else {
        if (write) {
          throw new RepositoryPathError(`artifactKind ('job' or 'trans') is required to create a new repository artifact`, 'MISSING_ARTIFACT_KIND');
        } else {
          throw new RepositoryPathError(`Artifact not found: ${cleanRepoPath}`, 'ARTIFACT_NOT_FOUND');
        }
      }
    }

    const ext = kind === 'job' ? '.kjb' : '.ktr';
    const targetRelPath = path.join(relDir, name + ext);
    const physicalPath = write
      ? boundary.resolveWrite(targetRelPath)
      : boundary.resolveRead(targetRelPath);

    return {
      physicalPath,
      repositoryPath: cleanRepoPath,
      artifactKind: kind,
      name,
      directory
    };
  }

  function resolveDirectory(selector) {
    if (!selector || typeof selector !== 'object') {
      throw new RepositoryPathError('Directory selector must be an object', 'INVALID_SELECTOR');
    }

    const hasPhysical = Boolean(selector.directory);
    const hasRepo = Boolean(selector.repositoryDirectory);

    if (hasPhysical && hasRepo) {
      throw new RepositoryPathError('Both physical directory and repositoryDirectory provided; mutually exclusive selector modes', 'INVALID_SELECTOR');
    }

    if (hasRepo) {
      let repoDir = selector.repositoryDirectory;
      if (typeof repoDir !== 'string' || !repoDir.startsWith('/')) {
        throw new RepositoryPathError(`repositoryDirectory must start with '/': ${repoDir}`, 'INVALID_REPOSITORY_DIRECTORY');
      }
      if (repoDir.includes('\\') || repoDir.includes('\0') || /[a-zA-Z]:/.test(repoDir)) {
        throw new RepositoryPathError(`Invalid character in repository directory: ${repoDir}`, 'INVALID_REPOSITORY_DIRECTORY');
      }
      const parts = repoDir.split('/').filter(Boolean);
      for (const p of parts) {
        if (p === '.' || p === '..') {
          throw new RepositoryPathError(`Relative path segment '${p}' not allowed in repositoryDirectory`, 'INVALID_REPOSITORY_DIRECTORY');
        }
      }
      const normalizedRepoDir = '/' + parts.join('/');
      const relPath = parts.join(path.sep);
      const physicalPath = boundary.resolveRead(relPath || '.');

      return {
        physicalPath,
        repositoryDirectory: normalizedRepoDir === '/' ? '/' : normalizedRepoDir
      };
    }

    // Physical directory selector or default
    const physicalInput = selector.directory || '.';
    const physicalPath = boundary.resolveRead(physicalInput);
    const rel = path.relative(root, physicalPath).replace(/\\/g, '/');
    const repositoryDirectory = rel ? '/' + rel : '/';

    return {
      physicalPath,
      repositoryDirectory
    };
  }

  function fromPhysical(physicalPath) {
    const resolved = boundary.resolveRead(physicalPath);
    const relPath = path.relative(root, resolved).replace(/\\/g, '/');
    const ext = path.extname(relPath).toLowerCase();
    const stem = ext ? relPath.slice(0, -ext.length) : relPath;
    const repositoryPath = '/' + stem;
    const directory = path.posix.dirname(repositoryPath);
    const name = path.posix.basename(repositoryPath);
    const artifactKind = ext === '.kjb' ? 'job' : ext === '.ktr' ? 'trans' : null;

    return {
      physicalPath: resolved,
      repositoryPath,
      artifactKind,
      name,
      directory
    };
  }

  return {
    resolveArtifact,
    resolveDirectory,
    fromPhysical
  };
}
