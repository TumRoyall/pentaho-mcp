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

// Batch B2c (SCD / data warehouse): trans DimensionLookup, trans
// CombinationLookup.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b2c-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans DimensionLookup -> org.pentaho.di.trans.steps.dimensionlookup.DimensionLookupMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 25 (id="DimensionLookup").
//   getXML() (lines 832-893) emits schema, table, connection, commit, update,
//   then a PAIRED <fields> wrapper holding <key> (name+lookup), one <date>
//   (name+from+to), <field> (name+lookup+update code), one <return>
//   (name+rename+creation_method+use_autoinc+version), then sequence, min_year,
//   max_year, cache_size, preload_cache, use_start_date_alternative,
//   start_date_alternative, start_date_field_name, useBatch.
// - trans CombinationLookup -> org.pentaho.di.trans.steps.combinationlookup.CombinationLookupMeta,
//   registry @Step annotation (lines 73-75, id="CombinationLookup").
//   getXML() (lines 509-544) emits schema, table, connection, commit,
//   cache_size, replace, preloadCache, crc, crcfield, then a PAIRED <fields>
//   wrapper holding <key> (name+lookup) and one <return>
//   (name+creation_method+use_autoinc), then sequence, last_update_field.
const BATCH = [
  { kind: 'trans', xmlType: 'DimensionLookup', alias: 'DIMENSION_LOOKUP' },
  { kind: 'trans', xmlType: 'CombinationLookup', alias: 'COMBINATION_LOOKUP' },
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

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b2c-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b2c') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // Declare the ${CONN} connection both SCD steps reference so the structural
    // validator's undefined-connection rule is satisfied (a real .ktr using a
    // connection must declare it; Kettle allows a variable in the name).
    '  <connection><name>${CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

test('B2c catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B2c references resolve and their first XML block is one valid step with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (neither SCD step nests a field-level <type> tag,
    // unlike DBJoin's <parameter>/<field>/<type>).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B2c templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = minimalKtr(`b2c-${xmlType.toLowerCase()}`);
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

test('DimensionLookup template follows DimensionLookupMeta.getXML tag order and SCD structure', () => {
  // DimensionLookupMeta.getXML() (lines 832-893) emits schema, table,
  // connection, commit, update, then the paired <fields> wrapper (lines
  // 843/876) with <key> items, one <date>, <field> items, one <return>,
  // then sequence, min_year, max_year, cache_size, preload_cache,
  // use_start_date_alternative, start_date_alternative,
  // start_date_field_name, useBatch. setDefault() (lines 704-746):
  // commit=100, update=true, cache_size=5000, min/max year 1900/2199,
  // date_from/date_to, version="version", autoIncrement=false.
  const ref = getReference('trans', 'DimensionLookup');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<schema>', '<table>', '<connection>', '<commit>', '<update>', '<fields>',
      '<sequence>', '<min_year>', '<max_year>', '<cache_size>', '<preload_cache>',
      '<use_start_date_alternative>', '<start_date_alternative>',
      '<start_date_field_name>', '<useBatch>'],
    'DimensionLookup');
  // Internal <fields> order: keys, then the single <date>, then fields,
  // then the single <return> (getXML lines 844-874).
  const keyAt = block.indexOf('<key>');
  const dateAt = block.indexOf('<date>');
  const fieldAt = block.indexOf('<field>');
  const returnAt = block.indexOf('<return>');
  assert.ok(keyAt !== -1 && dateAt !== -1 && fieldAt !== -1 && returnAt !== -1,
    'DimensionLookup template must carry <key>, <date>, <field> and <return>');
  assert.ok(keyAt < dateAt && dateAt < fieldAt && fieldAt < returnAt,
    'DimensionLookup <fields> children must follow getXML() order key/date/field/return');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'DimensionLookup template must carry <connection> (DB connection reference)');
  assert.ok(block.includes('</fields>'),
    'DimensionLookup template must carry a paired <fields> wrapper per getXML()');
  assert.equal(parsed.step.commit, 100, 'commit defaults 100 (setDefault)');
  assert.equal(parsed.step.update, 'Y', 'update defaults Y (setDefault true)');
  assert.equal(parsed.step.cache_size, 5000, 'cache_size defaults 5000 (setDefault)');
  assert.equal(parsed.step.min_year, 1900, 'min_year defaults Const.MIN_YEAR=1900');
  assert.equal(parsed.step.max_year, 2199, 'max_year defaults Const.MAX_YEAR=2199');
  assert.ok(!parsed.step.schemaname,
    'DimensionLookup template must use <schema>, not <schemaname>');
  assert.ok(!parsed.step.tablename,
    'DimensionLookup template must use <table>, not <tablename>');

  // Non-default SCD Type II configuration: natural key, stream date range,
  // one Insert field (new version) plus one Update field (overwrite), and a
  // tablemax technical key return (all placeholders, never real credentials).
  const file = minimalKtr('b2c-dimensionlookup');
  addElement(file, 'DimensionLookup', 'Update customer dim');
  setFieldPath(file, 'Update customer dim', 'connection', '${CONN}');
  setFieldPath(file, 'Update customer dim', 'schema', '${SCHEMA}');
  setFieldPath(file, 'Update customer dim', 'table', '${TABLE}');
  setFields(file, 'Update customer dim', 'fields', 'key', [
    { name: 'CUST_CODE', lookup: 'cust_code' },
  ]);
  setFieldPath(file, 'Update customer dim', 'fields/date/name', 'ORDER_DATE');
  setFieldPath(file, 'Update customer dim', 'fields/date/from', 'date_from');
  setFieldPath(file, 'Update customer dim', 'fields/date/to', 'date_to');
  setFields(file, 'Update customer dim', 'fields', 'field', [
    { name: 'CUST_NAME', lookup: 'cust_name', update: 'Insert' },
    { name: 'CUST_SEGMENT', lookup: 'cust_segment', update: 'Update' },
  ]);
  setFieldPath(file, 'Update customer dim', 'fields/return/name', 'customer_sk');
  setFieldPath(file, 'Update customer dim', 'fields/return/rename', 'CUSTOMER_SK');
  setFieldPath(file, 'Update customer dim', 'fields/return/creation_method', 'tablemax');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<schema>\$\{SCHEMA\}<\/schema>/);
  assert.match(after, /<table>\$\{TABLE\}<\/table>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Update customer dim');
  assert.ok(step, 'inserted step present');
  const keys = Array.isArray(step.fields.key) ? step.fields.key : [step.fields.key];
  assert.equal(keys.length, 1);
  assert.equal(keys[0].name, 'CUST_CODE');
  assert.equal(keys[0].lookup, 'cust_code');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'CUST_NAME');
  assert.equal(items[0].update, 'Insert');
  assert.equal(items[1].name, 'CUST_SEGMENT');
  assert.equal(items[1].update, 'Update');
  assert.equal(step.fields.return.creation_method, 'tablemax');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('CombinationLookup template follows CombinationLookupMeta.getXML tag order and structure', () => {
  // CombinationLookupMeta.getXML() (lines 509-544) emits schema, table,
  // connection, commit, cache_size, replace, preloadCache, crc, crcfield,
  // then the paired <fields> wrapper (lines 523/537) with <key> items and
  // one <return> (name+creation_method+use_autoinc — no version/rename),
  // then sequence, last_update_field. setDefault() (lines 465-487):
  // commit=100, cache_size=9999, replace/preloadCache/useHash=false,
  // crcfield="hashcode", useAutoinc=false.
  const ref = getReference('trans', 'CombinationLookup');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<schema>', '<table>', '<connection>', '<commit>', '<cache_size>', '<replace>',
      '<preloadCache>', '<crc>', '<crcfield>', '<fields>',
      '<sequence>', '<last_update_field>'],
    'CombinationLookup');
  // Internal <fields> order: keys first, then the single <return>
  // (getXML lines 524-535).
  const keyAt = block.indexOf('<key>');
  const returnAt = block.indexOf('<return>');
  assert.ok(keyAt !== -1 && returnAt !== -1,
    'CombinationLookup template must carry <key> and <return>');
  assert.ok(keyAt < returnAt,
    'CombinationLookup <fields> children must follow getXML() order key/return');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'CombinationLookup template must carry <connection> (DB connection reference)');
  assert.ok(block.includes('</fields>'),
    'CombinationLookup template must carry a paired <fields> wrapper per getXML()');
  assert.equal(parsed.step.commit, 100, 'commit defaults 100 (setDefault)');
  assert.equal(parsed.step.cache_size, 9999, 'cache_size defaults 9999 (DEFAULT_CACHE_SIZE)');
  assert.equal(parsed.step.replace, 'N', 'replace defaults N (setDefault false)');
  assert.equal(parsed.step.crc, 'N', 'crc defaults N (setDefault false)');
  assert.equal(parsed.step.crcfield, 'hashcode', 'crcfield defaults "hashcode" (setDefault)');
  assert.ok(!parsed.step.tablename,
    'CombinationLookup template must use <table>, not <tablename>');

  // Non-default configuration: two-key combination with hash lookup,
  // replace-fields on, sequence-generated technical key and a last-update
  // field (placeholders only, never real credentials).
  const file = minimalKtr('b2c-combinationlookup');
  addElement(file, 'CombinationLookup', 'Lookup product combo');
  setFieldPath(file, 'Lookup product combo', 'connection', '${CONN}');
  setFieldPath(file, 'Lookup product combo', 'schema', '${SCHEMA}');
  setFieldPath(file, 'Lookup product combo', 'table', '${TABLE}');
  setFieldPath(file, 'Lookup product combo', 'replace', 'Y');
  setFieldPath(file, 'Lookup product combo', 'crc', 'Y');
  setFieldPath(file, 'Lookup product combo', 'crcfield', 'combo_hash');
  setFields(file, 'Lookup product combo', 'fields', 'key', [
    { name: 'BRAND', lookup: 'brand' },
    { name: 'COLOR', lookup: 'color' },
  ]);
  setFieldPath(file, 'Lookup product combo', 'fields/return/name', 'product_sk');
  setFieldPath(file, 'Lookup product combo', 'fields/return/creation_method', 'sequence');
  setFieldPath(file, 'Lookup product combo', 'sequence', '${SEQ_PRODUCT_SK}');
  setFieldPath(file, 'Lookup product combo', 'last_update_field', 'last_update');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<replace>Y<\/replace>/);
  assert.match(after, /<crc>Y<\/crc>/);
  assert.match(after, /<crcfield>combo_hash<\/crcfield>/);
  assert.match(after, /<sequence>\$\{SEQ_PRODUCT_SK\}<\/sequence>/);
  assert.match(after, /<last_update_field>last_update<\/last_update_field>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Lookup product combo');
  assert.ok(step, 'inserted step present');
  const keys = Array.isArray(step.fields.key) ? step.fields.key : [step.fields.key];
  assert.equal(keys.length, 2);
  assert.equal(keys[0].name, 'BRAND');
  assert.equal(keys[0].lookup, 'brand');
  assert.equal(keys[1].name, 'COLOR');
  assert.equal(keys[1].lookup, 'color');
  assert.equal(step.fields.return.name, 'product_sk');
  assert.equal(step.fields.return.creation_method, 'sequence');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B2c package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b2c-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b2c-package</name></info>',
    '<step><name>Update customer dim</name><type>DimensionLookup</type></step>',
    '<step><name>Lookup product combo</name><type>CombinationLookup</type></step>',
    '<order/></transformation>',
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
