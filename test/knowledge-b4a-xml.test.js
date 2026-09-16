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

// Batch B4a (XML plugin steps): trans AddXML, trans getXMLData,
// trans XMLJoin, trans XSDValidator, trans XSLT, trans XMLInputStream.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b4a-source-notes.md.
//
// Grounding (all at the pinned commit; all six live under
// plugins/xml/core/... and register via @Step annotation, NOT via
// engine/.../kettle-steps.xml):
// - trans AddXML -> .../addxml/AddXMLMeta, @Step(id="AddXML") (lines
//   63-65). getXML() (lines 239-275) emits encoding, valueName,
//   xml_repeat_element, <file> (omitXMLheader, omitNullValues), then a
//   PAIRED <fields> wrapper holding <field> items (name, element, type
//   [value-meta name string], format, currency, decimal, group, nullif,
//   length, precision, attribute Y/N, attributeParentName). setDefault()
//   (lines 201-229): omitXMLheader=true, encoding UTF-8,
//   valueName="xmlvaluename", rootNode="Row", 0 fields.
// - trans getXMLData -> .../getxmldata/GetXMLDataMeta, @Step(id="getXMLData")
//   (lines 65-67; lowercase leading g). getXML() (lines 723-775) emits 11
//   flags, rownum_field, encoding, a <file> wrapper with FLAT per-file tag
//   quintuples (name/filemask/exclude_filemask/file_required/
//   include_subfolders, no per-file sub-wrapper), <fields> of <field> items
//   (GetXMLDataField.getXML(), lines 121-137: name, xpath, element_type
//   [node/attribute], result_type [valueof/singlenode], type, format,
//   currency, decimal, group, length, precision, trim_type
//   [none/left/right/both], repeat Y/N), then limit, loopxpath, IsInFields,
//   IsAFile, XmlField, prunePath and 8 extra-file-field names. setDefault()
//   (lines 882-929): doNotFailIfNoFile=true, rest false/empty, 0 files/fields.
// - trans XMLJoin -> .../xmljoin/XMLJoinMeta, @Step(id="XMLJoin") (lines
//   63-65). getXML() (lines 185-201) emits 11 scalars, no lists:
//   valueXMLField, targetXMLstep, targetXMLfield, sourceXMLstep,
//   sourceXMLfield, complexJoin, joinCompareField, targetXPath, encoding,
//   omitXMLHeader, omitNullValues. setDefault() (lines 148-151) sets ONLY
//   encoding UTF-8. check() (lines 242-354) requires BOTH referenced steps
//   on input hops.
// - trans XSDValidator -> .../xsdvalidator/XsdValidatorMeta,
//   @Step(id="XSDValidator") (lines 63-66). getXML() (lines 273-291) emits
//   12 scalars: xdsfilename, xmlstream, resultfieldname, addvalidationmsg,
//   validationmsgfield, ifxmlunvalid BEFORE ifxmlvalid, outputstringfield,
//   xmlsourcefile, xsddefinedfield, xsdsource, allowExternalEntities.
//   setDefault() (lines 232-245): resultfieldname="result",
//   xsdSource="filename". xsdsource is one of filename/fieldname/noneed
//   (lines 85-87).
// - trans XSLT -> .../xslt/XsltMeta, @Step(id="XSLT") (lines 59-61).
//   getXML() (lines 318-350) emits 7 scalars then PAIRED <parameters>
//   (each <parameter> has <field> BEFORE <name>, lines 333-334) and PAIRED
//   <outputproperties> (each <outputproperty> has <name> then <value>).
//   setDefault() (lines 287-308): resultfieldname="result",
//   xslFactory="JAXP", 0 params/props. Output property names are the 9
//   fixed outputProperties (lines 65-66).
// - trans XMLInputStream -> .../xmlinputstream/XMLInputStreamMeta,
//   @Step(id="XMLInputStream") (lines 54-57). getXML() (lines 321-377)
//   emits 34 scalars, no lists: source, filename, skip/limit (STRINGS),
//   defaultStringLen, encoding, namespace/trim flags, then 12
//   include+name pairs. setDefault() (lines 380-431): encoding UTF-8,
//   defaultStringLen "1024", enableTrim=true, 7 metadata columns on.
//   NOTE the asymmetric tag names includeDataTypeNumericField /
//   dataTypeNumericField (lines 342-343) vs includeXml... elsewhere.
// None of the six references a DB connection: NO <connection> tag.
const BATCH = [
  { kind: 'trans', xmlType: 'AddXML', alias: 'ADD_XML' },
  { kind: 'trans', xmlType: 'getXMLData', alias: 'GET_XML_DATA' },
  { kind: 'trans', xmlType: 'XMLJoin', alias: 'XML_JOIN' },
  { kind: 'trans', xmlType: 'XSDValidator', alias: 'XSD_VALIDATOR' },
  { kind: 'trans', xmlType: 'XSLT', alias: 'XSLT' },
  { kind: 'trans', xmlType: 'XMLInputStream', alias: 'XML_INPUT_STREAM' },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b4a-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b4a') {
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

test('B4a catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B4a references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested value-type tag such as AddXML's
    // <fields>/<field>/<type> or getXMLData's).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B4a templates carry no <connection> and insert via addElement with escaped names, validating clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(!/<connection(?:\s|\/?>)/.test(block),
      `${xmlType} template must not carry <connection> (no DB reference in source)`);
    const file = minimalKtr(`b4a-${xmlType.toLowerCase()}`);
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

test('AddXML template follows AddXMLMeta.getXML: encoding, valueName, xml_repeat_element, file, fields', () => {
  // AddXMLMeta.getXML() (lines 239-275) emits encoding, valueName,
  // xml_repeat_element, then <file> (omitXMLheader, omitNullValues), then a
  // PAIRED <fields> wrapper holding <field> items with name/element/type/
  // format/currency/decimal/group/nullif/length/precision/attribute/
  // attributeParentName. setDefault() (lines 201-229): omitXMLheader=true,
  // encoding UTF-8, valueName="xmlvaluename", rootNode="Row".
  const ref = getReference('trans', 'AddXML');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<encoding>', '<valueName>', '<xml_repeat_element>', '<file>', '<fields>'],
    'AddXML');
  assertTagOrder(block, ['<omitXMLheader>', '<omitNullValues>'], 'AddXML file flags');
  assert.equal(parsed.step.encoding, 'UTF-8', 'encoding defaults UTF-8 (setDefault)');
  assert.equal(parsed.step.file.omitXMLheader, 'Y',
    'omitXMLheader defaults Y (setDefault true)');
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'AddXML template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['name', 'element', 'type', 'format', 'currency', 'decimal',
      'group', 'nullif', 'length', 'precision', 'attribute', 'attributeParentName']) {
      assert.ok(hasOwn(f, tag), `AddXML <field> must carry <${tag}> per getXML lines 256-268`);
    }
    assert.ok(Number.isNaN(Number(f.type)),
      '<type> must be a value-meta name string, not a numeric id');
    assert.ok(f.attribute === 'Y' || f.attribute === 'N',
      '<attribute> is boolean Y/N');
  }
  assert.ok(block.includes('</fields>'),
    'AddXML template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: custom fragment field plus an attribute field.
  const file = minimalKtr('b4a-addxml');
  addElement(file, 'AddXML', 'Build customer XML');
  setFieldPath(file, 'Build customer XML', 'valueName', 'CUSTOMER_XML');
  setFieldPath(file, 'Build customer XML', 'xml_repeat_element', 'Customer');
  setFields(file, 'Build customer XML', 'fields', 'field', [
    {
      name: 'CUSTOMER_ID', element: 'id', type: 'Integer', format: '',
      currency: '', decimal: '', group: '', nullif: '', length: '-1',
      precision: '-1', attribute: 'Y', attributeParentName: 'Customer',
    },
    {
      name: 'CUSTOMER_NAME', element: 'name', type: 'String', format: '',
      currency: '', decimal: '', group: '', nullif: '', length: '-1',
      precision: '-1', attribute: 'N', attributeParentName: '',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<valueName>CUSTOMER_XML<\/valueName>/);
  assert.match(after, /<xml_repeat_element>Customer<\/xml_repeat_element>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Build customer XML');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].attribute, 'Y');
  assert.equal(configured[0].attributeParentName, 'Customer');
  assert.equal(configured[1].element, 'name');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('getXMLData template follows GetXMLDataMeta.getXML: flags, flat file quintuples, xpath fields', () => {
  // GetXMLDataMeta.getXML() (lines 723-775) emits 11 flags, rownum_field,
  // encoding, <file> with FLAT per-file tag quintuples (lines 742-749, no
  // per-file sub-wrapper), <fields> of xpath items
  // (GetXMLDataField.getXML(), lines 121-137), then limit, loopxpath,
  // IsInFields, IsAFile, XmlField, prunePath and 8 extra-file-field names.
  // setDefault() (lines 882-929): doNotFailIfNoFile=true, rest false/empty.
  const ref = getReference('trans', 'getXMLData');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include>', '<rownum>', '<encoding>', '<file>', '<fields>', '<limit>',
      '<loopxpath>', '<IsInFields>', '<IsAFile>', '<XmlField>'],
    'getXMLData');
  assert.equal(parsed.step.doNotFailIfNoFile, 'Y',
    'doNotFailIfNoFile defaults Y (setDefault true)');
  assert.equal(parsed.step.encoding, 'UTF-8', 'encoding defaults UTF-8');
  // Flat per-file quintuple inside <file> (no nested per-file wrapper).
  const fileBlock = parsed.step.file;
  assert.ok(fileBlock, 'getXMLData template must carry <file>');
  for (const tag of ['name', 'filemask', 'exclude_filemask', 'file_required',
    'include_subfolders']) {
    assert.ok(hasOwn(fileBlock, tag), `<file> must carry flat <${tag}> per getXML lines 743-747`);
  }
  assert.match(block, /<name>\$\{XML_FILE\}<\/name>/);
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'getXMLData template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['name', 'xpath', 'element_type', 'result_type', 'type',
      'format', 'currency', 'decimal', 'group', 'length', 'precision',
      'trim_type', 'repeat']) {
      assert.ok(hasOwn(f, tag), `getXMLData <field> must carry <${tag}> per GetXMLDataField.getXML`);
    }
    assert.ok(String(f.element_type) === 'node' || String(f.element_type) === 'attribute',
      '<element_type> must be node or attribute');
    assert.ok(String(f.result_type) === 'valueof' || String(f.result_type) === 'singlenode',
      '<result_type> must be valueof or singlenode');
    assert.ok(['none', 'left', 'right', 'both'].includes(String(f.trim_type)),
      '<trim_type> must be none/left/right/both');
    assert.ok(f.repeat === 'Y' || f.repeat === 'N',
      '<repeat> must be explicit Y/N (missing tag loads as TRUE)');
  }
  assert.equal(parsed.step.type, 'getXMLData',
    '<type> keeps the lowercase leading g');

  // Non-default configuration: loop path plus two xpath fields (node + attribute).
  const file = minimalKtr('b4a-getxmldata');
  addElement(file, 'getXMLData', 'Read orders');
  setFieldPath(file, 'Read orders', 'loopxpath', '/orders/order');
  setFields(file, 'Read orders', 'fields', 'field', [
    {
      name: 'ORDER_ID', xpath: 'id', element_type: 'node',
      result_type: 'valueof', type: 'Integer', format: '', currency: '',
      decimal: '', group: '', length: '-1', precision: '-1',
      trim_type: 'none', repeat: 'N',
    },
    {
      name: 'ORDER_STATUS', xpath: '@status', element_type: 'attribute',
      result_type: 'valueof', type: 'String', format: '', currency: '',
      decimal: '', group: '', length: '-1', precision: '-1',
      trim_type: 'none', repeat: 'N',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<loopxpath>\/orders\/order<\/loopxpath>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read orders');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].xpath, 'id');
  assert.equal(configured[1].element_type, 'attribute');
  assert.equal(configured[1].xpath, '@status');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XMLJoin template follows XMLJoinMeta.getXML: 11 scalars with two step references', () => {
  // XMLJoinMeta.getXML() (lines 185-201) emits 11 scalars in order, no
  // lists. setDefault() (lines 148-151) sets ONLY encoding UTF-8. check()
  // (lines 242-354) requires both referenced steps on input hops.
  const ref = getReference('trans', 'XMLJoin');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<valueXMLField>', '<targetXMLstep>', '<targetXMLfield>', '<sourceXMLstep>',
      '<sourceXMLfield>', '<complexJoin>', '<joinCompareField>', '<targetXPath>',
      '<encoding>', '<omitXMLHeader>', '<omitNullValues>'],
    'XMLJoin');
  assert.equal(parsed.step.encoding, 'UTF-8', 'encoding defaults UTF-8 (setDefault)');
  for (const tag of ['valueXMLField', 'targetXMLstep', 'targetXMLfield',
    'sourceXMLstep', 'sourceXMLfield', 'targetXPath']) {
    assert.ok(hasOwn(parsed.step, tag), `XMLJoin template must carry <${tag}> (check() ERROR when empty)`);
  }
  assert.ok(parsed.step.complexJoin === 'Y' || parsed.step.complexJoin === 'N',
    '<complexJoin> is boolean Y/N');

  // Non-default configuration: complex join on an order key.
  const file = minimalKtr('b4a-xmljoin');
  addElement(file, 'XMLJoin', 'Join order lines');
  setFieldPath(file, 'Join order lines', 'targetXMLstep', 'Orders XML');
  setFieldPath(file, 'Join order lines', 'targetXMLfield', 'ORDER_DOC');
  setFieldPath(file, 'Join order lines', 'sourceXMLstep', 'Lines XML');
  setFieldPath(file, 'Join order lines', 'sourceXMLfield', 'LINE_FRAG');
  setFieldPath(file, 'Join order lines', 'complexJoin', 'Y');
  setFieldPath(file, 'Join order lines', 'joinCompareField', 'ORDER_ID');
  setFieldPath(file, 'Join order lines', 'targetXPath', '/order/lines');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<targetXMLstep>Orders XML<\/targetXMLstep>/);
  assert.match(after, /<sourceXMLstep>Lines XML<\/sourceXMLstep>/);
  assert.match(after, /<complexJoin>Y<\/complexJoin>/);
  assert.match(after, /<joinCompareField>ORDER_ID<\/joinCompareField>/);
  assert.match(after, /<targetXPath>\/order\/lines<\/targetXPath>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XSDValidator template follows XsdValidatorMeta.getXML: 12 scalars with xds/ifxmlunvalid spellings', () => {
  // XsdValidatorMeta.getXML() (lines 273-291) emits 12 scalars: xdsfilename
  // (NOT xsdfilename), xmlstream, resultfieldname, addvalidationmsg,
  // validationmsgfield, ifxmlunvalid BEFORE ifxmlvalid (NOT invalid), then
  // outputstringfield, xmlsourcefile, xsddefinedfield, xsdsource,
  // allowExternalEntities. setDefault() (lines 232-245):
  // resultfieldname="result", xsdSource="filename".
  const ref = getReference('trans', 'XSDValidator');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<xdsfilename>', '<xmlstream>', '<resultfieldname>', '<addvalidationmsg>',
      '<validationmsgfield>', '<ifxmlunvalid>', '<ifxmlvalid>',
      '<outputstringfield>', '<xmlsourcefile>', '<xsddefinedfield>',
      '<xsdsource>', '<allowExternalEntities>'],
    'XSDValidator');
  assert.ok(!/<xsdfilename(?:\s|\/?>)/.test(block),
    'XSD filename tag is <xdsfilename>, never <xsdfilename>');
  assert.ok(!/<ifxmlinvalid(?:\s|\/?>)/.test(block),
    'invalid-branch tag is <ifxmlunvalid>, never <ifxmlinvalid>');
  assert.equal(parsed.step.resultfieldname, 'result',
    'resultfieldname defaults to "result" (setDefault)');
  assert.equal(parsed.step.xsdsource, 'filename',
    'xsdsource defaults to "filename" (setDefault)');
  assert.match(block, /<xdsfilename>\$\{XSD_FILE\}<\/xdsfilename>/);

  // Non-default configuration: schema from a field, string result, error message.
  const file = minimalKtr('b4a-xsdvalidator');
  addElement(file, 'XSDValidator', 'Validate order doc');
  setFieldPath(file, 'Validate order doc', 'xmlstream', 'ORDER_DOC');
  setFieldPath(file, 'Validate order doc', 'resultfieldname', 'IS_VALID');
  setFieldPath(file, 'Validate order doc', 'addvalidationmsg', 'Y');
  setFieldPath(file, 'Validate order doc', 'validationmsgfield', 'VALIDATION_ERROR');
  setFieldPath(file, 'Validate order doc', 'outputstringfield', 'Y');
  setFieldPath(file, 'Validate order doc', 'xsdsource', 'fieldname');
  setFieldPath(file, 'Validate order doc', 'xsddefinedfield', 'SCHEMA_DEF');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<xmlstream>ORDER_DOC<\/xmlstream>/);
  assert.match(after, /<addvalidationmsg>Y<\/addvalidationmsg>/);
  assert.match(after, /<outputstringfield>Y<\/outputstringfield>/);
  assert.match(after, /<xsdsource>fieldname<\/xsdsource>/);
  assert.match(after, /<xsddefinedfield>SCHEMA_DEF<\/xsddefinedfield>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XSLT template follows XsltMeta.getXML: scalars, paired parameters with field-first, paired outputproperties', () => {
  // XsltMeta.getXML() (lines 318-350) emits 7 scalars, then PAIRED
  // <parameters> (each <parameter> has <field> BEFORE <name>, lines
  // 333-334), then PAIRED <outputproperties> (each <outputproperty> has
  // <name> then <value>). setDefault() (lines 287-308):
  // resultfieldname="result", xslFactory="JAXP".
  const ref = getReference('trans', 'XSLT');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<xslfilename>', '<fieldname>', '<resultfieldname>', '<xslfilefield>',
      '<xslfilefielduse>', '<xslfieldisafile>', '<xslfactory>',
      '<parameters>', '<outputproperties>'],
    'XSLT');
  assert.equal(parsed.step.resultfieldname, 'result',
    'resultfieldname defaults to "result" (setDefault)');
  assert.equal(parsed.step.xslfactory, 'JAXP', 'xslfactory defaults JAXP (setDefault)');
  assert.match(block, /<xslfilename>\$\{XSL_FILE\}<\/xslfilename>/);
  const params = parsed.step.parameters;
  assert.ok(params && params.parameter, 'XSLT template must carry <parameters>/<parameter>');
  const paramItems = Array.isArray(params.parameter) ? params.parameter : [params.parameter];
  for (const p of paramItems) {
    assert.ok(hasOwn(p, 'field'), 'every <parameter> must carry <field> (row field)');
    assert.ok(hasOwn(p, 'name'), 'every <parameter> must carry <name> (stylesheet parameter)');
  }
  // Scope to the <parameters> region so the assertion does not collide with
  // the step's own top-level <name> tag; within a <parameter>, <field> precedes <name>.
  const paramsRegion = block.slice(block.indexOf('<parameters>'), block.indexOf('</parameters>'));
  assertTagOrder(paramsRegion, ['<parameters>', '<field>', '<name>'], 'XSLT parameter field-first');
  const props = parsed.step.outputproperties;
  assert.ok(props, 'XSLT template must carry a paired <outputproperties> wrapper per getXML()');
  assert.ok(block.includes('</parameters>'), '<parameters> must be paired');
  assert.ok(block.includes('</outputproperties>'), '<outputproperties> must be paired');
  if (props.outputproperty) {
    const propItems = Array.isArray(props.outputproperty) ? props.outputproperty : [props.outputproperty];
    for (const o of propItems) {
      assert.ok(['method', 'version', 'encoding', 'standalone', 'indent',
        'omit-xml-declaration', 'doctype-public', 'doctype-system',
        'media-type'].includes(String(o.name)),
      '<outputproperty>/<name> must be one of the 9 fixed outputProperties');
    }
  }

  // Non-default configuration: two stylesheet parameters plus html output.
  const file = minimalKtr('b4a-xslt');
  addElement(file, 'XSLT', 'Render order HTML');
  setFieldPath(file, 'Render order HTML', 'xslfilename', '${XSL_DIR}/order.xsl');
  setFieldPath(file, 'Render order HTML', 'fieldname', 'ORDER_DOC');
  setFieldPath(file, 'Render order HTML', 'resultfieldname', 'ORDER_HTML');
  setFields(file, 'Render order HTML', 'parameters', 'parameter', [
    { field: 'TITLE', name: 'title' },
    { field: 'SHOW_PRICES', name: 'showPrices' },
  ]);
  setFields(file, 'Render order HTML', 'outputproperties', 'outputproperty', [
    { name: 'method', value: 'html' },
    { name: 'indent', value: 'yes' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<xslfilename>\$\{XSL_DIR\}\/order\.xsl<\/xslfilename>/);
  assert.match(after, /<resultfieldname>ORDER_HTML<\/resultfieldname>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Render order HTML');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.parameters.parameter)
    ? step.parameters.parameter
    : [step.parameters.parameter];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].field, 'TITLE');
  assert.equal(configured[0].name, 'title');
  const outProps = Array.isArray(step.outputproperties.outputproperty)
    ? step.outputproperties.outputproperty
    : [step.outputproperties.outputproperty];
  assert.equal(outProps.length, 2);
  assert.equal(outProps[0].name, 'method');
  assert.equal(outProps[0].value, 'html');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('XMLInputStream template follows XMLInputStreamMeta.getXML: 34 scalars with asymmetric include names', () => {
  // XMLInputStreamMeta.getXML() (lines 321-377) emits 34 scalars, no lists.
  // setDefault() (lines 380-431): encoding UTF-8, defaultStringLen "1024",
  // enableTrim=true, 7 metadata columns on. NOTE the asymmetric pair
  // includeDataTypeNumericField/dataTypeNumericField (lines 342-343) vs
  // includeXml... everywhere else.
  const ref = getReference('trans', 'XMLInputStream');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<sourceFromInput>', '<filename>', '<nrRowsToSkip>', '<rowLimit>',
      '<defaultStringLen>', '<encoding>', '<enableNamespaces>', '<enableTrim>'],
    'XMLInputStream head');
  assertTagOrder(block,
    ['<includeXmlPathField>', '<xmlPathField>', '<includeXmlDataValueField>',
      '<xmlDataValueField>'],
    'XMLInputStream columns');
  assert.equal(parsed.step.encoding, 'UTF-8', 'encoding defaults UTF-8 (setDefault)');
  assert.equal(String(parsed.step.defaultStringLen), '1024',
    'defaultStringLen defaults "1024" (setDefault)');
  assert.equal(parsed.step.enableTrim, 'Y', 'enableTrim defaults Y (setDefault true)');
  assert.equal(parsed.step.includeXmlPathField, 'Y',
    'includeXmlPathField defaults Y (setDefault)');
  assert.ok(/<includeDataTypeNumericField(?:\s|\/?>)/.test(block),
    'datatype-numeric include tag is <includeDataTypeNumericField> (no Xml)');
  assert.ok(!/<includeXmlDataTypeNumericField(?:\s|\/?>)/.test(block),
    'there is no <includeXmlDataTypeNumericField> in source');
  assert.ok(/<dataTypeNumericField(?:\s|\/?>)/.test(block),
    'datatype-numeric name tag is <dataTypeNumericField> (no Xml)');
  assert.match(block, /<filename>\$\{XML_FILE\}<\/filename>/);

  // Non-default configuration: file path plus filename/row-number columns, capped rows.
  const file = minimalKtr('b4a-xmlinputstream');
  addElement(file, 'XMLInputStream', 'Stream orders');
  setFieldPath(file, 'Stream orders', 'filename', '${XML_DIR}/orders.xml');
  setFieldPath(file, 'Stream orders', 'rowLimit', '1000');
  setFieldPath(file, 'Stream orders', 'includeFilenameField', 'Y');
  setFieldPath(file, 'Stream orders', 'includeRowNumberField', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename>\$\{XML_DIR\}\/orders\.xml<\/filename>/);
  assert.match(after, /<rowLimit>1000<\/rowLimit>/);
  assert.match(after, /<includeFilenameField>Y<\/includeFilenameField>/);
  assert.match(after, /<includeRowNumberField>Y<\/includeRowNumberField>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B4a package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b4a-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b4a-package</name></info>',
    '<step><name>Build customer XML</name><type>AddXML</type></step>',
    '<step><name>Read orders</name><type>getXMLData</type></step>',
    '<step><name>Join order lines</name><type>XMLJoin</type></step>',
    '<step><name>Validate order doc</name><type>XSDValidator</type></step>',
    '<step><name>Render order HTML</name><type>XSLT</type></step>',
    '<step><name>Stream orders</name><type>XMLInputStream</type></step>',
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
