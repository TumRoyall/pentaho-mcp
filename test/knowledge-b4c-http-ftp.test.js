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

// Batch B4c (HTTP/FTP): trans HTTP, trans HTTPPOST, job HTTP, job FTP_PUT,
// job FTP_DELETE, job FTPS_GET, job FTPS_PUT.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b4c-source-notes.md.
//
// Grounding (all at the pinned commit; all seven register in
// engine/src/main/resources/kettle-steps.xml / kettle-job-entries.xml):
// - trans HTTP -> .../trans/steps/http/HTTPMeta, kettle-steps.xml line 42
//   (Lookup). getXML() (lines 361-402): 11 scalars (url, urlInField,
//   urlField, encoding, httpLogin, httpPassword [encrypted unless a
//   variable], proxyHost, proxyPort, 3 timeouts), then <lookup> holding
//   <arg> items (name=query param, parameter=row field) then <header> items
//   (name=header name, parameter=static value), then <result> (name, code,
//   response_time, response_header). setDefault() (lines 304-331):
//   timeouts "10000"/"10000"/"-1", fieldName="result", encoding UTF-8.
// - trans HTTPPOST -> .../trans/steps/httppost/HTTPPOSTMeta,
//   kettle-steps.xml line 91 (Lookup). getXML() (lines 410-454): postafile,
//   encoding, url, urlInField, urlField, requestEntity, auth/proxy/timeouts,
//   then <lookup> holding <arg> items (name, parameter, header Y/N) then
//   <query> items (name, parameter), then the same <result>. setDefault()
//   (lines 353-382): fieldName="result", encoding UTF-8, postafile=false.
// - job HTTP -> .../job/entries/http/JobEntryHTTP, kettle-job-entries.xml
//   line 19 (FileManagement). getXML() (lines 178-216) = super.getXML()
//   then url, targetfilename, file_appended, date_time_added,
//   targetfilename_extension (+ typo fallback on load), uploadfilename,
//   run_every_row, 3 fieldnames, username, password, proxy_host,
//   proxy_port, non_proxy_hosts, addfilenameresult (missing => TRUE), then
//   a PAIRED <headers> wrapper (always emitted) of <header> items
//   (header_name, header_value). Same "HTTP" string as the trans step but a
//   different KIND (valid per the TABLE_EXISTS precedent).
// - job FTP_PUT -> .../job/entries/ftpput/JobEntryFTPPUT,
//   kettle-job-entries.xml line 9 (FileTransfer). getXML() (lines 137-170)
//   = super.getXML() then servername, serverport, username, password,
//   remoteDirectory, localDirectory, wildcard, binary, timeout, remove,
//   only_new, active, control_encoding, 4 proxy_* tags, 4 socksproxy_*
//   tags. Constructor (lines 118-126): port "21", socksProxyPort "1080",
//   controlEncoding ISO-8859-1. timeout missing => 10000.
// - job FTP_DELETE -> .../job/entries/ftpdelete/JobEntryFTPDelete,
//   kettle-job-entries.xml line 14 (FileTransfer). getXML() (lines
//   188-229) = super.getXML() then protocol (FTP/FTPS/SFTP/SSH), servername,
//   port, username, password, ftpdirectory, wildcard, timeout, active,
//   useproxy + proxy_*, publicpublickey/keyfilename/keyfilepass,
//   nr_limit_success, success_condition, copyprevious, ftps_connection_type
//   (code), socksproxy_*. Constructor (lines 164-177): protocol FTP, port
//   "21", nr_limit_success "10", success all-downloaded.
// - job FTPS_GET -> .../job/entries/ftpsget/JobEntryFTPSGet,
//   kettle-job-entries.xml line 10 (FileTransfer). getXML() (lines
//   161-205) = super.getXML() then port FIRST, servername, username,
//   password, FTPSdirectory, targetdirectory, wildcard, binary, timeout,
//   remove, only_new, active, movefiles, movetodirectory, date/time block,
//   isaddresult (missing => TRUE), createmovefolder, proxy_*, ifFileExists
//   (action string), nr_limit, success_condition, connection_type (code).
//   Constructor (lines 133-150): port "21", nr_limit "10", success
//   no-errors, ifFileExists 0, isaddresult true.
// - job FTPS_PUT -> .../job/entries/ftpsput/JobEntryFTPSPUT,
//   kettle-job-entries.xml line 11 (FileTransfer). getXML() (lines
//   110-137) = super.getXML() then servername FIRST, serverport, username,
//   password, remoteDirectory, localDirectory, wildcard, binary, timeout,
//   remove, only_new, active, proxy_* (proxy_password stored PLAIN, line
//   132), connection_type (code). Constructor (lines 92-99): port "21".
// Connection-type codes (FTPSConnection.java lines 79-82): FTP_CONNECTION,
// IMPLICIT_SSL_FTP_CONNECTION, AUTH_SSL_FTP_CONNECTION,
// IMPLICIT_SSL_WITH_CRYPTED_DATA_FTP_CONNECTION, AUTH_TLS_FTP_CONNECTION,
// IMPLICIT_TLS_FTP_CONNECTION,
// IMPLICIT_TLS_WITH_CRYPTED_DATA_FTP_CONNECTION (unknown => 0).
// None of the seven references a DB connection: NO <connection> tag.
// Auth/host/port values always use ${VAR} placeholders, never real secrets.
const BATCH = [
  { kind: 'trans', xmlType: 'HTTP', alias: 'HTTP' },
  { kind: 'trans', xmlType: 'HTTPPOST', alias: 'HTTPPOST' },
  { kind: 'job', xmlType: 'HTTP', alias: 'HTTP' },
  { kind: 'job', xmlType: 'FTP_PUT', alias: 'FTP_PUT' },
  { kind: 'job', xmlType: 'FTP_DELETE', alias: 'FTP_DELETE' },
  { kind: 'job', xmlType: 'FTPS_GET', alias: 'FTPS_GET' },
  { kind: 'job', xmlType: 'FTPS_PUT', alias: 'FTPS_PUT' },
];

const FTPS_CONNECTION_CODES = [
  'FTP_CONNECTION', 'IMPLICIT_SSL_FTP_CONNECTION', 'AUTH_SSL_FTP_CONNECTION',
  'IMPLICIT_SSL_WITH_CRYPTED_DATA_FTP_CONNECTION', 'AUTH_TLS_FTP_CONNECTION',
  'IMPLICIT_TLS_FTP_CONNECTION', 'IMPLICIT_TLS_WITH_CRYPTED_DATA_FTP_CONNECTION',
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<lookup>') appears in `block` after
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b4c-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b4c') {
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

function freshKjb(name) {
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

test('B4c catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
  for (const { kind, xmlType, alias } of BATCH) {
    const entry = findByXmlType(kind, xmlType);
    assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
    assert.equal(entry.type, alias, `${kind}/${xmlType} design alias`);
    assert.equal(entry.status, 'canonical', `${kind}/${xmlType} should be canonical`);
    assert.equal(entry.generator_eligible, true, `${kind}/${xmlType} must be generator-eligible`);
    assert.equal(isGeneratorEligible(kind, xmlType), true, `${kind}/${xmlType} eligibility`);
    assert.ok(verifiedVersions(entry).includes('9.4'), `${kind}/${xmlType} must verify 9.4`);
    assert.equal(entry.source_version, '9.4', `${kind}/${xmlType} source_version`);
    assert.equal(entry.verification, 'source_reviewed', `${kind}/${xmlType} verification`);
  }
});

test('B4c references resolve and their first XML block is one valid entry/step with the right direct-child <type>', () => {
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

test('B4c templates carry no <connection> and no real secrets, and insert via addElement with escaped names', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(!/<connection(?:\s|\/?>)/.test(block),
      `${kind}/${xmlType} template must not carry <connection> (no DB reference in source)`);
    const file = kind === 'job'
      ? freshKjb(`b4c-${xmlType.toLowerCase()}`)
      : minimalKtr(`b4c-${xmlType.toLowerCase()}`);
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

test('trans HTTP template follows HTTPMeta.getXML: scalars, lookup arg+header, result block', () => {
  // HTTPMeta.getXML() (lines 361-402): 11 scalars, then <lookup> with
  // <arg> items (name=query param, parameter=row field) then <header>
  // items (name=header name, parameter=static value), then <result>
  // (name, code, response_time, response_header). setDefault() (lines
  // 304-331): timeouts "10000"/"10000"/"-1", fieldName="result".
  const ref = getReference('trans', 'HTTP');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<url>', '<urlInField>', '<urlField>', '<encoding>', '<httpLogin>',
      '<httpPassword>', '<proxyHost>', '<proxyPort>', '<socketTimeout>',
      '<connectionTimeout>', '<closeIdleConnectionsTime>', '<lookup>', '<result>'],
    'trans HTTP');
  assert.equal(String(parsed.step.socketTimeout), '10000', 'socketTimeout defaults "10000"');
  assert.equal(String(parsed.step.closeIdleConnectionsTime), '-1', 'closeIdleConnectionsTime defaults "-1"');
  assert.match(block, /<url>\$\{HTTP_URL\}<\/url>/);
  assert.match(block, /<httpPassword>\$\{HTTP_PASSWORD\}<\/httpPassword>/);
  const lookup = parsed.step.lookup;
  assert.ok(lookup, 'trans HTTP template must carry <lookup>');
  const args = lookup.arg ? (Array.isArray(lookup.arg) ? lookup.arg : [lookup.arg]) : [];
  assert.ok(args.length >= 1, '<lookup> must show at least one <arg>');
  for (const a of args) {
    assert.ok(hasOwn(a, 'name'), 'every <arg> must carry <name> (query param)');
    assert.ok(hasOwn(a, 'parameter'), 'every <arg> must carry <parameter> (row field)');
  }
  const hdrs = lookup.header ? (Array.isArray(lookup.header) ? lookup.header : [lookup.header]) : [];
  assert.ok(hdrs.length >= 1, '<lookup> must show at least one <header>');
  const result = parsed.step.result;
  assert.ok(result, 'trans HTTP template must carry <result>');
  for (const tag of ['name', 'code', 'response_time', 'response_header']) {
    assert.ok(hasOwn(result, tag), `<result> must carry <${tag}> per getXML lines 395-398`);
  }
  assert.equal(result.name, 'result', 'result name defaults to "result" (setDefault)');

  // Non-default configuration: URL from a field plus a status-code column.
  const file = minimalKtr('b4c-http');
  addElement(file, 'HTTP', 'Call customer API');
  setFieldPath(file, 'Call customer API', 'urlInField', 'Y');
  setFieldPath(file, 'Call customer API', 'urlField', 'API_URL');
  setFieldPath(file, 'Call customer API', 'url', '');
  setFields(file, 'Call customer API', 'lookup', 'arg', [
    { name: 'id', parameter: 'CUSTOMER_ID' },
  ]);
  setFieldPath(file, 'Call customer API', 'result/code', 'STATUS_CODE');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<urlInField>Y<\/urlInField>/);
  assert.match(after, /<urlField>API_URL<\/urlField>/);
  assert.match(after, /<code>STATUS_CODE<\/code>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans HTTPPOST template follows HTTPPOSTMeta.getXML: postafile first, arg with header flag, query list', () => {
  // HTTPPOSTMeta.getXML() (lines 410-454): postafile, encoding, url,
  // urlInField, urlField, requestEntity, auth/proxy/timeouts, then
  // <lookup> with <arg> items (name, parameter, header Y/N) then <query>
  // items (name, parameter), then <result>. setDefault() (lines 353-382):
  // fieldName="result", encoding UTF-8, postafile=false.
  const ref = getReference('trans', 'HTTPPOST');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<postafile>', '<encoding>', '<url>', '<requestEntity>', '<httpLogin>',
      '<lookup>', '<result>'],
    'trans HTTPPOST');
  assert.equal(parsed.step.postafile, 'N', 'postafile defaults N (setDefault false)');
  const lookup = parsed.step.lookup;
  assert.ok(lookup && lookup.arg, '<lookup> must carry <arg> items');
  const args = Array.isArray(lookup.arg) ? lookup.arg : [lookup.arg];
  for (const a of args) {
    for (const tag of ['name', 'parameter', 'header']) {
      assert.ok(hasOwn(a, tag), `HTTPPOST <arg> must carry <${tag}> per getXML lines 432-434`);
    }
    assert.ok(a.header === 'Y' || a.header === 'N', '<arg>/<header> is boolean Y/N');
  }
  assert.ok(lookup.query, '<lookup> must show a <query> item (second list)');
  const queries = Array.isArray(lookup.query) ? lookup.query : [lookup.query];
  for (const q of queries) {
    assert.ok(hasOwn(q, 'name') && hasOwn(q, 'parameter'),
      'every <query> must carry <name>/<parameter> (and NO <header>)');
    assert.ok(!hasOwn(q, 'header'), '<query> must not carry <header>');
  }

  // Non-default configuration: a header-carrying form arg plus a query param.
  const file = minimalKtr('b4c-httppost');
  addElement(file, 'HTTPPOST', 'Post login form');
  setFieldPath(file, 'Post login form', 'url', '${HTTP_URL}/login');
  setFields(file, 'Post login form', 'lookup', 'arg', [
    { name: 'username', parameter: 'LOGIN_NAME', header: 'N' },
    { name: 'X-Token', parameter: 'TOKEN_VALUE', header: 'Y' },
  ]);
  setFields(file, 'Post login form', 'lookup', 'query', [
    { name: 'v', parameter: '2' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<url>\$\{HTTP_URL\}\/login<\/url>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Post login form');
  assert.ok(step, 'inserted step present');
  const configuredArgs = Array.isArray(step.lookup.arg) ? step.lookup.arg : [step.lookup.arg];
  assert.equal(configuredArgs.length, 2);
  assert.equal(configuredArgs[1].header, 'Y');
  const configuredQuery = Array.isArray(step.lookup.query) ? step.lookup.query : [step.lookup.query];
  assert.equal(configuredQuery[0].name, 'v');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job HTTP template follows JobEntryHTTP.getXML: scalars plus paired headers', () => {
  // JobEntryHTTP.getXML() (lines 178-216) = super.getXML() then url,
  // targetfilename, file_appended, date_time_added,
  // targetfilename_extension, uploadfilename, run_every_row, 3 fieldnames,
  // username, password, proxy_host, proxy_port, non_proxy_hosts,
  // addfilenameresult, then PAIRED <headers> (always emitted) of <header>
  // items (header_name, header_value). addfilenameresult missing => TRUE
  // (loadXML lines 243-244); constructor sets it true (lines 150-154).
  const ref = getReference('job', 'HTTP');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<url>', '<targetfilename>', '<file_appended>', '<uploadfilename>',
      '<run_every_row>', '<username>', '<password>', '<proxy_host>',
      '<addfilenameresult>', '<headers>'],
    'job HTTP');
  assert.equal(parsed.entry.addfilenameresult, 'Y',
    'addfilenameresult defaults Y (constructor true; missing tag loads true)');
  assert.match(block, /<url>\$\{HTTP_URL\}<\/url>/);
  assert.match(block, /<password>\$\{HTTP_PASSWORD\}<\/password>/);
  const headers = parsed.entry.headers;
  assert.ok(headers && headers.header, 'job HTTP template must carry <headers>/<header>');
  const items = Array.isArray(headers.header) ? headers.header : [headers.header];
  for (const h of items) {
    assert.ok(hasOwn(h, 'header_name'), 'every <header> must carry <header_name>');
    assert.ok(hasOwn(h, 'header_value'), 'every <header> must carry <header_value>');
  }
  assert.ok(block.includes('</headers>'), '<headers> must be paired');

  // Non-default configuration: upload with an auth header.
  const file = freshKjb('b4c-job-http');
  addElement(file, 'HTTP', 'Upload artifact');
  setFieldPath(file, 'Upload artifact', 'url', '${HTTP_URL}/upload');
  setFieldPath(file, 'Upload artifact', 'uploadfilename', '${LOCAL_FILE}');
  setFields(file, 'Upload artifact', 'headers', 'header', [
    { header_name: 'Authorization', header_value: 'Bearer ${API_TOKEN}' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<url>\$\{HTTP_URL\}\/upload<\/url>/);
  assert.match(after, /<uploadfilename>\$\{LOCAL_FILE\}<\/uploadfilename>/);
  assert.match(after, /<header_name>Authorization<\/header_name>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FTP_PUT template follows JobEntryFTPPUT.getXML order with control_encoding and socksproxy', () => {
  // JobEntryFTPPUT.getXML() (lines 137-170): servername, serverport,
  // username, password, remoteDirectory, localDirectory, wildcard, binary,
  // timeout, remove, only_new, active, control_encoding, 4 proxy_* tags,
  // 4 socksproxy_* tags. Constructor (lines 118-126): port "21",
  // socksProxyPort "1080", controlEncoding ISO-8859-1. timeout missing =>
  // 10000 (loadXML line 184).
  const ref = getReference('job', 'FTP_PUT');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<servername>', '<serverport>', '<username>', '<password>',
      '<remoteDirectory>', '<localDirectory>', '<wildcard>', '<binary>',
      '<timeout>', '<remove>', '<only_new>', '<active>', '<control_encoding>',
      '<proxy_host>', '<socksproxy_host>', '<socksproxy_port>'],
    'FTP_PUT');
  assert.equal(String(parsed.entry.serverport), '21', 'serverport defaults "21" (constructor)');
  assert.equal(parsed.entry.control_encoding, 'ISO-8859-1',
    'control_encoding defaults ISO-8859-1 (constructor)');
  assert.equal(String(parsed.entry.socksproxy_port), '1080',
    'socksproxy_port defaults "1080" (constructor)');
  assert.match(block, /<servername>\$\{FTP_HOST\}<\/servername>/);
  assert.match(block, /<password>\$\{FTP_PASSWORD\}<\/password>/);

  // Non-default configuration: binary upload of CSVs, removing sources.
  const file = freshKjb('b4c-ftp-put');
  addElement(file, 'FTP_PUT', 'Upload CSVs');
  setFieldPath(file, 'Upload CSVs', 'servername', '${FTP_HOST}');
  setFieldPath(file, 'Upload CSVs', 'binary', 'Y');
  setFieldPath(file, 'Upload CSVs', 'remove', 'Y');
  setFieldPath(file, 'Upload CSVs', 'wildcard', '.*\\.csv');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<servername>\$\{FTP_HOST\}<\/servername>/);
  assert.match(after, /<binary>Y<\/binary>/);
  assert.match(after, /<remove>Y<\/remove>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FTP_DELETE template follows getXML: protocol first, ftpdirectory, key tags, success pair', () => {
  // JobEntryFTPDelete.getXML() (lines 188-229): protocol, servername,
  // port, username, password, ftpdirectory, wildcard, timeout, active,
  // useproxy + proxy_*, publicpublickey/keyfilename/keyfilepass,
  // nr_limit_success, success_condition, copyprevious, ftps_connection_type
  // (code), socksproxy_*. Constructor (lines 164-177): protocol FTP, port
  // "21", nr_limit_success "10", success all-downloaded.
  const ref = getReference('job', 'FTP_DELETE');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<protocol>', '<servername>', '<port>', '<username>', '<password>',
      '<ftpdirectory>', '<wildcard>', '<timeout>', '<active>', '<useproxy>',
      '<publicpublickey>', '<nr_limit_success>', '<success_condition>',
      '<copyprevious>', '<ftps_connection_type>', '<socksproxy_host>'],
    'FTP_DELETE');
  assert.ok(!/<remoteDirectory(?:\s|\/?>)/.test(block),
    'FTP_DELETE directory tag is <ftpdirectory>, not <remoteDirectory>');
  assert.equal(parsed.entry.protocol, 'FTP', 'protocol defaults FTP (constructor)');
  assert.equal(String(parsed.entry.nr_limit_success), '10', 'nr_limit_success defaults "10"');
  assert.equal(parsed.entry.success_condition, 'success_is_all_files_downloaded',
    'success_condition defaults to all-downloaded (constructor)');
  assert.ok(FTPS_CONNECTION_CODES.includes(String(parsed.entry.ftps_connection_type)),
    '<ftps_connection_type> must be one of the 7 connection codes');

  // Non-default configuration: SFTP cleanup with an at-least threshold.
  const file = freshKjb('b4c-ftp-delete');
  addElement(file, 'FTP_DELETE', 'Clean temp files');
  setFieldPath(file, 'Clean temp files', 'protocol', 'SFTP');
  setFieldPath(file, 'Clean temp files', 'ftpdirectory', '${FTP_DIR}/archive');
  setFieldPath(file, 'Clean temp files', 'wildcard', '.*\\.tmp');
  setFieldPath(file, 'Clean temp files', 'success_condition', 'success_when_at_least');
  setFieldPath(file, 'Clean temp files', 'nr_limit_success', '5');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<protocol>SFTP<\/protocol>/);
  assert.match(after, /<ftpdirectory>\$\{FTP_DIR\}\/archive<\/ftpdirectory>/);
  assert.match(after, /<success_condition>success_when_at_least<\/success_condition>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FTPS_GET template follows getXML: port first, FTPSdirectory case, isaddresult default', () => {
  // JobEntryFTPSGet.getXML() (lines 161-205): port FIRST, servername,
  // username, password, FTPSdirectory, targetdirectory, wildcard, binary,
  // timeout, remove, only_new, active, movefiles, movetodirectory,
  // date/time block, isaddresult, createmovefolder, proxy_*,
  // ifFileExists (action string), nr_limit, success_condition,
  // connection_type (code). Constructor (lines 133-150): port "21",
  // isaddresult true. isaddresult missing => TRUE (loadXML 234-240).
  const ref = getReference('job', 'FTPS_GET');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<port>', '<servername>', '<username>', '<password>', '<FTPSdirectory>',
      '<targetdirectory>', '<wildcard>', '<isaddresult>', '<ifFileExists>',
      '<nr_limit>', '<success_condition>', '<connection_type>'],
    'FTPS_GET');
  assert.ok(!/<remoteDirectory(?:\s|\/?>)/.test(block),
    'FTPS_GET directories are <FTPSdirectory>/<targetdirectory>, not <remoteDirectory>');
  assert.equal(parsed.entry.isaddresult, 'Y',
    'isaddresult defaults Y (constructor true; missing tag loads true)');
  assert.ok(['ifFileExistsSkip', 'ifFileExistsCreateUniq', 'ifFileExistsFail']
    .includes(String(parsed.entry.ifFileExists)),
    '<ifFileExists> must be one of the 3 FILE_EXISTS_ACTIONS');
  assert.ok(FTPS_CONNECTION_CODES.includes(String(parsed.entry.connection_type)),
    '<connection_type> must be one of the 7 connection codes');

  // Non-default configuration: fail on clash plus explicit TLS.
  const file = freshKjb('b4c-ftps-get');
  addElement(file, 'FTPS_GET', 'Fetch inbox XML');
  setFieldPath(file, 'Fetch inbox XML', 'servername', '${FTPS_HOST}');
  setFieldPath(file, 'Fetch inbox XML', 'FTPSdirectory', '${FTPS_DIR}/inbox');
  setFieldPath(file, 'Fetch inbox XML', 'ifFileExists', 'ifFileExistsFail');
  setFieldPath(file, 'Fetch inbox XML', 'connection_type', 'AUTH_TLS_FTP_CONNECTION');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<servername>\$\{FTPS_HOST\}<\/servername>/);
  assert.match(after, /<ifFileExists>ifFileExistsFail<\/ifFileExists>/);
  assert.match(after, /<connection_type>AUTH_TLS_FTP_CONNECTION<\/connection_type>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FTPS_PUT template follows getXML: servername first, serverport name, plain proxy_password', () => {
  // JobEntryFTPSPUT.getXML() (lines 110-137): servername FIRST,
  // serverport, username, password, remoteDirectory, localDirectory,
  // wildcard, binary, timeout, remove, only_new, active, proxy_*
  // (proxy_password stored PLAIN, line 132), connection_type (code).
  // Constructor (lines 92-99): port "21". No success-condition tags.
  const ref = getReference('job', 'FTPS_PUT');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<servername>', '<serverport>', '<username>', '<password>',
      '<remoteDirectory>', '<localDirectory>', '<wildcard>', '<binary>',
      '<timeout>', '<proxy_host>', '<proxy_password>', '<connection_type>'],
    'FTPS_PUT');
  assert.ok(!/<port(?:\s|\/?>)/.test(block),
    'FTPS_PUT port tag is <serverport>, not <port>');
  assert.ok(!/<FTPSdirectory(?:\s|\/?>)/.test(block),
    'FTPS_PUT directories are <remoteDirectory>/<localDirectory>');
  assert.ok(!/<success_condition(?:\s|\/?>)/.test(block),
    'FTPS_PUT has no <success_condition> in source');
  assert.ok(FTPS_CONNECTION_CODES.includes(String(parsed.entry.connection_type)),
    '<connection_type> must be one of the 7 connection codes');

  // Non-default configuration: TLS upload of new CSVs only.
  const file = freshKjb('b4c-ftps-put');
  addElement(file, 'FTPS_PUT', 'Push reports');
  setFieldPath(file, 'Push reports', 'servername', '${FTPS_HOST}');
  setFieldPath(file, 'Push reports', 'wildcard', '.*\\.csv');
  setFieldPath(file, 'Push reports', 'only_new', 'Y');
  setFieldPath(file, 'Push reports', 'connection_type', 'AUTH_TLS_FTP_CONNECTION');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<servername>\$\{FTPS_HOST\}<\/servername>/);
  assert.match(after, /<only_new>Y<\/only_new>/);
  assert.match(after, /<connection_type>AUTH_TLS_FTP_CONNECTION<\/connection_type>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B4c package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b4c-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b4c-package</name></info>',
    '<step><name>Call customer API</name><type>HTTP</type></step>',
    '<step><name>Post login form</name><type>HTTPPOST</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b4c-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b4c-package</name><entries>',
    '<entry><name>Upload artifact</name><type>HTTP</type></entry>',
    '<entry><name>Upload CSVs</name><type>FTP_PUT</type></entry>',
    '<entry><name>Clean temp files</name><type>FTP_DELETE</type></entry>',
    '<entry><name>Fetch inbox XML</name><type>FTPS_GET</type></entry>',
    '<entry><name>Push reports</name><type>FTPS_PUT</type></entry>',
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
