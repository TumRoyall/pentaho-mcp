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

// Batch B3b (transform): trans SetValueField, ReplaceString,
// SplitFieldToRows3, FieldSplitter, UniqueRowsByHashSet.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b3b-source-notes.md.
//
// Grounding (all at the pinned commit):
// - trans SetValueField -> org.pentaho.di.trans.steps.setvaluefield.SetValueFieldMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 93
//   (id="SetValueField", category Transform). getXML() (lines 148-162)
//   emits ONLY a PAIRED <fields> wrapper holding <field> (name+replaceby).
//   setDefault() (lines 137-146): 0 fields. Assigns each field the value of
//   ANOTHER field (not a constant).
// - trans ReplaceString -> org.pentaho.di.trans.steps.replacestring.ReplaceStringMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 83
//   (id="ReplaceString", category Transform). getXML() (lines 284-310) emits
//   ONLY a PAIRED <fields> wrapper; each <field> has in_stream_name,
//   out_stream_name, use_regex, replace_string, replace_by_string,
//   set_empty_string, replace_field_by_string, whole_word, case_sensitive,
//   is_unicode. The four match flags serialize as "yes"/"no" (BACKLOG-27839),
//   NOT Y/N; set_empty_string is standard Y/N. Empty out_stream_name =
//   in-place replace.
// - trans SplitFieldToRows3 ->
//   org.pentaho.di.trans.steps.splitfieldtorows.SplitFieldToRowsMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 61
//   (id="SplitFieldToRows3" — WITH the trailing 3, category Transform).
//   getXML() (lines 175-187) emits splitfield, delimiter, newfield, rownum
//   (Y/N), rownum_field, resetrownumber (Y/N), delimiter_is_regex (Y/N).
//   setDefault() (lines 149-157): delimiter=";", resetRowNumber=true (the
//   only Y default), rest false/empty.
// - trans FieldSplitter -> org.pentaho.di.trans.steps.fieldsplitter.FieldSplitterMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 104
//   (id="FieldSplitter", category Transform). getXML() (lines 452-496) emits
//   splitfield, delimiter, enclosure, then a PAIRED <fields> wrapper; each
//   <field> has name, id, idrem (Y/N), type (value-meta NAME string),
//   format, group, decimal, currency, length (int, -1), precision (int, -1),
//   nullif, ifnull, trimtype (code none/left/right/both).
//   setDefault() (lines 392-397): splitField="", delimiter=",",
//   enclosure=null, 0 fields. getFields() REPLACES the split field in place.
// - trans UniqueRowsByHashSet ->
//   org.pentaho.di.trans.steps.uniquerowsbyhashset.UniqueRowsByHashSetMeta,
//   registry engine/src/main/resources/kettle-steps.xml line 90
//   (id="UniqueRowsByHashSet", category Transform). getXML() (lines 176-191)
//   emits store_values (Y/N), reject_duplicate_row (Y/N), error_description,
//   then a PAIRED <fields> wrapper holding <field> (name).
//   setDefault() (lines 160-170): both flags false. supportsErrorHandling()
//   returns isRejectDuplicateRow() — the error hop only works when rejecting.
// None of the five references a DB connection: NO <connection> tag.
const BATCH = [
  { kind: 'trans', xmlType: 'SetValueField', alias: 'SET_VALUE_FIELD' },
  { kind: 'trans', xmlType: 'ReplaceString', alias: 'REPLACE_STRING' },
  { kind: 'trans', xmlType: 'SplitFieldToRows3', alias: 'SPLIT_FIELD_TO_ROWS3' },
  { kind: 'trans', xmlType: 'FieldSplitter', alias: 'FIELD_SPLITTER' },
  { kind: 'trans', xmlType: 'UniqueRowsByHashSet', alias: 'UNIQUE_ROWS_BY_HASH_SET' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<fields>') appears in `block` after
// the previous one, mirroring the emission order of the source getXML().
// Self-closing leaves (e.g. '<mask/>') also match.
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

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

let tmp;
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b3b-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b3b') {
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

test('B3b catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B3b references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> — note SplitFieldToRows3 carries its trailing 3
    // in the ID itself (class name has no digit).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B3b templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const file = minimalKtr(`b3b-${xmlType.toLowerCase()}`);
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

test('SetValueField template follows SetValueFieldMeta.getXML: ONLY paired <fields> of <name>/<replaceby>', () => {
  // SetValueFieldMeta.getXML() (lines 148-162) emits ONLY a <fields> block;
  // each <field> carries <name> (target field, line 155) plus <replaceby>
  // (source field whose value is assigned, line 156).
  // setDefault() (lines 137-146) allocates 0 fields.
  const ref = getReference('trans', 'SetValueField');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<fields>'], 'SetValueField');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'SetValueField template must not carry <connection> (no DB reference in source)');
  assert.ok(block.includes('</fields>'),
    'SetValueField template must carry a paired <fields> wrapper per getXML()');
  const items = toArray(parsed.step.fields?.field);
  assert.ok(items.length >= 1, 'SetValueField template must show at least one <field> example');
  for (const f of items) {
    assert.ok(hasOwn(f, 'name'), 'every SetValueField <field> must carry <name>');
    // check() lines 227-234 ERRORs when replaceByFieldValue is empty, so
    // the template MUST always show <replaceby>.
    assert.ok(hasOwn(f, 'replaceby'),
      'every SetValueField <field> must carry <replaceby> (empty value => check() ERROR)');
  }
  assert.ok(!/<replace_by(?:\s|\/?>)/.test(block),
    'source tag is <replaceby> (no underscore); <replace_by> would be silently ignored');

  // Non-default configuration: two field-to-field assignments.
  const file = minimalKtr('b3b-setvaluefield');
  addElement(file, 'SetValueField', 'Copy address fields');
  setFields(file, 'Copy address fields', 'fields', 'field', [
    { name: 'SHIP_ADDR', replaceby: 'BILL_ADDR' },
    { name: 'SHIP_CITY', replaceby: 'BILL_CITY' },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = toArray(reparsed.transformation.step);
  const step = steps.find((s) => s.name === 'Copy address fields');
  assert.ok(step, 'inserted step present');
  const configured = toArray(step.fields.field);
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'SHIP_ADDR');
  assert.equal(configured[0].replaceby, 'BILL_ADDR');
  assert.equal(configured[1].name, 'SHIP_CITY');
  assert.equal(configured[1].replaceby, 'BILL_CITY');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ReplaceString template follows getXML 10-tag field order with yes/no match flags and Y/N empty-string flag', () => {
  // ReplaceStringMeta.getXML() (lines 284-310) emits ONLY a <fields> block;
  // each <field> carries exactly these 10 tags in order (lines 291-303):
  // in_stream_name, out_stream_name, use_regex, replace_string,
  // replace_by_string, set_empty_string, replace_field_by_string,
  // whole_word, case_sensitive, is_unicode.
  const ref = getReference('trans', 'ReplaceString');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<fields>'], 'ReplaceString');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'ReplaceString template must not carry <connection> (no DB reference in source)');
  const items = toArray(parsed.step.fields?.field);
  assert.ok(items.length >= 1, 'ReplaceString template must show at least one <field> example');
  const order = ['in_stream_name', 'out_stream_name', 'use_regex', 'replace_string',
    'replace_by_string', 'set_empty_string', 'replace_field_by_string',
    'whole_word', 'case_sensitive', 'is_unicode'];
  for (const f of items) {
    for (const tag of order) {
      assert.ok(hasOwn(f, tag), `ReplaceString <field> must carry <${tag}> per getXML lines 291-303`);
    }
    // BACKLOG-27839 pitfall (getFlagTagValue lines 312-315): the four match
    // flags serialize as "yes"/"no", NOT Y/N ...
    for (const tag of ['use_regex', 'whole_word', 'case_sensitive', 'is_unicode']) {
      assert.ok(f[tag] === 'yes' || f[tag] === 'no',
        `<${tag}> must be yes/no per getFlagTagValue (got ${String(f[tag])})`);
    }
    // ... while set_empty_string is a standard Y/N boolean (line 296).
    assert.ok(f.set_empty_string === 'Y' || f.set_empty_string === 'N',
      '<set_empty_string> must be Y/N (standard boolean tag, unlike the yes/no match flags)');
  }

  // Non-default configuration: regex cleanup into a new field plus an
  // in-place literal replacement (empty out_stream_name).
  const file = minimalKtr('b3b-replacestring');
  addElement(file, 'ReplaceString', 'Clean phone numbers');
  setFields(file, 'Clean phone numbers', 'fields', 'field', [
    {
      in_stream_name: 'PHONE_RAW', out_stream_name: 'PHONE', use_regex: 'yes',
      replace_string: '[^0-9]', replace_by_string: '', set_empty_string: 'N',
      replace_field_by_string: '', whole_word: 'no', case_sensitive: 'no',
      is_unicode: 'no',
    },
    {
      in_stream_name: 'STATUS', out_stream_name: '', use_regex: 'no',
      replace_string: 'n/a', replace_by_string: 'UNKNOWN', set_empty_string: 'N',
      replace_field_by_string: '', whole_word: 'yes', case_sensitive: 'no',
      is_unicode: 'no',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<in_stream_name>PHONE_RAW<\/in_stream_name>/);
  assert.match(after, /<use_regex>yes<\/use_regex>/);
  assert.match(after, /<whole_word>yes<\/whole_word>/);
  const reparsed = parser.parse(after);
  const steps = toArray(reparsed.transformation.step);
  const step = steps.find((s) => s.name === 'Clean phone numbers');
  assert.ok(step, 'inserted step present');
  const configured = toArray(step.fields.field);
  assert.equal(configured.length, 2);
  assert.equal(configured[0].in_stream_name, 'PHONE_RAW');
  assert.equal(configured[0].out_stream_name, 'PHONE');
  assert.equal(configured[0].use_regex, 'yes');
  // Empty out_stream_name = in-place replacement per getFields() lines 383-389.
  assert.ok(configured[1].out_stream_name === '' || configured[1].out_stream_name == null,
    'empty out_stream_name means in-place replacement');
  assert.equal(configured[1].replace_by_string, 'UNKNOWN');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SplitFieldToRows3 template follows getXML 7-tag order (ID keeps its trailing 3) and reset default', () => {
  // SplitFieldToRowsMeta.getXML() (lines 175-187) emits splitfield,
  // delimiter, newfield, rownum (Y/N), rownum_field, resetrownumber (Y/N),
  // delimiter_is_regex (Y/N). No lists. setDefault() (lines 149-157):
  // delimiter=";", resetRowNumber=true (the only Y default),
  // includeRowNumber/isDelimiterRegex=false.
  const ref = getReference('trans', 'SplitFieldToRows3');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<splitfield>', '<delimiter>', '<newfield>', '<rownum>', '<rownum_field>',
      '<resetrownumber>', '<delimiter_is_regex>'],
    'SplitFieldToRows3');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'SplitFieldToRows3 template must not carry <connection> (no DB reference in source)');
  assert.equal(parsed.step.type, 'SplitFieldToRows3',
    'XML ID keeps its trailing 3 (class name SplitFieldToRowsMeta has no digit)');
  assert.equal(parsed.step.delimiter, ';', 'delimiter defaults ";" (setDefault)');
  assert.equal(parsed.step.rownum, 'N', 'rownum defaults N (setDefault false)');
  assert.equal(parsed.step.resetrownumber, 'Y',
    'resetrownumber defaults Y (setDefault true — template pins it explicitly)');
  assert.equal(parsed.step.delimiter_is_regex, 'N',
    'delimiter_is_regex defaults N (setDefault false)');
  assert.ok(!parsed.step.reset_rownumber,
    'XML tag is <resetrownumber> (no underscore); repository uses reset_rownumber');

  // Non-default configuration: comma split with a row-number field.
  const file = minimalKtr('b3b-splitfieldtorows3');
  addElement(file, 'SplitFieldToRows3', 'Split order tags');
  setFieldPath(file, 'Split order tags', 'splitfield', 'ORDER_TAGS');
  setFieldPath(file, 'Split order tags', 'delimiter', ',');
  setFieldPath(file, 'Split order tags', 'newfield', 'ORDER_TAG');
  setFieldPath(file, 'Split order tags', 'rownum', 'Y');
  setFieldPath(file, 'Split order tags', 'rownum_field', 'TAG_NR');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<splitfield>ORDER_TAGS<\/splitfield>/);
  assert.match(after, /<newfield>ORDER_TAG<\/newfield>/);
  assert.match(after, /<rownum>Y<\/rownum>/);
  assert.match(after, /<rownum_field>TAG_NR<\/rownum_field>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('FieldSplitter template follows getXML order: splitfield, delimiter, enclosure, fields with 13-tag items', () => {
  // FieldSplitterMeta.getXML() (lines 452-496) emits splitfield, delimiter,
  // enclosure, then the <fields> wrapper (lines 460/493, always emitted)
  // with <field> items carrying 13 tags in order (lines 464-490): name, id,
  // idrem (Y/N), type (value-meta NAME string), format, group, decimal,
  // currency, length (int, -1), precision (int, -1), nullif, ifnull,
  // trimtype (code none/left/right/both).
  // setDefault() (lines 392-397): splitField="", delimiter=",",
  // enclosure=null, 0 fields.
  const ref = getReference('trans', 'FieldSplitter');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<splitfield>', '<delimiter>', '<enclosure>', '<fields>'],
    'FieldSplitter');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'FieldSplitter template must not carry <connection> (no DB reference in source)');
  assert.ok(block.includes('</fields>'),
    'FieldSplitter template must carry a paired <fields> wrapper per getXML()');
  assert.equal(parsed.step.delimiter, ',', 'delimiter defaults "," (setDefault)');
  const items = toArray(parsed.step.fields?.field);
  assert.ok(items.length >= 1, 'FieldSplitter template must show at least one <field> example');
  const order = ['name', 'id', 'idrem', 'type', 'format', 'group', 'decimal',
    'currency', 'length', 'precision', 'nullif', 'ifnull', 'trimtype'];
  for (const f of items) {
    for (const tag of order) {
      assert.ok(hasOwn(f, tag), `FieldSplitter <field> must carry <${tag}> per getXML lines 464-490`);
    }
    assert.ok(f.idrem === 'Y' || f.idrem === 'N',
      '<idrem> is boolean Y/N per addTagValue(idrem, boolean)');
    assert.ok(typeof f.type === 'string' && f.type.length > 0,
      '<type> must be a value-meta NAME string (unknown code loads as NONE)');
    assert.ok(Number.isInteger(Number(f.length)),
      '<length> must parse as an integer (-1 when unset)');
    assert.ok(Number.isInteger(Number(f.precision)),
      '<precision> must parse as an integer (-1 when unset)');
    // trimtype codes (ValueMetaBase.trimTypeCode): none/left/right/both.
    assert.ok(['none', 'left', 'right', 'both'].includes(String(f.trimtype)),
      '<trimtype> must be a trim code none/left/right/both');
  }

  // Non-default configuration: semicolon split with enclosure and two typed
  // output fields (id-based second field with ID stripping).
  const file = minimalKtr('b3b-fieldsplitter');
  addElement(file, 'FieldSplitter', 'Split sales line');
  setFieldPath(file, 'Split sales line', 'splitfield', 'SALES_LINE');
  setFieldPath(file, 'Split sales line', 'delimiter', ';');
  setFieldPath(file, 'Split sales line', 'enclosure', '"');
  setFields(file, 'Split sales line', 'fields', 'field', [
    {
      name: 'SALES1', id: '', idrem: 'N', type: 'Number', format: '###.##',
      group: '', decimal: '.', currency: '', length: '3', precision: '0',
      nullif: '', ifnull: '', trimtype: 'none',
    },
    {
      name: 'SALES2', id: 'Sales2', idrem: 'Y', type: 'Number', format: '###.##',
      group: '', decimal: '.', currency: '', length: '3', precision: '0',
      nullif: '', ifnull: '', trimtype: 'none',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<splitfield>SALES_LINE<\/splitfield>/);
  assert.match(after, /<delimiter>;<\/delimiter>/);
  const reparsed = parser.parse(after);
  const steps = toArray(reparsed.transformation.step);
  const step = steps.find((s) => s.name === 'Split sales line');
  assert.ok(step, 'inserted step present');
  const configured = toArray(step.fields.field);
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'SALES1');
  assert.equal(configured[0].type, 'Number');
  assert.equal(configured[1].id, 'Sales2');
  assert.equal(configured[1].idrem, 'Y');
  assert.equal(configured[1].trimtype, 'none');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('UniqueRowsByHashSet template follows getXML order with paired fields list and N/N flag defaults', () => {
  // UniqueRowsByHashSetMeta.getXML() (lines 176-191) emits store_values
  // (Y/N), reject_duplicate_row (Y/N), error_description, then the PAIRED
  // <fields> wrapper (lines 182/188) holding <field> (name).
  // setDefault() (lines 160-170): both flags false, errorDescription null.
  // getFields() is EMPTY (lines 172-174) — output schema = input.
  const ref = getReference('trans', 'UniqueRowsByHashSet');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<store_values>', '<reject_duplicate_row>', '<error_description>', '<fields>'],
    'UniqueRowsByHashSet');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'UniqueRowsByHashSet template must not carry <connection> (no DB reference in source)');
  assert.ok(block.includes('</fields>'),
    'UniqueRowsByHashSet template must carry a paired <fields> wrapper per getXML()');
  assert.equal(parsed.step.store_values, 'N',
    'store_values defaults N (boolean default false)');
  assert.equal(parsed.step.reject_duplicate_row, 'N',
    'reject_duplicate_row defaults N (setDefault false)');
  const items = toArray(parsed.step.fields?.field);
  assert.ok(items.length >= 1,
    'UniqueRowsByHashSet template must show at least one <field> example');
  for (const f of items) {
    assert.ok(hasOwn(f, 'name'), 'every <field> must carry <name> (compare field)');
  }

  // Non-default configuration: hash dedup on two keys, duplicates routed to
  // the error hop (the hop only works when rejecting — supportsErrorHandling
  // returns isRejectDuplicateRow(), lines 252-254).
  const file = minimalKtr('b3b-uniquerowsbyhashset');
  addElement(file, 'UniqueRowsByHashSet', 'Dedup customers');
  setFieldPath(file, 'Dedup customers', 'reject_duplicate_row', 'Y');
  setFieldPath(file, 'Dedup customers', 'error_description', 'Duplicate customer row');
  setFields(file, 'Dedup customers', 'fields', 'field', [
    { name: 'CUST_ID' },
    { name: 'CUST_EMAIL' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<reject_duplicate_row>Y<\/reject_duplicate_row>/);
  assert.match(after, /<error_description>Duplicate customer row<\/error_description>/);
  const reparsed = parser.parse(after);
  const steps = toArray(reparsed.transformation.step);
  const step = steps.find((s) => s.name === 'Dedup customers');
  assert.ok(step, 'inserted step present');
  const configured = toArray(step.fields.field);
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'CUST_ID');
  assert.equal(configured[1].name, 'CUST_EMAIL');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B3b package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b3b-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b3b-package</name></info>',
    '<step><name>Copy address fields</name><type>SetValueField</type></step>',
    '<step><name>Clean phone numbers</name><type>ReplaceString</type></step>',
    '<step><name>Split order tags</name><type>SplitFieldToRows3</type></step>',
    '<step><name>Split sales line</name><type>FieldSplitter</type></step>',
    '<step><name>Dedup customers</name><type>UniqueRowsByHashSet</type></step>',
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
