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

// Batch B3c (pivot + validate): trans Normaliser, trans Denormaliser,
// trans Validator, trans Formula.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b3c-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans Normaliser -> org.pentaho.di.trans.steps.normaliser.NormaliserMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="Normaliser",
//   category Transform). NormaliserMeta.getXML() (lines 255-271) emits
//   <typefield> FIRST, then a PAIRED <fields> wrapper (always emitted, even
//   with zero fields) holding <field> items with <name> (source column),
//   <value> (type value) and <norm> (target field). setDefault()
//   (lines 185-197) => typeField="typefield", 0 fields.
// - trans Denormaliser ->
//   org.pentaho.di.trans.steps.denormaliser.DenormaliserMeta, registry
//   engine/src/main/resources/kettle-steps.xml (id="Denormaliser", category
//   Transform). DenormaliserMeta.getXML() (lines 257-296) emits <key_field>,
//   then <group> (each <field> has only <name>), then <fields> (each <field>
//   has exactly 12 tags: field_name, key_value, target_name, target_type
//   [value-meta name string], target_format, target_length, target_precision,
//   target_decimal_symbol, target_grouping_symbol, target_currency_symbol,
//   target_null_string, target_aggregation_type). <target_aggregation_type>
//   is one of "-", "SUM", "AVERAGE", "MIN", "MAX", "COUNT_ALL",
//   "CONCAT_COMMA" (DenormaliserTargetField.java lines 58-60); an unknown
//   string silently loads as 0 = "-" (lines 275-287). setDefault()
//   (lines 154-159) => 0 groups, 0 targets.
// - trans Validator -> org.pentaho.di.trans.steps.validator.ValidatorMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="Validator",
//   category Validation). ValidatorMeta.getXML() (lines 107-119) emits
//   <validate_all>, <concat_errors>, <concat_separator>, then one
//   <validator_field> block per rule DIRECTLY under <step> (NO wrapper list;
//   loadXML counts them directly, line 95). Validation.getXML()
//   (Validation.java lines 132-183) emits <name> (= the FIELD under test),
//   <validation_name> (= rule name), then length flags, Y/N booleans,
//   <data_type> (value-meta name string), masks, <max_value> BEFORE
//   <min_value>, start/end strings, regexes, error code/description,
//   sourcing tags, and a PAIRED <allowed_value> wrapper (always emitted)
//   holding <value> items. setDefault() (lines 149-152) => empty list,
//   concatenationSeparator="|".
// - trans Formula -> org.pentaho.di.trans.steps.formula.FormulaMeta,
//   registry engine/src/main/resources/kettle-steps.xml (id="Formula",
//   category Scripting). FormulaMeta.getXML() (lines 91-101) emits NO scalar
//   tags, only repeated <formula> blocks DIRECTLY under <step> (loadXML
//   counts them directly, line 83). FormulaMetaFunction.getXML()
//   (FormulaMetaFunction.java lines 97-112) emits field_name,
//   formula_string, value_type (value-meta name string), value_length,
//   value_precision, replace_field. setDefault() (lines 131-133) =>
//   0 formulas.
// None of the four references a DB connection: NO <connection> tag.
const BATCH = [
  { kind: 'trans', xmlType: 'Normaliser', alias: 'NORMALISER' },
  { kind: 'trans', xmlType: 'Denormaliser', alias: 'DENORMALISER' },
  { kind: 'trans', xmlType: 'Validator', alias: 'VALIDATOR' },
  { kind: 'trans', xmlType: 'Formula', alias: 'FORMULA' },
];

// DenormaliserTargetField.typeAggrDesc (lines 58-60) — the only legal
// <target_aggregation_type> codes; getAggregationType() maps anything else
// to 0 ("-").
const DENORMALISER_AGGR_CODES = [
  '-', 'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT_ALL', 'CONCAT_COMMA',
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

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b3c-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b3c') {
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

test('B3c catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B3c references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested value-type tag such as
    // Denormaliser's <target_type>, Validator's <data_type> or Formula's
    // <value_type>).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B3c templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const file = minimalKtr(`b3c-${xmlType.toLowerCase()}`);
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

test('Normaliser template follows NormaliserMeta.getXML: typefield then fields of name/value/norm', () => {
  // NormaliserMeta.getXML() (lines 255-271) emits <typefield> (line 258)
  // FIRST, then a PAIRED <fields> wrapper (always emitted, lines 260/268)
  // holding <field> items with <name> (source column), <value> (type value)
  // and <norm> (target field). setDefault() (lines 185-197) =>
  // typeField="typefield", 0 fields.
  const ref = getReference('trans', 'Normaliser');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<typefield>', '<fields>'], 'Normaliser');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'Normaliser template must not carry <connection> (no DB reference in source)');
  const fields = parsed.step.fields;
  assert.ok(fields, 'Normaliser template must carry <fields>');
  assert.ok(fields.field, 'Normaliser template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  assert.ok(items.length >= 1, 'Normaliser template must show at least one <field> example');
  for (const f of items) {
    for (const tag of ['name', 'value', 'norm']) {
      assert.ok(hasOwn(f, tag), `Normaliser <field> must carry <${tag}> per getXML lines 263-265`);
    }
  }
  assert.ok(block.includes('</fields>'),
    'Normaliser template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: custom type field plus two source columns
  // sharing one type value but landing in different target fields.
  const file = minimalKtr('b3c-normaliser');
  addElement(file, 'Normaliser', 'Normalise products');
  setFieldPath(file, 'Normalise products', 'typefield', 'PRODUCT');
  setFields(file, 'Normalise products', 'fields', 'field', [
    { name: 'PRODUCT1_SL', value: 'PRODUCT1', norm: 'Sales' },
    { name: 'PRODUCT1_NR', value: 'PRODUCT1', norm: 'Number' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<typefield>PRODUCT<\/typefield>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Normalise products');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'PRODUCT1_SL');
  assert.equal(configured[0].value, 'PRODUCT1');
  assert.equal(configured[0].norm, 'Sales');
  assert.equal(configured[1].norm, 'Number');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('Denormaliser template follows DenormaliserMeta.getXML: key_field, group, 12-tag fields', () => {
  // DenormaliserMeta.getXML() (lines 257-296) emits <key_field> (line 260),
  // then <group> (lines 262-268, each <field> has ONLY <name>), then
  // <fields> (lines 270-293, each <field> has exactly 12 tags in order:
  // field_name, key_value, target_name, target_type, target_format,
  // target_length, target_precision, target_decimal_symbol,
  // target_grouping_symbol, target_currency_symbol, target_null_string,
  // target_aggregation_type). setDefault() (lines 154-159) => 0 groups,
  // 0 targets.
  const ref = getReference('trans', 'Denormaliser');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<key_field>', '<group>', '<fields>'], 'Denormaliser');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'Denormaliser template must not carry <connection> (no DB reference in source)');
  assert.ok(hasOwn(parsed.step, 'key_field'),
    'Denormaliser template must carry <key_field> (getFields throws when empty)');
  const group = parsed.step.group;
  assert.ok(group, 'Denormaliser template must carry <group>');
  assert.ok(group.field, 'Denormaliser template must carry <group>/<field>');
  const groupItems = Array.isArray(group.field) ? group.field : [group.field];
  for (const g of groupItems) {
    assert.ok(hasOwn(g, 'name'), 'every <group>/<field> must carry <name>');
  }
  const fields = parsed.step.fields;
  assert.ok(fields, 'Denormaliser template must carry <fields>');
  assert.ok(fields.field, 'Denormaliser template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  const twelve = ['field_name', 'key_value', 'target_name', 'target_type',
    'target_format', 'target_length', 'target_precision',
    'target_decimal_symbol', 'target_grouping_symbol',
    'target_currency_symbol', 'target_null_string',
    'target_aggregation_type'];
  for (const f of items) {
    for (const tag of twelve) {
      assert.ok(hasOwn(f, tag), `denormaliser <field> must carry <${tag}> per getXML lines 275-290`);
    }
    // <target_type> is a value-meta NAME string, never a numeric id.
    assert.ok(Number.isNaN(Number(f.target_type)),
      '<target_type> must be a value-meta name string (String/Integer/Number/...)');
    assert.ok(DENORMALISER_AGGR_CODES.includes(String(f.target_aggregation_type)),
      '<target_aggregation_type> must be one of -, SUM, AVERAGE, MIN, MAX, COUNT_ALL, CONCAT_COMMA');
  }
  assertTagOrder(block,
    ['<field_name>', '<key_value>', '<target_name>', '<target_type>',
      '<target_format>', '<target_length>', '<target_precision>',
      '<target_aggregation_type>'],
    'Denormaliser field order');

  // Non-default configuration: pivot quarterly sales into two SUM columns.
  const file = minimalKtr('b3c-denormaliser');
  addElement(file, 'Denormaliser', 'Pivot quarters');
  setFieldPath(file, 'Pivot quarters', 'key_field', 'QUARTER');
  setFields(file, 'Pivot quarters', 'group', 'field', [
    { name: 'REGION' },
  ]);
  setFields(file, 'Pivot quarters', 'fields', 'field', [
    {
      field_name: 'SALES', key_value: 'Q1', target_name: 'SALES_Q1',
      target_type: 'Number', target_format: '', target_length: '-1',
      target_precision: '-1', target_decimal_symbol: '',
      target_grouping_symbol: '', target_currency_symbol: '',
      target_null_string: '', target_aggregation_type: 'SUM',
    },
    {
      field_name: 'SALES', key_value: 'Q2', target_name: 'SALES_Q2',
      target_type: 'Number', target_format: '', target_length: '-1',
      target_precision: '-1', target_decimal_symbol: '',
      target_grouping_symbol: '', target_currency_symbol: '',
      target_null_string: '', target_aggregation_type: 'SUM',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<key_field>QUARTER<\/key_field>/);
  assert.match(after, /<group>[\s\S]*<name>REGION<\/name>[\s\S]*<\/group>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Pivot quarters');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].target_name, 'SALES_Q1');
  assert.equal(configured[0].target_aggregation_type, 'SUM');
  assert.equal(configured[1].key_value, 'Q2');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('Validator template follows ValidatorMeta.getXML: scalars then direct validator_field repeats', () => {
  // ValidatorMeta.getXML() (lines 107-119) emits validate_all,
  // concat_errors, concat_separator (lines 110-112), then one
  // <validator_field> per rule DIRECTLY under <step> (no wrapper list;
  // loadXML counts them directly, line 95). Validation.getXML()
  // (Validation.java lines 132-183) emits <name> (= field under test) then
  // <validation_name>, Y/N booleans, <data_type> (value-meta name string),
  // <max_value> BEFORE <min_value>, then strings/regexes/error/sourcing
  // tags and a PAIRED <allowed_value> wrapper. setDefault() (lines
  // 149-152) => empty list, concatenationSeparator="|".
  const ref = getReference('trans', 'Validator');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<validate_all>', '<concat_errors>', '<concat_separator>', '<validator_field>'],
    'Validator');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'Validator template must not carry <connection> (no DB reference in source)');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block),
    'Validator has no <fields> wrapper in source (rules repeat directly)');
  assert.equal(parsed.step.concat_separator, '|',
    'concat_separator defaults to "|" (setDefault)');
  const rules = Array.isArray(parsed.step.validator_field)
    ? parsed.step.validator_field
    : [parsed.step.validator_field];
  assert.ok(rules.length >= 1, 'Validator template must show at least one <validator_field>');
  for (const r of rules) {
    // <name> holds the FIELD under test; <validation_name> the rule name.
    assert.ok(hasOwn(r, 'name'), 'every <validator_field> must carry <name> (field under test)');
    assert.ok(hasOwn(r, 'validation_name'), 'every <validator_field> must carry <validation_name>');
    for (const flag of ['null_allowed', 'only_null_allowed', 'only_numeric_allowed',
      'data_type_verified', 'is_sourcing_values']) {
      assert.ok(r[flag] === 'Y' || r[flag] === 'N',
        `<${flag}> is boolean Y/N per "Y".equalsIgnoreCase parsing`);
    }
    assert.ok(hasOwn(r, 'data_type'), 'every <validator_field> must carry <data_type>');
  }
  assertTagOrder(block, ['<max_value>', '<min_value>'], 'Validator max-before-min');
  assert.ok(block.includes('</allowed_value>'),
    'Validator template must carry a paired <allowed_value> wrapper per getXML()');

  // Non-default configuration: validate all rules, concatenate errors with
  // ";", and require a non-null email matching a pattern.
  const file = minimalKtr('b3c-validator');
  addElement(file, 'Validator', 'Validate email');
  setFieldPath(file, 'Validate email', 'validate_all', 'Y');
  setFieldPath(file, 'Validate email', 'concat_errors', 'Y');
  setFieldPath(file, 'Validate email', 'concat_separator', ';');
  setFieldPath(file, 'Validate email', 'validator_field/null_allowed', 'N');
  setFieldPath(file, 'Validate email', 'validator_field/error_code', 'ERR_EMAIL');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<validate_all>Y<\/validate_all>/);
  assert.match(after, /<concat_errors>Y<\/concat_errors>/);
  assert.match(after, /<concat_separator>;<\/concat_separator>/);
  assert.match(after, /<null_allowed>N<\/null_allowed>/);
  assert.match(after, /<error_code>ERR_EMAIL<\/error_code>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('Formula template follows FormulaMeta.getXML: direct formula repeats with expression per field', () => {
  // FormulaMeta.getXML() (lines 91-101) emits NO scalar tags, only repeated
  // <formula> blocks DIRECTLY under <step> (loadXML counts them directly,
  // line 83). FormulaMetaFunction.getXML() (lines 97-112) emits field_name,
  // formula_string, value_type (value-meta name string), value_length,
  // value_precision, replace_field. setDefault() (lines 131-133) =>
  // 0 formulas.
  const ref = getReference('trans', 'Formula');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'Formula template must not carry <connection> (no DB reference in source)');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block),
    'Formula has no <fields> wrapper in source (formulas repeat directly)');
  const formulas = Array.isArray(parsed.step.formula)
    ? parsed.step.formula
    : [parsed.step.formula];
  assert.ok(formulas.length >= 1, 'Formula template must show at least one <formula>');
  for (const f of formulas) {
    for (const tag of ['field_name', 'formula_string', 'value_type',
      'value_length', 'value_precision', 'replace_field']) {
      assert.ok(hasOwn(f, tag), `formula block must carry <${tag}> per getXML lines 102-107`);
    }
    // <value_type> is a value-meta NAME string, never a numeric id.
    assert.ok(Number.isNaN(Number(f.value_type)),
      '<value_type> must be a value-meta name string (String/Number/Integer/...)');
  }
  assertTagOrder(block,
    ['<field_name>', '<formula_string>', '<value_type>', '<value_length>',
      '<value_precision>', '<replace_field>'],
    'Formula field order');

  // Non-default configuration: a taxed-total expression (with a `<`
  // comparison proving XML-escaping) plus numeric result metadata.
  const file = minimalKtr('b3c-formula');
  addElement(file, 'Formula', 'Compute total');
  setFieldPath(file, 'Compute total', 'formula/field_name', 'TOTAL_WITH_TAX');
  setFieldPath(file, 'Compute total', 'formula/formula_string', 'IF([PRICE] < [LIMIT]; [PRICE] * 2; [PRICE])');
  setFieldPath(file, 'Compute total', 'formula/value_type', 'Number');
  setFieldPath(file, 'Compute total', 'formula/value_precision', '2');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<field_name>TOTAL_WITH_TAX<\/field_name>/);
  assert.match(after, /<formula_string>IF\(\[PRICE\] &lt; \[LIMIT\]; \[PRICE\] \* 2; \[PRICE\]\)<\/formula_string>/);
  assert.match(after, /<value_type>Number<\/value_type>/);
  assert.match(after, /<value_precision>2<\/value_precision>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B3c package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b3c-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b3c-package</name></info>',
    '<step><name>Normalise products</name><type>Normaliser</type></step>',
    '<step><name>Pivot quarters</name><type>Denormaliser</type></step>',
    '<step><name>Validate email</name><type>Validator</type></step>',
    '<step><name>Compute total</name><type>Formula</type></step>',
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
