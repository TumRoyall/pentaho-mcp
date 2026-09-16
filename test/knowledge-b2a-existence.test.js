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

// Batch B2a (existence checks + DB join): trans TableExists, job TABLE_EXISTS,
// trans ColumnExists, trans DBJoin.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b2a-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans TableExists -> org.pentaho.di.trans.steps.tableexists.TableExistsMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="TableExists").
//   getXML() emits connection, tablenamefield, resultfieldname, schemaname.
// - job TABLE_EXISTS -> org.pentaho.di.job.entries.tableexists.JobEntryTableExists,
//   registry engine/src/main/resources/kettle-job-entries.xml (id="TABLE_EXISTS").
//   getXML() emits super.getXML() then tablename, schemaname, connection.
// - trans ColumnExists -> org.pentaho.di.trans.steps.columnexists.ColumnExistsMeta,
//   annotation @Step(id="ColumnExists"). getXML() emits connection, tablename,
//   schemaname, istablenameInfield, tablenamefield, columnnamefield,
//   resultfieldname.
// - trans DBJoin -> org.pentaho.di.trans.steps.databasejoin.DatabaseJoinMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="DBJoin").
//   getXML() emits connection, rowlimit, sql, outer_join, replace_vars, then
//   <parameter> wrapping <field> items (name + type).
const BATCH = [
  { kind: 'trans', xmlType: 'TableExists', alias: 'TABLE_EXISTS' },
  { kind: 'job', xmlType: 'TABLE_EXISTS', alias: 'TABLE_EXISTS' },
  { kind: 'trans', xmlType: 'ColumnExists', alias: 'COLUMN_EXISTS' },
  { kind: 'trans', xmlType: 'DBJoin', alias: 'DB_JOIN' },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b2a-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b2a') {
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

function minimalKjb(name = 'b2a') {
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

test('B2a catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B2a references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // Direct-child <type> (not a nested field <type> such as DBJoin's
    // <parameter>/<field>/<type>).
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B2a templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b2a-${xmlType.toLowerCase()}`)
      : minimalKtr(`b2a-${xmlType.toLowerCase()}`);
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

test('TableExists template follows TableExistsMeta.getXML: connection, tablenamefield, resultfieldname, schemaname', () => {
  // TableExistsMeta.getXML() (lines 156-165) emits exactly these four tags in
  // this order. NOTE: there is no static <tablename> tag — <tablenamefield>
  // is the name of the input-stream FIELD carrying the table name (dynamic).
  // setDefault() (lines 139-143) sets resultfieldname="result".
  const ref = getReference('trans', 'TableExists');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<tablenamefield>', '<resultfieldname>', '<schemaname>'],
    'TableExists');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'TableExists template must carry <connection> (DB connection reference)');
  assert.equal(parsed.step.resultfieldname, 'result',
    'resultfieldname defaults to "result" (setDefault)');
  assert.ok(!parsed.step.tablename,
    'TableExists template must not invent a static <tablename> tag');

  // Non-default configuration: dynamic table-name field plus schema and
  // connection references (placeholders only, never real credentials).
  const file = minimalKtr('b2a-tableexists');
  addElement(file, 'TableExists', 'Check table exists');
  setFieldPath(file, 'Check table exists', 'connection', '${CONN}');
  setFieldPath(file, 'Check table exists', 'tablenamefield', 'SRC_TABLE');
  setFieldPath(file, 'Check table exists', 'schemaname', '${SCHEMA}');
  setFieldPath(file, 'Check table exists', 'resultfieldname', 'table_exists_flag');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<tablenamefield>SRC_TABLE<\/tablenamefield>/);
  assert.match(after, /<schemaname>\$\{SCHEMA\}<\/schemaname>/);
  assert.match(after, /<resultfieldname>table_exists_flag<\/resultfieldname>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job TABLE_EXISTS template follows JobEntryTableExists.getXML: tablename, schemaname, connection', () => {
  // JobEntryTableExists.getXML() (lines 81-92) emits super.getXML() then
  // exactly tablename, schemaname, connection (the DatabaseMeta name).
  const ref = getReference('job', 'TABLE_EXISTS');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<tablename>', '<schemaname>', '<connection>'], 'TABLE_EXISTS');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.entry, 'connection'),
    'TABLE_EXISTS template must carry <connection> (DB connection reference)');

  // Non-default configuration: static table name plus connection reference.
  const file = minimalKjb('b2a-table-exists');
  addElement(file, 'TABLE_EXISTS', 'Check dimension table');
  setFieldPath(file, 'Check dimension table', 'tablename', '${TABLE}');
  setFieldPath(file, 'Check dimension table', 'schemaname', '${SCHEMA}');
  setFieldPath(file, 'Check dimension table', 'connection', '${CONN}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<tablename>\$\{TABLE\}<\/tablename>/);
  assert.match(after, /<schemaname>\$\{SCHEMA\}<\/schemaname>/);
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ColumnExists template follows ColumnExistsMeta.getXML 7-tag order', () => {
  // ColumnExistsMeta.getXML() (lines 218-228) emits: connection, tablename,
  // schemaname, istablenameInfield, tablenamefield, columnnamefield,
  // resultfieldname. setDefault() (lines 199-205): istablenameInfield=false,
  // resultfieldname="result". NOTE: the column under test is the dynamic
  // stream field <columnnamefield> — there is no static <columnname> tag —
  // and the boolean result lands in <resultfieldname>.
  const ref = getReference('trans', 'ColumnExists');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<tablename>', '<schemaname>', '<istablenameInfield>',
      '<tablenamefield>', '<columnnamefield>', '<resultfieldname>'],
    'ColumnExists');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'ColumnExists template must carry <connection> (DB connection reference)');
  assert.equal(parsed.step.istablenameInfield, 'N',
    'istablenameInfield defaults N (setDefault false)');
  assert.equal(parsed.step.resultfieldname, 'result',
    'resultfieldname defaults to "result" (setDefault)');
  assert.ok(!parsed.step.columnname,
    'ColumnExists template must not invent a static <columnname> tag');
  assert.ok(!parsed.step.valuename,
    'ColumnExists template must not invent a <valuename> tag');

  // Non-default configuration: static table plus dynamic column field plus
  // custom boolean result field.
  const file = minimalKtr('b2a-columnexists');
  addElement(file, 'ColumnExists', 'Check column exists');
  setFieldPath(file, 'Check column exists', 'connection', '${CONN}');
  setFieldPath(file, 'Check column exists', 'tablename', 'EMP');
  setFieldPath(file, 'Check column exists', 'columnnamefield', 'EMP_ID');
  setFieldPath(file, 'Check column exists', 'resultfieldname', 'col_exists_flag');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<tablename>EMP<\/tablename>/);
  assert.match(after, /<columnnamefield>EMP_ID<\/columnnamefield>/);
  assert.match(after, /<resultfieldname>col_exists_flag<\/resultfieldname>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('DBJoin template follows DatabaseJoinMeta.getXML: connection, rowlimit, sql, outer_join, replace_vars, parameter/field list', () => {
  // DatabaseJoinMeta.getXML() (lines 338-359) emits connection, rowlimit, sql,
  // outer_join (Y/N), replace_vars (Y/N), then a PAIRED <parameter> wrapper
  // (always emitted, even with zero fields) holding <field> items with
  // <name> (input-stream field filling a ? marker) and <type> (value-meta
  // name string). setDefault() (lines 250-268): rowLimit=0, sql="", both
  // flags false, zero parameters.
  const ref = getReference('trans', 'DBJoin');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<rowlimit>', '<sql>', '<outer_join>', '<replace_vars>', '<parameter>'],
    'DBJoin');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'DBJoin template must carry <connection> (DB connection reference)');
  assert.equal(parsed.step.rowlimit, 0, 'rowlimit defaults 0 (ALL rows)');
  assert.equal(parsed.step.outer_join, 'N', 'outer_join defaults N (setDefault false)');
  assert.equal(parsed.step.replace_vars, 'N', 'replace_vars defaults N (setDefault false)');
  assert.ok(block.includes('</parameter>'),
    'DBJoin template must carry a paired <parameter> wrapper per getXML()');
  assert.ok(!parsed.step.lookup,
    'DBJoin template must not invent a <lookup> tag (parameter list is <parameter>/<field>)');

  // Non-default configuration: SQL with a ? marker plus one lookup
  // parameter field (name + value-meta type).
  const file = minimalKtr('b2a-dbjoin');
  addElement(file, 'DBJoin', 'Join department');
  setFieldPath(file, 'Join department', 'connection', '${CONN}');
  setFieldPath(file, 'Join department', 'sql',
    'SELECT dept_name FROM ${SCHEMA}.dept WHERE dept_id = ?');
  setFields(file, 'Join department', 'parameter', 'field', [
    { name: 'DEPT_ID', type: 'Integer' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<sql>SELECT dept_name FROM \$\{SCHEMA\}\.dept WHERE dept_id = \?<\/sql>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Join department');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.parameter.field)
    ? step.parameter.field
    : [step.parameter.field];
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'DEPT_ID');
  assert.equal(items[0].type, 'Integer');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B2a package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b2a-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b2a-package</name></info>',
    '<step><name>Check table exists</name><type>TableExists</type></step>',
    '<step><name>Check column exists</name><type>ColumnExists</type></step>',
    '<step><name>Join department</name><type>DBJoin</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b2a-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b2a-package</name><entries>',
    '<entry><name>Check dimension table</name><type>TABLE_EXISTS</type></entry>',
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
