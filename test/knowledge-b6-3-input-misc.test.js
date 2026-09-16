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

// Batch B6-3 (input/misc/external/utility/job): 30 trans + 4 job = 34 IDs.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b6-3-source-notes.md.
//
// Grounding (all at the pinned commit; registry = kettle-steps.xml line or
// @Step/@JobEntry annotation; serializer = Meta.getXML lines):
// - trans XBaseInput (XBaseInputMeta, ks.xml:55): file_dbf, limit,
//   add_rownr, field_rownr, include, include_field, charset_name,
//   accept_filenames, accept_field, accept_stepname.
// - trans SASInput (SasInputMeta, ks.xml:126): accept_field + N x <field>
//   directly under step (NO <fields> wrapper): name, rename, type, length,
//   precision, conversion_mask, decimal, grouping, trim_type.
// - trans S3CSVINPUT (S3CsvInputMeta, @Step): aws_access_key, aws_secret_key,
//   bucket, filename, filename_field, rownum_field, include_filename,
//   separator, enclosure, header, max_line_size, lazy_conversion, parallel,
//   fields/field[name,type,format,currency,decimal,group,length,precision,
//   trim_type].
// - trans RssInput (RssInputMeta, @Step): url_in_field, url_field_name,
//   rownum, rownum_field, include_url, url_Field, read_from, urls/url,
//   fields/field[name,column,type,format,currency,decimal,group,length,
//   precision,trim_type,repeat], limit.
// - trans RssOutput (RssOutputMeta, @Step): 25 flat tags (displayitem ..
//   geopointlong), file block, fields/channel_custom_fields + Item_custom_
//   fields, namespaces/namespace.
// - trans MondrianInput (MondrianInputMeta, @Step): connection, sql, catalog,
//   role, variables_active. DB connection reference.
// - trans OlapInput (OlapInputMeta, ks.xml:57): url, username, password,
//   mdx, catalog, variables_active. NO <connection>.
// - trans Injector (InjectorMeta, ks.xml:15): fields/field[name,type,length,
//   precision].
// - trans SocketReader (SocketReaderMeta, ks.xml:5): hostname, port,
//   buffer_size, compressed.
// - trans SocketWriter (SocketWriterMeta, ks.xml:6): port, buffer_size,
//   flush_interval, compressed.
// - trans PrioritizeStreams (PrioritizeStreamsMeta, ks.xml:117):
//   steps/step/name.
// - trans GetSlaveSequence (GetSlaveSequenceMeta, ks.xml:12): valuename,
//   slave, seqname, increment (string).
// - trans GetRepositoryNames (GetRepositoryNamesMeta, ks.xml:119):
//   object_type, rownum, rownum_field, file/directory,name_mask,
//   exclude_name_mask,include_subfolders.
// - trans StepMetastructure (StepMetastructureMeta, ks.xml:66):
//   outputRowcount, rowcountField.
// - trans SSH (SSHMeta, ks.xml:113): dynamicCommandField, command,
//   commandfieldname, port, servername, userName, password, usePrivateKey,
//   keyFileName, passPhrase, stdOutFieldName, stdErrFieldName, timeOut,
//   proxyHost, proxyPort, proxyUsername, proxyPassword.
// - trans SFTPPut (SFTPPutMeta, ks.xml:128): servername, serverport,
//   username, password, sourceFileFieldName, remoteDirectoryFieldName,
//   inputIsStream, addFilenameResut, usekeyfilename, keyfilename,
//   keyfilepass, compression, proxyType, proxyHost, proxyPort,
//   proxyUsername, proxyPassword, createRemoteFolder, aftersftpput,
//   destinationfolderFieldName, createdestinationfolder,
//   remoteFilenameFieldName.
// - trans HL7Input (HL7InputMeta, @Step): message_field only.
// - trans ShapeFileReader (ShapeFileReaderMeta, @Step): shapefilename,
//   dbffilename, encoding.
// - trans PentahoReportingOutput (PentahoReportingOutputMeta, @Step):
//   input_file_field, output_file_field, create_parent_folder, input_file,
//   output_file, use_values_from_fields, parameters/parameter[name,field],
//   processor_type.
// - trans CubeInput (CubeInputMeta, @Step): file/name, limit, addfilenameresult.
// - trans CubeOutput (CubeOutputMeta, @Step): file/name,
//   add_to_result_filenames, do_not_open_newfile_init.
// - trans AutoDoc (AutoDocMeta, @Step): filename_field, file_type_field,
//   target_file, output_type, 10 include_* flags.
// - trans ClosureGenerator (ClosureGeneratorMeta, @Step): parent_id_field,
//   child_id_field, distance_field, is_root_zero.
// - trans CreditCardValidator (CreditCardValidatorMeta, ks.xml:73):
//   fieldname, resultfieldname, cardtype, onlydigits, notvalidmsg.
// - trans RandomCCNumberGenerator (RandomCCNumberGeneratorMeta, ks.xml:114):
//   fields/field[cctype,cclen,ccsize], cardNumberFieldName,
//   cardLengthFieldName, cardTypeFieldName.
// - trans SyslogMessage (SyslogMessageMeta, ks.xml:108): messagefieldname,
//   port, servername, facility, priority, addTimestamp, datePattern,
//   addHostName.
// - trans TableCompare (TableCompareMeta, ks.xml:127): reference_connection,
//   reference_schema_field, reference_table_field, compare_connection,
//   compare_schema_field, compare_table_field, key_fields_field,
//   exclude_fields_field, nr_errors_field, nr_records_reference_field,
//   nr_records_compare_field, nr_errors_left_join_field,
//   nr_errors_inner_join_field, nr_errors_right_join_field,
//   key_description_field, value_reference_field, value_compare_field.
//   TWO DB connection references.
// - trans ParallelGzipCsvInput (ParGzipCsvInputMeta, ks.xml:97): filename,
//   filename_field, rownum_field, include_filename, separator, enclosure,
//   header, buffer_size, lazy_conversion, add_filename_result, parallel,
//   encoding, fields/field[name,type,format,currency,decimal,group,length,
//   precision,trim_type].
// - job CONNECTED_TO_REPOSITORY (JobEntryConnectedToRepository,
//   kje.xml:47): isspecificrep, repname, isspecificuser, username (BEFORE
//   super name/description/type).
// - job DOS_UNIX_CONVERTER (JobEntryDosToUnix, kje.xml:61): super then
//   arg_from_previous, include_subfolders, nr_errors_less_than,
//   success_condition, resultfilenames, fields/field[source_filefolder,
//   wildcard, ConversionType].
// - job EVAL (JobEntryEval, kje.xml:17): super then script.
// - job MSGBOX_INFO (JobEntryMsgBoxInfo, kje.xml:25): super then
//   bodymessage, titremessage.
// - trans TypeExitEdi2XmlStep (Edi2XmlMeta, @Step): inputfield, outputfield.
// - trans TypeExitGoogleAnalyticsInputStep (GaInputStepMeta, @Step):
//   oauthServiceAccount, appName, oauthKeyFile, profileName, profileTableId,
//   customTableId, useCustomTableId, startDate, endDate, dimensions, metrics,
//   filters, sort, useSegment, useCustomSegment, customSegment, segmentId,
//   segmentName, samplingLevel, rowLimit + N x <feedField> directly under
//   step: feedFieldType, feedField, outField, type, conversionMask.
const BATCH = [
  { kind: 'trans', xmlType: 'XBaseInput', alias: 'XBASE_INPUT' },
  { kind: 'trans', xmlType: 'SASInput', alias: 'SAS_INPUT' },
  { kind: 'trans', xmlType: 'S3CSVINPUT', alias: 'S3_CSV_INPUT' },
  { kind: 'trans', xmlType: 'RssInput', alias: 'RSS_INPUT' },
  { kind: 'trans', xmlType: 'RssOutput', alias: 'RSS_OUTPUT' },
  { kind: 'trans', xmlType: 'MondrianInput', alias: 'MONDRIAN_INPUT' },
  { kind: 'trans', xmlType: 'OlapInput', alias: 'OLAP_INPUT' },
  { kind: 'trans', xmlType: 'Injector', alias: 'INJECTOR' },
  { kind: 'trans', xmlType: 'SocketReader', alias: 'SOCKET_READER' },
  { kind: 'trans', xmlType: 'SocketWriter', alias: 'SOCKET_WRITER' },
  { kind: 'trans', xmlType: 'PrioritizeStreams', alias: 'PRIORITIZE_STREAMS' },
  { kind: 'trans', xmlType: 'GetSlaveSequence', alias: 'GET_SLAVE_SEQUENCE' },
  { kind: 'trans', xmlType: 'GetRepositoryNames', alias: 'GET_REPOSITORY_NAMES' },
  { kind: 'trans', xmlType: 'StepMetastructure', alias: 'STEP_METASTRUCTURE' },
  { kind: 'trans', xmlType: 'SSH', alias: 'SSH' },
  { kind: 'trans', xmlType: 'SFTPPut', alias: 'SFTP_PUT' },
  { kind: 'trans', xmlType: 'HL7Input', alias: 'HL7_INPUT' },
  { kind: 'trans', xmlType: 'ShapeFileReader', alias: 'SHAPE_FILE_READER' },
  { kind: 'trans', xmlType: 'PentahoReportingOutput', alias: 'PENTAHO_REPORTING_OUTPUT' },
  { kind: 'trans', xmlType: 'CubeInput', alias: 'CUBE_INPUT' },
  { kind: 'trans', xmlType: 'CubeOutput', alias: 'CUBE_OUTPUT' },
  { kind: 'trans', xmlType: 'AutoDoc', alias: 'AUTO_DOC' },
  { kind: 'trans', xmlType: 'ClosureGenerator', alias: 'CLOSURE_GENERATOR' },
  { kind: 'trans', xmlType: 'CreditCardValidator', alias: 'CREDIT_CARD_VALIDATOR' },
  { kind: 'trans', xmlType: 'RandomCCNumberGenerator', alias: 'RANDOM_CC_NUMBER_GENERATOR' },
  { kind: 'trans', xmlType: 'SyslogMessage', alias: 'SYSLOG_MESSAGE' },
  { kind: 'trans', xmlType: 'TableCompare', alias: 'TABLE_COMPARE' },
  { kind: 'trans', xmlType: 'ParallelGzipCsvInput', alias: 'PARALLEL_GZIP_CSV_INPUT' },
  { kind: 'job', xmlType: 'CONNECTED_TO_REPOSITORY', alias: 'CONNECTED_TO_REPOSITORY' },
  { kind: 'job', xmlType: 'DOS_UNIX_CONVERTER', alias: 'DOS_UNIX_CONVERTER' },
  { kind: 'job', xmlType: 'EVAL', alias: 'EVAL' },
  { kind: 'job', xmlType: 'MSGBOX_INFO', alias: 'MSGBOX_INFO' },
  { kind: 'trans', xmlType: 'TypeExitEdi2XmlStep', alias: 'EDI_2_XML' },
  { kind: 'trans', xmlType: 'TypeExitGoogleAnalyticsInputStep', alias: 'GOOGLE_ANALYTICS_INPUT' },
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
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b6-3-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b6-3') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // Declare every ${VAR} connection the DB steps reference so the
    // structural validator's undefined-connection rule is satisfied. Extra
    // declarations are harmless (the validator only flags uses without a
    // declaration). TableCompare needs two; MondrianInput needs one.
    '  <connection><name>${CONN}</name></connection>',
    '  <connection><name>${REF_CONN}</name></connection>',
    '  <connection><name>${CMP_CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

function minimalKjb(name = 'b6-3') {
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

test('B6-3 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B6-3 references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // Direct-child <type> (not a nested field <type> such as SASInput's
    // <field>/<type> or the GA step's <feedField>/<type>).
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B6-3 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b6-3-${xmlType.toLowerCase()}`)
      : minimalKtr(`b6-3-${xmlType.toLowerCase()}`);
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

test('XBaseInput template follows XBaseInputMeta.getXML 10-tag order', () => {
  // XBaseInputMeta.getXML() (lines 362-383) emits exactly these ten tags in
  // this order. Booleans are Y/N; limit is int default 0; setDefault()
  // (lines 282-287) only resets dbfFileName/rowLimit/rowNrAdded/rowNrField.
  const ref = getReference('trans', 'XBaseInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<file_dbf>', '<limit>', '<add_rownr>', '<field_rownr>', '<include>',
      '<include_field>', '<charset_name>', '<accept_filenames>',
      '<accept_field>', '<accept_stepname>'],
    'XBaseInput');
  assert.equal(parsed.step.limit, 0, 'limit defaults 0');
  assert.equal(parsed.step.add_rownr, 'N', 'add_rownr defaults N');
  assert.ok(!parsed.step.connection,
    'XBaseInput template must not invent a <connection> tag');

  // Non-default configuration: row-number column plus filename column.
  const file = minimalKtr('b6-3-xbaseinput');
  addElement(file, 'XBaseInput', 'Read legacy dbf');
  setFieldPath(file, 'Read legacy dbf', 'file_dbf', '${DBF_FILE}');
  setFieldPath(file, 'Read legacy dbf', 'limit', '1000');
  setFieldPath(file, 'Read legacy dbf', 'add_rownr', 'Y');
  setFieldPath(file, 'Read legacy dbf', 'field_rownr', 'ROW_NR');
  setFieldPath(file, 'Read legacy dbf', 'include', 'Y');
  setFieldPath(file, 'Read legacy dbf', 'include_field', 'SRC_FILE');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<file_dbf>\$\{DBF_FILE\}<\/file_dbf>/);
  assert.match(after, /<add_rownr>Y<\/add_rownr>/);
  assert.match(after, /<field_rownr>ROW_NR<\/field_rownr>/);
  assert.match(after, /<include_field>SRC_FILE<\/include_field>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SASInput template follows SasInputMeta.getXML: accept_field plus bare <field> items', () => {
  // SasInputMeta.getXML() (lines 122-133) emits <accept_field> then N x
  // <field> DIRECTLY under <step> — no <fields> wrapper. Per-field order
  // comes from SasInputField.getXML (SasInputField.java:87-101).
  const ref = getReference('trans', 'SASInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<accept_field>'], 'SASInput');
  assert.ok(!/<fields>/.test(block),
    'SASInput template must not invent a <fields> wrapper');
  const firstField = block.slice(block.indexOf('<field>'));
  assertTagOrder(firstField,
    ['<name>', '<rename>', '<type>', '<length>', '<precision>',
      '<conversion_mask>', '<decimal>', '<grouping>', '<trim_type>'],
    'SASInput field');
  const fields = Array.isArray(parsed.step.field)
    ? parsed.step.field : [parsed.step.field];
  assert.equal(fields[0].trim_type, 'none', 'trim_type code default none');

  // Non-default configuration: dynamic filename field (setFieldPath; the
  // bare <field> items have no list wrapper so setFields does not apply).
  const file = minimalKtr('b6-3-sasinput');
  addElement(file, 'SASInput', 'Read sas data');
  setFieldPath(file, 'Read sas data', 'accept_field', 'SRC_SAS_PATH');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<accept_field>SRC_SAS_PATH<\/accept_field>/);
  assert.match(after, /<type>String<\/type>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('S3CSVINPUT template follows S3CsvInputMeta.getXML order with paired <fields>', () => {
  // S3CsvInputMeta.getXML() (lines 201-240): keys (encrypted), bucket,
  // filename, filename_field, rownum_field, include_filename, separator,
  // enclosure, header, max_line_size, lazy_conversion, parallel, then a
  // PAIRED <fields> wrapper (always emitted, lines 220/237).
  // setDefault() (lines 148-154): header/lazy true, maxLineSize "5000".
  const ref = getReference('trans', 'S3CSVINPUT');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<aws_access_key>', '<aws_secret_key>', '<bucket>', '<filename>',
      '<filename_field>', '<rownum_field>', '<include_filename>',
      '<separator>', '<enclosure>', '<header>', '<max_line_size>',
      '<lazy_conversion>', '<parallel>', '<fields>'],
    'S3CSVINPUT');
  assert.equal(parsed.step.header, 'Y', 'header defaults Y (setDefault true)');
  assert.equal(parsed.step.lazy_conversion, 'Y', 'lazy_conversion defaults Y');
  assert.ok(block.includes('</fields>'),
    'S3CSVINPUT template must carry a paired <fields> wrapper per getXML()');
  assert.ok(!parsed.step.connection,
    'S3CSVINPUT template must not invent a <connection> tag');

  // Non-default configuration: two typed fields plus filename/rownum.
  const file = minimalKtr('b6-3-s3csvinput');
  addElement(file, 'S3CSVINPUT', 'Read orders csv');
  setFieldPath(file, 'Read orders csv', 'bucket', '${S3_BUCKET}');
  setFieldPath(file, 'Read orders csv', 'separator', ';');
  setFieldPath(file, 'Read orders csv', 'parallel', 'Y');
  setFieldPath(file, 'Read orders csv', 'rownum_field', 'ROW_NR');
  setFields(file, 'Read orders csv', 'fields', 'field', [
    {
      name: 'ORDER_ID', type: 'Integer', format: '', currency: '',
      decimal: '.', group: ',', length: 10, precision: 0, trim_type: 'none',
    },
    {
      name: 'ORDER_DATE', type: 'Date', format: 'yyyy-MM-dd', currency: '',
      decimal: '', group: '', length: -1, precision: -1, trim_type: 'none',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<bucket>\$\{S3_BUCKET\}<\/bucket>/);
  assert.match(after, /<separator>;<\/separator>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read orders csv');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'ORDER_ID');
  assert.equal(items[0].type, 'Integer');
  assert.equal(items[1].format, 'yyyy-MM-dd');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('RssInput template follows RssInputMeta.getXML order with url_Field case', () => {
  // RssInputMeta.getXML() (lines 263-286): url_in_field, url_field_name,
  // rownum, rownum_field, include_url, url_Field (capital F), read_from,
  // urls/url, fields/field[name,column,type,...,repeat], limit.
  const ref = getReference('trans', 'RssInput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<url_in_field>', '<url_field_name>', '<rownum>', '<rownum_field>',
      '<include_url>', '<url_Field>', '<read_from>', '<urls>', '<fields>',
      '<limit>'],
    'RssInput');
  // The default template emits the empty tag self-closing (<url_Field/>);
  // assert the capital-F casing regardless of open vs self-closing form.
  assert.ok(/<url_Field(?:\s|\/?>)/.test(block),
    'RssInput template must keep the capital-F <url_Field> tag');
  assert.ok(!/<url_field(?:\s|\/?>)/.test(block),
    'RssInput template must not use lowercase <url_field> for the URL output column');
  const firstField = block.slice(block.indexOf('<fields>'));
  assertTagOrder(firstField,
    ['<name>', '<column>', '<type>', '<repeat>'],
    'RssInput field');

  // Non-default configuration: dynamic URL plus two feed columns.
  const file = minimalKtr('b6-3-rssinput');
  addElement(file, 'RssInput', 'Read feeds');
  setFieldPath(file, 'Read feeds', 'url_in_field', 'Y');
  setFieldPath(file, 'Read feeds', 'url_field_name', 'FEED_URL');
  setFieldPath(file, 'Read feeds', 'limit', '100');
  setFields(file, 'Read feeds', 'fields', 'field', [
    {
      name: 'ITEM_TITLE', column: 'title', type: 'String', format: '',
      currency: '', decimal: '', group: '', length: 255, precision: -1,
      trim_type: 'both', repeat: 'Y',
    },
    {
      name: 'PUB_DATE', column: 'pubdate', type: 'Date',
      format: 'yyyy-MM-dd', currency: '', decimal: '', group: '',
      length: -1, precision: -1, trim_type: 'none', repeat: 'N',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<url_in_field>Y<\/url_in_field>/);
  assert.match(after, /<column>pubdate<\/column>/);
  assert.match(after, /<limit>100<\/limit>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('RssOutput template follows RssOutputMeta.getXML: flat tags, file block, custom fields, namespaces', () => {
  // RssOutputMeta.getXML() (lines 757-830): 25 flat tags, <file> block
  // (with lowercase <addtoresult> inside), <fields> with channel_custom_
  // fields + Item_custom_fields (capital I), namespaces/namespace.
  const ref = getReference('trans', 'RssOutput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<displayitem>', '<customrss>', '<channel_title>', '<version>',
      '<encoding>', '<item_title>', '<addgeorss>', '<file>', '<fields>',
      '<namespaces>'],
    'RssOutput');
  assert.ok(block.includes('<extention>'),
    'RssOutput template must keep the <extention> spelling');
  assert.ok(block.includes('<addtoresult>'),
    'RssOutput template must keep lowercase <addtoresult>');
  assert.ok(block.includes('<Item_custom_fields>'),
    'RssOutput template must keep capital-I <Item_custom_fields>');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<filename_field>', '<name>', '<extention>', '<split>',
      '<is_filename_in_field>', '<create_parent_folder>', '<addtoresult>'],
    'RssOutput file');

  // Non-default configuration: GeoRSS plus a namespace entry.
  const file = minimalKtr('b6-3-rssoutput');
  addElement(file, 'RssOutput', 'Write feed');
  setFieldPath(file, 'Write feed', 'version', 'rss_2.0');
  setFieldPath(file, 'Write feed', 'addgeorss', 'Y');
  setFieldPath(file, 'Write feed', 'geopointlat', 'LAT_FIELD');
  setFields(file, 'Write feed', 'namespaces', 'namespace', [
    { namespace_tag: 'georss', namespace_value: 'http://www.georss.org/georss' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<addgeorss>Y<\/addgeorss>/);
  assert.match(after, /<namespace_tag>georss<\/namespace_tag>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('MondrianInput template follows MondrianInputMeta.getXML with DB connection', () => {
  // MondrianInputMeta.getXML() (lines 193-204): connection, sql, catalog,
  // role, variables_active. variables_active uses case-SENSITIVE
  // "Y".equals (lowercase y loads false).
  const ref = getReference('trans', 'MondrianInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<sql>', '<catalog>', '<role>', '<variables_active>'],
    'MondrianInput');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'connection'),
    'MondrianInput template must carry <connection> (DB connection reference)');

  // Non-default configuration: role plus variable substitution in MDX.
  const file = minimalKtr('b6-3-mondrianinput');
  addElement(file, 'MondrianInput', 'Read sales cube');
  setFieldPath(file, 'Read sales cube', 'connection', '${CONN}');
  setFieldPath(file, 'Read sales cube', 'sql',
    'SELECT {[Measures].[${MEASURE}]} ON COLUMNS FROM [Sales]');
  setFieldPath(file, 'Read sales cube', 'catalog', '${CATALOG}');
  setFieldPath(file, 'Read sales cube', 'role', '${ROLE}');
  setFieldPath(file, 'Read sales cube', 'variables_active', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.match(after, /<variables_active>Y<\/variables_active>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('OlapInput template follows OlapInputMeta.getXML: mdx before catalog, no connection', () => {
  // OlapInputMeta.getXML() (lines 160-172): url, username, password
  // (encrypted), mdx, catalog, variables_active. The driver is a hardcoded
  // const (line 64) — never serialized. variables_active is case-sensitive.
  const ref = getReference('trans', 'OlapInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<url>', '<username>', '<password>', '<mdx>', '<catalog>',
      '<variables_active>'],
    'OlapInput');
  assert.ok(!parsed.step.connection,
    'OlapInput template must not invent a <connection> tag');

  // Non-default configuration: variable substitution across url/mdx.
  const file = minimalKtr('b6-3-olapinput');
  addElement(file, 'OlapInput', 'Read olap sales');
  setFieldPath(file, 'Read olap sales', 'url', '${OLAP_URL}');
  setFieldPath(file, 'Read olap sales', 'mdx',
    'SELECT {[Measures].[${MEASURE}]} ON COLUMNS FROM [${CUBE}]');
  setFieldPath(file, 'Read olap sales', 'variables_active', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<url>\$\{OLAP_URL\}<\/url>/);
  assert.match(after, /<variables_active>Y<\/variables_active>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('Injector template follows InjectorMeta.getXML fields/field list', () => {
  // InjectorMeta.getXML() (lines 151-166): <fields> wrapper, each <field>
  // has name, type (name string), length, precision. setDefault()
  // (lines 184-186) allocates zero fields.
  const ref = getReference('trans', 'Injector');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<fields>'], 'Injector');
  const firstField = block.slice(block.indexOf('<field>'));
  assertTagOrder(firstField,
    ['<name>', '<type>', '<length>', '<precision>'],
    'Injector field');

  // Non-default configuration: three heterogeneously typed fields.
  const file = minimalKtr('b6-3-injector');
  addElement(file, 'Injector', 'Define schema');
  setFields(file, 'Define schema', 'fields', 'field', [
    { name: 'CUSTOMER_ID', type: 'Integer', length: 10, precision: 0 },
    { name: 'ORDER_TOTAL', type: 'Number', length: 12, precision: 2 },
    { name: 'ORDER_DATE', type: 'Date', length: -1, precision: -1 },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Define schema');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 3);
  assert.equal(items[1].type, 'Number');
  assert.equal(items[1].precision, 2);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SocketReader template follows SocketReaderMeta.getXML order', () => {
  // SocketReaderMeta.getXML() (lines 75-84): hostname, port, buffer_size,
  // compressed (Y/N). setDefault() (lines 93-96): bufferSize "3000",
  // compressed true.
  const ref = getReference('trans', 'SocketReader');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<hostname>', '<port>', '<buffer_size>', '<compressed>'],
    'SocketReader');
  assert.equal(parsed.step.buffer_size, 3000, 'buffer_size defaults 3000');
  assert.equal(parsed.step.compressed, 'Y', 'compressed defaults Y');

  // Non-default configuration: uncompressed large buffer on a variable port.
  const file = minimalKtr('b6-3-socketreader');
  addElement(file, 'SocketReader', 'Read socket lines');
  setFieldPath(file, 'Read socket lines', 'hostname', '${SOCKET_HOST}');
  setFieldPath(file, 'Read socket lines', 'port', '${SOCKET_PORT}');
  setFieldPath(file, 'Read socket lines', 'buffer_size', '65536');
  setFieldPath(file, 'Read socket lines', 'compressed', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<hostname>\$\{SOCKET_HOST\}<\/hostname>/);
  assert.match(after, /<compressed>N<\/compressed>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SocketWriter template follows SocketWriterMeta.getXML order (flush_interval, no hostname)', () => {
  // SocketWriterMeta.getXML() (lines 75-84): port, buffer_size,
  // flush_interval, compressed (Y/N). setDefault() (lines 93-97):
  // bufferSize "2000", flushInterval "5000", compressed true.
  const ref = getReference('trans', 'SocketWriter');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<port>', '<buffer_size>', '<flush_interval>', '<compressed>'],
    'SocketWriter');
  assert.ok(!parsed.step.hostname,
    'SocketWriter template must not invent a <hostname> tag');
  assert.equal(parsed.step.flush_interval, 5000, 'flush_interval defaults 5000');

  // Non-default configuration: fast flush, uncompressed.
  const file = minimalKtr('b6-3-socketwriter');
  addElement(file, 'SocketWriter', 'Write socket lines');
  setFieldPath(file, 'Write socket lines', 'port', '${SOCKET_PORT}');
  setFieldPath(file, 'Write socket lines', 'buffer_size', '65536');
  setFieldPath(file, 'Write socket lines', 'flush_interval', '1000');
  setFieldPath(file, 'Write socket lines', 'compressed', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<flush_interval>1000<\/flush_interval>/);
  assert.match(after, /<compressed>N<\/compressed>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('PrioritizeStreams template follows PrioritizeStreamsMeta.getXML steps/step/name', () => {
  // PrioritizeStreamsMeta.getXML() (lines 120-132): <steps> wrapper, each
  // <step> item carries only <name>. setDefault() (lines 134-142)
  // allocates zero steps.
  const ref = getReference('trans', 'PrioritizeStreams');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<steps>'], 'PrioritizeStreams');
  const stepsBlock = block.slice(block.indexOf('<steps>'));
  assertTagOrder(stepsBlock, ['<step>', '<name>'], 'PrioritizeStreams steps');

  // NOTE: no edit-API writes here. The item tag <step> collides with the
  // root element tag <step>, so setFields()/findChildSpan cannot locate a
  // <steps> list scoped to this step (same failure class documented for
  // StepsMetrics in b6-2). The non-default config is asserted from the
  // reference's second fenced block instead.
  const blocks = [...ref.content.matchAll(/```xml\r?\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  assert.ok(blocks.length >= 2, 'reference carries a non-default example block');
  const nonDefault = blocks[blocks.length - 1];
  const stepsExample = nonDefault.slice(nonDefault.indexOf('<steps>'));
  assertTagOrder(stepsExample, ['<step>', '<name>'], 'PrioritizeStreams example');
  assert.equal((stepsExample.match(/<step>/g) || []).length, 2, 'example prioritizes two steps');
  assert.ok(/<name>HIGH_PRIORITY_SOURCE<\/name>/.test(nonDefault), 'high priority source');
  assert.ok(/<name>LOW_PRIORITY_SOURCE<\/name>/.test(nonDefault), 'low priority source');

  // The default template still inserts and validates clean.
  const file = minimalKtr('b6-3-prioritizestreams');
  addElement(file, 'PrioritizeStreams', 'Order streams');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GetSlaveSequence template follows GetSlaveSequenceMeta.getXML order', () => {
  // GetSlaveSequenceMeta.getXML() (lines 105-114): valuename, slave,
  // seqname, increment — all strings (increment is NOT int).
  // setDefault() (lines 89-94): id / slave server name / Slave Sequence
  // Name -- To be configured / 10000.
  const ref = getReference('trans', 'GetSlaveSequence');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<valuename>', '<slave>', '<seqname>', '<increment>'],
    'GetSlaveSequence');
  assert.equal(parsed.step.increment, 10000, 'increment defaults "10000"');
  assert.ok(!parsed.step.connection,
    'GetSlaveSequence <slave> is a slave-server name, not a <connection>');

  // Non-default configuration: order sequence with a 500 block.
  const file = minimalKtr('b6-3-getslavesequence');
  addElement(file, 'GetSlaveSequence', 'Next order id');
  setFieldPath(file, 'Next order id', 'valuename', 'ORDER_SEQ');
  setFieldPath(file, 'Next order id', 'slave', '${SLAVE_SERVER}');
  setFieldPath(file, 'Next order id', 'seqname', 'SEQ_ORDER_ID');
  setFieldPath(file, 'Next order id', 'increment', '500');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<valuename>ORDER_SEQ<\/valuename>/);
  assert.match(after, /<seqname>SEQ_ORDER_ID<\/seqname>/);
  assert.match(after, /<increment>500<\/increment>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('GetRepositoryNames template follows GetRepositoryNamesMeta.getXML with singular <file>', () => {
  // GetRepositoryNamesMeta.getXML() (lines 205-223): object_type,
  // rownum (Y/N), rownum_field, then singular <file> wrapper with the flat
  // repeating quadruple directory, name_mask, exclude_name_mask,
  // include_subfolders. setDefault() (lines 115-129): All / true / rownr /
  // (/, .*, "", true).
  const ref = getReference('trans', 'GetRepositoryNames');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<object_type>', '<rownum>', '<rownum_field>', '<file>'],
    'GetRepositoryNames');
  assert.ok(!/<files>/.test(block),
    'GetRepositoryNames wrapper is singular <file>, not <files>');
  assert.equal(parsed.step.rownum, 'Y', 'rownum defaults Y');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<directory>', '<name_mask>', '<exclude_name_mask>',
      '<include_subfolders>'],
    'GetRepositoryNames file');

  // Non-default configuration: transformations only, no row number.
  const file = minimalKtr('b6-3-getrepositorynames');
  addElement(file, 'GetRepositoryNames', 'List objects');
  setFieldPath(file, 'List objects', 'object_type', 'Transformation');
  setFieldPath(file, 'List objects', 'rownum', 'N');
  setFieldPath(file, 'List objects', 'file/directory', '/production');
  setFieldPath(file, 'List objects', 'file/name_mask', '.*_daily');
  setFieldPath(file, 'List objects', 'file/include_subfolders', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<object_type>Transformation<\/object_type>/);
  assert.match(after, /<directory>\/production<\/directory>/);
  assert.match(after, /<name_mask>\.\*_daily<\/name_mask>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('StepMetastructure template carries only outputRowcount and rowcountField', () => {
  // StepMetastructureMeta.getXML() (lines 78-86) emits ONLY these two tags;
  // the 7 display names are i18n in code (setDefault lines 188-197) and
  // must not be invented in XML.
  const ref = getReference('trans', 'StepMetastructure');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<outputRowcount>', '<rowcountField>'],
    'StepMetastructure');
  assert.equal(parsed.step.outputRowcount, 'N',
    'outputRowcount defaults N (setDefault leaves false)');

  // Non-default configuration: include the row-count column.
  const file = minimalKtr('b6-3-stepmetastructure');
  addElement(file, 'StepMetastructure', 'Describe stream');
  setFieldPath(file, 'Describe stream', 'outputRowcount', 'Y');
  setFieldPath(file, 'Describe stream', 'rowcountField', 'FIELD_COUNT');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<outputRowcount>Y<\/outputRowcount>/);
  assert.match(after, /<rowcountField>FIELD_COUNT<\/rowcountField>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SSH template follows SSHMeta.getXML 17-tag order with servername/userName case', () => {
  // SSHMeta.getXML() (lines 377-402): dynamicCommandField, command,
  // commandfieldname, port, servername (lowercase), userName (camel),
  // password, usePrivateKey, keyFileName, passPhrase, stdOutFieldName,
  // stdErrFieldName, timeOut, proxyHost, proxyPort, proxyUsername,
  // proxyPassword. setDefault() (lines 108-125): port "22",
  // usePrivateKey true, stdOut/stdErr names, timeOut "0".
  const ref = getReference('trans', 'SSH');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<dynamicCommandField>', '<command>', '<commandfieldname>', '<port>',
      '<servername>', '<userName>', '<password>', '<usePrivateKey>',
      '<keyFileName>', '<passPhrase>', '<stdOutFieldName>',
      '<stdErrFieldName>', '<timeOut>', '<proxyHost>', '<proxyPort>',
      '<proxyUsername>', '<proxyPassword>'],
    'SSH');
  assert.ok(!parsed.step.connection,
    'SSH template must not invent a <connection> tag');
  assert.equal(parsed.step.port, 22, 'port defaults "22"');

  // Non-default configuration: dynamic command with private key and proxy.
  const file = minimalKtr('b6-3-ssh');
  addElement(file, 'SSH', 'Run remote command');
  setFieldPath(file, 'Run remote command', 'dynamicCommandField', 'Y');
  setFieldPath(file, 'Run remote command', 'commandfieldname', 'SSH_CMD');
  setFieldPath(file, 'Run remote command', 'servername', '${SSH_HOST}');
  setFieldPath(file, 'Run remote command', 'userName', '${SSH_USER}');
  setFieldPath(file, 'Run remote command', 'usePrivateKey', 'Y');
  setFieldPath(file, 'Run remote command', 'keyFileName', '${SSH_KEY}');
  setFieldPath(file, 'Run remote command', 'timeOut', '30');
  setFieldPath(file, 'Run remote command', 'proxyHost', '${PROXY_HOST}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<dynamicCommandField>Y<\/dynamicCommandField>/);
  assert.match(after, /<servername>\$\{SSH_HOST\}<\/servername>/);
  assert.match(after, /<userName>\$\{SSH_USER\}<\/userName>/);
  assert.match(after, /<proxyHost>\$\{PROXY_HOST\}<\/proxyHost>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SFTPPut template follows SFTPPutMeta.getXML order with addFilenameResut spelling', () => {
  // SFTPPutMeta.getXML() (lines 161-196): servername, serverport, username,
  // password, sourceFileFieldName, remoteDirectoryFieldName, inputIsStream,
  // addFilenameResut (sic), usekeyfilename, keyfilename, keyfilepass,
  // compression, proxyType, proxyHost, proxyPort, proxyUsername,
  // proxyPassword, createRemoteFolder, aftersftpput,
  // destinationfolderFieldName, createdestinationfolder (lowercase d),
  // remoteFilenameFieldName. setDefault() (lines 140-159): port "22",
  // compression "none".
  const ref = getReference('trans', 'SFTPPut');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<servername>', '<serverport>', '<username>', '<password>',
      '<sourceFileFieldName>', '<remoteDirectoryFieldName>',
      '<inputIsStream>', '<addFilenameResut>', '<usekeyfilename>',
      '<keyfilename>', '<keyfilepass>', '<compression>', '<proxyType>',
      '<proxyHost>', '<proxyPort>', '<proxyUsername>', '<proxyPassword>',
      '<createRemoteFolder>', '<aftersftpput>',
      '<destinationfolderFieldName>', '<createdestinationfolder>',
      '<remoteFilenameFieldName>'],
    'SFTPPut');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'addFilenameResut'),
    'SFTPPut template must keep the <addFilenameResut> spelling');
  assert.equal(parsed.step.serverport, 22, 'serverport defaults "22"');

  // Non-default configuration: key auth with delete-after-upload.
  const file = minimalKtr('b6-3-sftpput');
  addElement(file, 'SFTPPut', 'Upload export');
  setFieldPath(file, 'Upload export', 'servername', '${SFTP_HOST}');
  setFieldPath(file, 'Upload export', 'username', '${SFTP_USER}');
  setFieldPath(file, 'Upload export', 'usekeyfilename', 'Y');
  setFieldPath(file, 'Upload export', 'keyfilename', '${SFTP_KEY}');
  setFieldPath(file, 'Upload export', 'createRemoteFolder', 'Y');
  setFieldPath(file, 'Upload export', 'aftersftpput', 'delete');
  setFieldPath(file, 'Upload export', 'createdestinationfolder', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<servername>\$\{SFTP_HOST\}<\/servername>/);
  assert.match(after, /<usekeyfilename>Y<\/usekeyfilename>/);
  assert.match(after, /<aftersftpput>delete<\/aftersftpput>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('HL7Input template carries only message_field', () => {
  // HL7InputMeta.getXML() (lines 71-74) emits exactly one tag.
  // setDefault() (lines 80-82) is a no-op (messageField stays null).
  const ref = getReference('trans', 'HL7Input');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<message_field>'], 'HL7Input');

  // Non-default configuration: business-specific message field.
  const file = minimalKtr('b6-3-hl7input');
  addElement(file, 'HL7Input', 'Parse ADT feed');
  setFieldPath(file, 'Parse ADT feed', 'message_field', 'ADT_MESSAGE');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<message_field>ADT_MESSAGE<\/message_field>/);
  assert.ok(parsed.step, 'template parses');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ShapeFileReader template follows ShapeFileReaderMeta.getXML lowercase triple', () => {
  // ShapeFileReaderMeta.getXML() (lines 248-256): shapefilename,
  // dbffilename, encoding — all lowercase. setDefault() (lines 152-156):
  // "", "", " ".
  const ref = getReference('trans', 'ShapeFileReader');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<shapefilename>', '<dbffilename>', '<encoding>'],
    'ShapeFileReader');

  // Non-default configuration: districts shapefile with UTF-8 DBF.
  const file = minimalKtr('b6-3-shapefilereader');
  addElement(file, 'ShapeFileReader', 'Read districts');
  setFieldPath(file, 'Read districts', 'shapefilename', '${GIS_DIR}/districts.shp');
  setFieldPath(file, 'Read districts', 'dbffilename', '${GIS_DIR}/districts.dbf');
  setFieldPath(file, 'Read districts', 'encoding', 'UTF-8');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<shapefilename>\$\{GIS_DIR\}\/districts\.shp<\/shapefilename>/);
  assert.match(after, /<encoding>UTF-8<\/encoding>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('PentahoReportingOutput template follows getXML with paired <parameters>', () => {
  // PentahoReportingOutputMeta.getXML() (lines 195-220): input_file_field,
  // output_file_field, create_parent_folder, input_file, output_file,
  // use_values_from_fields, parameters/parameter[name,field] (always
  // emitted, sorted by name), processor_type. setDefault() (lines
  // 189-193): PDF / false / true.
  const ref = getReference('trans', 'PentahoReportingOutput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<input_file_field>', '<output_file_field>', '<create_parent_folder>',
      '<input_file>', '<output_file>', '<use_values_from_fields>',
      '<parameters>', '<processor_type>'],
    'PentahoReportingOutput');
  assert.equal(parsed.step.processor_type, 'PDF', 'processor_type defaults PDF');
  assert.ok(block.includes('</parameters>'),
    'PentahoReportingOutput template must carry a paired <parameters> wrapper');

  // Non-default configuration: field-driven paths with Excel and 2 params.
  const file = minimalKtr('b6-3-pentahoreportingoutput');
  addElement(file, 'PentahoReportingOutput', 'Run monthly report');
  setFieldPath(file, 'Run monthly report', 'input_file_field', 'REPORT_PATH');
  setFieldPath(file, 'Run monthly report', 'output_file_field', 'OUTPUT_PATH');
  setFieldPath(file, 'Run monthly report', 'create_parent_folder', 'Y');
  setFieldPath(file, 'Run monthly report', 'processor_type', 'Excel');
  setFields(file, 'Run monthly report', 'parameters', 'parameter', [
    { name: 'REGION', field: 'REGION_CODE' },
    { name: 'YEAR', field: 'FISCAL_YEAR' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<processor_type>Excel<\/processor_type>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Run monthly report');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.parameters.parameter)
    ? step.parameters.parameter : [step.parameters.parameter];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'REGION');
  assert.equal(items[0].field, 'REGION_CODE');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('CubeInput template follows CubeInputMeta.getXML file/name/limit/addfilenameresult', () => {
  // CubeInputMeta.getXML() (lines 198-208): literal <file> wrapper with
  // name (NOT filename), limit (STRING), addfilenameresult.
  // setDefault() (lines 156-160): "file" / "0" / false.
  const ref = getReference('trans', 'CubeInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<file>'], 'CubeInput');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<name>', '<limit>', '<addfilenameresult>'],
    'CubeInput file');
  assert.ok(!parsed.step.filename,
    'CubeInput child is <name>, not <filename>');

  // Non-default configuration: limited read with add-to-result.
  const file = minimalKtr('b6-3-cubeinput');
  addElement(file, 'CubeInput', 'Read sales cube');
  setFieldPath(file, 'Read sales cube', 'file/name', '${CUBE_DIR}/sales.cube');
  setFieldPath(file, 'Read sales cube', 'file/limit', '5000');
  setFieldPath(file, 'Read sales cube', 'file/addfilenameresult', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<name>\$\{CUBE_DIR\}\/sales\.cube<\/name>/);
  assert.match(after, /<limit>5000<\/limit>/);
  assert.match(after, /<addfilenameresult>Y<\/addfilenameresult>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('CubeOutput template follows CubeOutputMeta.getXML file triple', () => {
  // CubeOutputMeta.getXML() (lines 151-162): literal <file> wrapper with
  // name, add_to_result_filenames, do_not_open_newfile_init.
  // setDefault() (lines 145-149): "file.cube" / false / false.
  const ref = getReference('trans', 'CubeOutput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<file>'], 'CubeOutput');
  const fileBlock = block.slice(block.indexOf('<file>'));
  assertTagOrder(fileBlock,
    ['<name>', '<add_to_result_filenames>', '<do_not_open_newfile_init>'],
    'CubeOutput file');

  // Non-default configuration: add the cube file to result filenames.
  const file = minimalKtr('b6-3-cubeoutput');
  addElement(file, 'CubeOutput', 'Write sales cube');
  setFieldPath(file, 'Write sales cube', 'file/name', '${CUBE_DIR}/sales.cube');
  setFieldPath(file, 'Write sales cube', 'file/add_to_result_filenames', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<add_to_result_filenames>Y<\/add_to_result_filenames>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('AutoDoc template follows AutoDocMeta.getXML 13-tag order', () => {
  // AutoDocMeta.getXML() (lines 154-175): filename_field, file_type_field,
  // target_file, output_type (enum name, NPE when null), then 10 include_*
  // flags. output_type unknown/null loads back as PDF (lines 140-144).
  // setDefault() (lines 107-119): PDF + target kettle-autodoc.pdf; the
  // last-exec-result flag ends FALSE (line 118 overwrites line 117).
  const ref = getReference('trans', 'AutoDoc');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<filename_field>', '<file_type_field>', '<target_file>',
      '<output_type>', '<include_name>', '<include_description>',
      '<include_extended_description>', '<include_creation>',
      '<include_modification>', '<include_image>',
      '<include_logging_config>', '<include_last_exec_result>',
      '<include_image_area_list>'],
    'AutoDoc');
  assert.equal(parsed.step.output_type, 'PDF', 'output_type defaults PDF');

  // Non-default configuration: METADATA mode driven by fields.
  const file = minimalKtr('b6-3-autodoc');
  addElement(file, 'AutoDoc', 'Document lineage');
  setFieldPath(file, 'Document lineage', 'filename_field', 'SRC_PATH');
  setFieldPath(file, 'Document lineage', 'output_type', 'METADATA');
  setFieldPath(file, 'Document lineage', 'include_last_exec_result', 'Y');
  setFieldPath(file, 'Document lineage', 'include_image_area_list', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<output_type>METADATA<\/output_type>/);
  assert.match(after, /<include_last_exec_result>Y<\/include_last_exec_result>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ClosureGenerator template follows ClosureGeneratorMeta.getXML order', () => {
  // ClosureGeneratorMeta.getXML() (lines 129-138): parent_id_field,
  // child_id_field, distance_field, is_root_zero. setDefault() (lines
  // 95-96) is a no-op (all null/false).
  const ref = getReference('trans', 'ClosureGenerator');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<parent_id_field>', '<child_id_field>', '<distance_field>',
      '<is_root_zero>'],
    'ClosureGenerator');

  // Non-default configuration: org-chart closure with zero-based root.
  const file = minimalKtr('b6-3-closuregenerator');
  addElement(file, 'ClosureGenerator', 'Close org chart');
  setFieldPath(file, 'Close org chart', 'parent_id_field', 'MANAGER_ID');
  setFieldPath(file, 'Close org chart', 'child_id_field', 'EMP_ID');
  setFieldPath(file, 'Close org chart', 'distance_field', 'LEVELS');
  setFieldPath(file, 'Close org chart', 'is_root_zero', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<parent_id_field>MANAGER_ID<\/parent_id_field>/);
  assert.match(after, /<is_root_zero>Y<\/is_root_zero>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('CreditCardValidator template follows CreditCardValidatorMeta.getXML order', () => {
  // CreditCardValidatorMeta.getXML() (lines 184-194): fieldname,
  // resultfieldname, cardtype, onlydigits (Y/N), notvalidmsg.
  // setDefault() (lines 155-160): result / false / "card type" /
  // "not valid message".
  const ref = getReference('trans', 'CreditCardValidator');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<fieldname>', '<resultfieldname>', '<cardtype>', '<onlydigits>',
      '<notvalidmsg>'],
    'CreditCardValidator');
  assert.equal(parsed.step.resultfieldname, 'result',
    'resultfieldname defaults to "result" (setDefault)');

  // Non-default configuration: digits-only PAN with business column names.
  const file = minimalKtr('b6-3-creditcardvalidator');
  addElement(file, 'CreditCardValidator', 'Validate cards');
  setFieldPath(file, 'Validate cards', 'fieldname', 'PAN');
  setFieldPath(file, 'Validate cards', 'resultfieldname', 'IS_VALID');
  setFieldPath(file, 'Validate cards', 'cardtype', 'CARD_BRAND');
  setFieldPath(file, 'Validate cards', 'onlydigits', 'Y');
  setFieldPath(file, 'Validate cards', 'notvalidmsg', 'VALIDATION_MSG');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<fieldname>PAN<\/fieldname>/);
  assert.match(after, /<onlydigits>Y<\/onlydigits>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('RandomCCNumberGenerator template follows getXML: fields/field triple plus camelCase columns', () => {
  // RandomCCNumberGeneratorMeta.getXML() (lines 250-268): <fields> wrapper
  // with <field>[cctype,cclen,ccsize], then cardNumberFieldName,
  // cardLengthFieldName, cardTypeFieldName (camelCase).
  const ref = getReference('trans', 'RandomCCNumberGenerator');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<fields>', '<cardNumberFieldName>', '<cardLengthFieldName>',
      '<cardTypeFieldName>'],
    'RandomCCNumberGenerator');
  const firstField = block.slice(block.indexOf('<field>'));
  assertTagOrder(firstField,
    ['<cctype>', '<cclen>', '<ccsize>'],
    'RandomCCNumberGenerator field');

  // Non-default configuration: two card brands with business column names.
  const file = minimalKtr('b6-3-randomccnumbergenerator');
  addElement(file, 'RandomCCNumberGenerator', 'Generate test pans');
  setFields(file, 'Generate test pans', 'fields', 'field', [
    { cctype: 'Visa', cclen: '16', ccsize: '100' },
    { cctype: 'MasterCard', cclen: '16', ccsize: '50' },
  ]);
  setFieldPath(file, 'Generate test pans', 'cardNumberFieldName', 'PAN');
  setFieldPath(file, 'Generate test pans', 'cardTypeFieldName', 'BRAND');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<cctype>Visa<\/cctype>/);
  assert.match(after, /<ccsize>50<\/ccsize>/);
  assert.match(after, /<cardNumberFieldName>PAN<\/cardNumberFieldName>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('SyslogMessage template follows SyslogMessageMeta.getXML order with servername/datePattern case', () => {
  // SyslogMessageMeta.getXML() (lines 219-232): messagefieldname, port,
  // servername (lowercase), facility, priority, addTimestamp, datePattern
  // (camel), addHostName. setDefault() (lines 78-87): port DEFAULT_PORT,
  // FACILITYS[0]/PRIORITYS[0], DEFAULT_DATE_FORMAT, both flags true.
  const ref = getReference('trans', 'SyslogMessage');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<messagefieldname>', '<port>', '<servername>', '<facility>',
      '<priority>', '<addTimestamp>', '<datePattern>', '<addHostName>'],
    'SyslogMessage');
  assert.ok(block.includes('<servername>'),
    'SyslogMessage template must keep lowercase <servername>');
  assert.ok(block.includes('<datePattern>'),
    'SyslogMessage template must keep camelCase <datePattern>');

  // Non-default configuration: authpriv/crit without hostname.
  const file = minimalKtr('b6-3-syslogmessage');
  addElement(file, 'SyslogMessage', 'Send alert');
  setFieldPath(file, 'Send alert', 'messagefieldname', 'ALERT_MSG');
  setFieldPath(file, 'Send alert', 'servername', '${SYSLOG_HOST}');
  setFieldPath(file, 'Send alert', 'port', '${SYSLOG_PORT}');
  setFieldPath(file, 'Send alert', 'facility', 'authpriv');
  setFieldPath(file, 'Send alert', 'priority', 'crit');
  setFieldPath(file, 'Send alert', 'addHostName', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<servername>\$\{SYSLOG_HOST\}<\/servername>/);
  assert.match(after, /<facility>authpriv<\/facility>/);
  assert.match(after, /<addHostName>N<\/addHostName>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('TableCompare template follows TableCompareMeta.getXML 17-tag order with two connections', () => {
  // TableCompareMeta.getXML() (lines 469-503): reference_connection,
  // reference_schema_field, reference_table_field, compare_connection,
  // compare_schema_field, compare_table_field, key_fields_field,
  // exclude_fields_field, then the six nr_* column tags, then
  // key_description_field, value_reference_field, value_compare_field.
  // Connections emit the NAME (getName), not the object.
  // setDefault() (lines 506-513) names the six nr columns.
  const ref = getReference('trans', 'TableCompare');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<reference_connection>', '<reference_schema_field>',
      '<reference_table_field>', '<compare_connection>',
      '<compare_schema_field>', '<compare_table_field>',
      '<key_fields_field>', '<exclude_fields_field>', '<nr_errors_field>',
      '<nr_records_reference_field>', '<nr_records_compare_field>',
      '<nr_errors_left_join_field>', '<nr_errors_inner_join_field>',
      '<nr_errors_right_join_field>', '<key_description_field>',
      '<value_reference_field>', '<value_compare_field>'],
    'TableCompare');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'reference_connection'),
    'TableCompare template must carry <reference_connection>');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'compare_connection'),
    'TableCompare template must carry <compare_connection>');

  // Non-default configuration: daily-load comparison with custom counters.
  const file = minimalKtr('b6-3-tablecompare');
  addElement(file, 'TableCompare', 'Compare daily load');
  setFieldPath(file, 'Compare daily load', 'reference_connection', '${REF_CONN}');
  setFieldPath(file, 'Compare daily load', 'compare_connection', '${CMP_CONN}');
  setFieldPath(file, 'Compare daily load', 'reference_table_field', 'REF_TABLE');
  setFieldPath(file, 'Compare daily load', 'compare_table_field', 'CMP_TABLE');
  setFieldPath(file, 'Compare daily load', 'key_fields_field', 'ID');
  setFieldPath(file, 'Compare daily load', 'exclude_fields_field', 'LOAD_DATE');
  setFieldPath(file, 'Compare daily load', 'nr_errors_field', 'ERR_CNT');
  setFieldPath(file, 'Compare daily load', 'nr_records_reference_field', 'REF_CNT');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<reference_connection>\$\{REF_CONN\}<\/reference_connection>/);
  assert.match(after, /<compare_connection>\$\{CMP_CONN\}<\/compare_connection>/);
  assert.match(after, /<nr_errors_field>ERR_CNT<\/nr_errors_field>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ParallelGzipCsvInput template follows ParGzipCsvInputMeta.getXML order with paired <fields>', () => {
  // ParGzipCsvInputMeta.getXML() (lines 178-215): filename, filename_field,
  // rownum_field, include_filename, separator (maps delimiter), enclosure,
  // header (maps headerPresent), buffer_size (string, maps bufferSize),
  // lazy_conversion, add_filename_result (maps isaddresult), parallel (maps
  // runningInParallel), encoding, then <fields>/field[name,type,format,
  // currency,decimal,group,length,precision,trim_type].
  // setDefault() (lines 124-131): "," / '"' / true / true / "50000".
  const ref = getReference('trans', 'ParallelGzipCsvInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<filename>', '<filename_field>', '<rownum_field>',
      '<include_filename>', '<separator>', '<enclosure>', '<header>',
      '<buffer_size>', '<lazy_conversion>', '<add_filename_result>',
      '<parallel>', '<encoding>', '<fields>'],
    'ParallelGzipCsvInput');
  assert.equal(parsed.step.header, 'Y', 'header defaults Y (setDefault true)');
  assert.equal(parsed.step.buffer_size, 50000, 'buffer_size defaults "50000"');
  assert.ok(block.includes('</fields>'),
    'ParallelGzipCsvInput template must carry a paired <fields> wrapper');

  // Non-default configuration: semicolon CSV with parallel inflate.
  const file = minimalKtr('b6-3-parallelgzipcsvinput');
  addElement(file, 'ParallelGzipCsvInput', 'Read gzipped orders');
  setFieldPath(file, 'Read gzipped orders', 'filename', '${GZIP_DIR}/orders.csv.gz');
  setFieldPath(file, 'Read gzipped orders', 'separator', ';');
  setFieldPath(file, 'Read gzipped orders', 'parallel', 'Y');
  setFieldPath(file, 'Read gzipped orders', 'encoding', 'UTF-8');
  setFields(file, 'Read gzipped orders', 'fields', 'field', [
    {
      name: 'ORDER_ID', type: 'Integer', format: '', currency: '',
      decimal: '.', group: ',', length: 10, precision: 0, trim_type: 'none',
    },
    {
      name: 'ORDER_DATE', type: 'Date', format: 'yyyy-MM-dd', currency: '',
      decimal: '', group: '', length: -1, precision: -1, trim_type: 'none',
    },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<separator>;<\/separator>/);
  assert.match(after, /<parallel>Y<\/parallel>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read gzipped orders');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field)
    ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'ORDER_ID');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job CONNECTED_TO_REPOSITORY template emits custom tags before super name/description/type', () => {
  // JobEntryConnectedToRepository.getXML() (lines 106-116) emits
  // isspecificrep, repname, isspecificuser, username BEFORE super.getXML()
  // (name, description, type). Constructor (lines 57-63): all false/null.
  const ref = getReference('job', 'CONNECTED_TO_REPOSITORY');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<isspecificrep>', '<repname>', '<isspecificuser>', '<username>',
      '<name>', '<description>', '<type>'],
    'CONNECTED_TO_REPOSITORY');
  assert.equal(parsed.entry.type, 'CONNECTED_TO_REPOSITORY',
    'direct-child <type>');

  // Non-default configuration: pin both repository and user.
  const file = minimalKjb('b6-3-connected-to-repository');
  addElement(file, 'CONNECTED_TO_REPOSITORY', 'Require prod repo');
  setFieldPath(file, 'Require prod repo', 'isspecificrep', 'Y');
  setFieldPath(file, 'Require prod repo', 'repname', '${REPO_NAME}');
  setFieldPath(file, 'Require prod repo', 'isspecificuser', 'Y');
  setFieldPath(file, 'Require prod repo', 'username', '${REPO_USER}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<isspecificrep>Y<\/isspecificrep>/);
  assert.match(after, /<repname>\$\{REPO_NAME\}<\/repname>/);
  assert.match(after, /<username>\$\{REPO_USER\}<\/username>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job DOS_UNIX_CONVERTER template follows JobEntryDosToUnix.getXML with ConversionType code', () => {
  // JobEntryDosToUnix.getXML() (lines 155-178): super then
  // arg_from_previous, include_subfolders, nr_errors_less_than,
  // success_condition, resultfilenames, fields/field[source_filefolder,
  // wildcard, ConversionType (capital C, code)]. Constructor (lines
  // 121-131): all_filenames / false / "10" / success_if_no_errors.
  // ConversionType unknown/null loads as guess (lines 209-220).
  const ref = getReference('job', 'DOS_UNIX_CONVERTER');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<arg_from_previous>', '<include_subfolders>', '<nr_errors_less_than>',
      '<success_condition>', '<resultfilenames>', '<fields>'],
    'DOS_UNIX_CONVERTER');
  assert.ok(block.includes('<ConversionType>'),
    'DOS_UNIX_CONVERTER template must keep capital-C <ConversionType>');
  assert.equal(parsed.entry.success_condition, 'success_if_no_errors',
    'success_condition defaults success_if_no_errors');

  // Non-default configuration: unix-to-dos with error threshold.
  const file = minimalKjb('b6-3-dos-unix-converter');
  addElement(file, 'DOS_UNIX_CONVERTER', 'Normalize scripts');
  setFieldPath(file, 'Normalize scripts', 'include_subfolders', 'Y');
  setFieldPath(file, 'Normalize scripts', 'nr_errors_less_than', '5');
  setFieldPath(file, 'Normalize scripts', 'success_condition', 'success_if_error_files_less');
  setFieldPath(file, 'Normalize scripts', 'resultfilenames', 'only_error_filenames');
  setFields(file, 'Normalize scripts', 'fields', 'field', [
    { source_filefolder: '${SOURCE_DIR}', wildcard: '.*\\.sh', ConversionType: 'unixtodos' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<ConversionType>unixtodos<\/ConversionType>/);
  assert.match(after, /<success_condition>success_if_error_files_less<\/success_condition>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job EVAL template follows JobEntryEval.getXML: super plus script', () => {
  // JobEntryEval.getXML() (lines 78-85): super.getXML() then exactly
  // <script>. Constructor (lines 64-71): script "".
  const ref = getReference('job', 'EVAL');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<name>', '<description>', '<type>', '<script>'], 'EVAL');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.entry, 'script'),
    'EVAL template must carry <script>');

  // Non-default configuration: branch on previous errors (no XML-special
  // chars in this script so the template stays parseable unescaped).
  const file = minimalKjb('b6-3-eval');
  addElement(file, 'EVAL', 'Branch on errors');
  setFieldPath(file, 'Branch on errors', 'script', 'previous_result.getNrErrors() == 0;');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<script>previous_result\.getNrErrors\(\) == 0;<\/script>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job MSGBOX_INFO template follows JobEntryMsgBoxInfo.getXML: bodymessage before titremessage', () => {
  // JobEntryMsgBoxInfo.getXML() (lines 75-83): super.getXML() then
  // bodymessage, titremessage (body FIRST). Constructor (lines 60-64):
  // both null, but getters are null-safe ("").
  const ref = getReference('job', 'MSGBOX_INFO');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<name>', '<description>', '<type>', '<bodymessage>', '<titremessage>'],
    'MSGBOX_INFO');

  // Non-default configuration: nightly ETL notice with variables.
  const file = minimalKjb('b6-3-msgbox-info');
  addElement(file, 'MSGBOX_INFO', 'Announce nightly finish');
  setFieldPath(file, 'Announce nightly finish', 'bodymessage',
    'ETL nightly finished with ${ERRORS} errors.');
  setFieldPath(file, 'Announce nightly finish', 'titremessage', 'Nightly ETL -- ${TODAY}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<bodymessage>ETL nightly finished with \$\{ERRORS\} errors\.<\/bodymessage>/);
  assert.match(after, /<titremessage>Nightly ETL -- \$\{TODAY\}<\/titremessage>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('TypeExitEdi2XmlStep template carries lowercase inputfield/outputfield only', () => {
  // Edi2XmlMeta.getXML() (lines 87-94): inputfield, outputfield
  // (lowercase). setDefault() (lines 201-204): "edi_xml" / "".
  const ref = getReference('trans', 'TypeExitEdi2XmlStep');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<inputfield>', '<outputfield>'], 'TypeExitEdi2XmlStep');
  assert.equal(parsed.step.outputfield, 'edi_xml',
    'outputfield defaults to "edi_xml" (setDefault)');

  // Non-default configuration: business document fields.
  const file = minimalKtr('b6-3-edi2xml');
  addElement(file, 'TypeExitEdi2XmlStep', 'Convert desadv');
  setFieldPath(file, 'Convert desadv', 'inputfield', 'DESADV_EDI');
  setFieldPath(file, 'Convert desadv', 'outputfield', 'DESADV_XML');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<inputfield>DESADV_EDI<\/inputfield>/);
  assert.match(after, /<outputfield>DESADV_XML<\/outputfield>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('TypeExitGoogleAnalyticsInputStep template follows GaInputStepMeta.getXML with bare feedField items', () => {
  // GaInputStepMeta.getXML() (lines 427-462): oauthServiceAccount, appName
  // (= gaAppName), oauthKeyFile, profileName, profileTableId, customTableId,
  // useCustomTableId, startDate, endDate, dimensions, metrics, filters,
  // sort, useSegment, useCustomSegment, customSegment, segmentId,
  // segmentName, samplingLevel, rowLimit, then N x <feedField> DIRECTLY
  // under <step> (no wrapper): feedFieldType, feedField, outField
  // (= outputField), type (= outputType name), conversionMask.
  // setDefault() (lines 346-364): ga:browser / ga:visits / gaid::-1 /
  // All Visits / DEFAULT / 0.
  const ref = getReference('trans', 'TypeExitGoogleAnalyticsInputStep');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<oauthServiceAccount>', '<appName>', '<oauthKeyFile>', '<profileName>',
      '<profileTableId>', '<customTableId>', '<useCustomTableId>',
      '<startDate>', '<endDate>', '<dimensions>', '<metrics>', '<filters>',
      '<sort>', '<useSegment>', '<useCustomSegment>', '<customSegment>',
      '<segmentId>', '<segmentName>', '<samplingLevel>', '<rowLimit>'],
    'TypeExitGoogleAnalyticsInputStep');
  assert.ok(!/<fields>/.test(block),
    'GA template must not wrap feeds in <fields> (bare <feedField> items)');
  // Each feed item is a <feedField> WRAPPER whose inner name-tag is also
  // <feedField> (source quirk). Scope to the wrapper's inner content so the
  // wrapper open tag does not collide with the inner <feedField> in the order
  // check. Inner order: feedFieldType, feedField, outField, type, conversionMask.
  // A feed item is a <feedField> WRAPPER whose inner name-tag is ALSO
  // <feedField> (source quirk). Slicing by </feedField> would stop at the
  // inner name-tag's close, and assertTagOrder's prefix regex cannot tell the
  // wrapper/name-tag apart. So assert the item's child order using the tags
  // that are unique within the item: feedFieldType -> outField -> type ->
  // conversionMask. Presence of the inner <feedField> name-tag (between
  // feedFieldType and outField) is checked separately.
  const firstFeed = block.slice(block.indexOf('<feedFieldType>'));
  const gPosType = firstFeed.indexOf('<feedFieldType>');
  const gPosOut = firstFeed.indexOf('<outField>');
  const gPosT = firstFeed.search(/<type(?:\s|\/?>)/);
  const gPosMask = firstFeed.search(/<conversionMask(?:\s|\/?>)/);
  assert.ok(gPosType === 0, 'GA: item starts with feedFieldType');
  assert.ok(gPosOut > gPosType, 'GA: outField after feedFieldType');
  assert.ok(gPosT > gPosOut, 'GA: type after outField');
  assert.ok(gPosMask > gPosT, 'GA: conversionMask after type');
  // The inner name-tag <feedField> sits between feedFieldType and outField.
  const nameTag = firstFeed.slice(0, gPosOut).search(/<feedField>/);
  assert.ok(nameTag > gPosType, 'GA: inner <feedField> name-tag before outField');
  assert.equal(parsed.step.samplingLevel, 'DEFAULT',
    'samplingLevel defaults DEFAULT');

  // Non-default configuration: higher-precision pull with filters and a
  // row limit (setFieldPath; bare <feedField> items have no list wrapper
  // so setFields does not apply).
  const file = minimalKtr('b6-3-ga');
  addElement(file, 'TypeExitGoogleAnalyticsInputStep', 'Pull ga stats');
  setFieldPath(file, 'Pull ga stats', 'oauthServiceAccount', '${GA_SERVICE_ACCOUNT}');
  setFieldPath(file, 'Pull ga stats', 'oauthKeyFile', '${GA_KEY_FILE}');
  setFieldPath(file, 'Pull ga stats', 'dimensions', 'ga:browser,ga:country');
  setFieldPath(file, 'Pull ga stats', 'metrics', 'ga:visits,ga:pageviews');
  setFieldPath(file, 'Pull ga stats', 'filters', 'ga:country==Vietnam');
  setFieldPath(file, 'Pull ga stats', 'useSegment', 'N');
  setFieldPath(file, 'Pull ga stats', 'samplingLevel', 'HIGHER_PRECISION');
  setFieldPath(file, 'Pull ga stats', 'rowLimit', '1000');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<dimensions>ga:browser,ga:country<\/dimensions>/);
  assert.match(after, /<samplingLevel>HIGHER_PRECISION<\/samplingLevel>/);
  assert.match(after, /<rowLimit>1000<\/rowLimit>/);
  assert.match(after, /<outField>BROWSER<\/outField>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B6-3 package as canonical with nothing missing', () => {
  const ktrSteps = BATCH.filter((b) => b.kind === 'trans')
    .map((b) => `<step><name>Uses ${b.xmlType}</name><type>${b.xmlType}</type></step>`)
    .join('');
  const ktr = path.join(tmp, 'b6-3-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<transformation><info><name>b6-3-package</name></info>${ktrSteps}<order/></transformation>`,
  ].join('\n'));
  const kjbEntries = BATCH.filter((b) => b.kind === 'job')
    .map((b) => `<entry><name>Uses ${b.xmlType}</name><type>${b.xmlType}</type></entry>`)
    .join('');
  const kjb = path.join(tmp, 'b6-3-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<job><name>b6-3-package</name><entries>${kjbEntries}</entries><hops/></job>`,
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
