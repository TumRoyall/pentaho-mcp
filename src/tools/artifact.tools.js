/**
 * Artifact-level edit tools: replace the parameter list and copy a named
 * connection between artifacts. Both go through the shared workspace boundary
 * and return a unified diff of exactly what changed.
 */
import { setArtifactParameters, copyConnection } from '../core/artifact-edit.js';
import {
  artifactSelectorSchema,
  sourceDestArtifactSelectorSchema,
  selectArtifact,
} from './repository-schema.js';

const str = d => ({ type: 'string', description: d });

export function artifactTools(ctx) {
  return [
    {
      name: 'kettle_set_parameters',
      title: 'Set artifact parameters',
      description: 'Replace the artifact-level parameter list.',
      annotations: { title: 'Set artifact parameters', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          parameters: {
            type: 'array',
            description: 'Full replacement parameter list (order preserved).',
            items: {
              type: 'object',
              properties: {
                name: str('Parameter name (must be non-blank and unique)'),
                default: str('Default value (optional)'),
                description: str('Description (optional)'),
              },
              required: ['name'],
              additionalProperties: false,
            },
          },
        },
        required: ['parameters'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: setArtifactParameters(id.physicalPath, a.parameters) };
      },
    },
    {
      name: 'kettle_copy_connection',
      title: 'Copy connection',
      description: 'Copy one named top-level <connection> block from a source artifact into a destination artifact.',
      annotations: { title: 'Copy connection', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...sourceDestArtifactSelectorSchema(),
          sourceName: str('Name of the connection to copy from the source'),
          destName: str('Optional new name for the connection in the destination (defaults to sourceName)'),
          allowEncryptedPassword: {
            type: 'boolean',
            description: 'Opt in to copying a connection whose password is a Pentaho "Encrypted ..." string',
          },
        },
        required: ['sourceName'],
        additionalProperties: false,
      },
      handler: a => {
        const srcId = selectArtifact(ctx, a, { prefix: 'source', physicalKey: 'sourcePath', write: false });
        const destId = selectArtifact(ctx, a, { prefix: 'dest', physicalKey: 'destPath', write: true });
        return {
          diff: copyConnection(srcId.physicalPath, destId.physicalPath, a.sourceName, {
            destName: a.destName,
            allowEncryptedPassword: a.allowEncryptedPassword === true,
          }),
        };
      },
    },
  ];
}
