/** Surgical edit tools. Each returns a unified diff of exactly what changed. */
import {
  createFile, addElement, setField, setFields, setFieldPath, editHops, addErrorHop, renameElement, cloneFile,
} from '../core/edit.js';
import {
  artifactSelectorSchema,
  sourceDestArtifactSelectorSchema,
  selectArtifact,
} from './repository-schema.js';

const str = d => ({ type: 'string', description: d });

export function editTools(ctx) {
  return [
    {
      name: 'kettle_create_file',
      title: 'Create Kettle file',
      description: 'Create a brand-new empty Kettle file from scratch (no source to clone). Kind is inferred from extension or artifactKind. Internal artifact name defaults to the filename stem or provided name. Refuses to overwrite an existing file.',
      annotations: { title: 'Create Kettle file', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          kind: { type: 'string', enum: ['job', 'trans'], description: 'Optional; must match the extension/artifactKind if given' },
          name: str('Optional internal artifact name; defaults to the filename without extension'),
        },
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return createFile(id.physicalPath, { kind: a.kind || id.artifactKind, name: a.name });
      },
    },
    {
      name: 'kettle_add_element',
      title: 'Add step/entry',
      description: 'Add a new step (trans) or entry (job) to a file, using the XML template from the knowledge base for the given type. Sets the element name. Returns diff, catalogStatus, and manualReviewRequired.',
      annotations: { title: 'Add step/entry', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          type: str('Kettle XML type, e.g. "ExcelOutput", "TableInput", "SQL"'),
          name: str('Name for the new step/entry'),
          x: { type: 'number', description: 'Optional GUI x location' },
          y: { type: 'number', description: 'Optional GUI y location' },
          allowObserved: {
            type: 'boolean',
            description: 'Allow an observed/ineligible catalog type and add a MANUAL_REVIEW marker',
          },
        },
        required: ['type', 'name'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return addElement(id.physicalPath, a.type, a.name, {
          x: a.x,
          y: a.y,
          allowObserved: a.allowObserved === true,
        });
      },
    },
    {
      name: 'kettle_set_field',
      title: 'Set field value',
      description: 'Set one child element value on a named step/entry; creates the child if absent (returns diff)',
      annotations: { title: 'Set field value', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          name: str('Step/entry name'),
          field: str('Child element tag'),
          value: str('New value'),
        },
        required: ['name', 'field', 'value'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: setField(id.physicalPath, a.name, a.field, a.value) };
      },
    },
    {
      name: 'kettle_set_field_path',
      title: 'Set nested field value',
      description: 'Set one value nested under a step/entry, addressed by a slash path of tag names (e.g. "file/sheetname"). Ancestors must exist; the leaf is created if absent. Returns diff.',
      annotations: { title: 'Set nested field value', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          name: str('Step/entry name'),
          fieldPath: str('Slash path of nested tag names, e.g. "file/sheetname"'),
          value: str('New value'),
        },
        required: ['name', 'fieldPath', 'value'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: setFieldPath(id.physicalPath, a.name, a.fieldPath, a.value) };
      },
    },
    {
      name: 'kettle_set_fields',
      title: 'Set repeatable field list',
      description: 'Fill a repeatable list of item blocks inside a step/entry (e.g. SelectValues <field>/<meta>, ExcelWriter <fields>). Learns each item\'s child tag order and defaults from the FIRST existing item in the template, then rebuilds the whole run from the given items.',
      annotations: { title: 'Set repeatable field list', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          name: str('Step/entry name'),
          listTag: str('Wrapping list tag, e.g. "fields"'),
          itemTag: str('Repeatable item tag inside the list, e.g. "field" or "meta"'),
          items: {
            type: 'array',
            description: 'One object per item; keys are child tag names, values are their text.',
            items: { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
        required: ['name', 'listTag', 'itemTag', 'items'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: setFields(id.physicalPath, a.name, a.listTag, a.itemTag, a.items) };
      },
    },
    {
      name: 'kettle_edit_hops',
      title: 'Edit hop',
      description: 'Add, remove, enable, or disable a hop between two named elements (returns diff).',
      annotations: { title: 'Edit hop', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          action: { type: 'string', enum: ['add', 'remove', 'enable', 'disable'] },
          from: str('Source element name'),
          to: str('Target element name'),
          evaluation: { type: 'string', enum: ['Y', 'N'], description: 'Job hops: follow on success (Y) or failure (N)' },
          unconditional: { type: 'string', enum: ['Y', 'N'], description: 'Job hops: always follow (auto-Y from START)' },
        },
        required: ['action', 'from', 'to'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return {
          diff: editHops(id.physicalPath, a.action, a.from, a.to, {
            evaluation: a.evaluation, unconditional: a.unconditional,
          }),
        };
      },
    },
    {
      name: 'kettle_add_error_hop',
      title: 'Add error hop',
      description: 'Add transformation error handling: route error rows of source step into target step.',
      annotations: { title: 'Add error hop', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          source: str('Step whose error rows are routed out'),
          target: str('Step that receives the error rows'),
          enabled: { type: 'boolean', description: 'Is error handling enabled? Default true' },
          nrErrorsField: str('Field name to hold the number of errors (optional)'),
          errorDescField: str('Field name to hold error description(s) (optional)'),
          errorFieldsField: str('Field name to hold the fields in error (optional)'),
          errorCodesField: str('Field name to hold error code(s) (optional)'),
          maxErrors: str('Max errors before a hard stop (optional)'),
          maxPctErrors: str('Max percent errors before a hard stop (optional)'),
          minPctRows: str('Min rows read before percent evaluation (optional)'),
        },
        required: ['source', 'target'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return {
          diff: addErrorHop(id.physicalPath, a.source, a.target, {
            enabled: a.enabled,
            nrErrorsField: a.nrErrorsField,
            errorDescField: a.errorDescField,
            errorFieldsField: a.errorFieldsField,
            errorCodesField: a.errorCodesField,
            maxErrors: a.maxErrors,
            maxPctErrors: a.maxPctErrors,
            minPctRows: a.minPctRows,
          }),
        };
      },
    },
    {
      name: 'kettle_rename_element',
      title: 'Rename element',
      description: 'Rename a step/entry and update every hop that references it (returns diff)',
      annotations: { title: 'Rename element', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...artifactSelectorSchema(),
          oldName: str('Current name'),
          newName: str('New name'),
        },
        required: ['oldName', 'newName'],
        additionalProperties: false,
      },
      handler: a => {
        const id = selectArtifact(ctx, a, { write: true });
        return { diff: renameElement(id.physicalPath, a.oldName, a.newName) };
      },
    },
    {
      name: 'kettle_clone',
      title: 'Clone artifact',
      description: 'Copy an existing .kjb/.ktr as a template: sets internal name and applies substitutions',
      annotations: { title: 'Clone artifact', readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          ...sourceDestArtifactSelectorSchema(),
          name: str('Internal name for the new artifact'),
          replacements: {
            type: 'array',
            items: {
              type: 'object',
              properties: { find: str('Literal text to find'), replace: str('Replacement text') },
              required: ['find', 'replace'],
              additionalProperties: false,
            },
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => {
        const srcId = selectArtifact(ctx, a, { prefix: 'source', physicalKey: 'sourcePath', write: false });
        const destId = selectArtifact(ctx, a, { prefix: 'dest', physicalKey: 'destPath', write: true });
        return cloneFile(srcId.physicalPath, destId.physicalPath, a.name, a.replacements ?? []);
      },
    },
  ];
}
