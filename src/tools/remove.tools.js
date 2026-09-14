/** Reference-safe removal tools. Each returns a unified diff of what changed. */
import { removeElement, editErrorHop } from '../core/remove.js';
import {
  artifactSelectorSchema,
  selectArtifact,
} from './repository-schema.js';

const str = d => ({ type: 'string', description: d });

export function removeTools(ctx) {
  return [
    {
      name: 'kettle_remove_element',
      title: 'Remove element',
      description: 'Remove a named step (trans) or entry (job). By default refuses when any hop, error-hop, or known step-reference tag still points to the element.',
      annotations: { title: 'Remove element', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          name: str('Step/entry name to remove'),
          removeReferences: {
            type: 'boolean',
            description: 'Cascade: also remove referencing hops/error blocks and blank step-reference tags (default false)',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return {
          diff: removeElement(id.physicalPath, a.name, { removeReferences: a.removeReferences === true }),
        };
      },
    },
    {
      name: 'kettle_edit_error_hop',
      title: 'Edit error hop',
      description: 'Enable, disable, or remove the transformation error block whose source step matches.',
      annotations: { title: 'Edit error hop', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          action: { type: 'string', enum: ['enable', 'disable', 'remove'], description: 'Operation to perform on the error block' },
          source: str('Source step whose error block is edited'),
        },
        required: ['action', 'source'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: editErrorHop(id.physicalPath, a.action, a.source) };
      },
    },
  ];
}
