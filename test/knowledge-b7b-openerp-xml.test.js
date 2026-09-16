import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  findByXmlType, getReference, isGeneratorEligible, verifiedVersions,
} from '../src/knowledge/loader.js';
import { addElement, setFields, setFieldPath } from '../src/core/edit.js';
import { validateFile } from '../src/core/validate.js';
import { knowledgeCoverage } from '../src/core/knowledge-coverage.js';

// Batch B7b (DEPRECATED trans steps, read/maintain only — never generate new):
// trans OpenERPObjectInput, trans OpenERPObjectOutputImport,
// trans OpenERPObjectDelete, trans XMLInput, trans XMLInputSax,
// trans GPBulkLoader, trans LucidDBStreamingLoader.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b7b-source-notes.md.
//
// B7 rule (differs from B2a/B2b/B6): every ID in this batch is DEPRECATED in
// source, so the catalog row is status=observed + generator_eligible=false
// (verification stays source_reviewed). isGeneratorEligible() must be FALSE;
// addElement() therefore requires { allowObserved: true } and stamps the
// MANUAL_REVIEW marker (catalogStatus 'observed', manualReviewRequired true).
//
// Grounding (all at the pinned commit):
// - trans OpenERPObjectInput -> objectinput/OpenERPObjectInputMeta,
//   @Step(id="OpenERPObjectInput", deprecated.svg, Category.Deprecated).
//   getXML() emits connection, modelName, readBatchSize, <mappings>
//   (mapping: source_model, source_field, source_index, target_model,
//   target_field, target_field_label, target_field_type), <filters>
//   (filter: operator, field_name, comparator, value).
// - trans OpenERPObjectOutputImport -> objectoutput/OpenERPObjectOutputMeta,
//   @Step(id="OpenERPObjectOutputImport", deprecated.svg, Category.Deprecated).
//   NOTE the XML type is OpenERPObjectOutputImport, not OpenERPObjectOutput.
//   getXML() emits connection, modelName, readBatchSize (holding
//   commitBatchSize), outputIDField (Y/N), outputIDFieldName, <mappings>
//   (mapping: model_field, stream_field), <key_mappings> (key_map:
//   model_key_field, comparitor [sic], stream_key_field).
// - trans OpenERPObjectDelete -> objectdelete/OpenERPObjectDeleteMeta,
//   @Step(id="OpenERPObjectDelete", deprecated.svg, Category.Deprecated).
//   getXML() emits exactly connection, modelName, readBatchSize (holding
//   commitBatchSize), idFieldName.
// - trans XMLInput -> xmlinput/XMLInputMeta, @Step(id="XMLInput",
//   Category.Deprecated). getXML() emits include, include_field, rownum,
//   rownum_field, file_base_uri, ignore_entities, namespace_aware, <file>
//   (name+filemask pairs), <fields> (XMLInputField.getXML: name, type,
//   format, currency, decimal, group, length, precision, trim_type CODE,
//   repeat, nested positions), <positions>, limit, skip.
// - trans XMLInputSax -> xmlinputsax/XMLInputSaxMeta, @Step(id="XMLInputSax",
//   Category.Deprecated). getXML() emits include, include_field, rownum,
//   rownum_field, <file>, <def_attributes> (def_element+def_attribute),
//   <fields> (trim_type DESC, not code), <positions>, limit. NO
//   file_base_uri/ignore_entities/namespace_aware/skip.
// - trans GPBulkLoader -> gpbulkloader/GPBulkLoaderMeta,
//   @Step(id="GPBulkLoader", deprecated.svg, Category.Deprecated +
//   suggestion). getXML() emits connection, errors, schema, table,
//   load_method, load_action, PsqlPath, control_file, data_file, log_file,
//   erase_files, encoding, dbname_override, then <mapping> items DIRECTLY
//   under <step> (stream_name, field_name, date_mask) — no wrapper.
// - trans LucidDBStreamingLoader ->
//   luciddbstreamingloader/LucidDBStreamingLoaderMeta,
//   @Step(id="LucidDBStreamingLoader", deprecated.svg, Category.Deprecated +
//   suggestion). getXML() emits connection, schema, table, host, port,
//   operation, custom_sql, then <keys_mapping>, <fields_mapping>,
//   <tab_is_enable_mapping> items DIRECTLY under <step> — no wrappers.
const BATCH = [
  { kind: 'trans', xmlType: 'OpenERPObjectInput', alias: 'OPENERP_OBJECT_INPUT' },
  { kind: 'trans', xmlType: 'OpenERPObjectOutputImport', alias: 'OPENERP_OBJECT_OUTPUT_IMPORT' },
  { kind: 'trans', xmlType: 'OpenERPObjectDelete', alias: 'OPENERP_OBJECT_DELETE' },
  { kind: 'trans', xmlType: 'XMLInput', alias: 'XML_INPUT' },
  { kind: 'trans', xmlType: 'XMLInputSax', alias: 'XML_INPUT_SAX' },
  { kind: 'trans', xmlType: 'GPBulkLoader', alias: 'GP_BULK_LOADER' },
  { kind: 'trans', xmlType: 'LucidDBStreamingLoader', alias: 'LUCID_DB_STREAMING_LOADER' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<connection>') appears in `block` after
// the previous one, mirroring the emission order of the source getXML().
function assertTagOrder(block, order, label) {
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + '(?:\\s|/?>)'));
    assert.ok(i > at, `${label}: ${tag} must follow source getXML() order`);
    at = i;
  }
}

let tmp;
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b7b-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b7b') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // Declare the ${CONN} connection the DB-backed deprecated steps reference
    // so the structural validator's undefined-connection rule is satisfied.
    '  <connection><name>${CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

test('B7b catalog rows exist, are observed (DEPRECATED), and are NOT generator-eligible', () => {
  for (const { kind, xmlType, alias } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.type, alias, `${xmlType} design alias`);
    assert.equal(entry.status, 'observed', `${xmlType} must be observed (deprecated in source 9.4)`);
    assert.equal(entry.generator_eligible, false, `${xmlType} must NOT be generator-eligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), false, `${xmlType} eligibility must be false`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${xmlType} verification`);
  }
});

test('B7b references resolve and their first XML block is one valid step with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B7b templates insert only with allowObserved, stamp MANUAL_REVIEW, escape names, validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = minimalKtr(`b7b-${xmlType.toLowerCase()}`);
    assert.throws(
      () => addElement(file, xmlType, `New ${xmlType}`),
      /not generator-eligible/,
      `${xmlType} must refuse insert without allowObserved`,
    );
    const out = addElement(file, xmlType, `New ${xmlType} & <Item>`, { allowObserved: true });
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.match(after, new RegExp(`MANUAL_REVIEW: ${xmlType} is observed-only`),
      `${xmlType} observed insert must stamp MANUAL_REVIEW`);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'observed');
    assert.equal(out.manualReviewRequired, true);
  }
});

test('OpenERPObjectInput template follows getXML: connection, modelName, readBatchSize, mappings, filters', () => {
  // OpenERPObjectInputMeta.getXML() (lines 105-139) emits connection,
  // modelName, readBatchSize, then a PAIRED <mappings> wrapper (always
  // emitted, even empty) holding <mapping> items with source_model,
  // source_field, source_index, target_model, target_field,
  // target_field_label, target_field_type, then a PAIRED <filters> wrapper
  // holding <filter> items (operator, field_name, comparator, value).
  // setDefault() (lines 220-223) is EMPTY: a new step keeps readBatchSize
  // 1000 (field initializer, line 60) and empty lists.
  const ref = getReference('trans', 'OpenERPObjectInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<modelName>', '<readBatchSize>', '<mappings>', '<mapping>', '<filters>', '<filter>'],
    'OpenERPObjectInput');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'OpenERPObjectInput template must carry <connection> (OpenERP DatabaseMeta reference)');
  assert.equal(parsed.step.readBatchSize, 1000, 'readBatchSize defaults 1000 (field initializer)');
  assert.ok(block.includes('</mappings>') && block.includes('</filters>'),
    'mappings/filters wrappers must be paired per getXML()');
  assert.equal(parsed.step.mappings.mapping.target_field_type, 2,
    'target_field_type is a numeric value-meta id, not a name string');

  // Non-default configuration: model plus one extra mapping and filter.
  const file = minimalKtr('b7b-openerp-input');
  addElement(file, 'OpenERPObjectInput', 'Read partners', { allowObserved: true });
  setFieldPath(file, 'Read partners', 'connection', '${CONN}');
  setFieldPath(file, 'Read partners', 'modelName', 'res.partner');
  setFields(file, 'Read partners', 'mappings', 'mapping', [
    {
      source_model: 'res.partner', source_field: 'name', source_index: 0,
      target_model: 'res.partner', target_field: 'PARTNER_NAME',
      target_field_label: 'Name', target_field_type: 2,
    },
    {
      source_model: 'res.partner', source_field: 'email', source_index: 0,
      target_model: 'res.partner', target_field: 'PARTNER_EMAIL',
      target_field_label: 'Email', target_field_type: 2,
    },
  ]);
  setFields(file, 'Read partners', 'filters', 'filter', [
    {
      operator: 'AND', field_name: 'customer', comparator: '=', value: 'True',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<modelName>res\.partner<\/modelName>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read partners');
  assert.ok(step, 'inserted step present');
  const maps = Array.isArray(step.mappings.mapping) ? step.mappings.mapping : [step.mappings.mapping];
  assert.equal(maps.length, 2);
  assert.equal(maps[1].target_field, 'PARTNER_EMAIL');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('OpenERPObjectOutputImport template follows getXML: readBatchSize holds commitBatchSize, comparitor spelling', () => {
  // OpenERPObjectOutputMeta.getXML() (lines 94-124) emits connection,
  // modelName, readBatchSize (HOLDING commitBatchSize, line 100 — the XML
  // tag is NOT commitBatchSize), outputIDField (Y/N), outputIDFieldName,
  // then PAIRED <mappings> (mapping: model_field, stream_field) and PAIRED
  // <key_mappings> (key_map: model_key_field, comparitor [sic],
  // stream_key_field). The XML type is OpenERPObjectOutputImport, not
  // OpenERPObjectOutput. Missing <outputIDField> NPEs on load (line 210).
  const ref = getReference('trans', 'OpenERPObjectOutputImport');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<modelName>', '<readBatchSize>', '<outputIDField>', '<outputIDFieldName>',
      '<mappings>', '<mapping>', '<key_mappings>', '<key_map>'],
    'OpenERPObjectOutputImport');
  assert.equal(parsed.step.type, 'OpenERPObjectOutputImport');
  assert.ok(!parsed.step.commitBatchSize,
    'template must use the <readBatchSize> tag name, never <commitBatchSize>');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'outputIDField'),
    'outputIDField must always be present (missing tag NPEs on load)');
  assert.match(block, /<comparitor>/, 'key_map comparator tag keeps the source spelling "comparitor"');
  assert.ok(!block.includes('<comparator>'),
    'template must not use the <comparator> spelling (source tag is <comparitor>)');

  // Non-default configuration: commit batch plus output ID column.
  const file = minimalKtr('b7b-openerp-output');
  addElement(file, 'OpenERPObjectOutputImport', 'Write partners', { allowObserved: true });
  setFieldPath(file, 'Write partners', 'connection', '${CONN}');
  setFieldPath(file, 'Write partners', 'modelName', 'res.partner');
  setFieldPath(file, 'Write partners', 'readBatchSize', '500');
  setFieldPath(file, 'Write partners', 'outputIDField', 'Y');
  setFieldPath(file, 'Write partners', 'outputIDFieldName', 'OERP_ID');
  setFields(file, 'Write partners', 'mappings', 'mapping', [
    { model_field: 'name', stream_field: 'PARTNER_NAME' },
    { model_field: 'email', stream_field: 'PARTNER_EMAIL' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<readBatchSize>500<\/readBatchSize>/);
  assert.match(after, /<outputIDField>Y<\/outputIDField>/);
  assert.match(after, /<outputIDFieldName>OERP_ID<\/outputIDFieldName>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('OpenERPObjectDelete template follows getXML: exactly connection, modelName, readBatchSize, idFieldName', () => {
  // OpenERPObjectDeleteMeta.getXML() (lines 67-77) emits exactly four scalar
  // tags, no list wrappers. readBatchSize holds commitBatchSize (line 73);
  // setDefault() is empty (lines 113-116), the new-step default 1000 comes
  // from the field initializer (line 49).
  const ref = getReference('trans', 'OpenERPObjectDelete');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<modelName>', '<readBatchSize>', '<idFieldName>'],
    'OpenERPObjectDelete');
  assert.equal(parsed.step.readBatchSize, 1000, 'readBatchSize defaults 1000 (field initializer)');
  assert.ok(!parsed.step.mappings && !parsed.step.filters,
    'delete template must not invent mappings/filters wrappers');

  // Non-default configuration: model plus id column.
  const file = minimalKtr('b7b-openerp-delete');
  addElement(file, 'OpenERPObjectDelete', 'Delete partners', { allowObserved: true });
  setFieldPath(file, 'Delete partners', 'connection', '${CONN}');
  setFieldPath(file, 'Delete partners', 'modelName', 'res.partner');
  setFieldPath(file, 'Delete partners', 'readBatchSize', '500');
  setFieldPath(file, 'Delete partners', 'idFieldName', 'OERP_ID');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<modelName>res\.partner<\/modelName>/);
  assert.match(after, /<readBatchSize>500<\/readBatchSize>/);
  assert.match(after, /<idFieldName>OERP_ID<\/idFieldName>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XMLInput template follows getXML: flags, file pairs, fields with nested positions, loop positions, limit, skip', () => {
  // XMLInputMeta.getXML() (lines 277-313) emits include, include_field,
  // rownum, rownum_field, file_base_uri, ignore_entities, namespace_aware,
  // <file> (name+filemask pairs by shared index), <fields>
  // (XMLInputField.getXML: name, type desc string, format, currency,
  // decimal, group, length, precision, trim_type CODE, repeat, nested
  // positions), <positions> (loop path), limit, skip. All three wrappers
  // always emitted. setDefault() (lines 370-400): all flags false, 0
  // files/fields/positions, limit 0, skip 0.
  const ref = getReference('trans', 'XMLInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include>', '<include_field>', '<rownum>', '<rownum_field>', '<file_base_uri>',
      '<ignore_entities>', '<namespace_aware>', '<file>', '<fields>', '<positions>',
      '<limit>', '<skip>'],
    'XMLInput');
  assert.ok(!Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'XMLInput template must not carry <connection> (no DB reference)');
  assert.equal(parsed.step.file.name, '${XML_FILE}');
  assert.equal(parsed.step.fields.field.trim_type, 'none',
    'trim_type is a CODE (none/left/right/both), unlike XMLInputSax');
  assert.equal(parsed.step.limit, 0, 'limit defaults 0 (no limit)');
  assert.equal(parsed.step.skip, 0, 'skip defaults 0');

  // Non-default configuration: include filename plus a retyped field.
  // NOTE: the field list is NOT driven with setFields() here: each <field>
  // carries a NESTED <positions> block and setFields() would flatten it into
  // escaped text. setFieldPath() keeps the nested markup real.
  const file = minimalKtr('b7b-xmlinput');
  addElement(file, 'XMLInput', 'Read orders xml', { allowObserved: true });
  setFieldPath(file, 'Read orders xml', 'include', 'Y');
  setFieldPath(file, 'Read orders xml', 'include_field', 'FILENAME');
  setFieldPath(file, 'Read orders xml', 'limit', '100');
  setFieldPath(file, 'Read orders xml', 'fields/field/name', 'ORDER_TOTAL');
  setFieldPath(file, 'Read orders xml', 'fields/field/type', 'Number');
  setFieldPath(file, 'Read orders xml', 'fields/field/format', '#.00');
  setFieldPath(file, 'Read orders xml', 'fields/field/trim_type', 'both');
  setFieldPath(file, 'Read orders xml', 'fields/field/positions/position', 'customer/total');
  setFieldPath(file, 'Read orders xml', 'positions/position', 'orders/order');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<include>Y<\/include>/);
  assert.match(after, /<include_field>FILENAME<\/include_field>/);
  assert.match(after, /<limit>100<\/limit>/);
  assert.match(after, /<name>ORDER_TOTAL<\/name>/);
  assert.match(after, /<trim_type>both<\/trim_type>/);
  // Nested field positions must stay REAL markup (not escaped text).
  assert.match(after, /<positions>\s*<position>customer\/total<\/position>\s*<\/positions>/);
  assert.match(after, /<positions>\s*<position>orders\/order<\/position>\s*<\/positions>/);
  assert.doesNotMatch(after, /{{(XML_PATH|LOOP_PATH|FIELD_NAME)}}/,
    'configured paths must not leak placeholders (GUI {{X}}/{{Y}} pinning is out of scope)');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XMLInputSax template follows getXML: def_attributes present, no base-uri/skip tags', () => {
  // XMLInputSaxMeta.getXML() (lines 258-297) emits include, include_field,
  // rownum, rownum_field, <file>, <def_attributes> (def_element +
  // def_attribute pairs), <fields> (trim_type DESC via getTrimTypeDesc),
  // <positions>, limit. There is NO file_base_uri, ignore_entities,
  // namespace_aware, or skip tag.
  const ref = getReference('trans', 'XMLInputSax');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include>', '<include_field>', '<rownum>', '<rownum_field>', '<file>',
      '<def_attributes>', '<fields>', '<positions>', '<limit>'],
    'XMLInputSax');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'def_attributes'),
    'XMLInputSax template must carry <def_attributes> (SAX identifying attributes)');
  assert.ok(!block.includes('<file_base_uri>') && !block.includes('<skip>')
    && !block.includes('<ignore_entities>') && !block.includes('<namespace_aware>'),
    'XMLInputSax template must not copy XMLInput-only tags');
  assert.ok(!Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'XMLInputSax template must not carry <connection>');

  // Non-default configuration: def attribute plus a retyped field.
  // Same setFields() caveat as XMLInput (nested <positions> per field):
  // configure via setFieldPath() so nested markup stays real.
  const file = minimalKtr('b7b-xmlinputsax');
  addElement(file, 'XMLInputSax', 'Stream orders xml', { allowObserved: true });
  setFieldPath(file, 'Stream orders xml', 'limit', '50');
  setFieldPath(file, 'Stream orders xml', 'def_attributes/def_element', 'order');
  setFieldPath(file, 'Stream orders xml', 'def_attributes/def_attribute', 'id');
  setFieldPath(file, 'Stream orders xml', 'fields/field/name', 'ORDER_ID');
  setFieldPath(file, 'Stream orders xml', 'fields/field/type', 'Integer');
  setFieldPath(file, 'Stream orders xml', 'fields/field/positions/position', 'order/id');
  setFieldPath(file, 'Stream orders xml', 'positions/position', 'orders/order');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<limit>50<\/limit>/);
  assert.match(after, /<def_element>order<\/def_element>/);
  assert.match(after, /<def_attribute>id<\/def_attribute>/);
  assert.match(after, /<name>ORDER_ID<\/name>/);
  assert.match(after, /<positions>\s*<position>order\/id<\/position>\s*<\/positions>/);
  assert.doesNotMatch(after, /{{(XML_PATH|LOOP_PATH|FIELD_NAME|ELEMENT|ATTRIBUTE)}}/,
    'configured paths must not leak placeholders (GUI {{X}}/{{Y}} pinning is out of scope)');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GPBulkLoader template follows getXML: 13 scalar tags then direct-child mapping items', () => {
  // GPBulkLoaderMeta.getXML() (lines 326-354) emits connection, errors,
  // schema, table, load_method, load_action, PsqlPath, control_file,
  // data_file, log_file, erase_files (Y/N), encoding, dbname_override, then
  // <mapping> items DIRECTLY under <step> (stream_name = TABLE column,
  // field_name = stream column, date_mask DATE/DATETIME else "") — there is
  // NO <mappings> wrapper (readData counts countNodes(stepnode,
  // "mapping"), line 274). setDefault() (lines 304-323): errors 50,
  // AUTO_END/APPEND, eraseFiles true, 0 mappings.
  const ref = getReference('trans', 'GPBulkLoader');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<errors>', '<schema>', '<table>', '<load_method>', '<load_action>',
      '<PsqlPath>', '<control_file>', '<data_file>', '<log_file>', '<erase_files>',
      '<encoding>', '<dbname_override>', '<mapping>'],
    'GPBulkLoader');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'GPBulkLoader template must carry <connection> (Greenplum DatabaseMeta reference)');
  assert.ok(!parsed.step.mappings,
    'GPBulkLoader template must not invent a <mappings> wrapper (mappings are direct children)');
  assert.equal(parsed.step.errors, 50, 'errors defaults 50');
  assert.equal(parsed.step.load_method, 'AUTO_END', 'load_method defaults AUTO_END');
  assert.equal(parsed.step.load_action, 'APPEND', 'load_action defaults APPEND');
  assert.equal(parsed.step.erase_files, 'Y', 'erase_files defaults Y (setDefault true)');
  assert.equal(parsed.step.mapping.stream_name, '{{STREAM_FIELD}}');
  assert.equal(parsed.step.mapping.date_mask, '', 'date_mask defaults empty');

  // Non-default configuration: TRUNCATE action, keep files, zero error
  // tolerance (mappings stay direct children — template shape unchanged).
  const file = minimalKtr('b7b-gpload');
  addElement(file, 'GPBulkLoader', 'Bulk load facts', { allowObserved: true });
  setFieldPath(file, 'Bulk load facts', 'connection', '${CONN}');
  setFieldPath(file, 'Bulk load facts', 'schema', '${SCHEMA}');
  setFieldPath(file, 'Bulk load facts', 'table', 'FACT_ORDERS');
  setFieldPath(file, 'Bulk load facts', 'load_action', 'TRUNCATE');
  setFieldPath(file, 'Bulk load facts', 'erase_files', 'N');
  setFieldPath(file, 'Bulk load facts', 'errors', '0');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<table>FACT_ORDERS<\/table>/);
  assert.match(after, /<load_action>TRUNCATE<\/load_action>/);
  assert.match(after, /<erase_files>N<\/erase_files>/);
  assert.match(after, /<errors>0<\/errors>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('LucidDBStreamingLoader template follows getXML: scalars then direct-child keys/fields/tab mappings', () => {
  // LucidDBStreamingLoaderMeta.getXML() (lines 274-309) emits connection,
  // schema, table, host, port, operation, custom_sql, then <keys_mapping>
  // (key_field_name, key_stream_name), <fields_mapping>
  // (field_field_name, field_stream_name, insert_or_update_flag Y/N), and
  // <tab_is_enable_mapping> (tab_is_enable Y/N) items DIRECTLY under <step>
  // — no wrappers (readData counts countNodes(stepnode, ...) directly,
  // lines 220-222). setDefault() (lines 264-272): host localhost, port
  // 9034, operation MERGE, 0 mappings.
  const ref = getReference('trans', 'LucidDBStreamingLoader');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<schema>', '<table>', '<host>', '<port>', '<operation>',
      '<custom_sql>', '<keys_mapping>', '<fields_mapping>', '<tab_is_enable_mapping>'],
    'LucidDBStreamingLoader');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'LucidDBStreamingLoader template must carry <connection> (LucidDB DatabaseMeta reference)');
  assert.equal(parsed.step.operation, 'MERGE', 'operation defaults MERGE');
  assert.equal(parsed.step.fields_mapping.insert_or_update_flag, 'Y');
  assert.ok(!parsed.step.keys_mappings && !parsed.step.fields_mappings,
    'template must use the singular direct-child tag names (no wrappers)');

  // Non-default configuration: INSERT operation, placeholder endpoint,
  // escaped custom SQL (proves < and & escaping for free-text tags).
  const file = minimalKtr('b7b-luciddb');
  addElement(file, 'LucidDBStreamingLoader', 'Stream load dims', { allowObserved: true });
  setFieldPath(file, 'Stream load dims', 'connection', '${CONN}');
  setFieldPath(file, 'Stream load dims', 'schema', '${SCHEMA}');
  setFieldPath(file, 'Stream load dims', 'table', 'DIM_CUSTOMER');
  setFieldPath(file, 'Stream load dims', 'host', '${LUCID_HOST}');
  setFieldPath(file, 'Stream load dims', 'port', '${LUCID_PORT}');
  setFieldPath(file, 'Stream load dims', 'operation', 'INSERT');
  setFieldPath(file, 'Stream load dims', 'custom_sql', 'SELECT * FROM t WHERE a < b & c');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<operation>INSERT<\/operation>/);
  assert.match(after, /<host>\$\{LUCID_HOST\}<\/host>/);
  assert.match(after, /<custom_sql>SELECT \* FROM t WHERE a &lt; b &amp; c<\/custom_sql>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B7b package as observed with nothing missing', () => {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b7b-package</name></info>',
    ...BATCH.map(({ xmlType }, i) => `<step><name>Deprecated ${i}</name><type>${xmlType}</type></step>`),
    '<order/></transformation>',
  ];
  const ktr = path.join(tmp, 'b7b-package.ktr');
  writeFileSync(ktr, lines.join('\n'));
  const report = knowledgeCoverage(tmp);
  for (const { xmlType } of BATCH) {
    const row = report.types.find((t) => t.xmlType === xmlType);
    assert.ok(row, `${xmlType} covered`);
    assert.equal(row.status, 'observed', `${xmlType} observed (deprecated)`);
    assert.equal(row.generatorEligible, false, `${xmlType} not eligible`);
  }
  assert.equal(report.summary.missing, 0);
});
