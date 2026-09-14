/**
 * Validation tool. Composes structural validation and catalog checks.
 */
import { validateFile, validateAll } from '../core/validate.js';
import { loadModel } from '../core/model.js';
import { checkCatalogTypes } from '../knowledge/catalog-check.js';
import {
  artifactSelectorSchema,
  directorySelectorSchema,
  selectArtifact,
  selectDirectory,
} from './repository-schema.js';

const str = d => ({ type: 'string', description: d });

function recount(report) {
  report.summary = {
    errors: report.issues.filter(i => i.severity === 'error').length,
    warnings: report.issues.filter(i => i.severity === 'warning').length,
    info: report.issues.filter(i => i.severity === 'info').length,
  };
  return report;
}

function validateWithCatalog(filePath) {
  const report = validateFile(filePath);
  try {
    const model = loadModel(filePath);
    report.issues.push(...checkCatalogTypes(model));
    recount(report);
  } catch {
    // structural error already recorded
  }
  return report;
}

export function validateTools(ctx) {
  const { root } = ctx;
  return [
    {
      name: 'kettle_validate',
      title: 'Validate artifact',
      description: 'Lint one file or directory tree (default KETTLE_ROOT). Checks structure plus knowledge-catalog type coverage.',
      annotations: { title: 'Validate artifact', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          ...directorySelectorSchema(),
          checkCatalog: { type: 'boolean', description: 'Include knowledge-catalog type check (default true)' },
        },
        additionalProperties: false,
      },
      handler: a => {
        const withCatalog = a.checkCatalog !== false;
        const hasArtifactSelector = Boolean(a.path || a.repositoryPath || a.artifactKind);
        const hasDirSelector = Boolean(a.directory || a.repositoryDirectory);

        if (hasArtifactSelector && hasDirSelector) {
          throw new Error('Cannot specify both artifact selector and directory selector in kettle_validate');
        }

        if (hasArtifactSelector) {
          const id = selectArtifact(ctx, a);
          const report = withCatalog ? validateWithCatalog(id.physicalPath) : validateFile(id.physicalPath);
          return { repositoryPath: id.repositoryPath, artifactKind: id.artifactKind, ...report };
        }

        const { physicalPath } = selectDirectory(ctx, a);
        const all = validateAll(physicalPath);
        if (!withCatalog) return all;
        for (const report of all.files) {
          try {
            report.issues.push(...checkCatalogTypes(loadModel(report.path)));
            recount(report);
          } catch { /* structural error already recorded */ }
        }
        const summary = { files: all.summary.files, errors: 0, warnings: 0, info: 0 };
        for (const r of all.files) {
          summary.errors += r.summary.errors;
          summary.warnings += r.summary.warnings;
          summary.info += r.summary.info;
        }
        all.summary = summary;
        return all;
      },
    },
  ];
}
