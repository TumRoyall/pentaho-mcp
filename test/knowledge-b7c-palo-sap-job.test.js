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

// Batch B7c (DEPRECATED components, read/maintain only): 4 Palo trans steps,
// trans SAPINPUT, job MS_ACCESS_BULK_LOAD, job TALEND_JOB_EXEC.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b7c-source-notes.md.
//
// B7 rule (unlike B2a/B2b/B6): every ID here is Deprecated in source 9.4,
// so catalog rows are status=observed + generator_eligible=false
// (verification stays source_reviewed). isGeneratorEligible() must be FALSE.
// addElement() therefore requires { allowObserved: true } and returns
// catalogStatus=observed + manualReviewRequired=true.
//
// Grounding (all at the pinned commit):
// - trans PaloCellInput -> PaloCellInputMeta, @Step id="PaloCellInput"
//   (PaloCellInputMeta.java:55-59, category Deprecated, icon deprecated.svg).
//   getXML() (150-169): connection, cube, cubemeasurename, cubemeasuretype,
//   <fields>/<field> (dimensionname, fieldname, fieldtype). setDefault() empty.
// - trans PaloCellOutput -> PaloCellOutputMeta, @Step id="PaloCellOutput"
//   (54-58, Deprecated). getXML() (169-211): connection, cube, measuretype,
//   updateMode, splashMode, clearcube (!!missing => NPE on load, line 118),
//   enableDimensionCache, preloadDimensionCache, commitSize, <fields>,
//   <measures> (only the first <measure> loads, lines 153-160).
// - trans PaloDimInput -> PaloDimInputMeta, @Step id="PaloDimInput"
//   (54-58, Deprecated). getXML() (146-165): connection, dimension,
//   baseElementsOnly, <levels>/<level> (levelname, levelnumber int,
//   fieldname, fieldtype). setDefault() empty.
// - trans PaloDimOutput -> PaloDimOutputMeta, @Step id="PaloDimOutput"
//   (57-61, Deprecated). getXML() (148-182): connection, dimension,
//   elementtype, createdimension (!!missing => NPE, line 111),
//   cleardimension (!!missing => NPE, line 112), clearconsolidations,
//   recreatedimension, enableElementCache, preloadElementCache, <levels>
//   (levelname, levelnumber, fieldname, consolidationfieldname — NO
//   fieldtype, unlike DimInput).
// - trans SAPINPUT -> SapInputMeta, @Step id="SAPINPUT" (SapInputMeta.java
//   61-63, category Deprecated, icon deprecated.svg). getXML() (156-199):
//   connection, <function> (name, description, group, application, host),
//   <parameters>/<parameter> (field_name, sap_type SINGLE/STRUCTURE/TABLE,
//   table_name, parameter_name, target_type), <fields>/<field> (field_name,
//   sap_type, table_name, new_name, target_type). setDefault() nulls
//   databaseMeta + function only.
// - job MS_ACCESS_BULK_LOAD -> JobEntryMSAccessBulkLoad, @JobEntry
//   id="MS_ACCESS_BULK_LOAD" (JobEntryMSAccessBulkLoad.java:72-76, category
//   Deprecated, icon deprecated.svg; NOT in kettle-job-entries.xml).
//   getXML() (148-173): super.getXML() then include_subfolders,
//   is_args_from_previous, add_result_filenames, limit, success_condition,
//   <fields>/<field> (source_filefolder, source_wildcard, delimiter,
//   target_db = .mdb FILE PATH (not a connection ref), target_table).
// - job TALEND_JOB_EXEC -> JobEntryTalendJobExec, registry
//   engine/src/main/resources/kettle-job-entries.xml line 60
//   (id="TALEND_JOB_EXEC", category Deprecated, icon deprecated.svg; NO
//   @JobEntry annotation). getXML() (95-103): super.getXML() then filename,
//   class_name. Only 2 tags.
const BATCH = [
  { kind: 'trans', xmlType: 'PaloCellInput', alias: 'PALO_CELL_INPUT', needsConnection: true },
  { kind: 'trans', xmlType: 'PaloCellOutput', alias: 'PALO_CELL_OUTPUT', needsConnection: true },
  { kind: 'trans', xmlType: 'PaloDimInput', alias: 'PALO_DIM_INPUT', needsConnection: true },
  { kind: 'trans', xmlType: 'PaloDimOutput', alias: 'PALO_DIM_OUTPUT', needsConnection: true },
  { kind: 'trans', xmlType: 'SAPINPUT', alias: 'SAP_INPUT', needsConnection: true },
  { kind: 'job', xmlType: 'MS_ACCESS_BULK_LOAD', alias: 'MS_ACCESS_BULK_LOAD', needsConnection: false },
  { kind: 'job', xmlType: 'TALEND_JOB_EXEC', alias: 'TALEND_JOB_EXEC', needsConnection: false },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b7c-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b7c') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // The Palo + SAP steps reference <connection> by name, so every trans
    // fixture declares ${CONN} (B2 pitfall); harmless for steps that carry
    // their own <connection> tag with a placeholder value.
    '  <connection><name>${CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

function minimalKjb(name = 'b7c') {
  const file = path.join(tmp, `${name}.kjb`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job>',
    `  <name>${name}</name>`,
    '  <entries>',
    '    <entry>',
    '      <name>Start</name>',
    '      <type>SPECIAL</type>',
    '      <start>Y</start>',
    '    </entry>',
    '  </entries>',
    '  <hops>',
    '  </hops>',
    '</job>',
  ].join('\n'));
  return file;
}

test('B7c catalog rows exist as observed (deprecated) and are NOT generator-eligible', () => {
  for (const { kind, xmlType, alias } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.type, alias, `${xmlType} design alias`);
    assert.equal(entry.status, 'observed', `${xmlType} deprecated => observed`);
    assert.equal(entry.generator_eligible, false, `${xmlType} deprecated => ineligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), false, `${xmlType} eligibility false`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${xmlType} verification`);
  }
});

test('B7c references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // Direct-child <type> (not a nested field <type> such as SAPINPUT's
    // <parameter>/<target_type> or DBJoin-style <field>/<type>).
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B7c templates insert via addElement (allowObserved) with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b7c-${xmlType.toLowerCase()}`)
      : minimalKtr(`b7c-${xmlType.toLowerCase()}`);
    const out = addElement(file, xmlType, `New ${xmlType} & <Item>`, { allowObserved: true });
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'observed');
    assert.equal(out.manualReviewRequired, true);
  }
});

test('PaloCellInput template follows PaloCellInputMeta.getXML order; 2-dimension non-default', () => {
  // getXML() (lines 150-169) emits connection, cube, cubemeasurename,
  // cubemeasuretype, then <fields>/<field> (dimensionname, fieldname,
  // fieldtype). setDefault() is EMPTY (lines 125-126).
  const ref = getReference('trans', 'PaloCellInput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<cube>', '<cubemeasurename>', '<cubemeasuretype>', '<fields>'],
    'PaloCellInput');
  assert.ok(block.includes('</fields>'),
    'PaloCellInput template keeps a paired <fields> wrapper per getXML()');

  const file = minimalKtr('b7c-palocellinput');
  addElement(file, 'PaloCellInput', 'Read cube', { allowObserved: true });
  setFieldPath(file, 'Read cube', 'connection', '${CONN}');
  setFieldPath(file, 'Read cube', 'cube', 'Sales');
  setFields(file, 'Read cube', 'fields', 'field', [
    { dimensionname: 'Region', fieldname: 'REGION', fieldtype: 'String' },
    { dimensionname: 'Year', fieldname: 'YEAR', fieldtype: 'String' },
  ]);
  const reparsed = parser.parse(readFileSync(file, 'utf8'));
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read cube');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].dimensionname, 'Region');
  assert.equal(items[1].fieldname, 'YEAR');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('PaloCellOutput template keeps clearcube + single-measure semantics', () => {
  // getXML() (169-211): connection, cube, measuretype, updateMode,
  // splashMode, clearcube (missing => NPE on load, line 118),
  // enableDimensionCache, preloadDimensionCache, commitSize, <fields>,
  // <measures>. Load reads ONLY the first <measure> (lines 153-160).
  const ref = getReference('trans', 'PaloCellOutput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<cube>', '<measuretype>', '<updateMode>', '<splashMode>', '<clearcube>',
      '<commitSize>', '<fields>', '<measures>'],
    'PaloCellOutput');
  assert.ok(block.includes('<clearcube>'),
    'PaloCellOutput template must carry <clearcube> (missing tag NPEs on load)');

  const file = minimalKtr('b7c-palocelloutput');
  addElement(file, 'PaloCellOutput', 'Write cube', { allowObserved: true });
  setFieldPath(file, 'Write cube', 'updateMode', 'ADD');
  setFieldPath(file, 'Write cube', 'clearcube', 'Y');
  setFieldPath(file, 'Write cube', 'commitSize', '500');
  setFields(file, 'Write cube', 'measures', 'measure', [
    { measurename: 'Revenue', measurefieldname: 'REV', measurefieldtype: 'Number' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<clearcube>Y<\/clearcube>/);
  assert.match(after, /<measurename>Revenue<\/measurename>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('PaloDimInput uses levels (not fields) and PaloDimOutput has no fieldtype', () => {
  // DimInput getXML() (146-165): connection, dimension, baseElementsOnly,
  // <levels>/<level> (levelname, levelnumber int, fieldname, fieldtype).
  // levelnumber is Integer.parseInt (line 115) — missing => load FAIL.
  let ref = getReference('trans', 'PaloDimInput');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<dimension>', '<baseElementsOnly>', '<levels>'], 'PaloDimInput');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block), 'DimInput uses <levels>, not <fields>');

  let file = minimalKtr('b7c-palodiminput');
  addElement(file, 'PaloDimInput', 'Read dimension', { allowObserved: true });
  setFieldPath(file, 'Read dimension', 'baseElementsOnly', 'Y');
  setFields(file, 'Read dimension', 'levels', 'level', [
    { levelname: 'Country', levelnumber: '0', fieldname: 'COUNTRY', fieldtype: 'String' },
    { levelname: 'City', levelnumber: '1', fieldname: 'CITY', fieldtype: 'String' },
  ]);
  let reparsed = parser.parse(readFileSync(file, 'utf8'));
  let steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  let step = steps.find((s) => s.name === 'Read dimension');
  const lv = Array.isArray(step.levels.level) ? step.levels.level : [step.levels.level];
  assert.equal(lv.length, 2);
  assert.ok(Number.isInteger(Number(lv[1].levelnumber)), 'levelnumber parses as int');
  assert.equal(validateFile(file).summary.errors, 0);

  // DimOutput getXML() (148-182): connection, dimension, elementtype,
  // createdimension + cleardimension (BOTH missing => NPE, lines 111-112),
  // clearconsolidations, recreatedimension, enableElementCache,
  // preloadElementCache, <levels> with consolidationfieldname and NO
  // fieldtype.
  ref = getReference('trans', 'PaloDimOutput');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<dimension>', '<elementtype>', '<createdimension>', '<cleardimension>',
      '<levels>'],
    'PaloDimOutput');
  assert.ok(/<createdimension>/.test(block) && /<cleardimension>/.test(block),
    'DimOutput NPE-guard tags present');

  file = minimalKtr('b7c-palodimoutput');
  addElement(file, 'PaloDimOutput', 'Write dimension', { allowObserved: true });
  setFieldPath(file, 'Write dimension', 'createdimension', 'Y');
  setFields(file, 'Write dimension', 'levels', 'level', [
    {
      levelname: 'Country', levelnumber: '0', fieldname: 'COUNTRY', consolidationfieldname: 'ALL_REGIONS',
    },
  ]);
  reparsed = parser.parse(readFileSync(file, 'utf8'));
  steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  step = steps.find((s) => s.name === 'Write dimension');
  const out = Array.isArray(step.levels.level) ? step.levels.level[0] : step.levels.level;
  assert.ok(Object.prototype.hasOwnProperty.call(out, 'consolidationfieldname'),
    'DimOutput level carries consolidationfieldname');
  assert.ok(!Object.prototype.hasOwnProperty.call(out, 'fieldtype'),
    'DimOutput level must not carry fieldtype');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SAPINPUT template follows SapInputMeta.getXML: connection, function, parameters, fields', () => {
  // getXML() (lines 156-199) emits connection, then an ALWAYS-emitted
  // <function> wrapper (name/description/group/application/host only when a
  // function is selected, lines 163-169), then ALWAYS-emitted <parameters>
  // (each <parameter>: field_name, sap_type SINGLE/STRUCTURE/TABLE,
  // table_name, parameter_name, target_type) and <fields> (each <field>:
  // field_name, sap_type, table_name, new_name, target_type).
  // setDefault() (133-137) nulls databaseMeta + function only.
  const ref = getReference('trans', 'SAPINPUT');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<function>', '<parameters>', '<fields>'], 'SAPINPUT');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'SAPINPUT template must carry <connection> (SAP connection reference)');
  assert.ok(block.includes('</function>'),
    'SAPINPUT template keeps a paired <function> wrapper per getXML()');
  assert.ok(block.includes('</parameters>'),
    'SAPINPUT template keeps a paired <parameters> wrapper per getXML()');

  // Non-default configuration: RFC function + 1 SINGLE parameter + 2 TABLE
  // output fields (placeholders only, never real credentials).
  const file = minimalKtr('b7c-sapinput');
  addElement(file, 'SAPINPUT', 'Read customers', { allowObserved: true });
  setFieldPath(file, 'Read customers', 'connection', '${CONN}');
  setFieldPath(file, 'Read customers', 'function/name', 'BAPI_CUSTOMER_GETLIST');
  setFieldPath(file, 'Read customers', 'function/host', '${SAP_HOST}');
  setFields(file, 'Read customers', 'parameters', 'parameter', [
    {
      field_name: 'CUSTOMER_ID', sap_type: 'SINGLE', table_name: '', parameter_name: 'CUSTOMERNO', target_type: 'String',
    },
  ]);
  setFields(file, 'Read customers', 'fields', 'field', [
    {
      field_name: 'NAME1', sap_type: 'TABLE', table_name: 'ADDRESSDATA', new_name: 'CUSTOMER_NAME', target_type: 'String',
    },
    {
      field_name: 'CITY', sap_type: 'TABLE', table_name: 'ADDRESSDATA', new_name: 'CUSTOMER_CITY', target_type: 'String',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<name>BAPI_CUSTOMER_GETLIST<\/name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read customers');
  assert.ok(step, 'inserted step present');
  const params = Array.isArray(step.parameters.parameter)
    ? step.parameters.parameter
    : [step.parameters.parameter];
  assert.equal(params.length, 1);
  assert.equal(params[0].sap_type, 'SINGLE');
  assert.equal(params[0].parameter_name, 'CUSTOMERNO');
  const outs = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(outs.length, 2);
  assert.equal(outs[0].new_name, 'CUSTOMER_NAME');
  assert.equal(outs[1].new_name, 'CUSTOMER_CITY');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job MS_ACCESS_BULK_LOAD template follows getXML order; target_db is a path, not a connection', () => {
  // getXML() (lines 148-173) emits super.getXML() then include_subfolders,
  // is_args_from_previous, add_result_filenames, limit, success_condition,
  // then an ALWAYS-emitted <fields> wrapper (each <field>:
  // source_filefolder, source_wildcard, delimiter, target_db, target_table).
  // target_db is an .mdb FILE PATH — there is NO <connection> tag, so the
  // B2a connection-fixture pitfall does NOT apply to this entry.
  const ref = getReference('job', 'MS_ACCESS_BULK_LOAD');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include_subfolders>', '<is_args_from_previous>', '<add_result_filenames>', '<limit>',
      '<success_condition>', '<fields>'],
    'MS_ACCESS_BULK_LOAD');
  assert.ok(!Object.prototype.hasOwnProperty.call(parsed.entry, 'connection'),
    'MS_ACCESS_BULK_LOAD must not invent a <connection> tag (target_db is a path)');
  assert.ok(block.includes('</fields>'),
    'MS_ACCESS_BULK_LOAD template keeps a paired <fields> wrapper per getXML()');

  // Non-default configuration: recursive scan + success_when_at_least.
  const file = minimalKjb('b7c-ms-access');
  addElement(file, 'MS_ACCESS_BULK_LOAD', 'Load csv files', { allowObserved: true });
  setFieldPath(file, 'Load csv files', 'include_subfolders', 'Y');
  setFieldPath(file, 'Load csv files', 'limit', '5');
  setFieldPath(file, 'Load csv files', 'success_condition', 'success_when_at_least');
  setFields(file, 'Load csv files', 'fields', 'field', [
    {
      source_filefolder: '${SOURCE_DIR}', source_wildcard: '.*\\.csv', delimiter: ';', target_db: '${ACCESS_DB}', target_table: 'STAGING_SALES',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<include_subfolders>Y<\/include_subfolders>/);
  assert.match(after, /<success_condition>success_when_at_least<\/success_condition>/);
  assert.match(after, /<target_db>\$\{ACCESS_DB\}<\/target_db>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job TALEND_JOB_EXEC template is filename + class_name only', () => {
  // getXML() (lines 95-103) emits super.getXML() then exactly filename and
  // class_name. No booleans, no lists, no connection.
  const ref = getReference('job', 'TALEND_JOB_EXEC');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<filename>', '<class_name>'], 'TALEND_JOB_EXEC');
  assert.ok(!Object.prototype.hasOwnProperty.call(parsed.entry, 'connection'),
    'TALEND_JOB_EXEC must not invent a <connection> tag');

  const file = minimalKjb('b7c-talend');
  addElement(file, 'TALEND_JOB_EXEC', 'Run Talend job', { allowObserved: true });
  setFieldPath(file, 'Run Talend job', 'filename', '${TALEND_JOB_PACKAGE}');
  setFieldPath(file, 'Run Talend job', 'class_name', 'routines.customer_sync_0_1.CustomerSync');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename>\$\{TALEND_JOB_PACKAGE\}<\/filename>/);
  assert.match(after, /<class_name>routines\.customer_sync_0_1\.CustomerSync<\/class_name>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B7c package as observed with nothing missing', () => {
  const ktr = path.join(tmp, 'b7c-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b7c-package</name></info>',
    '<step><name>Read cube</name><type>PaloCellInput</type></step>',
    '<step><name>Write cube</name><type>PaloCellOutput</type></step>',
    '<step><name>Read dimension</name><type>PaloDimInput</type></step>',
    '<step><name>Write dimension</name><type>PaloDimOutput</type></step>',
    '<step><name>Read customers</name><type>SAPINPUT</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b7c-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b7c-package</name><entries>',
    '<entry><name>Load csv files</name><type>MS_ACCESS_BULK_LOAD</type></entry>',
    '<entry><name>Run Talend job</name><type>TALEND_JOB_EXEC</type></entry>',
    '</entries><hops/></job>',
  ].join('\n'));
  const report = knowledgeCoverage(tmp);
  for (const { xmlType } of BATCH) {
    const row = report.types.find((t) => t.xmlType === xmlType);
    assert.ok(row, `${xmlType} covered`);
    assert.equal(row.status, 'observed', `${xmlType} observed (deprecated)`);
    assert.equal(row.generatorEligible, false, `${xmlType} ineligible`);
  }
  assert.equal(report.summary.missing, 0);
});
