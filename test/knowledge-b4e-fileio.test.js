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

// Batch B4e (file input/output steps): trans FixedInput, trans
// LoadFileInput, trans GetFilesRowsCount, trans GetSubFolders, trans
// PropertyOutput.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b4e-source-notes.md.
//
// Grounding (all at the pinned commit; all five register in
// engine/src/main/resources/kettle-steps.xml):
// - trans FixedInput -> .../trans/steps/fixedinput/FixedInputMeta,
//   kettle-steps.xml line 105 (Input). getXML() (lines 160-182): filename,
//   line_width, header, buffer_size, lazy_conversion, line_feed, parallel,
//   file_type (code NONE/UNIX/DOS, lines 73-77; unknown => NONE), encoding,
//   add_to_result_filenames, then a PAIRED <fields> wrapper of <field>
//   items (FixedFileInputField.getXML(), lines 114-133, XML_TAG="field"
//   line 43: name, type, format, trim_type, currency, decimal, group,
//   width, length, precision). setDefault() (lines 120-127): lineWidth
//   "80", header/lazy/lineFeed true, bufferSize "50000".
// - trans LoadFileInput -> .../trans/steps/loadfileinput/LoadFileInputMeta,
//   kettle-steps.xml line 111 (Input). getXML() (lines 616-658): include,
//   include_field, rownum, addresultfile, IsIgnoreEmptyFile,
//   IsIgnoreMissingPath, rownum_field, encoding, <file> with FLAT 5-tag
//   tuples (name/filemask/exclude_filemask/file_required/
//   include_subfolders), <fields> of <field> items
//   (LoadFileInputField.getXML(), lines 95-114: name, element_type
//   [content/size, line 59], type, format, currency, decimal, group,
//   length, precision, trim_type, repeat), then limit, IsInFields,
//   DynamicFilenameField and 7 extra-file-field names. setDefault()
//   (lines 729-768): encoding "", addresultfile=true, rest false/empty.
//   getFields() clears the incoming row in file mode (lines 772-774).
// - trans GetFilesRowsCount ->
//   .../trans/steps/getfilesrowscount/GetFilesRowsCountMeta,
//   kettle-steps.xml line 58 (Input). getXML() (lines 373-398):
//   files_count, files_count_fieldname, rows_count_fieldname,
//   rowseparator_format, row_separator, isaddresult, filefield,
//   filename_Field (capital F), smartCount, then <file> with FLAT 5-tag
//   tuples. NO <fields> list. setDefault() (lines 471-493):
//   rowsCountFieldName="rowscount", RowSeparator_format="CR",
//   isaddresult=true. readData scrubs legacy "CR"->"LINEFEED" /
//   "LF"->"CARRIAGERETURN" (lines 407-417, 426); isaddresult empty => TRUE
//   (431-436). getFields() always adds the Integer rows-count column
//   (lines 495-509).
// - trans GetSubFolders -> .../trans/steps/getsubfolders/GetSubFoldersMeta,
//   kettle-steps.xml line 70 (Input). getXML() (lines 339-357): rownum,
//   foldername_dynamic, rownum_field, foldername_field, limit, then <file>
//   with FLAT 2-tag pairs (name/file_required — NO masks), always paired.
//   NO <fields> list. setDefault() (lines 254-267): 0 folders, flags
//   false. getFields() (lines 269-337) adds 10 FIXED columns (folderName,
//   short_folderName, path, ishidden/isreadable/iswriteable, lastmodified-
//   time, uri, rooturi, childrens) plus the rownumber when enabled.
// - trans PropertyOutput ->
//   .../trans/steps/propertyoutput/PropertyOutputMeta, kettle-steps.xml
//   line 64 (Output). getXML() (lines 386-412): keyfield, valuefield,
//   comment, fileNameInField, fileNameField, then a single <file> block
//   (name, extention [sic], split, haspartno, add_date, add_time,
//   create_parent_folder, addtoresult [lowercase], append). setDefault()
//   (lines 376-383): append/createparentfolder false, key/value/comment
//   null. No getFields override (pass-through rows). readData reads
//   file/AddToResult (capital, line 364) vs getXML's lowercase —
//   harmless, case-insensitive.
// None of the five references a DB connection: NO <connection> tag.
// File paths use ${VAR} placeholders.
const BATCH = [
  { kind: 'trans', xmlType: 'FixedInput', alias: 'FIXED_INPUT' },
  { kind: 'trans', xmlType: 'LoadFileInput', alias: 'LOAD_FILE_INPUT' },
  { kind: 'trans', xmlType: 'GetFilesRowsCount', alias: 'GET_FILES_ROWS_COUNT' },
  { kind: 'trans', xmlType: 'GetSubFolders', alias: 'GET_SUB_FOLDERS' },
  { kind: 'trans', xmlType: 'PropertyOutput', alias: 'PROPERTY_OUTPUT' },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b4e-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b4e') {
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

test('B4e catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B4e references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested value-type tag such as
    // FixedInput's <fields>/<field>/<type> or LoadFileInput's).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B4e templates carry no <connection> and insert via addElement with escaped names, validating clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(!/<connection(?:\s|\/?>)/.test(block),
      `${xmlType} template must not carry <connection> (no DB reference in source)`);
    const file = minimalKtr(`b4e-${xmlType.toLowerCase()}`);
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

test('FixedInput template follows getXML: scalars, file_type code, width-bearing fields', () => {
  // FixedInputMeta.getXML() (lines 160-182): filename, line_width,
  // header, buffer_size, lazy_conversion, line_feed, parallel, file_type
  // (code NONE/UNIX/DOS), encoding, add_to_result_filenames, then a
  // PAIRED <fields> wrapper of <field> items (FixedFileInputField.getXML()
  // lines 114-133: name, type, format, trim_type, currency, decimal,
  // group, width, length, precision). setDefault() (lines 120-127):
  // lineWidth "80", header/lazy/lineFeed true, bufferSize "50000".
  const ref = getReference('trans', 'FixedInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<filename>', '<line_width>', '<header>', '<buffer_size>',
      '<lazy_conversion>', '<line_feed>', '<parallel>', '<file_type>',
      '<encoding>', '<add_to_result_filenames>', '<fields>'],
    'FixedInput');
  assert.equal(String(parsed.step.line_width), '80', 'line_width defaults "80" (setDefault)');
  assert.equal(parsed.step.header, 'Y', 'header defaults Y (setDefault true)');
  assert.ok(['NONE', 'UNIX', 'DOS'].includes(String(parsed.step.file_type)),
    '<file_type> must be one of NONE/UNIX/DOS');
  assert.match(block, /<filename>\$\{INPUT_FILE\}<\/filename>/);
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'FixedInput template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['name', 'type', 'format', 'trim_type', 'currency',
      'decimal', 'group', 'width', 'length', 'precision']) {
      assert.ok(hasOwn(f, tag), `FixedInput <field> must carry <${tag}> per FixedFileInputField.getXML`);
    }
    assert.ok(hasOwn(f, 'width'), '<width> (cut width) must be present and distinct from <length>');
  }
  assert.ok(block.includes('</fields>'),
    'FixedInput template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: two fixed-width columns.
  const file = minimalKtr('b4e-fixedinput');
  addElement(file, 'FixedInput', 'Read fixed customers');
  setFieldPath(file, 'Read fixed customers', 'filename', '${INPUT_DIR}/customer.txt');
  setFieldPath(file, 'Read fixed customers', 'line_width', '50');
  setFieldPath(file, 'Read fixed customers', 'file_type', 'DOS');
  setFields(file, 'Read fixed customers', 'fields', 'field', [
    {
      name: 'CUSTOMER_ID', type: 'String', format: '', trim_type: 'both',
      currency: '', decimal: '', group: '', width: '10', length: '-1',
      precision: '-1',
    },
    {
      name: 'CUSTOMER_NAME', type: 'String', format: '', trim_type: 'both',
      currency: '', decimal: '', group: '', width: '40', length: '-1',
      precision: '-1',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename>\$\{INPUT_DIR\}\/customer\.txt<\/filename>/);
  assert.match(after, /<line_width>50<\/line_width>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read fixed customers');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(String(configured[0].width), '10');
  assert.equal(String(configured[1].width), '40');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('LoadFileInput template follows getXML: flags, flat 5-tag file, content/size fields', () => {
  // LoadFileInputMeta.getXML() (lines 616-658): include, include_field,
  // rownum, addresultfile, IsIgnoreEmptyFile, IsIgnoreMissingPath,
  // rownum_field, encoding, <file> with FLAT 5-tag tuples, <fields> of
  // <field> items (LoadFileInputField.getXML() lines 95-114: name,
  // element_type [content/size], type, format, currency, decimal, group,
  // length, precision, trim_type, repeat), then limit, IsInFields,
  // DynamicFilenameField and 7 extra-file-field names. setDefault()
  // (lines 729-768): encoding "", addresultfile=true.
  const ref = getReference('trans', 'LoadFileInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include>', '<rownum>', '<encoding>', '<file>', '<fields>', '<limit>',
      '<IsInFields>', '<DynamicFilenameField>'],
    'LoadFileInput');
  assert.equal(parsed.step.addresultfile, 'Y',
    'addresultfile defaults Y (setDefault true)');
  const fileBlock = parsed.step.file;
  assert.ok(fileBlock, 'LoadFileInput template must carry <file>');
  for (const tag of ['name', 'filemask', 'exclude_filemask', 'file_required',
    'include_subfolders']) {
    assert.ok(hasOwn(fileBlock, tag), `<file> must carry flat <${tag}> per getXML lines 631-635`);
  }
  assert.match(block, /<name>\$\{INPUT_FILE\}<\/name>/);
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'LoadFileInput template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    for (const tag of ['name', 'element_type', 'type', 'format', 'currency',
      'decimal', 'group', 'length', 'precision', 'trim_type', 'repeat']) {
      assert.ok(hasOwn(f, tag), `LoadFileInput <field> must carry <${tag}> per LoadFileInputField.getXML`);
    }
    assert.ok(String(f.element_type) === 'content' || String(f.element_type) === 'size',
      '<element_type> must be content or size');
    assert.ok(f.repeat === 'Y' || f.repeat === 'N',
      '<repeat> must be explicit Y/N (missing tag loads as TRUE)');
  }

  // Non-default configuration: content plus size columns.
  const file = minimalKtr('b4e-loadfileinput');
  addElement(file, 'LoadFileInput', 'Load report file');
  setFieldPath(file, 'Load report file', 'file/name', '${INPUT_DIR}/report.pdf');
  setFieldPath(file, 'Load report file', 'file/file_required', 'Y');
  setFields(file, 'Load report file', 'fields', 'field', [
    {
      name: 'FILE_CONTENT', element_type: 'content', type: 'String',
      format: '', currency: '', decimal: '', group: '', length: '-1',
      precision: '-1', trim_type: 'none', repeat: 'N',
    },
    {
      name: 'FILE_SIZE', element_type: 'size', type: 'Integer', format: '',
      currency: '', decimal: '', group: '', length: '-1', precision: '-1',
      trim_type: 'none', repeat: 'N',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<name>\$\{INPUT_DIR\}\/report\.pdf<\/name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Load report file');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 2);
  assert.equal(configured[0].element_type, 'content');
  assert.equal(configured[1].element_type, 'size');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GetFilesRowsCount template follows getXML: 9 scalars, flat file, and NO fields list', () => {
  // GetFilesRowsCountMeta.getXML() (lines 373-398): files_count,
  // files_count_fieldname, rows_count_fieldname, rowseparator_format,
  // row_separator, isaddresult, filefield, filename_Field (capital F),
  // smartCount, then <file> with FLAT 5-tag tuples. NO <fields> list.
  // setDefault() (lines 471-493): rowsCountFieldName="rowscount",
  // RowSeparator_format="CR", isaddresult=true.
  const ref = getReference('trans', 'GetFilesRowsCount');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<files_count>', '<rows_count_fieldname>', '<rowseparator_format>',
      '<row_separator>', '<isaddresult>', '<filefield>', '<filename_Field>',
      '<smartCount>', '<file>'],
    'GetFilesRowsCount');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block),
    'GetFilesRowsCount has no <fields> list in source');
  assert.equal(parsed.step.rows_count_fieldname, 'rowscount',
    'rows_count_fieldname defaults to "rowscount" (setDefault)');
  assert.equal(parsed.step.isaddresult, 'Y',
    'isaddresult defaults Y (setDefault true; missing tag loads true)');
  const fileBlock = parsed.step.file;
  assert.ok(fileBlock, 'GetFilesRowsCount template must carry <file>');
  for (const tag of ['name', 'filemask', 'exclude_filemask', 'file_required',
    'include_subfolders']) {
    assert.ok(hasOwn(fileBlock, tag), `<file> must carry flat <${tag}> per getXML lines 388-392`);
  }
  assert.match(block, /<name>\$\{INPUT_FILE\}<\/name>/);

  // Non-default configuration: count both files and rows over a CSV tree.
  const file = minimalKtr('b4e-getfilesrowscount');
  addElement(file, 'GetFilesRowsCount', 'Count CSV rows');
  setFieldPath(file, 'Count CSV rows', 'files_count', 'Y');
  setFieldPath(file, 'Count CSV rows', 'files_count_fieldname', 'filescount');
  setFieldPath(file, 'Count CSV rows', 'file/name', '${INPUT_DIR}');
  setFieldPath(file, 'Count CSV rows', 'file/filemask', '.*\\.csv');
  setFieldPath(file, 'Count CSV rows', 'file/include_subfolders', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<files_count>Y<\/files_count>/);
  assert.match(after, /<files_count_fieldname>filescount<\/files_count_fieldname>/);
  assert.match(after, /<name>\$\{INPUT_DIR\}<\/name>/);
  assert.match(after, /<include_subfolders>Y<\/include_subfolders>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GetSubFolders template follows getXML: 5 scalars plus flat name/required file pairs', () => {
  // GetSubFoldersMeta.getXML() (lines 339-357): rownum,
  // foldername_dynamic, rownum_field, foldername_field, limit, then
  // <file> ALWAYS emitted with FLAT 2-tag pairs (name/file_required —
  // NO masks). NO <fields> list. setDefault() (lines 254-267): 0
  // folders, flags false.
  const ref = getReference('trans', 'GetSubFolders');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<rownum>', '<foldername_dynamic>', '<rownum_field>',
      '<foldername_field>', '<limit>', '<file>'],
    'GetSubFolders');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block),
    'GetSubFolders has no <fields> list in source');
  assert.ok(!/<filemask(?:\s|\/?>)/.test(block),
    'GetSubFolders <file> has NO <filemask> (pairs only, per getXML lines 350-351)');
  assert.ok(block.includes('</file>'),
    'GetSubFolders template must carry a paired <file> wrapper per getXML()');
  assert.match(block, /<name>\$\{PARENT_DIR\}<\/name>/);

  // Non-default configuration: dynamic folder names plus row numbers.
  const file = minimalKtr('b4e-getsubfolders');
  addElement(file, 'GetSubFolders', 'List project folders');
  setFieldPath(file, 'List project folders', 'rownum', 'Y');
  setFieldPath(file, 'List project folders', 'rownum_field', 'rownumber');
  setFieldPath(file, 'List project folders', 'foldername_dynamic', 'Y');
  setFieldPath(file, 'List project folders', 'foldername_field', 'PARENT_PATH');
  setFieldPath(file, 'List project folders', 'limit', '100');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<rownum>Y<\/rownum>/);
  assert.match(after, /<foldername_dynamic>Y<\/foldername_dynamic>/);
  assert.match(after, /<foldername_field>PARENT_PATH<\/foldername_field>/);
  assert.match(after, /<limit>100<\/limit>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('PropertyOutput template follows getXML: key/value/comment, filename flags, single file block', () => {
  // PropertyOutputMeta.getXML() (lines 386-412): keyfield, valuefield,
  // comment, fileNameInField, fileNameField, then a SINGLE <file> block
  // (name, extention [sic], split, haspartno, add_date, add_time,
  // create_parent_folder, addtoresult [lowercase], append). setDefault()
  // (lines 376-383): append/createparentfolder false, key/value/comment
  // null. No getFields override (pass-through rows).
  const ref = getReference('trans', 'PropertyOutput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<keyfield>', '<valuefield>', '<comment>', '<fileNameInField>',
      '<fileNameField>', '<file>'],
    'PropertyOutput');
  assert.ok(!/<fields(?:\s|\/?>)/.test(block),
    'PropertyOutput has no <fields> list in source');
  assert.ok(!/<extension(?:\s|\/?>)/.test(block),
    'file extension tag is <extention> (source typo), never <extension>');
  assertTagOrder(block,
    ['<name>', '<extention>', '<split>', '<haspartno>', '<add_date>',
      '<add_time>', '<create_parent_folder>', '<addtoresult>', '<append>'],
    'PropertyOutput file block');
  assert.match(block, /<name>\$\{PROP_FILE\}<\/name>/);

  // Non-default configuration: key/value pair appended to a created folder.
  const file = minimalKtr('b4e-propertyoutput');
  addElement(file, 'PropertyOutput', 'Write app config');
  setFieldPath(file, 'Write app config', 'keyfield', 'PROP_KEY');
  setFieldPath(file, 'Write app config', 'valuefield', 'PROP_VALUE');
  setFieldPath(file, 'Write app config', 'comment', 'Generated by ETL');
  setFieldPath(file, 'Write app config', 'file/name', '${PROP_DIR}/app-config');
  setFieldPath(file, 'Write app config', 'file/create_parent_folder', 'Y');
  setFieldPath(file, 'Write app config', 'file/append', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<keyfield>PROP_KEY<\/keyfield>/);
  assert.match(after, /<valuefield>PROP_VALUE<\/valuefield>/);
  assert.match(after, /<name>\$\{PROP_DIR\}\/app-config<\/name>/);
  assert.match(after, /<create_parent_folder>Y<\/create_parent_folder>/);
  assert.match(after, /<append>Y<\/append>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B4e package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b4e-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b4e-package</name></info>',
    '<step><name>Read fixed customers</name><type>FixedInput</type></step>',
    '<step><name>Load report file</name><type>LoadFileInput</type></step>',
    '<step><name>Count CSV rows</name><type>GetFilesRowsCount</type></step>',
    '<step><name>List project folders</name><type>GetSubFolders</type></step>',
    '<step><name>Write app config</name><type>PropertyOutput</type></step>',
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
