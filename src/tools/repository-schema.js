/**
 * Shared schemas and selection adapters for repository artifact and directory tools.
 */
import { createRepositoryPaths } from '../repository/paths.js';

export function artifactSelectorSchema(prefix = '') {
  const pPath = prefix ? `${prefix}Path` : 'path';
  const pRepo = prefix ? `${prefix}RepositoryPath` : 'repositoryPath';
  const pKind = prefix ? `${prefix}ArtifactKind` : 'artifactKind';

  return {
    [pPath]: {
      type: 'string',
      description: `Physical filesystem path to the Pentaho job (.kjb) or transformation (.ktr) file.`
    },
    [pRepo]: {
      type: 'string',
      description: `Repository path starting with '/' and without extension (e.g. '/xuat_user_active/check'). Mutually exclusive with '${pPath}'.`
    },
    [pKind]: {
      type: 'string',
      enum: ['job', 'trans'],
      description: `Artifact kind ('job' or 'trans'). Optional for existing files; required when creating a new artifact via repositoryPath.`
    }
  };
}

export function sourceDestArtifactSelectorSchema() {
  return {
    ...artifactSelectorSchema('source'),
    ...artifactSelectorSchema('dest')
  };
}

export function directorySelectorSchema() {
  return {
    directory: {
      type: 'string',
      description: 'Physical filesystem directory path within workspace boundary.'
    },
    repositoryDirectory: {
      type: 'string',
      description: "Repository directory path starting with '/' (e.g. '/xuat_user_active'). Mutually exclusive with 'directory'."
    }
  };
}

export function selectArtifact(ctx, args, { prefix = '', physicalKey = 'path', write = false } = {}) {
  const repoPaths = ctx.repositoryPaths || createRepositoryPaths(ctx);
  const pPath = physicalKey.startsWith(prefix) && prefix.length > 0 ? physicalKey : (prefix ? `${prefix}${physicalKey.slice(0, 1).toUpperCase()}${physicalKey.slice(1)}` : physicalKey);
  const pRepo = prefix ? `${prefix}RepositoryPath` : 'repositoryPath';
  const pKind = prefix ? `${prefix}ArtifactKind` : 'artifactKind';

  const selector = {
    path: args[pPath],
    repositoryPath: args[pRepo],
    artifactKind: args[pKind]
  };

  return repoPaths.resolveArtifact(selector, { write });
}

export function selectDirectory(ctx, args) {
  const repoPaths = ctx.repositoryPaths || createRepositoryPaths(ctx);
  const selector = {
    directory: args.directory,
    repositoryDirectory: args.repositoryDirectory
  };

  return repoPaths.resolveDirectory(selector);
}
