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

// Batch B4b (XML job entries + JSON/YAML steps): job DTD_VALIDATOR,
// job XSD_VALIDATOR, job XML_WELL_FORMED, trans JsonOutput, trans YamlInput.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b4b-source-notes.md.
//
// Grounding (all at the pinned commit; all five live in plugins/ and
// register via annotation, NOT via engine/.../kettle-*.xml):
// - job DTD_VALIDATOR -> .../job/entries/dtdvalidator/JobEntryDTDValidator,
//   @JobEntry(id="DTD_VALIDATOR") (lines 63-66). getXML() (lines 88-97) =
//   super.getXML() then xmlfilename, dtdfilename, dtdintern (Y/N).
//   Constructor (lines 72-77): nulls + false. evaluates()=true (177-179).
// - job XSD_VALIDATOR -> .../job/entries/xsdvalidator/JobEntryXSDValidator,
//   @JobEntry(id="XSD_VALIDATOR") (lines 77-80). getXML() (lines 107-116) =
//   super.getXML() then xmlfilename, xsdfilename, allowExternalEntities.
//   Constructor (lines 91-96): nulls + allowExternalEntities from system
//   property. evaluates()=true (262-264).
// - job XML_WELL_FORMED -> .../job/entries/xmlwellformed/JobEntryXMLWellFormed,
//   @JobEntry(id="XML_WELL_FORMED") (lines 74-77). getXML() (lines 131-152)
//   = super.getXML() then arg_from_previous, include_subfolders,
//   nr_errors_less_than, success_condition, resultfilenames, then a PAIRED
//   <fields> wrapper (always emitted) of <field> items (source_filefolder,
//   wildcard). Constructor (lines 111-120): resultfilenames="all_filenames",
//   nr_errors_less_than="10", success_condition="success_if_no_errors".
//   Success values: success_if_no_errors / success_when_at_least /
//   success_if_bad_formed_files_less (lines 81-83); result values:
//   all_filenames / only_well_formed_filenames / only_bad_formed_filenames
//   (lines 85-87). evaluates()=true (644-646).
// - trans JsonOutput -> .../trans/steps/jsonoutput/JsonOutputMeta,
//   @Step(id="JsonOutput") (lines 62-64; extends BaseFileOutputMeta).
//   getXML() (lines 337-373): outputValue, jsonBloc, nrRowsInBloc,
//   operation_type (code outputvalue/writetofile/both, line 82; unknown ->
//   0), compatibility_mode, encoding, addtoresult (lowercase), <file>
//   (name, extention [sic], append, split, haspartno, add_date, add_time,
//   create_parent_folder, DoNotOpenNewFileInit, servlet_output), then a
//   PAIRED <fields> wrapper of <field> items (name, element). setDefault()
//   (lines 308-324): operationType=WRITE_TO_FILE, extension "js",
//   jsonBloc "data", nrRowsInBloc "1", outputValue "outputValue".
// - trans YamlInput -> .../trans/steps/yamlinput/YamlInputMeta,
//   @Step(id="YamlInput") (line 66). getXML() (lines 415-452): include,
//   include_field, rownum, addresultfile, validating, IsIgnoreEmptyFile,
//   doNotFailIfNoFile, rownum_field, encoding, <file> with FLAT 4-tag
//   quintuples (name/filemask/file_required/include_subfolders — NO
//   exclude_filemask), <fields> of <field> items (YamlInputField, lines
//   87-96: name, path [NOT xpath], type, format, currency, decimal, group,
//   length, precision, trim_type [none/left/right/both]), then limit,
//   IsInFields, IsAFile, YamlField. setDefault() (lines 534-565):
//   doNotFailIfNoFile=true, rest false/empty.
// None of the five references a DB connection: NO <connection> tag.
const BATCH = [
  { kind: 'job', xmlType: 'DTD_VALIDATOR', alias: 'DTD_VALIDATOR' },
  { kind: 'job', xmlType: 'XSD_VALIDATOR', alias: 'XSD_VALIDATOR' },
  { kind: 'job', xmlType: 'XML_WELL_FORMED', alias: 'XML_WELL_FORMED' },
  { kind: 'trans', xmlType: 'JsonOutput', alias: 'JSON_OUTPUT' },
  { kind: 'trans', xmlType: 'YamlInput', alias: 'YAML_INPUT' },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b4b-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b4b') {
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

function minimalKjb(name = 'b4b') {
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

test('B4b catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B4b references resolve and their first XML block is one valid entry/step with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B4b templates carry no <connection> and insert via addElement with escaped names, validating clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(!/<connection(?:\s|\/?>)/.test(block),
      `${xmlType} template must not carry <connection> (no DB reference in source)`);
    const file = kind === 'job'
      ? minimalKjb(`b4b-${xmlType.toLowerCase()}`)
      : minimalKtr(`b4b-${xmlType.toLowerCase()}`);
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

test('job DTD_VALIDATOR template follows JobEntryDTDValidator.getXML: xmlfilename, dtdfilename, dtdintern', () => {
  // JobEntryDTDValidator.getXML() (lines 88-97) = super.getXML() then
  // xmlfilename, dtdfilename, dtdintern (Y/N). Constructor (lines 72-77):
  // nulls + false. evaluates()=true (lines 177-179).
  const ref = getReference('job', 'DTD_VALIDATOR');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<xmlfilename>', '<dtdfilename>', '<dtdintern>'], 'DTD_VALIDATOR');
  assert.equal(parsed.entry.dtdintern, 'N', 'dtdintern defaults N (constructor false)');
  assert.match(block, /<xmlfilename>\$\{XML_FILE\}<\/xmlfilename>/);
  assert.match(block, /<dtdfilename>\$\{DTD_FILE\}<\/dtdfilename>/);

  // Non-default configuration: internal DTD (external filename ignored).
  const file = minimalKjb('b4b-dtd-validator');
  addElement(file, 'DTD_VALIDATOR', 'Validate with internal DTD');
  setFieldPath(file, 'Validate with internal DTD', 'xmlfilename', '${XML_DIR}/order.xml');
  setFieldPath(file, 'Validate with internal DTD', 'dtdintern', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<xmlfilename>\$\{XML_DIR\}\/order\.xml<\/xmlfilename>/);
  assert.match(after, /<dtdintern>Y<\/dtdintern>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job XSD_VALIDATOR template follows JobEntryXSDValidator.getXML: xmlfilename, xsdfilename, allowExternalEntities', () => {
  // JobEntryXSDValidator.getXML() (lines 107-116) = super.getXML() then
  // xmlfilename, xsdfilename, allowExternalEntities (Y/N). Constructor
  // (lines 91-96): nulls + flag from system property. evaluates()=true
  // (lines 262-264).
  const ref = getReference('job', 'XSD_VALIDATOR');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<xmlfilename>', '<xsdfilename>', '<allowExternalEntities>'],
    'XSD_VALIDATOR');
  assert.ok(parsed.entry.allowExternalEntities === 'Y' || parsed.entry.allowExternalEntities === 'N',
    '<allowExternalEntities> is boolean Y/N');
  assert.match(block, /<xmlfilename>\$\{XML_FILE\}<\/xmlfilename>/);
  assert.match(block, /<xsdfilename>\$\{XSD_FILE\}<\/xsdfilename>/);

  // Non-default configuration: explicit paths (external entities stay off).
  const file = minimalKjb('b4b-xsd-validator');
  addElement(file, 'XSD_VALIDATOR', 'Validate order schema');
  setFieldPath(file, 'Validate order schema', 'xmlfilename', '${XML_DIR}/order.xml');
  setFieldPath(file, 'Validate order schema', 'xsdfilename', '${XSD_DIR}/order.xsd');
  setFieldPath(file, 'Validate order schema', 'allowExternalEntities', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<xmlfilename>\$\{XML_DIR\}\/order\.xml<\/xmlfilename>/);
  assert.match(after, /<xsdfilename>\$\{XSD_DIR\}\/order\.xsd<\/xsdfilename>/);
  assert.match(after, /<allowExternalEntities>N<\/allowExternalEntities>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job XML_WELL_FORMED template follows getXML: scalars plus paired fields of source_filefolder/wildcard', () => {
  // JobEntryXMLWellFormed.getXML() (lines 131-152) = super.getXML() then
  // arg_from_previous, include_subfolders, nr_errors_less_than,
  // success_condition, resultfilenames, then a PAIRED <fields> wrapper
  // (always emitted) of <field> items (source_filefolder, wildcard).
  // Constructor (lines 111-120): resultfilenames="all_filenames",
  // nr_errors_less_than="10", success_condition="success_if_no_errors".
  const ref = getReference('job', 'XML_WELL_FORMED');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<arg_from_previous>', '<include_subfolders>', '<nr_errors_less_than>',
      '<success_condition>', '<resultfilenames>', '<fields>'],
    'XML_WELL_FORMED');
  assert.equal(String(parsed.entry.nr_errors_less_than), '10',
    'nr_errors_less_than defaults to "10" (constructor)');
  assert.equal(parsed.entry.success_condition, 'success_if_no_errors',
    'success_condition defaults to success_if_no_errors (constructor)');
  assert.equal(parsed.entry.resultfilenames, 'all_filenames',
    'resultfilenames defaults to all_filenames (constructor)');
  const fields = parsed.entry.fields;
  assert.ok(fields && fields.field, 'XML_WELL_FORMED template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    assert.ok(hasOwn(f, 'source_filefolder'), 'every <field> must carry <source_filefolder>');
    assert.ok(hasOwn(f, 'wildcard'), 'every <field> must carry <wildcard>');
  }
  assert.ok(block.includes('</fields>'),
    'XML_WELL_FORMED template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: at-least-5-well-formed plus well-formed-only results.
  const file = minimalKjb('b4b-xml-well-formed');
  addElement(file, 'XML_WELL_FORMED', 'Check order XML files');
  setFieldPath(file, 'Check order XML files', 'nr_errors_less_than', '5');
  setFieldPath(file, 'Check order XML files', 'success_condition', 'success_when_at_least');
  setFieldPath(file, 'Check order XML files', 'resultfilenames', 'only_well_formed_filenames');
  setFields(file, 'Check order XML files', 'fields', 'field', [
    { source_filefolder: '${XML_DIR}', wildcard: '.*\\.xml' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<nr_errors_less_than>5<\/nr_errors_less_than>/);
  assert.match(after, /<success_condition>success_when_at_least<\/success_condition>/);
  assert.match(after, /<resultfilenames>only_well_formed_filenames<\/resultfilenames>/);
  assert.match(after, /<source_filefolder>\$\{XML_DIR\}<\/source_filefolder>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('JsonOutput template follows JsonOutputMeta.getXML: scalars, extention file block, name/element fields', () => {
  // JsonOutputMeta.getXML() (lines 337-373): outputValue, jsonBloc,
  // nrRowsInBloc, operation_type (code), compatibility_mode, encoding,
  // addtoresult (lowercase), <file> (name, extention [sic], append, split,
  // haspartno, add_date, add_time, create_parent_folder,
  // DoNotOpenNewFileInit, servlet_output), then PAIRED <fields> of
  // <field> items (name, element). setDefault() (lines 308-324):
  // operationType=WRITE_TO_FILE, extension "js", jsonBloc "data".
  const ref = getReference('trans', 'JsonOutput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<outputValue>', '<jsonBloc>', '<nrRowsInBloc>', '<operation_type>',
      '<compatibility_mode>', '<encoding>', '<addtoresult>', '<file>', '<fields>'],
    'JsonOutput');
  assert.ok(!/<extension(?:\s|\/?>)/.test(block),
    'file extension tag is <extention> (source typo), never <extension>');
  assert.ok(['outputvalue', 'writetofile', 'both'].includes(String(parsed.step.operation_type)),
    '<operation_type> must be one of outputvalue/writetofile/both');
  const fileBlock = parsed.step.file;
  assert.ok(fileBlock, 'JsonOutput template must carry <file>');
  for (const tag of ['name', 'extention', 'append', 'split', 'haspartno',
    'add_date', 'add_time', 'create_parent_folder', 'DoNotOpenNewFileInit',
    'servlet_output']) {
    assert.ok(hasOwn(fileBlock, tag), `<file> must carry <${tag}> per getXML lines 348-357`);
  }
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'JsonOutput template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    assert.ok(hasOwn(f, 'name'), 'every <field> must carry <name> (source field)');
    assert.ok(hasOwn(f, 'element'), 'every <field> must carry <element> (JSON key)');
  }
  assert.ok(block.includes('</fields>'),
    'JsonOutput template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: emit to both field and file with two fields.
  const file = minimalKtr('b4b-jsonoutput');
  addElement(file, 'JsonOutput', 'Emit order JSON');
  setFieldPath(file, 'Emit order JSON', 'outputValue', 'ORDER_JSON');
  setFieldPath(file, 'Emit order JSON', 'operation_type', 'both');
  setFieldPath(file, 'Emit order JSON', 'file/name', '${JSON_DIR}/orders');
  setFields(file, 'Emit order JSON', 'fields', 'field', [
    { name: 'ORDER_ID', element: 'id' },
    { name: 'ORDER_TOTAL', element: 'total' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<outputValue>ORDER_JSON<\/outputValue>/);
  assert.match(after, /<operation_type>both<\/operation_type>/);
  assert.match(after, /<name>\$\{JSON_DIR\}\/orders<\/name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Emit order JSON');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].name, 'ORDER_ID');
  assert.equal(configured[0].element, 'id');
  assert.equal(configured[1].element, 'total');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('YamlInput template follows YamlInputMeta.getXML: flags, 4-tag flat file, path fields', () => {
  // YamlInputMeta.getXML() (lines 415-452): include, include_field, rownum,
  // addresultfile, validating, IsIgnoreEmptyFile, doNotFailIfNoFile,
  // rownum_field, encoding, <file> with FLAT 4-tag quintuples
  // (name/filemask/file_required/include_subfolders — NO exclude_filemask),
  // <fields> of <field> items (YamlInputField: name, path [NOT xpath],
  // type, format, currency, decimal, group, length, precision, trim_type),
  // then limit, IsInFields, IsAFile, YamlField. setDefault() (lines
  // 534-565): doNotFailIfNoFile=true, rest false/empty.
  const ref = getReference('trans', 'YamlInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include>', '<rownum>', '<encoding>', '<file>', '<fields>', '<limit>',
      '<IsInFields>', '<IsAFile>', '<YamlField>'],
    'YamlInput');
  assert.equal(parsed.step.doNotFailIfNoFile, 'Y',
    'doNotFailIfNoFile defaults Y (setDefault true)');
  const fileBlock = parsed.step.file;
  assert.ok(fileBlock, 'YamlInput template must carry <file>');
  for (const tag of ['name', 'filemask', 'file_required', 'include_subfolders']) {
    assert.ok(hasOwn(fileBlock, tag), `<file> must carry flat <${tag}> per getXML lines 431-434`);
  }
  assert.ok(!/<exclude_filemask(?:\s|\/?>)/.test(block),
    'YamlInput <file> has NO <exclude_filemask> (unlike getXMLData)');
  assert.match(block, /<name>\$\{YAML_FILE\}<\/name>/);
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'YamlInput template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['name', 'path', 'type', 'format', 'currency', 'decimal',
      'group', 'length', 'precision', 'trim_type']) {
      assert.ok(hasOwn(f, tag), `YamlInput <field> must carry <${tag}> per YamlInputField`);
    }
    assert.ok(!hasOwn(f, 'xpath'),
      'YamlInput field path tag is <path>, never <xpath>');
    assert.ok(['none', 'left', 'right', 'both'].includes(String(f.trim_type)),
      '<trim_type> must be none/left/right/both');
  }

  // Non-default configuration: two YAML paths.
  const file = minimalKtr('b4b-yamlinput');
  addElement(file, 'YamlInput', 'Read orders YAML');
  setFieldPath(file, 'Read orders YAML', 'file/name', '${YAML_DIR}/orders.yaml');
  setFields(file, 'Read orders YAML', 'fields', 'field', [
    {
      name: 'ORDER_ID', path: 'order.id', type: 'Integer', format: '',
      currency: '', decimal: '', group: '', length: '-1', precision: '-1',
      trim_type: 'none',
    },
    {
      name: 'CUSTOMER', path: 'order.customer.name', type: 'String',
      format: '', currency: '', decimal: '', group: '', length: '-1',
      precision: '-1', trim_type: 'none',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<name>\$\{YAML_DIR\}\/orders\.yaml<\/name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read orders YAML');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].path, 'order.id');
  assert.equal(configured[1].path, 'order.customer.name');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B4b package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b4b-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b4b-package</name></info>',
    '<step><name>Emit order JSON</name><type>JsonOutput</type></step>',
    '<step><name>Read orders YAML</name><type>YamlInput</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b4b-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b4b-package</name><entries>',
    '<entry><name>Validate with DTD</name><type>DTD_VALIDATOR</type></entry>',
    '<entry><name>Validate order schema</name><type>XSD_VALIDATOR</type></entry>',
    '<entry><name>Check order XML files</name><type>XML_WELL_FORMED</type></entry>',
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
