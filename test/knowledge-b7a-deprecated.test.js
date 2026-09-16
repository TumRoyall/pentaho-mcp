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

// Batch B7a (deprecated trans steps, read/maintain only): 7 IDs.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b7a-source-notes.md.
//
// B7 policy (differs from earlier batches): deprecated components stay
// status=observed + generator_eligible=false (source_reviewed evidence,
// no new generation). addElement() therefore requires allowObserved:true
// and marks the insert MANUAL_REVIEW.
//
// Grounding (all at the pinned commit; registry = kettle-steps.xml line or
// @Step annotation; serializer = Meta.getXML lines):
// - trans AggregateRows (AggregateRowsMeta, @Step id="AggregateRows"):
//   fields/field[name,rename,type-as-i18n-string]; getType unknown->NONE.
// - trans DummyStep (DummyPluginMeta, @Step id="DummyStep", NOT trans
//   Dummy): values/value[name,type,text,length,precision,isnull,mask] via
//   ValueMetaAndData; setDefault Number valuename=123.456 len 12 prec 4.
// - trans OldTextFileInput (textfileinput.TextFileInputMeta, ks.xml:8,
//   replacement TextFileInput): accept_* + separator..encoding +
//   add_to_result_filenames + file/name.. + file/type,compression +
//   filters + 13-tag fields + limit + error-handling + locale + 8 cols.
// - trans Script (ScriptMeta, ks.xml:102, replacement JavaScriptMod):
//   jsScripts/jsScript[jsScript_type INT,jsScript_name,jsScript_script] +
//   fields/field[name,rename,type-STRING,length,precision,replace].
// - trans TextFileOutputLegacy (TextFileOutputLegacyMeta, ks.xml:19,
//   replacement TextFileOutput): parent TextFileOutputMeta tags + trailing
//   file/is_command; extention spelling; SpecifyFormat capitals.
// - trans GetPreviousRowField (GetPreviousRowFieldMeta, @Step):
//   fields/field[in_stream_name,out_stream_name]; schema NOT serialized.
// - trans ElasticSearchBulk (ElasticSearchBulkMeta, @Step):
//   general[index,type,batchSize,timeout,timeoutUnit,isJson,(jsonField?),
//   (idOutputField?),(idField?),overwriteIfExists,useOutput,stopOnError]
//   + fields/field[columnName,targetName] + servers/server[address,port]
//   + settings/setting[name,value]; bools case-sensitive "Y".equals.
const BATCH = [
  { kind: 'trans', xmlType: 'AggregateRows', alias: 'AGGREGATE_ROWS' },
  { kind: 'trans', xmlType: 'DummyStep', alias: 'DUMMY_STEP' },
  { kind: 'trans', xmlType: 'OldTextFileInput', alias: 'OLD_TEXT_FILE_INPUT' },
  { kind: 'trans', xmlType: 'Script', alias: 'SCRIPT_DEPRECATED' },
  { kind: 'trans', xmlType: 'TextFileOutputLegacy', alias: 'TEXT_FILE_OUTPUT_LEGACY' },
  { kind: 'trans', xmlType: 'GetPreviousRowField', alias: 'GET_PREVIOUS_ROW_FIELD' },
  { kind: 'trans', xmlType: 'ElasticSearchBulk', alias: 'ELASTIC_SEARCH_BULK' },
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

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b7a-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b7a') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

test('B7a catalog rows exist, are observed source_reviewed 9.4, and are NOT generator-eligible', () => {
  for (const { kind, xmlType, alias } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.type, alias, `${xmlType} design alias`);
    assert.equal(entry.status, 'observed', `${xmlType} must stay observed (deprecated)`);
    assert.equal(entry.generator_eligible, false, `${xmlType} must not be generator-eligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), false, `${xmlType} eligibility`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${xmlType} verification`);
  }
});

test('B7a references resolve and their first XML block is one valid step with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested field <type> such as
    // AggregateRows' <field>/<type> or DummyStep's <value>/<type>).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B7a templates insert only with allowObserved and validate clean with MANUAL_REVIEW', () => {
  for (const { kind, xmlType } of BATCH) {
    assert.equal(kind, 'trans', `${xmlType} is a trans step`);
    const file = minimalKtr(`b7a-${xmlType.toLowerCase()}`);
    // Deprecated gate: plain insert must refuse without the explicit flag.
    assert.throws(
      () => addElement(file, xmlType, `New ${xmlType}`),
      /not generator-eligible/,
      `${xmlType} must require allowObserved`,
    );
    const out = addElement(file, xmlType, `New ${xmlType} & <Item>`, { allowObserved: true });
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.match(after, new RegExp(`MANUAL_REVIEW: ${xmlType} is observed-only`));
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'observed');
    assert.equal(out.manualReviewRequired, true);
  }
});

test('AggregateRows template follows getXML fields/field name,rename,type order', () => {
  // AggregateRowsMeta.getXML() (lines 262-276) emits ONLY <fields>; each
  // <field> has name, rename, type (i18n desc string). setDefault()
  // (lines 210-222) allocates zero fields.
  const ref = getReference('trans', 'AggregateRows');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<fields>'], 'AggregateRows');
  const firstField = block.slice(block.indexOf('<field>'));
  assertTagOrder(firstField,
    ['<name>', '<rename>', '<type>'],
    'AggregateRows field');

  // Non-default configuration: revenue sum plus order count.
  const file = minimalKtr('b7a-aggregaterows');
  addElement(file, 'AggregateRows', 'Total orders', { allowObserved: true });
  setFields(file, 'Total orders', 'fields', 'field', [
    { name: 'ORDER_TOTAL', rename: 'TOTAL_REVENUE', type: 'SUM' },
    { name: 'ORDER_ID', rename: 'ORDER_COUNT', type: 'COUNT' },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Total orders');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'ORDER_TOTAL');
  assert.equal(items[0].rename, 'TOTAL_REVENUE');
  assert.equal(items[0].type, 'SUM');
  assert.equal(items[1].type, 'COUNT');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('DummyStep template follows getXML values/value order with setDefault constants', () => {
  // DummyPluginMeta.getXML() (lines 76-86) always emits <values>; the
  // <value> body comes from ValueMetaAndData.getXML (order name, type,
  // text, length, precision, isnull, mask). setDefault() (lines 120-124):
  // Number valuename = 123.456, length 12, precision 4.
  const ref = getReference('trans', 'DummyStep');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<values>'], 'DummyStep');
  const valueBlock = block.slice(block.indexOf('<values>'));
  assertTagOrder(valueBlock,
    ['<value>', '<name>', '<type>', '<text>', '<length>', '<precision>',
      '<isnull>', '<mask>'],
    'DummyStep value');
  assert.equal(parsed.step.values.value.name, 'valuename');
  assert.equal(parsed.step.values.value.type, 'Number');
  assert.equal(parsed.step.values.value.length, 12);
  assert.equal(parsed.step.values.value.precision, 4);
  assert.ok(!parsed.step.connection,
    'DummyStep template must not invent a <connection> tag');

  // Non-default configuration: string flag constant.
  const file = minimalKtr('b7a-dummystep');
  addElement(file, 'DummyStep', 'Compat marker', { allowObserved: true });
  setFieldPath(file, 'Compat marker', 'values/value/name', 'MIGRATION_FLAG');
  setFieldPath(file, 'Compat marker', 'values/value/type', 'String');
  setFieldPath(file, 'Compat marker', 'values/value/text', 'MIGRATED');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<name>MIGRATION_FLAG<\/name>/);
  assert.match(after, /<text>MIGRATED<\/text>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('OldTextFileInput template follows TextFileInputMeta.getXML order', () => {
  // TextFileInputMeta.getXML() (lines 1197-1324): accept block, separator..
  // encoding, add_to_result_filenames, file(name/mask/required/subfolders
  // per file, then type/compression), filters, 13-tag fields, limit,
  // error-handling, locale, 8 extra columns.
  const ref = getReference('trans', 'OldTextFileInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<accept_filenames>', '<separator>', '<header>', '<format>',
      '<add_to_result_filenames>', '<file>', '<filters>', '<fields>',
      '<limit>', '<error_ignored>', '<date_format_lenient>',
      '<shortFileFieldName>', '<sizeFieldName>'],
    'OldTextFileInput');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<name>', '<filemask>', '<file_required>', '<type>', '<compression>'],
    'OldTextFileInput file');
  const fieldBlock = block.slice(block.indexOf('<fields>'));
  assertTagOrder(fieldBlock,
    ['<name>', '<type>', '<nullif>', '<position>', '<trim_type>', '<repeat>'],
    'OldTextFileInput field');
  assert.equal(parsed.step.separator, ';', 'separator defaults ";"');
  assert.equal(parsed.step.header, 'Y', 'header defaults Y');
  assert.ok(!parsed.step.connection,
    'OldTextFileInput template must not invent a <connection> tag');

  // Non-default configuration: pipe-delimited with two typed columns.
  const file = minimalKtr('b7a-oldtextfileinput');
  addElement(file, 'OldTextFileInput', 'Read legacy export', { allowObserved: true });
  setFieldPath(file, 'Read legacy export', 'separator', '|');
  setFieldPath(file, 'Read legacy export', 'file/name', '${DATA_DIR}/orders.txt');
  setFieldPath(file, 'Read legacy export', 'file/filemask', '.*\\.txt');
  setFields(file, 'Read legacy export', 'fields', 'field', [
    {
      name: 'ORDER_ID', type: 'Integer', format: '', currency: '',
      decimal: '.', group: ',', nullif: '', ifnull: '', position: -1,
      length: 10, precision: 0, trim_type: 'none', repeat: 'N',
    },
    {
      name: 'ORDER_DATE', type: 'Date', format: 'yyyy-MM-dd', currency: '',
      decimal: '', group: '', nullif: '', ifnull: '', position: -1,
      length: -1, precision: -1, trim_type: 'none', repeat: 'N',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<separator>\|<\/separator>/);
  assert.match(after, /<name>\$\{DATA_DIR\}\/orders\.txt<\/name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read legacy export');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'ORDER_ID');
  assert.equal(items[1].format, 'yyyy-MM-dd');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('Script template follows ScriptMeta.getXML jsScripts + fields order', () => {
  // ScriptMeta.getXML() (lines 328-358): jsScripts/jsScript with
  // jsScript_type INT (parseInt, missing throws), jsScript_name,
  // jsScript_script; then fields/field[name,rename,type-STRING,length,
  // precision,replace]. setDefault() (lines 261-269): one TRANSFORM
  // script (type 0), zero fields.
  const ref = getReference('trans', 'Script');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<jsScripts>', '<fields>'],
    'Script');
  const scriptBlock = block.slice(block.indexOf('<jsScript>'));
  assertTagOrder(scriptBlock,
    ['<jsScript_type>', '<jsScript_name>', '<jsScript_script>'],
    'Script jsScript');
  const fieldBlock = block.slice(block.indexOf('<fields>'));
  assertTagOrder(fieldBlock,
    ['<name>', '<rename>', '<type>', '<length>', '<precision>', '<replace>'],
    'Script field');
  assert.equal(parsed.step.jsScripts.jsScript.jsScript_type, 0);

  // Non-default configuration: start script plus a replacing output.
  const file = minimalKtr('b7a-script');
  addElement(file, 'Script', 'Compute gross', { allowObserved: true });
  setFields(file, 'Compute gross', 'jsScripts', 'jsScript', [
    { jsScript_type: 1, jsScript_name: 'StartScript', jsScript_script: 'var factor = 1.1;' },
    { jsScript_type: 0, jsScript_name: 'TransformScript', jsScript_script: 'var gross = net * factor;' },
  ]);
  setFields(file, 'Compute gross', 'fields', 'field', [
    {
      name: 'gross', rename: 'GROSS_TOTAL', type: 'Number', length: 12,
      precision: 2, replace: 'N',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Compute gross');
  assert.ok(step, 'inserted step present');
  const scripts = Array.isArray(step.jsScripts.jsScript)
    ? step.jsScripts.jsScript : [step.jsScripts.jsScript];
  assert.equal(scripts.length, 2);
  assert.equal(scripts[0].jsScript_type, 1);
  assert.equal(scripts[1].jsScript_name, 'TransformScript');
  assert.match(after, /<rename>GROSS_TOTAL<\/rename>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('TextFileOutputLegacy template follows parent getXML with trailing is_command', () => {
  // TextFileOutputMeta.getXML() (lines 815-856) + saveFileOptions (lines
  // 858-878); legacy override appends <is_command> LAST inside <file>
  // (TextFileOutputLegacyMeta lines 90-93). setDefault adds
  // fileAsCommand=false. Spellings: extention (sic), SpecifyFormat.
  const ref = getReference('trans', 'TextFileOutputLegacy');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<separator>', '<format>', '<compression>', '<create_parent_folder>',
      '<file>', '<fields>'],
    'TextFileOutputLegacy');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<name>', '<servlet_output>', '<extention>', '<append>',
      '<SpecifyFormat>', '<add_to_result_filenames>', '<splitevery>',
      '<is_command>'],
    'TextFileOutputLegacy file');
  assert.ok(block.includes('<extention>'),
    'template must keep the <extention> spelling');
  assert.ok(block.includes('<SpecifyFormat>'),
    'template must keep the capital <SpecifyFormat> tag');
  assert.equal(parsed.step.file.is_command, 'N', 'is_command defaults N');
  const fieldBlock = block.slice(block.indexOf('<fields>'));
  assertTagOrder(fieldBlock,
    ['<name>', '<type>', '<nullif>', '<trim_type>', '<length>', '<precision>'],
    'TextFileOutputLegacy field');

  // Non-default configuration: append pipe-delimited export, 2 fields.
  const file = minimalKtr('b7a-textfileoutputlegacy');
  addElement(file, 'TextFileOutputLegacy', 'Write legacy export', { allowObserved: true });
  setFieldPath(file, 'Write legacy export', 'separator', '|');
  setFieldPath(file, 'Write legacy export', 'format', 'UNIX');
  setFieldPath(file, 'Write legacy export', 'file/name', '${EXPORT_DIR}/orders.dat');
  setFieldPath(file, 'Write legacy export', 'file/append', 'Y');
  setFieldPath(file, 'Write legacy export', 'file/extention', 'dat');
  setFields(file, 'Write legacy export', 'fields', 'field', [
    {
      name: 'ORDER_ID', type: 'Integer', format: '', currency: '',
      decimal: '.', group: ',', nullif: '', trim_type: 'none', length: 10,
      precision: 0,
    },
    {
      name: 'ORDER_DATE', type: 'Date', format: 'yyyy-MM-dd', currency: '',
      decimal: '', group: '', nullif: '', trim_type: 'none', length: -1,
      precision: -1,
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<separator>\|<\/separator>/);
  assert.match(after, /<append>Y<\/append>/);
  assert.match(after, /<is_command>N<\/is_command>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Write legacy export');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[1].format, 'yyyy-MM-dd');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GetPreviousRowField template follows getXML without schema', () => {
  // GetPreviousRowFieldMeta.getXML() (lines 171-186) emits ONLY <fields>
  // with in_stream_name/out_stream_name; schema is rep-only.
  // setDefault() (lines 160-168) allocates zero mappings.
  const ref = getReference('trans', 'GetPreviousRowField');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<fields>'], 'GetPreviousRowField');
  const firstField = block.slice(block.indexOf('<field>'));
  assertTagOrder(firstField,
    ['<in_stream_name>', '<out_stream_name>'],
    'GetPreviousRowField field');
  assert.ok(!/<schema>/.test(block),
    'GetPreviousRowField template must not invent a <schema> tag');

  // Non-default configuration: two previous-row mappings.
  const file = minimalKtr('b7a-getpreviousrowfield');
  addElement(file, 'GetPreviousRowField', 'Carry previous values', { allowObserved: true });
  setFields(file, 'Carry previous values', 'fields', 'field', [
    { in_stream_name: 'ORDER_TOTAL', out_stream_name: 'PREV_ORDER_TOTAL' },
    { in_stream_name: 'ORDER_DATE', out_stream_name: 'PREV_ORDER_DATE' },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Carry previous values');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].in_stream_name, 'ORDER_TOTAL');
  assert.equal(items[0].out_stream_name, 'PREV_ORDER_TOTAL');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ElasticSearchBulk template follows getXML general/fields/servers/settings order', () => {
  // ElasticSearchBulkMeta.getXML() (lines 475-555): general(index, type,
  // batchSize, timeout, timeoutUnit, isJson, [jsonField?],
  // [idOutputField?], [idField?], overwriteIfExists, useOutput,
  // stopOnError), fields/field[columnName,targetName],
  // servers/server[address,port], settings/setting[name,value].
  // setDefault() (lines 369-380): 50000/SECONDS/twitter/tweet/N/Y-stop.
  const ref = getReference('trans', 'ElasticSearchBulk');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<general>', '<fields>', '<servers>', '<settings>'],
    'ElasticSearchBulk');
  const generalBlock = block.slice(block.indexOf('<general>'));
  assertTagOrder(generalBlock,
    ['<index>', '<type>', '<batchSize>', '<timeout>', '<timeoutUnit>',
      '<isJson>', '<overwriteIfExists>', '<useOutput>', '<stopOnError>'],
    'ElasticSearchBulk general');
  const fieldBlock = block.slice(block.indexOf('<fields>'));
  assertTagOrder(fieldBlock,
    ['<columnName>', '<targetName>'],
    'ElasticSearchBulk field');
  const serverBlock = block.slice(block.indexOf('<servers>'));
  assertTagOrder(serverBlock,
    ['<address>', '<port>'],
    'ElasticSearchBulk server');
  assert.equal(parsed.step.general.batchSize, 50000, 'batchSize defaults "50000"');
  assert.equal(parsed.step.general.timeoutUnit, 'SECONDS');
  assert.equal(parsed.step.general.stopOnError, 'Y');
  assert.ok(!parsed.step.connection,
    'ElasticSearchBulk template must not invent a <connection> tag');

  // Non-default configuration: JSON mode with id handling, two nodes.
  const file = minimalKtr('b7a-elasticsearchbulk');
  addElement(file, 'ElasticSearchBulk', 'Index orders', { allowObserved: true });
  setFieldPath(file, 'Index orders', 'general/index', 'orders');
  setFieldPath(file, 'Index orders', 'general/batchSize', '10000');
  setFieldPath(file, 'Index orders', 'general/isJson', 'Y');
  setFieldPath(file, 'Index orders', 'general/jsonField', 'DOC_JSON');
  setFieldPath(file, 'Index orders', 'general/idField', 'ORDER_ID');
  setFieldPath(file, 'Index orders', 'general/overwriteIfExists', 'Y');
  setFieldPath(file, 'Index orders', 'general/idOutputField', 'ES_DOC_ID');
  setFieldPath(file, 'Index orders', 'general/useOutput', 'Y');
  setFields(file, 'Index orders', 'servers', 'server', [
    { address: '${ES_HOST_1}', port: 9300 },
    { address: '${ES_HOST_2}', port: 9300 },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<index>orders<\/index>/);
  assert.match(after, /<isJson>Y<\/isJson>/);
  assert.match(after, /<jsonField>DOC_JSON<\/jsonField>/);
  assert.match(after, /<idOutputField>ES_DOC_ID<\/idOutputField>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Index orders');
  assert.ok(step, 'inserted step present');
  const servers = Array.isArray(step.servers.server)
    ? step.servers.server : [step.servers.server];
  assert.equal(servers.length, 2);
  assert.equal(servers[0].address, '${ES_HOST_1}');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B7a package as observed with nothing missing', () => {
  const ktrSteps = BATCH
    .map((b) => `<step><name>Uses ${b.xmlType}</name><type>${b.xmlType}</type></step>`)
    .join('');
  const ktr = path.join(tmp, 'b7a-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<transformation><info><name>b7a-package</name></info>${ktrSteps}<order/></transformation>`,
  ].join('\n'));
  const report = knowledgeCoverage(tmp);
  for (const { xmlType } of BATCH) {
    const row = report.types.find((t) => t.xmlType === xmlType);
    assert.ok(row, `${xmlType} covered`);
    assert.equal(row.status, 'observed', `${xmlType} observed`);
    assert.equal(row.generatorEligible, false, `${xmlType} ineligible`);
  }
  assert.equal(report.summary.missing, 0);
});
