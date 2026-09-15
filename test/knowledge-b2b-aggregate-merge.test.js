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

// Batch B2b (aggregate/merge): trans SortedMerge, trans MemoryGroupBy,
// trans AnalyticQuery.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b2b-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans SortedMerge -> org.pentaho.di.trans.steps.sortedmerge.SortedMergeMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="SortedMerge",
//   category Joins). SortedMergeMeta.getXML() (lines 125-138) emits ONLY a
//   <fields> block; each <field> has <name> and <ascending> (boolean Y/N).
//   setDefault() (lines 80-88) => 0 fields. getFields() (lines 166-179)
//   only sets sort flags on existing input columns (output schema = input).
//   PITFALL: readData() line 114 calls asc.equalsIgnoreCase("Y") with NO
//   null-guard, so a <field> missing <ascending> throws NPE.
// - trans MemoryGroupBy -> org.pentaho.di.trans.steps.memgroupby.MemoryGroupByMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="MemoryGroupBy",
//   category Statistics). MemoryGroupByMeta.getXML() (lines 444-469) emits
//   <give_back_row> FIRST, then <group>, then <fields>. <type> is the STRING
//   code from typeGroupCode (lines 102-105); unknown code => getType()
//   returns 0 = "-" (NONE). <valuefield> is a STRING separator, not an int.
//   PITFALL: missing <give_back_row> falls back to (has any COUNT_*
//   aggregate), not a hard false (lines 286-291).
// - trans AnalyticQuery ->
//   org.pentaho.di.trans.steps.analyticquery.AnalyticQueryMeta, registered by
//   annotation @Step(id="AnalyticQuery") (lines 62-64, category Statistics),
//   NOT in kettle-steps.xml. AnalyticQueryMeta.getXML() (lines 304-327)
//   emits <group> then <fields>; NO <give_back_row>. <type> is LEAD or LAG
//   (lines 72-73). <valuefield> is an INT offset N. PITFALL: readData()
//   line 220 does Integer.parseInt(...) with NO null-guard, so a <field>
//   missing <valuefield> throws.
// None of the three references a DB connection: NO <connection> tag.
const BATCH = [
  { kind: 'trans', xmlType: 'SortedMerge' },
  { kind: 'trans', xmlType: 'MemoryGroupBy' },
  { kind: 'trans', xmlType: 'AnalyticQuery' },
];

// MemoryGroupByMeta.typeGroupCode (lines 102-105) — the only legal <type>
// string codes; getType() maps anything else to 0 ("-").
const MEMORY_GROUP_BY_CODES = [
  '-', 'SUM', 'AVERAGE', 'MEDIAN', 'PERCENTILE', 'MIN', 'MAX', 'COUNT_ALL',
  'CONCAT_COMMA', 'FIRST', 'LAST', 'FIRST_INCL_NULL', 'LAST_INCL_NULL',
  'STD_DEV', 'CONCAT_STRING', 'COUNT_DISTINCT', 'COUNT_ANY',
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<fields>') appears in `block` after
// the previous one, mirroring the emission order of the source getXML().
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
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b2b-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b2b') {
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

test('B2b catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
  for (const { kind, xmlType } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.status, 'canonical', `${xmlType} should be canonical`);
    assert.equal(entry.generator_eligible, true, `${xmlType} must be generator-eligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), true, `${xmlType} eligibility`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${xmlType} verification`);
  }
});

test('B2b references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested field <type> such as MemoryGroupBy's
    // <fields>/<field>/<type> or AnalyticQuery's).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B2b templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const file = minimalKtr(`b2b-${xmlType.toLowerCase()}`);
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

test('SortedMerge template follows SortedMergeMeta.getXML: ONLY <fields> of <name>/<ascending>', () => {
  // SortedMergeMeta.getXML() (lines 125-138) emits ONLY a <fields> block;
  // each <field> carries <name> plus <ascending> (boolean Y/N, line 132).
  // setDefault() (lines 80-88) allocates 0 fields. getFields() (lines
  // 166-179) only flags existing input columns as sorted — output schema =
  // input; the step merges multiple already-sorted input streams.
  const ref = getReference('trans', 'SortedMerge');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<fields>'], 'SortedMerge');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'SortedMerge template must not carry <connection> (no DB reference in source)');
  assert.ok(!/<group(?:\s|\/?>)/.test(block),
    'SortedMerge emits <fields>, not <group>');
  assert.ok(!/<give_back_row(?:\s|\/?>)/.test(block),
    'SortedMerge has no <give_back_row> in source');
  const fields = parsed.step.fields;
  assert.ok(fields, 'SortedMerge template must carry <fields>');
  assert.ok(fields.field, 'SortedMerge template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  assert.ok(items.length >= 1, 'SortedMerge template must show at least one <field> example');
  for (const f of items) {
    assert.ok(hasOwn(f, 'name'), 'every SortedMerge <field> must carry <name>');
    // NPE pitfall: readData() line 114 calls asc.equalsIgnoreCase("Y") with
    // NO null-guard, so <ascending> MUST be present on every <field>.
    assert.ok(hasOwn(f, 'ascending'),
      'every SortedMerge <field> MUST carry <ascending> (missing tag => NPE at readData line 114)');
    assert.ok(f.ascending === 'Y' || f.ascending === 'N',
      'SortedMerge <ascending> is boolean Y/N per XMLHandler.addTagValue("ascending", boolean)');
  }

  // Non-default configuration: two sort keys with mixed directions.
  const file = minimalKtr('b2b-sortedmerge');
  addElement(file, 'SortedMerge', 'Merge sorted streams');
  setFields(file, 'Merge sorted streams', 'fields', 'field', [
    { name: 'CUSTOMER_ID', ascending: 'Y' },
    { name: 'ORDER_DATE', ascending: 'N' },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Merge sorted streams');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'CUSTOMER_ID');
  assert.equal(configured[0].ascending, 'Y');
  assert.equal(configured[1].name, 'ORDER_DATE');
  assert.equal(configured[1].ascending, 'N');
  for (const f of configured) {
    assert.ok(hasOwn(f, 'ascending'), '<ascending> present on every configured field (NPE guard)');
  }
  assert.equal(validateFile(file).summary.errors, 0);
});

test('MemoryGroupBy template follows MemoryGroupByMeta.getXML: give_back_row, group, fields with string type codes', () => {
  // MemoryGroupByMeta.getXML() (lines 444-469) emits <give_back_row> (line
  // 447) FIRST, then <group> (lines 449-455, each <field> has <name>), then
  // <fields> (lines 457-466, each <field> has <aggregate>, <subject>,
  // <type>, <valuefield>). <type> is the STRING code from typeGroupCode
  // (lines 102-105) via getTypeDesc (line 462); unknown code => getType()
  // returns 0 = "-" (lines 298-310). <valuefield> is a STRING separator
  // (line 463), not an int. setDefault() (lines 327-332) => 0 groups,
  // 0 aggregates.
  const ref = getReference('trans', 'MemoryGroupBy');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<give_back_row>', '<group>', '<fields>'],
    'MemoryGroupBy');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'MemoryGroupBy template must not carry <connection> (no DB reference in source)');
  assert.ok(hasOwn(parsed.step, 'give_back_row'),
    'MemoryGroupBy template must carry <give_back_row> (emitted first by getXML)');
  assert.ok(parsed.step.give_back_row === 'Y' || parsed.step.give_back_row === 'N',
    '<give_back_row> is boolean Y/N');
  const group = parsed.step.group;
  assert.ok(group, 'MemoryGroupBy template must carry <group>');
  assert.ok(group.field, 'MemoryGroupBy template must carry <group>/<field>');
  const groupItems = Array.isArray(group.field) ? group.field : [group.field];
  for (const g of groupItems) {
    assert.ok(hasOwn(g, 'name'), 'every <group>/<field> must carry <name>');
  }
  const fields = parsed.step.fields;
  assert.ok(fields, 'MemoryGroupBy template must carry <fields>');
  assert.ok(fields.field, 'MemoryGroupBy template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['aggregate', 'subject', 'type', 'valuefield']) {
      assert.ok(hasOwn(f, tag), `aggregate <field> must carry <${tag}> per getXML lines 460-463`);
    }
    assert.ok(MEMORY_GROUP_BY_CODES.includes(String(f.type)),
      `<type> must be a typeGroupCode string (unknown code loads as 0 = "-")`);
  }

  // Non-default configuration: one group key plus SUM and CONCAT_STRING
  // aggregates (<valuefield> is the string separator for CONCAT_*).
  const file = minimalKtr('b2b-memgroupby');
  addElement(file, 'MemoryGroupBy', 'Aggregate sales');
  setFieldPath(file, 'Aggregate sales', 'give_back_row', 'Y');
  setFields(file, 'Aggregate sales', 'group', 'field', [
    { name: 'REGION' },
  ]);
  setFields(file, 'Aggregate sales', 'fields', 'field', [
    {
      aggregate: 'TOTAL_SALES', subject: 'SALES', type: 'SUM', valuefield: '',
    },
    {
      aggregate: 'PRODUCT_LIST', subject: 'PRODUCT', type: 'CONCAT_STRING', valuefield: ';',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<give_back_row>Y<\/give_back_row>/);
  assert.match(after, /<group>[\s\S]*<name>REGION<\/name>[\s\S]*<\/group>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Aggregate sales');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].aggregate, 'TOTAL_SALES');
  assert.equal(configured[0].subject, 'SALES');
  assert.equal(configured[0].type, 'SUM');
  assert.equal(configured[1].aggregate, 'PRODUCT_LIST');
  assert.equal(configured[1].type, 'CONCAT_STRING');
  assert.equal(configured[1].valuefield, ';');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('AnalyticQuery template follows AnalyticQueryMeta.getXML: group then fields, LEAD/LAG with int offset', () => {
  // AnalyticQueryMeta.getXML() (lines 304-327) emits <group> (lines 307-313,
  // each <field> has <name>) then <fields> (lines 315-324, each <field> has
  // <aggregate>, <subject>, <type>, <valuefield>). NO <give_back_row>.
  // <type> is LEAD or LAG (typeGroupCode lines 72-73, via getTypeDesc line
  // 320). <valuefield> is an INT offset N (line 321). setDefault() (lines
  // 257-263) => 0 groups, 0 functions.
  const ref = getReference('trans', 'AnalyticQuery');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<group>', '<fields>'], 'AnalyticQuery');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'AnalyticQuery template must not carry <connection> (no DB reference in source)');
  assert.ok(!/<give_back_row(?:\s|\/?>)/.test(block),
    'AnalyticQuery has no <give_back_row> in source');
  const group = parsed.step.group;
  assert.ok(group, 'AnalyticQuery template must carry <group>');
  assert.ok(group.field, 'AnalyticQuery template must carry <group>/<field>');
  const groupItems = Array.isArray(group.field) ? group.field : [group.field];
  for (const g of groupItems) {
    assert.ok(hasOwn(g, 'name'), 'every <group>/<field> must carry <name>');
  }
  const fields = parsed.step.fields;
  assert.ok(fields, 'AnalyticQuery template must carry <fields>');
  assert.ok(fields.field, 'AnalyticQuery template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['aggregate', 'subject', 'type', 'valuefield']) {
      assert.ok(hasOwn(f, tag), `analytic <field> must carry <${tag}> per getXML lines 318-321`);
    }
    assert.ok(String(f.type) === 'LEAD' || String(f.type) === 'LAG',
      '<type> must be LEAD or LAG per typeGroupCode');
    // Integer pitfall: readData() line 220 does
    // Integer.parseInt(getTagValue(fnode, "valuefield")) with NO null-guard,
    // so <valuefield> MUST be present and numeric.
    assert.ok(hasOwn(f, 'valuefield'),
      'every analytic <field> MUST carry <valuefield> (missing tag => NumberFormatException at readData line 220)');
    assert.ok(Number.isInteger(Number(f.valuefield)),
      '<valuefield> must parse as an integer offset N');
  }

  // Non-default configuration: partition by customer, LEAD over order total
  // with offset 1.
  const file = minimalKtr('b2b-analyticquery');
  addElement(file, 'AnalyticQuery', 'Next order total');
  setFields(file, 'Next order total', 'group', 'field', [
    { name: 'CUSTOMER_ID' },
  ]);
  setFields(file, 'Next order total', 'fields', 'field', [
    {
      aggregate: 'NEXT_ORDER_TOTAL', subject: 'ORDER_TOTAL', type: 'LEAD', valuefield: '1',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<group>[\s\S]*<name>CUSTOMER_ID<\/name>[\s\S]*<\/group>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Next order total');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 1);
  assert.equal(configured[0].aggregate, 'NEXT_ORDER_TOTAL');
  assert.equal(configured[0].subject, 'ORDER_TOTAL');
  assert.equal(configured[0].type, 'LEAD');
  assert.ok(Number.isInteger(Number(configured[0].valuefield)),
    '<valuefield> parses as an integer offset');
  assert.equal(Number(configured[0].valuefield), 1);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B2b package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b2b-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b2b-package</name></info>',
    '<step><name>Merge sorted streams</name><type>SortedMerge</type></step>',
    '<step><name>Aggregate sales</name><type>MemoryGroupBy</type></step>',
    '<step><name>Next order total</name><type>AnalyticQuery</type></step>',
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
