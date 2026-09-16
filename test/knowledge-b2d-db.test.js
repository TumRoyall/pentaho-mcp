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

// Batch B2d (DB proc/sync + job SQL): trans DBProc, trans
// SynchronizeAfterMerge, job WAIT_FOR_SQL, job COLUMNS_EXIST. Completes B2
// (13/13 IDs: B2a 4 + B2b 3 + B2c 2 + B2d 4).
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b2d-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans DBProc -> org.pentaho.di.trans.steps.dbproc.DBProcMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 51
//   (id="DBProc", category Lookup). getXML() (lines 288-316) emits
//   connection, procedure, then a PAIRED <lookup> wrapper holding <arg>
//   (name+direction+type as value-meta NAME string), then a PAIRED <result>
//   block (name+type), then auto_commit (Y/N).
//   setDefault() (lines 236-255): 0 args, resultName="result",
//   resultType=NUMBER, autoCommit=true.
// - trans SynchronizeAfterMerge ->
//   org.pentaho.di.trans.steps.synchronizeaftermerge.SynchronizeAfterMergeMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 82
//   (id="SynchronizeAfterMerge", category Output). getXML() (lines 519-562)
//   emits connection, commit (STRING "100"), tablename_in_field,
//   tablename_field, use_batch, perform_lookup, operation_order_field,
//   order_insert, order_update, order_delete, then a PAIRED <lookup> wrapper
//   holding schema, table, <key> (name+field+condition+name2) and <value>
//   (name+rename+update Y/N). Operation field values drive INSERT/UPDATE/
//   DELETE against the order_insert/update/delete markers.
//   setDefault() (lines 485-517): commitSize="100", schema="", 0 keys/values,
//   performLookup=false, tablenameInField=false (useBatchUpdate stays false).
// - job WAIT_FOR_SQL -> org.pentaho.di.job.entries.waitforsql.JobEntryWaitForSQL,
//   registry engine/src/main/resources/kettle-job-entries.xml line 50
//   (id="WAIT_FOR_SQL", category Utility). getXML() (lines 160-180) emits
//   super.getXML() then connection, schemaname, tablename, success_condition
//   (CODE string), rows_count_value, is_custom_sql, is_usevars, custom_sql,
//   add_rows_result, maximum_timeout, check_cycle_time, success_on_timeout,
//   clear_result_rows. Ctor defaults (lines 113-128): successCondition=GREATER,
//   rowsCountValue="0", maximumTimeout="0" (infinite), checkCycleTime="60",
//   isClearResultList=true.
// - job COLUMNS_EXIST ->
//   org.pentaho.di.job.entries.columnsexist.JobEntryColumnsExist, registry
//   engine/src/main/resources/kettle-job-entries.xml line 45
//   (id="COLUMNS_EXIST", category Conditions). getXML() (lines 94-115) emits
//   super.getXML() then tablename, schemaname, connection, then a PAIRED
//   <fields> wrapper holding <field> (name = STATIC column name).
//   execute() returns true only when ALL columns exist (PDI-15801).
// All four reference a DB connection BY NAME: fixtures MUST declare it.
const BATCH = [
  { kind: 'trans', xmlType: 'DBProc', alias: 'DB_PROC' },
  { kind: 'trans', xmlType: 'SynchronizeAfterMerge', alias: 'SYNCHRONIZE_AFTER_MERGE' },
  { kind: 'job', xmlType: 'WAIT_FOR_SQL', alias: 'WAIT_FOR_SQL' },
  { kind: 'job', xmlType: 'COLUMNS_EXIST', alias: 'COLUMNS_EXIST' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<connection>') appears in `block` after
// the previous one, mirroring the emission order of the source getXML().
// Self-closing leaves (e.g. '<sequence/>') also match.
function assertTagOrder(block, order, label) {
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + '(?:\\s|/?>)'));
    assert.ok(i > at, `${label}: ${tag} must follow source getXML() order`);
    at = i;
  }
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b2d-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b2d') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // Declare the ${CONN} connection the DB steps reference so the structural
    // validator's undefined-connection rule is satisfied (a real .ktr using a
    // connection must declare it; Kettle allows a variable in the name).
    '  <connection><name>${CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

function minimalKjb(name = 'b2d') {
  const file = path.join(tmp, `${name}.kjb`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job>',
    `  <name>${name}</name>`,
    '  <connection><name>${CONN}</name></connection>',
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

test('B2d catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
  for (const { kind, xmlType, alias } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.type, alias, `${xmlType} design alias`);
    assert.equal(entry.status, 'canonical', `${xmlType} should be canonical`);
    assert.equal(entry.generator_eligible, true, `${xmlType} must be generator-eligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), true, `${xmlType} eligibility`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${xmlType} verification`);
  }
});

test('B2d references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // Direct-child <type> (not a nested field <type> such as DBProc's
    // <lookup>/<arg>/<type>).
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B2d templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b2d-${xmlType.toLowerCase()}`)
      : minimalKtr(`b2d-${xmlType.toLowerCase()}`);
    const out = addElement(file, xmlType, `New ${xmlType} & <Item>`);
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'canonical');
    assert.equal(out.manualReviewRequired, false);
  }
});

test('DBProc template follows DBProcMeta.getXML: connection, procedure, lookup/arg list, result, auto_commit', () => {
  // DBProcMeta.getXML() (lines 288-316) emits connection, procedure, then the
  // PAIRED <lookup> wrapper (lines 294/305) with <arg> items carrying <name>
  // (argument field), <direction> (IN/OUT/INOUT) and <type> (value-meta NAME
  // string via getValueMetaName), then the PAIRED <result> block (lines
  // 307/311) with <name> + <type>, then <auto_commit> (Y/N).
  // setDefault() (lines 236-255): 0 args, resultName="result",
  // resultType=NUMBER, autoCommit=true.
  const ref = getReference('trans', 'DBProc');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<procedure>', '<lookup>', '<result>', '<auto_commit>'],
    'DBProc');
  assert.ok(hasOwn(parsed.step, 'connection'),
    'DBProc template must carry <connection> (DB connection reference)');
  assert.ok(hasOwn(parsed.step, 'procedure'),
    'DBProc template must carry <procedure> (procedure name)');
  assert.ok(block.includes('</lookup>'),
    'DBProc template must carry a paired <lookup> wrapper per getXML()');
  assert.ok(block.includes('</result>'),
    'DBProc template must carry a paired <result> block per getXML()');
  const args = parsed.step.lookup
    ? toArray(parsed.step.lookup.arg)
    : [];
  assert.ok(args.length >= 1, 'DBProc template must show at least one <arg> example');
  for (const a of args) {
    for (const tag of ['name', 'direction', 'type']) {
      assert.ok(hasOwn(a, tag), `DBProc <arg> must carry <${tag}> per getXML lines 298-301`);
    }
    // NPE pitfall: getFields() line 273 calls
    // argumentDirection[i].equalsIgnoreCase("OUT") with NO null-guard, so
    // <direction> MUST be present on every <arg>.
    assert.ok(a.direction === 'IN' || a.direction === 'OUT' || a.direction === 'INOUT',
      'DBProc <direction> must be IN, OUT or INOUT');
  }
  assert.equal(parsed.step.result.name, 'result',
    'result/name defaults to "result" (setDefault)');
  assert.equal(parsed.step.auto_commit, 'Y',
    'auto_commit defaults Y (setDefault true; template pins it explicitly)');
  assert.ok(!parsed.step.arguments,
    'DBProc template must not invent an <arguments> tag (list is <lookup>/<arg>)');

  // Non-default configuration: one IN argument plus one OUT argument and a
  // typed result field (placeholders only, never real credentials).
  const file = minimalKtr('b2d-dbproc');
  addElement(file, 'DBProc', 'Call pricing procedure');
  setFieldPath(file, 'Call pricing procedure', 'connection', '${CONN}');
  setFieldPath(file, 'Call pricing procedure', 'procedure', '${PROC}');
  setFields(file, 'Call pricing procedure', 'lookup', 'arg', [
    { name: 'IN_PRICE_ID', direction: 'IN', type: 'Integer' },
    { name: 'OUT_PRICE', direction: 'OUT', type: 'Number' },
  ]);
  setFieldPath(file, 'Call pricing procedure', 'result/name', 'proc_status');
  setFieldPath(file, 'Call pricing procedure', 'result/type', 'String');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<procedure>\$\{PROC\}<\/procedure>/);
  assert.match(after, /<result>[\s\S]*<name>proc_status<\/name>[\s\S]*<\/result>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Call pricing procedure');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.lookup.arg) ? step.lookup.arg : [step.lookup.arg];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'IN_PRICE_ID');
  assert.equal(configured[0].direction, 'IN');
  assert.equal(configured[0].type, 'Integer');
  assert.equal(configured[1].name, 'OUT_PRICE');
  assert.equal(configured[1].direction, 'OUT');
  assert.equal(configured[1].type, 'Number');
  assert.equal(step.result.type, 'String');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SynchronizeAfterMerge template follows getXML tag order, lookup key/value mapping and operation markers', () => {
  // SynchronizeAfterMergeMeta.getXML() (lines 519-562) emits connection,
  // commit (STRING), tablename_in_field, tablename_field, use_batch,
  // perform_lookup, operation_order_field, order_insert, order_update,
  // order_delete, then the PAIRED <lookup> wrapper (lines 538/559) holding
  // schema, table, <key> (name+field+condition+name2) and <value>
  // (name+rename+update Y/N). setDefault() (lines 485-517): commitSize="100",
  // schema="", 0 keys/values, performLookup=false, tablenameInField=false.
  const ref = getReference('trans', 'SynchronizeAfterMerge');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<commit>', '<tablename_in_field>', '<tablename_field>',
      '<use_batch>', '<perform_lookup>', '<operation_order_field>',
      '<order_insert>', '<order_update>', '<order_delete>', '<lookup>'],
    'SynchronizeAfterMerge');
  assert.ok(hasOwn(parsed.step, 'connection'),
    'SynchronizeAfterMerge template must carry <connection> (DB connection reference)');
  assert.ok(block.includes('</lookup>'),
    'SynchronizeAfterMerge template must carry a paired <lookup> wrapper per getXML()');
  assert.equal(parsed.step.commit, 100, 'commit defaults "100" (setDefault string)');
  assert.equal(parsed.step.tablename_in_field, 'N',
    'tablename_in_field defaults N (setDefault false)');
  assert.equal(parsed.step.use_batch, 'N',
    'use_batch defaults N (boolean default false; exact snake_case tag)');
  assert.equal(parsed.step.perform_lookup, 'N',
    'perform_lookup defaults N (setDefault false)');
  assert.ok(!parsed.step.useBatch,
    'SynchronizeAfterMerge template must use <use_batch>, not <useBatch>');
  const lookup = parsed.step.lookup;
  assert.ok(lookup, 'template must carry <lookup>');
  assert.ok(hasOwn(lookup, 'schema') && hasOwn(lookup, 'table'),
    '<lookup> must carry schema and table per getXML lines 539-540');
  const keys = toArray(lookup.key);
  assert.ok(keys.length >= 1, 'template must show at least one <key> example');
  for (const k of keys) {
    for (const tag of ['name', 'field', 'condition', 'name2']) {
      assert.ok(hasOwn(k, tag), `<key> must carry <${tag}> per getXML lines 544-547`);
    }
  }
  const values = toArray(lookup.value);
  assert.ok(values.length >= 1, 'template must show at least one <value> example');
  for (const v of values) {
    for (const tag of ['name', 'rename', 'update']) {
      assert.ok(hasOwn(v, tag), `<value> must carry <${tag}> per getXML lines 553-555`);
    }
    assert.ok(v.update === 'Y' || v.update === 'N',
      '<value>/<update> is boolean Y/N (missing tag loads TRUE — template pins it)');
  }

  // Non-default configuration: merge-output sync keyed by customer id with
  // I/U/D operation markers (placeholders only, never real credentials).
  const file = minimalKtr('b2d-synchronizeaftermerge');
  addElement(file, 'SynchronizeAfterMerge', 'Sync customer table');
  setFieldPath(file, 'Sync customer table', 'connection', '${CONN}');
  setFieldPath(file, 'Sync customer table', 'lookup/schema', '${SCHEMA}');
  setFieldPath(file, 'Sync customer table', 'lookup/table', '${TABLE}');
  setFieldPath(file, 'Sync customer table', 'operation_order_field', 'OP_FLAG');
  setFieldPath(file, 'Sync customer table', 'order_insert', 'I');
  setFieldPath(file, 'Sync customer table', 'order_update', 'U');
  setFieldPath(file, 'Sync customer table', 'order_delete', 'D');
  setFields(file, 'Sync customer table', 'lookup', 'key', [
    {
      name: 'CUST_ID', field: 'cust_id', condition: '=', name2: '',
    },
  ]);
  setFields(file, 'Sync customer table', 'lookup', 'value', [
    { name: 'cust_name', rename: 'CUST_NAME', update: 'Y' },
    { name: 'cust_segment', rename: 'CUST_SEGMENT', update: 'Y' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<operation_order_field>OP_FLAG<\/operation_order_field>/);
  assert.match(after, /<order_insert>I<\/order_insert>/);
  assert.match(after, /<order_update>U<\/order_update>/);
  assert.match(after, /<order_delete>D<\/order_delete>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Sync customer table');
  assert.ok(step, 'inserted step present');
  const configuredKeys = toArray(step.lookup.key);
  assert.equal(configuredKeys.length, 1);
  assert.equal(configuredKeys[0].name, 'CUST_ID');
  assert.equal(configuredKeys[0].field, 'cust_id');
  assert.equal(configuredKeys[0].condition, '=');
  const configuredValues = toArray(step.lookup.value);
  assert.equal(configuredValues.length, 2);
  assert.equal(configuredValues[0].name, 'cust_name');
  assert.equal(configuredValues[0].rename, 'CUST_NAME');
  assert.equal(configuredValues[0].update, 'Y');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job WAIT_FOR_SQL template follows JobEntryWaitForSQL.getXML tag order, codes and timeout defaults', () => {
  // JobEntryWaitForSQL.getXML() (lines 160-180) emits super.getXML() then
  // connection, schemaname, tablename, success_condition (CODE string),
  // rows_count_value, is_custom_sql, is_usevars, custom_sql, add_rows_result,
  // maximum_timeout, check_cycle_time, success_on_timeout, clear_result_rows.
  // Ctor (lines 113-128): successCondition=GREATER, rowsCountValue="0",
  // maximumTimeout="0" (infinite), checkCycleTime="60", isClearResultList=true.
  const ref = getReference('job', 'WAIT_FOR_SQL');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<schemaname>', '<tablename>', '<success_condition>',
      '<rows_count_value>', '<is_custom_sql>', '<is_usevars>', '<custom_sql>',
      '<add_rows_result>', '<maximum_timeout>', '<check_cycle_time>',
      '<success_on_timeout>', '<clear_result_rows>'],
    'WAIT_FOR_SQL');
  assert.ok(hasOwn(parsed.entry, 'connection'),
    'WAIT_FOR_SQL template must carry <connection> (DB connection reference)');
  assert.equal(parsed.entry.success_condition, 'rows_count_greater',
    'success_condition defaults to the GREATER code (ctor default 4; missing tag would load EQUAL)');
  assert.equal(parsed.entry.rows_count_value, 0,
    'rows_count_value defaults "0"');
  assert.equal(parsed.entry.is_custom_sql, 'N',
    'is_custom_sql defaults N (table count mode)');
  assert.equal(parsed.entry.maximum_timeout, 0,
    'maximum_timeout defaults "0" (infinite wait)');
  assert.equal(parsed.entry.check_cycle_time, 60,
    'check_cycle_time defaults "60" (1 minute)');
  assert.equal(parsed.entry.success_on_timeout, 'N',
    'success_on_timeout defaults N (timeout = failure)');
  assert.equal(parsed.entry.clear_result_rows, 'Y',
    'clear_result_rows defaults Y (ctor true; missing tag would load false — template pins it)');
  assert.ok(
    ['rows_count_equal', 'rows_count_different', 'rows_count_smaller',
      'rows_count_smaller_equal', 'rows_count_greater',
      'rows_count_greater_equal'].includes(String(parsed.entry.success_condition)),
    'success_condition must be one of the six successConditionsCode strings');

  // Non-default configuration: wait until the staging table holds exactly the
  // expected row count, polling every 30s for at most 10 minutes.
  const file = minimalKjb('b2d-wait-for-sql');
  addElement(file, 'WAIT_FOR_SQL', 'Wait for staging load');
  setFieldPath(file, 'Wait for staging load', 'connection', '${CONN}');
  setFieldPath(file, 'Wait for staging load', 'schemaname', '${SCHEMA}');
  setFieldPath(file, 'Wait for staging load', 'tablename', '${TABLE}');
  setFieldPath(file, 'Wait for staging load', 'success_condition', 'rows_count_equal');
  setFieldPath(file, 'Wait for staging load', 'rows_count_value', '1000');
  setFieldPath(file, 'Wait for staging load', 'maximum_timeout', '600');
  setFieldPath(file, 'Wait for staging load', 'check_cycle_time', '30');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<tablename>\$\{TABLE\}<\/tablename>/);
  assert.match(after, /<success_condition>rows_count_equal<\/success_condition>/);
  assert.match(after, /<rows_count_value>1000<\/rows_count_value>/);
  assert.match(after, /<maximum_timeout>600<\/maximum_timeout>/);
  assert.match(after, /<check_cycle_time>30<\/check_cycle_time>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job COLUMNS_EXIST template follows JobEntryColumnsExist.getXML: tablename, schemaname, connection, fields list', () => {
  // JobEntryColumnsExist.getXML() (lines 94-115) emits super.getXML() then
  // exactly tablename, schemaname, connection, then the PAIRED <fields>
  // wrapper (lines 104/112) holding <field> items with <name> = the STATIC
  // column name on the table (lines 107-109). execute() (lines 291-294)
  // returns true only when ALL listed columns exist (PDI-15801).
  const ref = getReference('job', 'COLUMNS_EXIST');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<tablename>', '<schemaname>', '<connection>', '<fields>'],
    'COLUMNS_EXIST');
  assert.ok(hasOwn(parsed.entry, 'connection'),
    'COLUMNS_EXIST template must carry <connection> (DB connection reference)');
  assert.ok(block.includes('</fields>'),
    'COLUMNS_EXIST template must carry a paired <fields> wrapper per getXML()');
  const fields = toArray(parsed.entry.fields?.field);
  assert.ok(fields.length >= 1, 'COLUMNS_EXIST template must show at least one <field> example');
  for (const f of fields) {
    assert.ok(hasOwn(f, 'name'), 'every COLUMNS_EXIST <field> must carry <name> (static column)');
  }
  assert.ok(!parsed.entry.columnnamefield,
    'COLUMNS_EXIST template must not invent <columnnamefield> (that is the dynamic trans ColumnExists step)');

  // Non-default configuration: static table plus two required columns.
  const file = minimalKjb('b2d-columns-exist');
  addElement(file, 'COLUMNS_EXIST', 'Check staging columns');
  setFieldPath(file, 'Check staging columns', 'tablename', '${TABLE}');
  setFieldPath(file, 'Check staging columns', 'schemaname', '${SCHEMA}');
  setFieldPath(file, 'Check staging columns', 'connection', '${CONN}');
  setFields(file, 'Check staging columns', 'fields', 'field', [
    { name: 'CUST_ID' },
    { name: 'CUST_NAME' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<tablename>\$\{TABLE\}<\/tablename>/);
  assert.match(after, /<schemaname>\$\{SCHEMA\}<\/schemaname>/);
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  const reparsed = parser.parse(after);
  const entries = Array.isArray(reparsed.job.entries.entry)
    ? reparsed.job.entries.entry
    : [reparsed.job.entries.entry];
  const entry = entries.find((e) => e.name === 'Check staging columns');
  assert.ok(entry, 'inserted entry present');
  const configured = toArray(entry.fields.field);
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'CUST_ID');
  assert.equal(configured[1].name, 'CUST_NAME');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B2d package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b2d-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b2d-package</name></info>',
    '<step><name>Call pricing procedure</name><type>DBProc</type></step>',
    '<step><name>Sync customer table</name><type>SynchronizeAfterMerge</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b2d-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b2d-package</name><entries>',
    '<entry><name>Wait for staging load</name><type>WAIT_FOR_SQL</type></entry>',
    '<entry><name>Check staging columns</name><type>COLUMNS_EXIST</type></entry>',
    '</entries><hops/></job>',
  ].join('\n'));
  const report = knowledgeCoverage(tmp);
  for (const { xmlType } of BATCH) {
    const row = report.types.find((t) => t.xmlType === xmlType);
    assert.ok(row, `${xmlType} covered`);
    assert.equal(row.status, 'canonical', `${xmlType} canonical`);
    assert.equal(row.generatorEligible, true, `${xmlType} eligible`);
  }
  assert.equal(report.summary.missing, 0);
});

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
