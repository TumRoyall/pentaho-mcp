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

// Batch B3a (cleanse / transform): trans CheckSum, CloneRow, IfNull,
// NumberRange, SetValueConstant.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b3a-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans CheckSum -> org.pentaho.di.trans.steps.checksum.CheckSumMeta,
//   registry @Step annotation (id="CheckSum", lines 63-65). getXML() (lines
//   488-509) emits checksumtype, resultfieldName, resultType (lowercase code),
//   compatibilityMode, oldChecksumBehaviour, evaluationMethod (code),
//   fieldSeparatorString only when non-null, then a PAIRED <fields> wrapper
//   holding <field> items with <name>.
// - trans CloneRow -> org.pentaho.di.trans.steps.clonerow.CloneRowMeta,
//   registry @Step annotation (id="CloneRow", lines 58-61). getXML() (lines
//   93-105) emits nrclones (string), addcloneflag, cloneflagfield,
//   nrcloneinfield, nrclonefield, addclonenum, clonenumfield. No lists.
// - trans IfNull -> org.pentaho.di.trans.steps.ifnull.IfNullMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 85 (id="IfNull").
//   getXML() (lines 334-367) emits replaceAllByValue, replaceAllMask,
//   selectFields, selectValuesType, setEmptyStringAll, then a PAIRED
//   <valuetypes> wrapper holding <valuetype> items
//   (name+value+mask+set_type_empty_string), then a PAIRED <fields> wrapper
//   holding <field> items (name+value+mask+set_empty_string).
// - trans NumberRange -> org.pentaho.di.trans.steps.numberrange.NumberRangeMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 81
//   (id="NumberRange"). getXML() (lines 87-105) emits inputField, outputField,
//   fallBackValue, then a PAIRED <rules> wrapper holding <rule> items
//   (lower_bound+upper_bound+value).
// - trans SetValueConstant -> org.pentaho.di.trans.steps.setvalueconstant.SetValueConstantMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 92
//   (id="SetValueConstant"). getXML() (lines 115-130) emits usevar, then a
//   PAIRED <fields> wrapper holding <field> items
//   (name+value+mask+set_empty_string).
//
// None of the five references a database connection: no <connection> tag in
// any getXML(), so fixtures need no connection declaration.
const BATCH = [
  { kind: 'trans', xmlType: 'CheckSum', alias: 'CHECK_SUM' },
  { kind: 'trans', xmlType: 'CloneRow', alias: 'CLONE_ROW' },
  { kind: 'trans', xmlType: 'IfNull', alias: 'IF_NULL' },
  { kind: 'trans', xmlType: 'NumberRange', alias: 'NUMBER_RANGE' },
  { kind: 'trans', xmlType: 'SetValueConstant', alias: 'SET_VALUE_CONSTANT' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<usevar>') appears in `block` after
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b3a-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b3a') {
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

test('B3a catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B3a references resolve and their first XML block is one valid step with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (none of the five nests a field-level <type> tag).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B3a templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = minimalKtr(`b3a-${xmlType.toLowerCase()}`);
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

test('CheckSum template follows CheckSumMeta.getXML: checksumtype, resultfieldName, resultType code, flags, paired fields', () => {
  // CheckSumMeta.getXML() (lines 488-509) emits checksumtype, resultfieldName,
  // resultType (lowercase code via getResultTypeCode, lines 480-485),
  // compatibilityMode, oldChecksumBehaviour, evaluationMethod (code), then
  // fieldSeparatorString ONLY when non-null (lines 496-498), then the paired
  // <fields> wrapper (always emitted, lines 500/506). setDefault() (lines
  // 512-520): checksumtype=CRC32, resultType=HEXADECIMAL, evaluationMethod=BYTES.
  const ref = getReference('trans', 'CheckSum');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<checksumtype>', '<resultfieldName>', '<resultType>', '<compatibilityMode>',
      '<oldChecksumBehaviour>', '<evaluationMethod>', '<fields>'],
    'CheckSum');
  assert.equal(parsed.step.checksumtype, 'CRC32', 'checksumtype defaults CRC32 (setDefault)');
  assert.equal(parsed.step.resultType, 'hexadecimal',
    'resultType is the lowercase code, defaults hexadecimal (setDefault)');
  assert.equal(parsed.step.evaluationMethod, 'BYTES',
    'evaluationMethod is the code, defaults BYTES');
  assert.ok(block.includes('</fields>'),
    'CheckSum template must carry a paired <fields> wrapper per getXML()');
  assert.ok(!parsed.step.connection,
    'CheckSum template must not carry a <connection> tag (no DB reference)');
  const items = Array.isArray(parsed.step.fields.field)
    ? parsed.step.fields.field
    : [parsed.step.fields.field];
  assert.ok(items.length >= 1, 'template carries at least one checksum field');
  for (const item of items) {
    assert.ok(item.name, 'each <field> carries <name> (the only child per getXML)');
  }

  // Non-default configuration: MD5 + binary output + separator + 2 fields.
  const file = minimalKtr('b3a-checksum');
  addElement(file, 'CheckSum', 'Hash customer row');
  setFieldPath(file, 'Hash customer row', 'checksumtype', 'MD5');
  setFieldPath(file, 'Hash customer row', 'resultfieldName', 'ROW_HASH');
  setFieldPath(file, 'Hash customer row', 'resultType', 'binary');
  setFieldPath(file, 'Hash customer row', 'fieldSeparatorString', '|');
  setFields(file, 'Hash customer row', 'fields', 'field', [
    { name: 'CUST_CODE' },
    { name: 'CUST_NAME' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<checksumtype>MD5<\/checksumtype>/);
  assert.match(after, /<resultfieldName>ROW_HASH<\/resultfieldName>/);
  assert.match(after, /<resultType>binary<\/resultType>/);
  assert.match(after, /<fieldSeparatorString>\|<\/fieldSeparatorString>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Hash customer row');
  assert.ok(step, 'inserted step present');
  const fields = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, 'CUST_CODE');
  assert.equal(fields[1].name, 'CUST_NAME');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('CloneRow template follows CloneRowMeta.getXML 7-tag order (nrclones is a string)', () => {
  // CloneRowMeta.getXML() (lines 93-105) emits exactly nrclones (verbatim
  // string, line 95), addcloneflag, cloneflagfield, nrcloneinfield,
  // nrclonefield, addclonenum, clonenumfield. setDefault() (lines 188-196):
  // nrclones="0" (string), three names null, three flags false.
  const ref = getReference('trans', 'CloneRow');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<nrclones>', '<addcloneflag>', '<cloneflagfield>', '<nrcloneinfield>',
      '<nrclonefield>', '<addclonenum>', '<clonenumfield>'],
    'CloneRow');
  assert.equal(parsed.step.addcloneflag, 'Y', 'template enables the clone flag');
  assert.equal(parsed.step.cloneflagfield, 'is_clone', 'clone flag field pinned');
  assert.equal(parsed.step.nrcloneinfield, 'N', 'count source defaults N (static nrclones)');
  assert.equal(parsed.step.addclonenum, 'N', 'clone numbering defaults N');
  assert.ok(!parsed.step.connection,
    'CloneRow template must not carry a <connection> tag (no DB reference)');

  // Non-default configuration: 2 clones plus clone numbering.
  const file = minimalKtr('b3a-clonerow');
  addElement(file, 'CloneRow', 'Duplicate rows');
  setFieldPath(file, 'Duplicate rows', 'nrclones', '2');
  setFieldPath(file, 'Duplicate rows', 'addcloneflag', 'Y');
  setFieldPath(file, 'Duplicate rows', 'cloneflagfield', 'is_clone');
  setFieldPath(file, 'Duplicate rows', 'addclonenum', 'Y');
  setFieldPath(file, 'Duplicate rows', 'clonenumfield', 'clone_nr');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<nrclones>2<\/nrclones>/);
  assert.match(after, /<addcloneflag>Y<\/addcloneflag>/);
  assert.match(after, /<addclonenum>Y<\/addclonenum>/);
  assert.match(after, /<clonenumfield>clone_nr<\/clonenumfield>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('IfNull template follows IfNullMeta.getXML: replace-all flags then paired valuetypes and fields', () => {
  // IfNullMeta.getXML() (lines 334-367) emits replaceAllByValue,
  // replaceAllMask, selectFields, selectValuesType, setEmptyStringAll, then
  // the paired <valuetypes> wrapper (always emitted, lines 343/353) with
  // <valuetype> items (name+value+mask+set_type_empty_string), then the
  // paired <fields> wrapper (lines 355/364) with <field> items
  // (name+value+mask+set_empty_string). setDefault() (lines 369-398): all
  // flags false, both lists empty.
  const ref = getReference('trans', 'IfNull');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<replaceAllByValue>', '<replaceAllMask>', '<selectFields>', '<selectValuesType>',
      '<setEmptyStringAll>', '<valuetypes>', '<fields>'],
    'IfNull');
  assert.equal(parsed.step.selectFields, 'Y', 'template activates the per-field table');
  assert.ok(block.includes('</valuetypes>'),
    'IfNull template must carry a paired <valuetypes> wrapper per getXML()');
  assert.ok(block.includes('</fields>'),
    'IfNull template must carry a paired <fields> wrapper per getXML()');
  assert.ok(!parsed.step.connection,
    'IfNull template must not carry a <connection> tag (no DB reference)');

  // Non-default configuration: one typed empty-string rule plus two field
  // rules (one value, one empty string).
  const file = minimalKtr('b3a-ifnull');
  addElement(file, 'IfNull', 'Replace nulls');
  setFieldPath(file, 'Replace nulls', 'selectFields', 'Y');
  setFieldPath(file, 'Replace nulls', 'selectValuesType', 'Y');
  setFields(file, 'Replace nulls', 'valuetypes', 'valuetype', [
    {
      name: 'String', value: '', mask: '', set_type_empty_string: 'Y',
    },
  ]);
  setFields(file, 'Replace nulls', 'fields', 'field', [
    {
      name: 'NICKNAME', value: 'N/A', mask: '', set_empty_string: 'N',
    },
    {
      name: 'NOTES', value: '', mask: '', set_empty_string: 'Y',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<selectValuesType>Y<\/selectValuesType>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Replace nulls');
  assert.ok(step, 'inserted step present');
  const types = Array.isArray(step.valuetypes.valuetype)
    ? step.valuetypes.valuetype
    : [step.valuetypes.valuetype];
  assert.equal(types.length, 1);
  assert.equal(types[0].name, 'String');
  assert.equal(types[0].set_type_empty_string, 'Y');
  const fields = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, 'NICKNAME');
  assert.equal(fields[0].value, 'N/A');
  assert.equal(fields[1].name, 'NOTES');
  assert.equal(fields[1].set_empty_string, 'Y');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('NumberRange template follows NumberRangeMeta.getXML: inputField, outputField, fallBackValue, paired rules', () => {
  // NumberRangeMeta.getXML() (lines 87-105) emits inputField, outputField,
  // fallBackValue, then the paired <rules> wrapper (always emitted, lines
  // 94/102) with <rule> items (lower_bound+upper_bound+value, lines 95-101).
  // setDefault() (lines 153-161): fallBackValue="unknown",
  // outputField="range". Bounds load via Double.parseDouble with no
  // null-guard (lines 142-143), so every <rule> must carry numeric bounds.
  const ref = getReference('trans', 'NumberRange');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<inputField>', '<outputField>', '<fallBackValue>', '<rules>'],
    'NumberRange');
  assert.equal(parsed.step.outputField, 'range', 'outputField defaults "range" (setDefault)');
  assert.equal(parsed.step.fallBackValue, 'unknown',
    'fallBackValue defaults "unknown" (setDefault)');
  assert.ok(block.includes('</rules>'),
    'NumberRange template must carry a paired <rules> wrapper per getXML()');
  assert.ok(!parsed.step.connection,
    'NumberRange template must not carry a <connection> tag (no DB reference)');
  const templateRules = Array.isArray(parsed.step.rules.rule)
    ? parsed.step.rules.rule
    : [parsed.step.rules.rule];
  for (const rule of templateRules) {
    assert.ok(Number.isFinite(Number(rule.lower_bound)),
      'every template <rule> must carry a numeric <lower_bound> (parseDouble has no null-guard)');
    assert.ok(Number.isFinite(Number(rule.upper_bound)),
      'every template <rule> must carry a numeric <upper_bound>');
  }

  // Non-default configuration: three age bands plus a custom fallback.
  const file = minimalKtr('b3a-numberrange');
  addElement(file, 'NumberRange', 'Band ages');
  setFieldPath(file, 'Band ages', 'inputField', 'AGE');
  setFieldPath(file, 'Band ages', 'outputField', 'age_group');
  setFieldPath(file, 'Band ages', 'fallBackValue', 'out_of_range');
  setFields(file, 'Band ages', 'rules', 'rule', [
    { lower_bound: '0', upper_bound: '18', value: 'Minor' },
    { lower_bound: '18', upper_bound: '65', value: 'Adult' },
    { lower_bound: '65', upper_bound: '150', value: 'Senior' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<inputField>AGE<\/inputField>/);
  assert.match(after, /<outputField>age_group<\/outputField>/);
  assert.match(after, /<fallBackValue>out_of_range<\/fallBackValue>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Band ages');
  assert.ok(step, 'inserted step present');
  const rules = Array.isArray(step.rules.rule) ? step.rules.rule : [step.rules.rule];
  assert.equal(rules.length, 3);
  assert.equal(rules[0].lower_bound, 0);
  assert.equal(rules[0].upper_bound, 18);
  assert.equal(rules[0].value, 'Minor');
  assert.equal(rules[2].value, 'Senior');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SetValueConstant template follows SetValueConstantMeta.getXML: usevar then paired fields', () => {
  // SetValueConstantMeta.getXML() (lines 115-130) emits usevar (Y/N) then
  // the paired <fields> wrapper (always emitted, lines 118/127) with
  // <field> items (name+value+mask+set_empty_string, lines 119-126).
  // setDefault() (line 132-134) sets usevar=false; the list starts empty
  // (field declaration line 60).
  const ref = getReference('trans', 'SetValueConstant');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<usevar>', '<fields>'], 'SetValueConstant');
  assert.equal(parsed.step.usevar, 'N', 'usevar defaults N (setDefault false)');
  assert.ok(block.includes('</fields>'),
    'SetValueConstant template must carry a paired <fields> wrapper per getXML()');
  assert.ok(!parsed.step.connection,
    'SetValueConstant template must not carry a <connection> tag (no DB reference)');
  assert.ok(!parsed.step.valuetypes,
    'SetValueConstant template must not carry <valuetypes> (that belongs to IfNull)');

  // Non-default configuration: variable substitution plus a constant plus
  // an empty-string marker.
  const file = minimalKtr('b3a-setvalueconstant');
  addElement(file, 'SetValueConstant', 'Stamp constants');
  setFieldPath(file, 'Stamp constants', 'usevar', 'Y');
  setFields(file, 'Stamp constants', 'fields', 'field', [
    {
      name: 'LOAD_DATE', value: '${LOAD_DATE}', mask: 'yyyy-MM-dd', set_empty_string: 'N',
    },
    {
      name: 'STATUS', value: 'ACTIVE', mask: '', set_empty_string: 'N',
    },
    {
      name: 'NOTES', value: '', mask: '', set_empty_string: 'Y',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<usevar>Y<\/usevar>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Stamp constants');
  assert.ok(step, 'inserted step present');
  const fields = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(fields.length, 3);
  assert.equal(fields[0].name, 'LOAD_DATE');
  assert.equal(fields[0].value, '${LOAD_DATE}');
  assert.equal(fields[0].mask, 'yyyy-MM-dd');
  assert.equal(fields[2].name, 'NOTES');
  assert.equal(fields[2].set_empty_string, 'Y');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B3a package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b3a-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b3a-package</name></info>',
    '<step><name>Hash row</name><type>CheckSum</type></step>',
    '<step><name>Duplicate rows</name><type>CloneRow</type></step>',
    '<step><name>Replace nulls</name><type>IfNull</type></step>',
    '<step><name>Band ages</name><type>NumberRange</type></step>',
    '<step><name>Stamp constants</name><type>SetValueConstant</type></step>',
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
