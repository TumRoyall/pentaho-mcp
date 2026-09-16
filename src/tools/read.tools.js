/** Read-only tools: inventory, summary, element detail, search. */
import { summarize, getElement } from '../core/summarize.js';
import { listArtifacts, search } from '../core/search.js';
import {
  artifactSelectorSchema,
  directorySelectorSchema,
  selectArtifact,
  selectDirectory
} from './repository-schema.js';

export function readTools(ctx) {
  const { root } = ctx;
  return [
    {
      name: 'kettle_list',
      title: 'List Kettle artifacts',
      description: 'Inventory of Kettle jobs/transformations under a directory (default: the workspace root)',
      annotations: { title: 'List Kettle artifacts', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { ...directorySelectorSchema() },
        additionalProperties: false
      },
      handler: a => {
        const { physicalPath } = selectDirectory(ctx, a);
        return listArtifacts(physicalPath);
      },
    },
    {
      name: 'kettle_summary',
      title: 'Summarize artifact',
      description: 'Summarize one job/transformation: elements with types, hop graph, connections, params, SQL previews',
      annotations: { title: 'Summarize artifact', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { ...artifactSelectorSchema() },
        additionalProperties: false
      },
      handler: a => {
        const id = selectArtifact(ctx, a);
        const res = summarize(id.physicalPath);
        return { repositoryPath: id.repositoryPath, artifactKind: id.artifactKind, ...res };
      },
    },
    {
      name: 'kettle_get_element',
      title: 'Get element detail',
      description: 'Full configuration of one named step/entry, including complete SQL (raw:true adds the raw XML)',
      annotations: { title: 'Get element detail', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          name: { type: 'string', description: 'Step/entry name' },
          raw: { type: 'boolean' }
        },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a);
        const res = getElement(id.physicalPath, a.name, a.raw === true);
        return { repositoryPath: id.repositoryPath, artifactKind: id.artifactKind, ...res };
      },
    },
    {
      name: 'kettle_search',
      title: 'Search artifacts',
      description: 'Search across all .kjb/.ktr files: free text, table (word-boundary), connection, variable, step_type, entry_type',
      annotations: { title: 'Search artifacts', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, description: 'What to search for' },
          kind: { type: 'string', enum: ['text', 'table', 'connection', 'variable', 'step_type', 'entry_type'] },
          ...directorySelectorSchema(),
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Maximum matches to return (1..500)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: a => {
        const { physicalPath } = selectDirectory(ctx, a);
        return search(root, a.query, a.kind ?? 'text', physicalPath, { limit: a.limit ?? 100 });
      },
    },
  ];
}
