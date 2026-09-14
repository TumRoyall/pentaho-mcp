import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { extractReferences, rewriteReference } from '../repository/references.js';
import { scanRepository } from '../repository/graph.js';
import { recoverChanges } from '../repository/transactions.js';
import { planArtifactMove, planMigration } from '../repository/operations.js';
import { detectRepository, planRegistration } from '../repository/registration.js';
import { artifactSelectorSchema, directorySelectorSchema, selectArtifact, selectDirectory } from './repository-schema.js';
import { validateXml } from '../core/validate.js';

const str = d => ({ type: 'string', description: d });

export function repositoryTools(ctx) {
  return [
    {
      name: 'kettle_repository_list',
      title: 'List Pentaho File Repository contents',
      description: 'List directories and artifact identities under a repository directory.',
      annotations: { title: 'List Pentaho File Repository contents', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...directorySelectorSchema(),
          recursive: { type: 'boolean', description: 'Recursively scan subdirectories (default false)' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Maximum items to return (1..500)' }
        },
        additionalProperties: false,
      },
      handler: a => {
        const dirInfo = selectDirectory(ctx, a);
        const limit = Math.min(500, Math.max(1, a.limit ?? 100));
        const items = [];

        let entries;
        try {
          entries = readdirSync(dirInfo.physicalPath, { withFileTypes: true });
        } catch {
          entries = [];
        }

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(dirInfo.physicalPath, entry.name);

          if (entry.isDirectory()) {
            const rel = path.relative(ctx.root, fullPath).replace(/\\/g, '/');
            items.push({
              name: entry.name,
              repositoryDirectory: '/' + rel,
              type: 'directory'
            });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.kjb' || ext === '.ktr') {
              const id = ctx.repositoryPaths.fromPhysical(fullPath);
              items.push({
                name: id.name,
                repositoryPath: id.repositoryPath,
                artifactKind: id.artifactKind,
                type: 'artifact'
              });
            }
          }
        }

        const total = items.length;
        const resultItems = items.slice(0, limit);

        return {
          repositoryDirectory: dirInfo.repositoryDirectory,
          items: resultItems,
          total,
          truncated: total > limit
        };
      },
    },
    {
      name: 'kettle_repository_mkdir',
      title: 'Make repository directory',
      description: 'Create a contained directory inside the repository.',
      annotations: { title: 'Make repository directory', readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          repositoryDirectory: str("Repository directory path starting with '/' (e.g. '/xuat_user_active')")
        },
        required: ['repositoryDirectory'],
        additionalProperties: false,
      },
      handler: a => {
        const dirInfo = selectDirectory(ctx, { repositoryDirectory: a.repositoryDirectory });
        ctx.resolveWrite(dirInfo.physicalPath);
        mkdirSync(dirInfo.physicalPath, { recursive: true });
        return {
          repositoryDirectory: dirInfo.repositoryDirectory,
          physicalPath: dirInfo.physicalPath,
          created: true
        };
      },
    },
    {
      name: 'kettle_set_reference',
      title: 'Set executable artifact reference',
      description: 'Surgically rewrite a job entry or transformation step reference to target a repository artifact by path.',
      annotations: { title: 'Set executable artifact reference', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          elementName: str('Step or entry name to modify'),
          targetRepositoryPath: str("Target repository path starting with '/' (e.g. '/batch/sub_job')"),
          targetKind: { type: 'string', enum: ['job', 'trans'], description: 'Optional target kind' },
        },
        required: ['elementName', 'targetRepositoryPath'],
        additionalProperties: false,
      },
      handler: a => {
        const ownerId = selectArtifact(ctx, a, { write: true });
        const targetId = ctx.repositoryPaths.resolveArtifact({
          repositoryPath: a.targetRepositoryPath,
          artifactKind: a.targetKind
        }, { write: false });

        const before = readFileSync(ownerId.physicalPath, 'utf8');
        const after = rewriteReference(before, {
          ownerKind: ownerId.artifactKind,
          elementName: a.elementName,
          target: targetId,
        });

        validateXml(after, ownerId.physicalPath);
        writeFileSync(ownerId.physicalPath, after, 'utf8');

        return {
          repositoryPath: ownerId.repositoryPath,
          elementName: a.elementName,
          targetRepositoryPath: targetId.repositoryPath,
          targetKind: targetId.artifactKind,
          status: 'MANAGED_REPO_REFERENCE'
        };
      },
    },
    {
      name: 'kettle_repository_references',
      title: 'Inspect repository reference graph',
      description: 'Inspect incoming and outgoing executable artifact references.',
      annotations: { title: 'Inspect repository reference graph', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], default: 'outgoing', description: 'Reference direction to inspect' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Maximum edges to return' }
        },
        additionalProperties: false,
      },
      handler: a => {
        const scan = scanRepository(ctx);
        const direction = a.direction || 'outgoing';
        const limit = Math.min(500, Math.max(1, a.limit ?? 100));

        let edges = scan.edges;
        if (a.path || a.repositoryPath || a.artifactKind) {
          const targetId = selectArtifact(ctx, a, { write: false });
          edges = edges.filter(e => {
            const isOut = e.sourceRepositoryPath === targetId.repositoryPath && e.sourceArtifactKind === targetId.artifactKind;
            const isIn = e.targetRepositoryPath === targetId.repositoryPath && e.targetKind === targetId.artifactKind;
            if (direction === 'outgoing') return isOut;
            if (direction === 'incoming') return isIn;
            return isOut || isIn;
          });
        }

        const total = edges.length;
        return {
          direction,
          edges: edges.slice(0, limit),
          issues: scan.issues,
          total,
          truncated: total > limit,
          complete: scan.complete
        };
      },
    },
    {
      name: 'kettle_repository_move',
      title: 'Move/rename repository artifact',
      description: 'Move or rename an artifact, updating its internal name and incoming reference callers via a previewed transaction.',
      annotations: { title: 'Move/rename repository artifact', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema('source'),
          targetRepositoryPath: str("Target repository path starting with '/' (e.g. '/moved/sub_job')"),
          apply: { type: 'boolean', default: false, description: 'Apply proposed transaction (default preview only)' }
        },
        required: ['targetRepositoryPath'],
        additionalProperties: false,
      },
      handler: a => planArtifactMove(ctx, {
        sourcePath: a.sourcePath,
        sourceRepositoryPath: a.sourceRepositoryPath,
        sourceArtifactKind: a.sourceArtifactKind,
        targetRepositoryPath: a.targetRepositoryPath,
        apply: a.apply === true
      }),
    },
    {
      name: 'kettle_repository_migrate_references',
      title: 'Migrate legacy file references',
      description: 'Preview or apply migration of legacy file-path references to repository references.',
      annotations: { title: 'Migrate legacy file references', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...directorySelectorSchema(),
          apply: { type: 'boolean', default: false, description: 'Apply proposed migration (default preview only)' }
        },
        additionalProperties: false,
      },
      handler: a => planMigration(ctx, {
        repositoryDirectory: a.repositoryDirectory || '/',
        apply: a.apply === true
      }),
    },
    {
      name: 'kettle_repository_recover',
      title: 'Recover transaction',
      description: 'Explicitly roll back a detected incomplete or interrupted repository transaction.',
      annotations: { title: 'Recover transaction', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          transactionId: str('Transaction ID to roll back')
        },
        required: ['transactionId'],
        additionalProperties: false,
      },
      handler: a => recoverChanges(ctx, { transactionId: a.transactionId }),
    },
    {
      name: 'kettle_repository_detect',
      title: 'Detect effective PDI file repository',
      description: 'Detect matching PDI file repository definition in effective repositories.xml config files.',
      annotations: { title: 'Detect effective PDI file repository', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      handler: () => detectRepository(ctx),
    },
    {
      name: 'kettle_repository_register',
      title: 'Register repository in repositories.xml',
      description: 'Preview or apply explicit repository registration in effective repositories.xml config.',
      annotations: { title: 'Register repository in repositories.xml', readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Repository name to register (e.g. "my_file_repo")'),
          apply: { type: 'boolean', default: false, description: 'Apply registration immediately (default preview only)' }
        },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => planRegistration(ctx, { name: a.name, apply: a.apply === true }),
    },
  ];
}
