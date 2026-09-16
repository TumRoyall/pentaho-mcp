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

// Batch B6-1 (connectivity/streaming/SQL/bulk/lookup): 10 job entries +
// 23 trans steps (33 IDs; the "35" in the dispatch prompt counts 2 spares
// that do not exist as separate IDs — OraBulkLoader already cataloged).
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b6-1-source-notes.md.
//
// Grounding (all at the pinned commit):
// - job GET_POP -> JobEntryGetPOP, kettle-job-entries.xml line 29.
//   getXML() (lines 187-242): super.getXML() + 40 tags servername..proxyusername.
// - job PING -> JobEntryPing, line 30. getXML() (102-116): hostname,
//   nbr_packets, nbrpaquets (legacy dup), timeout, pingtype.
// - job TELNET -> JobEntryTelnet, line 66. getXML() (88-97): hostname, port, timeout.
// - job SYSLOG -> JobEntrySyslog, line 55. getXML() (89-103): port FIRST, then
//   servername, facility, priority, message, datePattern, addTimestamp, addHostname.
// - job SNMP_TRAP -> JobEntrySNMPTrap, line 53. getXML() (156-172): port,
//   servername, oid, comstring, message, timeout, nrretry, targettype, user,
//   passphrase (encrypted), engineid.
// - job SEND_NAGIOS_PASSIVE_CHECK -> JobEntrySendNagiosPassiveCheck, line 65.
//   getXML() (203-221): port, servername, password (PLAIN!), responseTimeOut,
//   connectionTimeOut, senderServerName, senderServiceName, message,
//   encryptionMode + level (codes).
// - job WEBSERVICE_AVAILABLE -> JobEntryWebServiceAvailable, line 58.
//   getXML() (78-86): url, connectTimeOut, readTimeOut.
// - job MSSQL_BULK_LOAD -> JobEntryMssqlBulkLoad, line 41. getXML() (143-178):
//   26 tags schemaname..truncate, <connection> LAST.
// - job MYSQL_BULK_LOAD -> JobEntryMysqlBulkLoad, line 24. getXML() (115-142):
//   14 tags schemaname..addfiletoresult (note typo prorityvalue), <connection> LAST.
// - job MYSQL_BULK_FILE -> JobEntryMysqlBulkFile, line 28. getXML() (112-133):
//   13 tags schemaname..addfiletoresult (outdumpvalue/iffileexists are int
//   codes), <connection> LAST.
// - trans Mail -> MailMeta, kettle-steps.xml line 72. getXML() (253-316):
//   40 scalar tags server..secureconnectiontype + always-emitted paired
//   <embeddedimages>. setDefault() EMPTY.
// - trans MailInput -> MailInputMeta, line 98. getXML() (376-432): 33 scalars
//   + always-emitted <fields> (name + column code string).
// - trans MailValidator -> MailValidatorMeta, line 71. getXML() (347-366):
//   12 tags emailfield..isdynamicDefaultSMTP.
// - trans MySQLBulkLoader -> @Step (MySQLBulkLoaderMeta.java:81).
//   getXML() (305-332): connection..bulk_size + SIBLING <mapping> items
//   (stream_name, field_name, field_format_ok code).
// - trans MonetDBBulkLoader -> @Step (line 69). getXML() (369-397):
//   connection, buffer_size, schema, table, log_file, truncate,
//   fully_quote_sql, field_separator, field_enclosure, null_representation,
//   encoding + sibling <mapping>.
// - trans PGBulkLoader -> @Step (line 67). getXML() (279-302): connection,
//   schema, table, load_action, dbname_override, enclosure, delimiter,
//   stop_on_error + sibling <mapping> (stream_name, field_name, date_mask).
// - trans InfobrightOutput -> InfobrightLoaderMeta extends TableOutputMeta,
//   @Step (line 54). getXML() (157-164) = TableOutputMeta.getXML() tags +
//   data_format, agent_port, charset, debug_file (enum load is strict).
// - trans VectorWiseBulkLoader -> IngresVectorwiseLoaderMeta, @Step (line 55).
//   getXML() (209-243): connection, table (NO schema), fifo_file_name,
//   sql_path, encoding, delimiter, continue_on_error, error_file_name,
//   use_standard_conversion, use_authentication, use_dynamic_vnode,
//   use_SSV_delimiter, escape_special_characters, use_vwload, truncate_table,
//   max_errors, buffer_size + WRAPPED <fields> (column_name, stream_name).
// - trans GPLoad -> GPLoadMeta, @Step (line 61). getXML() (414-454):
//   connection..update_condition + sibling <mapping> (stream_name,
//   field_name, date_mask, match_column, update_column) + always-emitted
//   paired <local_hosts>. NOTE: missing <enclose_numbers> throws NPE (line 353).
// - trans SQLFileOutput -> SQLFileOutputMeta, kettle-steps.xml line 60.
//   getXML() (491-521): connection..startnewline + <file> block
//   (note typo extention).
// - trans ExecSQLRow -> ExecSQLRowMeta, line 79. getXML() (298-313): commit
//   FIRST, then connection, sql_field, insert/update/delete/read_field,
//   sqlFromfile, sendOneStatement.
// - trans Jms2Consumer/Jms2Producer -> @Step, NO handwritten getXML:
//   BaseSerializingMeta JAXB <step-props> (group/property/value). Observed
//   emission: jms/.../jms-consumer.ktr lines 451-537, amq-producer.ktr.
// - trans MQTTConsumer/MQTTProducer -> @Step, same <step-props> mechanism.
//   Observed: mqtt/.../ConsumeRows.ktr lines 451-543, ProduceFourRows.ktr.
// - trans RecordsFromStream -> RecordsFromStreamMeta extends RowsFromResultMeta
//   with ZERO overrides (28-line file): XML identical to RowsFromResult.
// - trans FileStream -> FileStreamMeta extends BaseStreamStepMeta via
//   StepWithMappingMeta/BaseSerializingMeta: <step-props> with one own prop
//   (sourcePath, lowercase!) + base-stream props.
// - trans DynamicSQLRow -> DynamicSQLRowMeta, kettle-steps.xml line 80.
//   getXML() (274-287): connection, rowlimit, sql, outer_join, replace_vars,
//   sql_fieldname, query_only_on_change. No <parameter> (unlike DBJoin).
// - trans FuzzyMatch -> FuzzyMatchMeta, line 112. getXML() (515-543): from
//   (info-step name), lookupfield, mainstreamfield, outputmatchfield,
//   outputvaluefield, caseSensitive, closervalue, minimalValue, maximalValue,
//   separator, algorithm (code), always-emitted paired <lookup>.
// - trans WebServiceLookup -> WebServiceMeta, line 95. getXML() (201-257):
//   17 ws* scalars + <fieldsIn> + <fieldsOut> (name, wsName, xsdType).
//   NOTE: compatible missing/empty loads TRUE (line 279-280).
// - trans WebServiceAvailable -> WebServiceAvailableMeta, line 110.
//   getXML() (148-156): urlField (DYNAMIC field name!), readTimeOut,
//   connectTimeOut, resultfieldname.
// - trans GetTableNames -> GetTableNamesMeta, line 99. getXML() (359-380):
//   connection, schemaname, 4 *fieldname, 8 include*/dynamic flags,
//   schemaNameField. NOTE legacy typo tag schenameNameField (7.0 compat).
// - trans MultiwayMergeJoin -> MultiMergeJoinMeta, line 121. getXML()
//   (148-165): join_type, DYNAMIC step0..stepN tags, number_input (parse has
//   NO null-guard), <keys>/<key>.
const BATCH = [
  { kind: 'job', xmlType: 'GET_POP', alias: 'GET_POP' },
  { kind: 'job', xmlType: 'PING', alias: 'PING' },
  { kind: 'job', xmlType: 'TELNET', alias: 'TELNET' },
  { kind: 'job', xmlType: 'SYSLOG', alias: 'SYSLOG' },
  { kind: 'job', xmlType: 'SNMP_TRAP', alias: 'SNMP_TRAP' },
  { kind: 'job', xmlType: 'SEND_NAGIOS_PASSIVE_CHECK', alias: 'SEND_NAGIOS_PASSIVE_CHECK' },
  { kind: 'job', xmlType: 'WEBSERVICE_AVAILABLE', alias: 'WEBSERVICE_AVAILABLE' },
  { kind: 'job', xmlType: 'MSSQL_BULK_LOAD', alias: 'MSSQL_BULK_LOAD' },
  { kind: 'job', xmlType: 'MYSQL_BULK_LOAD', alias: 'MYSQL_BULK_LOAD' },
  { kind: 'job', xmlType: 'MYSQL_BULK_FILE', alias: 'MYSQL_BULK_FILE' },
  { kind: 'trans', xmlType: 'Mail', alias: 'MAIL' },
  { kind: 'trans', xmlType: 'MailInput', alias: 'MAIL_INPUT' },
  { kind: 'trans', xmlType: 'MailValidator', alias: 'MAIL_VALIDATOR' },
  { kind: 'trans', xmlType: 'MySQLBulkLoader', alias: 'MYSQL_BULK_LOADER' },
  { kind: 'trans', xmlType: 'MonetDBBulkLoader', alias: 'MONETDB_BULK_LOADER' },
  { kind: 'trans', xmlType: 'PGBulkLoader', alias: 'PG_BULK_LOADER' },
  { kind: 'trans', xmlType: 'InfobrightOutput', alias: 'INFOBRIGHT_OUTPUT' },
  { kind: 'trans', xmlType: 'VectorWiseBulkLoader', alias: 'VECTORWISE_BULK_LOADER' },
  { kind: 'trans', xmlType: 'GPLoad', alias: 'GP_LOAD' },
  { kind: 'trans', xmlType: 'SQLFileOutput', alias: 'SQL_FILE_OUTPUT' },
  { kind: 'trans', xmlType: 'ExecSQLRow', alias: 'EXEC_SQL_ROW' },
  { kind: 'trans', xmlType: 'Jms2Consumer', alias: 'JMS_CONSUMER' },
  { kind: 'trans', xmlType: 'Jms2Producer', alias: 'JMS_PRODUCER' },
  { kind: 'trans', xmlType: 'MQTTConsumer', alias: 'MQTT_CONSUMER' },
  { kind: 'trans', xmlType: 'MQTTProducer', alias: 'MQTT_PRODUCER' },
  { kind: 'trans', xmlType: 'RecordsFromStream', alias: 'RECORDS_FROM_STREAM' },
  { kind: 'trans', xmlType: 'FileStream', alias: 'FILE_STREAM' },
  { kind: 'trans', xmlType: 'DynamicSQLRow', alias: 'DYNAMIC_SQL_ROW' },
  { kind: 'trans', xmlType: 'FuzzyMatch', alias: 'FUZZY_MATCH' },
  { kind: 'trans', xmlType: 'WebServiceLookup', alias: 'WEB_SERVICE_LOOKUP' },
  { kind: 'trans', xmlType: 'WebServiceAvailable', alias: 'WEB_SERVICE_AVAILABLE' },
  { kind: 'trans', xmlType: 'GetTableNames', alias: 'GET_TABLE_NAMES' },
  { kind: 'trans', xmlType: 'MultiwayMergeJoin', alias: 'MULTIWAY_MERGE_JOIN' },
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

// Same, for <step-props> injection properties addressed by name="...".
function assertPropOrder(block, names, label) {
  let at = -1;
  for (const name of names) {
    const i = block.indexOf(`name="${name}"`);
    assert.ok(i > at, `${label}: property ${name} must follow source declaration order`);
    at = i;
  }
}

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b61-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b61') {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    // The DB-referencing steps of this batch resolve <connection> by name,
    // so every trans fixture declares ${CONN} (B2 pitfall); harmless for
    // steps without a connection tag.
    '  <connection><name>${CONN}</name></connection>',
    '  <order/>',
    '</transformation>',
  ].join('\n'));
  return file;
}

function minimalKjb(name = 'b61') {
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

// Set one <step-props> property value by injection name (test-local splice;
// setFieldPath cannot address repeated <property> tags by attribute).
function setStepProp(file, propName, value) {
  const xml = readFileSync(file, 'utf8');
  // A <property> default value is either paired (<value>text</value>) or, for
  // empty defaults, self-closing (<value/> or <value xsi:type="..."/>) — the
  // JAXB serializer writes empties self-closing. Handle both forms so setting a
  // property with an empty default (e.g. AUTOMATIC_RECONNECT) does not run the
  // greedy match into the next property's </value>.
  const selfClosing = new RegExp(
    `(<property\\b[^>]*\\bname="${propName}"[^>]*>\\s*)<value\\b([^>]*?)/>`,
  );
  const paired = new RegExp(
    `(<property\\b[^>]*\\bname="${propName}"[^>]*>\\s*)<value\\b([^>]*?)(?<!/)>([\\s\\S]*?)</value>`,
  );
  let next;
  if (selfClosing.test(xml)) {
    next = xml.replace(selfClosing, (m, p1, attrs) => `${p1}<value${attrs}>${value}</value>`);
  } else if (paired.test(xml)) {
    next = xml.replace(paired, (m, p1, attrs) => `${p1}<value${attrs}>${value}</value>`);
  } else {
    assert.ok(false, `property ${propName} present for splice`);
  }
  writeFileSync(file, next);
}

function stepPropValue(file, propName) {
  const xml = readFileSync(file, 'utf8');
  const paired = new RegExp(
    `<property\\b[^>]*\\bname="${propName}"[^>]*>\\s*<value\\b[^>]*>([\\s\\S]*?)</value>`,
  ).exec(xml);
  if (paired) return paired[1];
  const selfClosing = new RegExp(
    `<property\\b[^>]*\\bname="${propName}"[^>]*>\\s*<value\\b[^>]*/>`,
  ).exec(xml);
  assert.ok(selfClosing, `property ${propName} present`);
  return '';
}

test('B6-1 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B6-1 references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
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

test('B6-1 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b61-${xmlType.toLowerCase()}`)
      : minimalKtr(`b61-${xmlType.toLowerCase()}`);
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

test('job GET_POP follows JobEntryGetPOP.getXML 40-tag order; IMAP non-default', () => {
  const ref = getReference('job', 'GET_POP');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<servername>', '<username>', '<password>', '<usessl>', '<sslport>',
      '<outputdirectory>', '<filenamepattern>', '<retrievemails>', '<firstmails>',
      '<delete>', '<savemessage>', '<saveattachment>',
      '<usedifferentfolderforattachment>', '<protocol>', '<attachmentfolder>',
      '<attachmentwildcard>', '<valueimaplist>', '<imapfirstmails>', '<imapfolder>',
      '<sendersearch>', '<nottermsendersearch>', '<receipientsearch>',
      '<nottermreceipientsearch>', '<subjectsearch>', '<nottermsubjectsearch>',
      '<bodysearch>', '<nottermbodysearch>', '<conditionreceiveddate>',
      '<nottermreceiveddatesearch>', '<receiveddate1>', '<receiveddate2>',
      '<actiontype>', '<movetoimapfolder>', '<createmovetofolder>',
      '<createlocalfolder>', '<aftergetimap>', '<includesubfolders>',
      '<useproxy>', '<proxyusername>'],
    'GET_POP');
  // Default template pins the constructor/codec defaults: POP3, savemessage/
  // saveattachment Y, valueimaplist imaplistall, actiontype get,
  // conditionreceiveddate ignore, aftergetimap nothing.
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.protocol, 'POP3');
  assert.equal(parsed.entry.valueimaplist, 'imaplistall');
  assert.equal(parsed.entry.actiontype, 'get');
  assert.equal(parsed.entry.aftergetimap, 'nothing');

  const file = minimalKjb('b61-get-pop');
  addElement(file, 'GET_POP', 'Fetch inbox');
  setFieldPath(file, 'Fetch inbox', 'servername', '${MAIL_HOST}');
  setFieldPath(file, 'Fetch inbox', 'username', '${MAIL_USER}');
  setFieldPath(file, 'Fetch inbox', 'protocol', 'IMAP');
  setFieldPath(file, 'Fetch inbox', 'valueimaplist', 'imaplistunread');
  setFieldPath(file, 'Fetch inbox', 'aftergetimap', 'delete');
  setFieldPath(file, 'Fetch inbox', 'usessl', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<protocol>IMAP<\/protocol>/);
  assert.match(after, /<valueimaplist>imaplistunread<\/valueimaplist>/);
  assert.match(after, /<aftergetimap>delete<\/aftergetimap>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job PING keeps the legacy nbrpaquets duplicate; systemPing non-default', () => {
  // JobEntryPing.getXML() (102-116) always emits BOTH nbr_packets and the
  // legacy nbrpaquets tag with the same value.
  const ref = getReference('job', 'PING');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<hostname>', '<nbr_packets>', '<nbrpaquets>', '<timeout>', '<pingtype>'],
    'PING');
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.nbr_packets, 2);
  assert.equal(parsed.entry.nbrpaquets, 2);
  assert.equal(parsed.entry.pingtype, 'classicPing');

  const file = minimalKjb('b61-ping');
  addElement(file, 'PING', 'Ping gateway');
  setFieldPath(file, 'Ping gateway', 'hostname', '${PING_HOST}');
  setFieldPath(file, 'Ping gateway', 'nbr_packets', '5');
  setFieldPath(file, 'Ping gateway', 'nbrpaquets', '5');
  setFieldPath(file, 'Ping gateway', 'timeout', '10000');
  setFieldPath(file, 'Ping gateway', 'pingtype', 'systemPing');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<pingtype>systemPing<\/pingtype>/);
  assert.match(after, /<timeout>10000<\/timeout>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job TELNET and WEBSERVICE_AVAILABLE follow their 3-tag getXML order', () => {
  // JobEntryTelnet.getXML() (88-97): hostname, port, timeout.
  let ref = getReference('job', 'TELNET');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<hostname>', '<port>', '<timeout>'], 'TELNET');
  let parsed = parser.parse(block);
  assert.equal(parsed.entry.port, 23);
  assert.equal(parsed.entry.timeout, 3000);

  let file = minimalKjb('b61-telnet');
  addElement(file, 'TELNET', 'Check ssh port');
  setFieldPath(file, 'Check ssh port', 'port', '22');
  setFieldPath(file, 'Check ssh port', 'timeout', '5000');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<port>22<\/port>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // JobEntryWebServiceAvailable.getXML() (78-86): url, connectTimeOut, readTimeOut.
  ref = getReference('job', 'WEBSERVICE_AVAILABLE');
  block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<url>', '<connectTimeOut>', '<readTimeOut>'],
    'WEBSERVICE_AVAILABLE');

  file = minimalKjb('b61-ws-available');
  addElement(file, 'WEBSERVICE_AVAILABLE', 'Check service');
  setFieldPath(file, 'Check service', 'url', '${SERVICE_URL}');
  setFieldPath(file, 'Check service', 'connectTimeOut', '30000');
  setFieldPath(file, 'Check service', 'readTimeOut', '60000');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<connectTimeOut>30000<\/connectTimeOut>/);
  assert.match(after, /<readTimeOut>60000<\/readTimeOut>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job SYSLOG emits port before servername; LOCAL0/WARNING non-default', () => {
  // JobEntrySyslog.getXML() (89-103): port FIRST, then servername, facility,
  // priority, message, datePattern, addTimestamp, addHostname.
  const ref = getReference('job', 'SYSLOG');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<port>', '<servername>', '<facility>', '<priority>', '<message>',
      '<datePattern>', '<addTimestamp>', '<addHostname>'],
    'SYSLOG');
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.port, 514);
  assert.equal(parsed.entry.facility, 'KERNEL');
  assert.equal(parsed.entry.priority, 'EMERGENCY');
  assert.equal(parsed.entry.addTimestamp, 'Y');
  assert.equal(parsed.entry.addHostname, 'Y');

  const file = minimalKjb('b61-syslog');
  addElement(file, 'SYSLOG', 'Report warnings');
  setFieldPath(file, 'Report warnings', 'servername', '${SYSLOG_HOST}');
  setFieldPath(file, 'Report warnings', 'facility', 'LOCAL0');
  setFieldPath(file, 'Report warnings', 'priority', 'WARNING');
  setFieldPath(file, 'Report warnings', 'addHostname', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<facility>LOCAL0<\/facility>/);
  assert.match(after, /<priority>WARNING<\/priority>/);
  assert.match(after, /<addHostname>N<\/addHostname>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job SNMP_TRAP 11-tag order; SNMPv3 user non-default', () => {
  // JobEntrySNMPTrap.getXML() (156-172): port, servername, oid, comstring,
  // message, timeout, nrretry, targettype, user, passphrase, engineid.
  const ref = getReference('job', 'SNMP_TRAP');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<port>', '<servername>', '<oid>', '<comstring>', '<message>',
      '<timeout>', '<nrretry>', '<targettype>', '<user>', '<passphrase>',
      '<engineid>'],
    'SNMP_TRAP');
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.port, 162);
  assert.equal(parsed.entry.targettype, 'community');

  const file = minimalKjb('b61-snmp');
  addElement(file, 'SNMP_TRAP', 'Trap on failure');
  setFieldPath(file, 'Trap on failure', 'servername', '${SNMP_HOST}');
  setFieldPath(file, 'Trap on failure', 'targettype', 'user');
  setFieldPath(file, 'Trap on failure', 'user', '${SNMP_USER}');
  setFieldPath(file, 'Trap on failure', 'nrretry', '3');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<targettype>user<\/targettype>/);
  assert.match(after, /<nrretry>3<\/nrretry>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job SEND_NAGIOS_PASSIVE_CHECK 10-tag order; critical/tripledes non-default', () => {
  // JobEntrySendNagiosPassiveCheck.getXML() (203-221): port, servername,
  // password (PLAIN - always ${VAR}), responseTimeOut, connectionTimeOut,
  // senderServerName, senderServiceName, message, encryptionMode, level.
  const ref = getReference('job', 'SEND_NAGIOS_PASSIVE_CHECK');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<port>', '<servername>', '<password>', '<responseTimeOut>',
      '<connectionTimeOut>', '<senderServerName>', '<senderServiceName>',
      '<message>', '<encryptionMode>', '<level>'],
    'SEND_NAGIOS_PASSIVE_CHECK');
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.port, 5667);
  assert.equal(parsed.entry.encryptionMode, 'none');
  assert.equal(parsed.entry.level, 'unknown');

  const file = minimalKjb('b61-nagios');
  addElement(file, 'SEND_NAGIOS_PASSIVE_CHECK', 'Page on failure');
  setFieldPath(file, 'Page on failure', 'servername', '${NAGIOS_HOST}');
  setFieldPath(file, 'Page on failure', 'password', '${NAGIOS_PASSWORD}');
  setFieldPath(file, 'Page on failure', 'encryptionMode', 'tripledes');
  setFieldPath(file, 'Page on failure', 'level', 'critical');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<encryptionMode>tripledes<\/encryptionMode>/);
  assert.match(after, /<level>critical<\/level>/);
  assert.match(after, /<password>\$\{NAGIOS_PASSWORD\}<\/password>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job MSSQL_BULK_LOAD/MYSQL_BULK_LOAD/MYSQL_BULK_FILE put <connection> last', () => {
  // All three bulk job entries emit <connection> AFTER their scalar tags.
  let ref = getReference('job', 'MSSQL_BULK_LOAD');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<schemaname>', '<tablename>', '<filename>', '<datafiletype>',
      '<fieldterminator>', '<lineterminated>', '<codepage>',
      '<specificcodepage>', '<formatfilename>', '<firetriggers>',
      '<checkconstraints>', '<keepnulls>', '<keepidentity>', '<tablock>',
      '<startfile>', '<endfile>', '<orderby>', '<orderdirection>',
      '<maxerrors>', '<batchsize>', '<rowsperbatch>', '<errorfilename>',
      '<adddatetime>', '<addfiletoresult>', '<truncate>', '<connection>'],
    'MSSQL_BULK_LOAD');
  let file = minimalKjb('b61-mssql-bulk');
  addElement(file, 'MSSQL_BULK_LOAD', 'Bulk load sales');
  setFieldPath(file, 'Bulk load sales', 'tablename', 'staging_sales');
  setFieldPath(file, 'Bulk load sales', 'filename', '${BULK_FILE}');
  setFieldPath(file, 'Bulk load sales', 'tablock', 'Y');
  setFieldPath(file, 'Bulk load sales', 'batchsize', '10000');
  setFieldPath(file, 'Bulk load sales', 'truncate', 'Y');
  setFieldPath(file, 'Bulk load sales', 'connection', '${CONN}');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<truncate>Y<\/truncate>/);
  assert.match(after, /<batchsize>10000<\/batchsize>/);
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // JobEntryMysqlBulkLoad.getXML() (115-142); note the source typo prorityvalue.
  ref = getReference('job', 'MYSQL_BULK_LOAD');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<schemaname>', '<tablename>', '<filename>', '<separator>', '<enclosed>',
      '<escaped>', '<linestarted>', '<lineterminated>', '<replacedata>',
      '<ignorelines>', '<listattribut>', '<localinfile>', '<prorityvalue>',
      '<addfiletoresult>', '<connection>'],
    'MYSQL_BULK_LOAD');
  assert.ok(block.includes('<prorityvalue>'),
    'MYSQL_BULK_LOAD keeps the source typo prorityvalue');
  file = minimalKjb('b61-mysql-bulk');
  addElement(file, 'MYSQL_BULK_LOAD', 'Load csv');
  setFieldPath(file, 'Load csv', 'replacedata', 'N');
  setFieldPath(file, 'Load csv', 'ignorelines', '1');
  setFieldPath(file, 'Load csv', 'localinfile', 'N');
  setFieldPath(file, 'Load csv', 'connection', '${CONN}');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<replacedata>N<\/replacedata>/);
  assert.match(after, /<ignorelines>1<\/ignorelines>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // JobEntryMysqlBulkFile.getXML() (112-133): outdumpvalue/iffileexists are
  // int codes, not Y/N.
  ref = getReference('job', 'MYSQL_BULK_FILE');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<schemaname>', '<tablename>', '<filename>', '<separator>', '<enclosed>',
      '<optionenclosed>', '<lineterminated>', '<limitlines>', '<listcolumn>',
      '<highpriority>', '<outdumpvalue>', '<iffileexists>',
      '<addfiletoresult>', '<connection>'],
    'MYSQL_BULK_FILE');
  const parsed = parser.parse(block);
  assert.equal(parsed.entry.iffileexists, 2);
  file = minimalKjb('b61-mysql-file');
  addElement(file, 'MYSQL_BULK_FILE', 'Dump table');
  setFieldPath(file, 'Dump table', 'listcolumn', 'id, name, total');
  setFieldPath(file, 'Dump table', 'limitlines', '1000');
  setFieldPath(file, 'Dump table', 'connection', '${CONN}');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<listcolumn>id, name, total<\/listcolumn>/);
  assert.match(after, /<limitlines>1000<\/limitlines>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans Mail 40-tag order plus paired embeddedimages; auth/TLS non-default', () => {
  // MailMeta.getXML() (253-316): 40 scalars server..secureconnectiontype,
  // then an ALWAYS-emitted paired <embeddedimages> wrapper.
  const ref = getReference('trans', 'Mail');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<server>', '<port>', '<destination>', '<destinationCc>',
      '<destinationBCc>', '<replyToAddresses>', '<replyto>', '<replytoname>',
      '<subject>', '<include_date>', '<include_subfolders>',
      '<zipFilenameDynamic>', '<isFilenameDynamic>',
      '<attachContentFromField>', '<attachContentField>',
      '<attachContentFileNameField>', '<dynamicFieldname>',
      '<dynamicWildcard>', '<dynamicZipFilename>', '<sourcefilefoldername>',
      '<sourcewildcard>', '<contact_person>', '<contact_phone>', '<comment>',
      '<include_files>', '<zip_files>', '<zip_name>', '<zip_limit_size>',
      '<use_auth>', '<use_secure_auth>', '<auth_user>', '<auth_password>',
      '<only_comment>', '<use_HTML>', '<use_Priority>', '<encoding>',
      '<priority>', '<importance>', '<sensitivity>',
      '<secureconnectiontype>', '<embeddedimages>'],
    'Mail');
  assert.ok(block.includes('</embeddedimages>'),
    'Mail template keeps a paired <embeddedimages> wrapper per getXML()');

  const file = minimalKtr('b61-mail');
  addElement(file, 'Mail', 'Send report');
  setFieldPath(file, 'Send report', 'server', '${SMTP_HOST}');
  setFieldPath(file, 'Send report', 'port', '587');
  setFieldPath(file, 'Send report', 'destination', '${MAIL_TO}');
  setFieldPath(file, 'Send report', 'use_auth', 'Y');
  setFieldPath(file, 'Send report', 'auth_user', '${SMTP_USER}');
  setFieldPath(file, 'Send report', 'auth_password', '${SMTP_PASSWORD}');
  setFieldPath(file, 'Send report', 'secureconnectiontype', 'TLS');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<use_auth>Y<\/use_auth>/);
  assert.match(after, /<secureconnectiontype>TLS<\/secureconnectiontype>/);
  assert.match(after, /<auth_password>\$\{SMTP_PASSWORD\}<\/auth_password>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans MailInput order with camelCase batch tags; batch + fields non-default', () => {
  // MailInputMeta.getXML() (376-432): 33 scalars ending in the camelCase
  // batch tags useBatch/batchSize/startMsg/endMsg/stopOnError, then <fields>.
  // NOTE the correct spelling recipientsearch (unlike job GET_POP).
  const ref = getReference('trans', 'MailInput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<servername>', '<username>', '<password>', '<usessl>', '<sslport>',
      '<retrievemails>', '<firstmails>', '<delete>', '<protocol>',
      '<valueimaplist>', '<imapfirstmails>', '<imapfolder>',
      '<sendersearch>', '<nottermsendersearch>', '<recipientsearch>',
      '<notTermRecipientSearch>', '<subjectsearch>',
      '<nottermsubjectsearch>', '<conditionreceiveddate>',
      '<nottermreceiveddatesearch>', '<receiveddate1>', '<receiveddate2>',
      '<includesubfolders>', '<useproxy>', '<proxyusername>',
      '<usedynamicfolder>', '<folderfield>', '<rowlimit>', '<useBatch>',
      '<batchSize>', '<startMsg>', '<endMsg>', '<stopOnError>', '<fields>'],
    'MailInput');
  assert.ok(!block.includes('receipientsearch'),
    'MailInput uses recipientsearch, not the GET_POP typo');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.batchSize, 500);
  assert.equal(parsed.step.stopOnError, 'Y');

  const file = minimalKtr('b61-mailinput');
  addElement(file, 'MailInput', 'Read inbox');
  setFieldPath(file, 'Read inbox', 'servername', '${MAIL_HOST}');
  setFieldPath(file, 'Read inbox', 'protocol', 'IMAP');
  setFieldPath(file, 'Read inbox', 'useBatch', 'Y');
  setFieldPath(file, 'Read inbox', 'batchSize', '100');
  setFieldPath(file, 'Read inbox', 'rowlimit', '1000');
  setFields(file, 'Read inbox', 'fields', 'field', [
    { name: 'MAIL_SUBJECT', column: 'subject' },
    { name: 'MAIL_BODY', column: 'body' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<useBatch>Y<\/useBatch>/);
  assert.match(after, /<batchSize>100<\/batchSize>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Read inbox');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'MAIL_SUBJECT');
  assert.equal(items[0].column, 'subject');
  assert.equal(items[1].column, 'body');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans MailValidator 12-tag order; ResultAsString non-default', () => {
  // MailValidatorMeta.getXML() (347-366): emailfield..isdynamicDefaultSMTP.
  const ref = getReference('trans', 'MailValidator');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<emailfield>', '<resultfieldname>', '<ResultAsString>', '<smtpCheck>',
      '<emailValideMsg>', '<emailNotValideMsg>', '<errorsFieldName>',
      '<timeout>', '<defaultSMTP>', '<emailSender>', '<defaultSMTPField>',
      '<isdynamicDefaultSMTP>'],
    'MailValidator');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.resultfieldname, 'result');
  assert.equal(parsed.step.ResultAsString, 'N');

  const file = minimalKtr('b61-mailvalidator');
  addElement(file, 'MailValidator', 'Validate emails');
  setFieldPath(file, 'Validate emails', 'emailfield', 'CUSTOMER_EMAIL');
  setFieldPath(file, 'Validate emails', 'ResultAsString', 'Y');
  setFieldPath(file, 'Validate emails', 'emailValideMsg', 'valid');
  setFieldPath(file, 'Validate emails', 'emailNotValideMsg', 'invalid');
  setFieldPath(file, 'Validate emails', 'errorsFieldName', 'EMAIL_ERROR');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<ResultAsString>Y<\/ResultAsString>/);
  assert.match(after, /<emailfield>CUSTOMER_EMAIL<\/emailfield>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('bulk loaders emit sibling <mapping> with source tag order', () => {
  // MySQLBulkLoaderMeta.getXML() (305-332): connection..bulk_size, then
  // SIBLING <mapping> (no wrapper) with stream_name/field_name/field_format_ok.
  let ref = getReference('trans', 'MySQLBulkLoader');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<schema>', '<table>', '<encoding>', '<delimiter>',
      '<enclosure>', '<escape_char>', '<replace>', '<ignore>', '<local>',
      '<fifo_file_name>', '<bulk_size>', '<mapping>'],
    'MySQLBulkLoader');
  assert.ok(!block.includes('<mappings>'),
    'MySQLBulkLoader must not invent a <mappings> wrapper');
  let parsed = parser.parse(block);
  const mysqlMappings = Array.isArray(parsed.step.mapping)
    ? parsed.step.mapping
    : [parsed.step.mapping];
  assert.ok(mysqlMappings.length >= 1);
  assert.ok('stream_name' in mysqlMappings[0] && 'field_name' in mysqlMappings[0]
    && 'field_format_ok' in mysqlMappings[0]);

  let file = minimalKtr('b61-mysqlbulkloader');
  addElement(file, 'MySQLBulkLoader', 'Bulk load customers');
  setFieldPath(file, 'Bulk load customers', 'connection', '${CONN}');
  setFieldPath(file, 'Bulk load customers', 'table', 'customers');
  setFieldPath(file, 'Bulk load customers', 'replace', 'Y');
  setFieldPath(file, 'Bulk load customers', 'fifo_file_name', '/tmp/fifo_customers');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<replace>Y<\/replace>/);
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // MonetDBBulkLoaderMeta.getXML() (369-397): connection, buffer_size,
  // schema, table, log_file, truncate, fully_quote_sql, field_separator,
  // field_enclosure, null_representation, encoding + sibling <mapping>.
  ref = getReference('trans', 'MonetDBBulkLoader');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<buffer_size>', '<schema>', '<table>', '<log_file>',
      '<truncate>', '<fully_quote_sql>', '<field_separator>',
      '<field_enclosure>', '<null_representation>', '<encoding>', '<mapping>'],
    'MonetDBBulkLoader');
  parsed = parser.parse(block);
  assert.equal(parsed.step.buffer_size, 100000);
  assert.equal(parsed.step.fully_quote_sql, 'Y');
  file = minimalKtr('b61-monetbulkloader');
  addElement(file, 'MonetDBBulkLoader', 'Bulk load events');
  setFieldPath(file, 'Bulk load events', 'connection', '${CONN}');
  setFieldPath(file, 'Bulk load events', 'table', 'events');
  setFieldPath(file, 'Bulk load events', 'truncate', 'Y');
  setFieldPath(file, 'Bulk load events', 'null_representation', 'null');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<truncate>Y<\/truncate>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // PGBulkLoaderMeta.getXML() (279-302): connection, schema, table,
  // load_action, dbname_override, enclosure, delimiter, stop_on_error +
  // sibling <mapping> with date_mask whitelist.
  ref = getReference('trans', 'PGBulkLoader');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<schema>', '<table>', '<load_action>',
      '<dbname_override>', '<enclosure>', '<delimiter>', '<stop_on_error>',
      '<mapping>'],
    'PGBulkLoader');
  file = minimalKtr('b61-pgbulkloader');
  addElement(file, 'PGBulkLoader', 'Bulk load staging');
  setFieldPath(file, 'Bulk load staging', 'connection', '${CONN}');
  setFieldPath(file, 'Bulk load staging', 'table', 'staging_orders');
  setFieldPath(file, 'Bulk load staging', 'load_action', 'TRUNCATE');
  setFieldPath(file, 'Bulk load staging', 'stop_on_error', 'Y');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<load_action>TRUNCATE<\/load_action>/);
  assert.match(after, /<stop_on_error>Y<\/stop_on_error>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans InfobrightOutput appends 4 tags after TableOutput fields; specify-fields non-default', () => {
  // InfobrightLoaderMeta.getXML() (157-164) = TableOutputMeta.getXML()
  // (connection..return_field + <fields>) + data_format, agent_port,
  // charset, debug_file. data_format loads via Enum.valueOf (strict).
  const ref = getReference('trans', 'InfobrightOutput');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<schema>', '<table>', '<commit>', '<truncate>',
      '<ignore_errors>', '<use_batch>', '<specify_fields>',
      '<partitioning_enabled>', '<partitioning_field>',
      '<partitioning_daily>', '<partitioning_monthly>',
      '<tablename_in_field>', '<tablename_field>', '<tablename_in_table>',
      '<return_keys>', '<return_field>', '<fields>', '<data_format>',
      '<agent_port>', '<charset>', '<debug_file>'],
    'InfobrightOutput');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.data_format, 'TXT_VARIABLE');

  const file = minimalKtr('b61-infobright');
  addElement(file, 'InfobrightOutput', 'Load facts');
  setFieldPath(file, 'Load facts', 'connection', '${CONN}');
  setFieldPath(file, 'Load facts', 'table', 'facts');
  setFieldPath(file, 'Load facts', 'truncate', 'Y');
  setFieldPath(file, 'Load facts', 'specify_fields', 'Y');
  setFields(file, 'Load facts', 'fields', 'field', [
    { column_name: 'order_id', stream_name: 'ORDER_ID' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<truncate>Y<\/truncate>/);
  assert.match(after, /<data_format>TXT_VARIABLE<\/data_format>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Load facts');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  // column_name comes BEFORE stream_name per TableOutputMeta.getXML (536-542).
  assert.equal(items[0].column_name, 'order_id');
  assert.equal(items[0].stream_name, 'ORDER_ID');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans VectorWiseBulkLoader has no schema and a wrapped fields list', () => {
  // IngresVectorwiseLoaderMeta.getXML() (209-243): connection, table (NO
  // schema), fifo_file_name, sql_path, ... buffer_size + WRAPPED <fields>.
  const ref = getReference('trans', 'VectorWiseBulkLoader');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<table>', '<fifo_file_name>', '<sql_path>',
      '<encoding>', '<delimiter>', '<continue_on_error>',
      '<error_file_name>', '<use_standard_conversion>',
      '<use_authentication>', '<use_dynamic_vnode>', '<use_SSV_delimiter>',
      '<escape_special_characters>', '<use_vwload>', '<truncate_table>',
      '<max_errors>', '<buffer_size>', '<fields>'],
    'VectorWiseBulkLoader');
  const parsed = parser.parse(block);
  assert.ok(!('schema' in parsed.step),
    'VectorWiseBulkLoader must not invent a <schema> tag');
  assert.equal(parsed.step.escape_special_characters, 'Y');

  const file = minimalKtr('b61-vectorwise');
  addElement(file, 'VectorWiseBulkLoader', 'Load sales');
  setFieldPath(file, 'Load sales', 'connection', '${CONN}');
  setFieldPath(file, 'Load sales', 'use_vwload', 'Y');
  setFieldPath(file, 'Load sales', 'truncate_table', 'Y');
  setFieldPath(file, 'Load sales', 'max_errors', '100');
  setFields(file, 'Load sales', 'fields', 'field', [
    { column_name: 'sale_id', stream_name: 'SALE_ID' },
    { column_name: 'amount', stream_name: 'AMOUNT' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<use_vwload>Y<\/use_vwload>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Load sales');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans GPLoad keeps sibling mapping with match/update columns plus paired local_hosts', () => {
  // GPLoadMeta.getXML() (414-454): connection..update_condition, sibling
  // <mapping> (stream_name, field_name, date_mask, match_column,
  // update_column), then ALWAYS-emitted paired <local_hosts>.
  // Missing <enclose_numbers> throws NPE on load (line 353).
  const ref = getReference('trans', 'GPLoad');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<errors>', '<schema>', '<table>', '<error_table>',
      '<load_method>', '<load_action>', '<gpload_path>', '<control_file>',
      '<data_file>', '<delimiter>', '<log_file>', '<null_as>',
      '<erase_files>', '<encoding>', '<enclose_numbers>', '<localhost_port>',
      '<update_condition>', '<mapping>', '<local_hosts>'],
    'GPLoad');
  assert.ok(block.includes('<enclose_numbers>'),
    'GPLoad template must carry <enclose_numbers> (missing tag NPEs on load)');
  assert.ok(block.includes('</local_hosts>'),
    'GPLoad template must carry a paired <local_hosts> wrapper per getXML()');
  const parsed = parser.parse(block);
  const mappings = Array.isArray(parsed.step.mapping)
    ? parsed.step.mapping
    : [parsed.step.mapping];
  assert.ok('match_column' in mappings[0] && 'update_column' in mappings[0]);
  assert.equal(parsed.step.load_action, 'insert');

  const file = minimalKtr('b61-gpload');
  addElement(file, 'GPLoad', 'Load warehouse');
  setFieldPath(file, 'Load warehouse', 'connection', '${CONN}');
  setFieldPath(file, 'Load warehouse', 'errors', '100');
  setFieldPath(file, 'Load warehouse', 'update_condition',
    'EXISTS (SELECT 1 FROM warehouse t WHERE t.id = src.id)');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<errors>100<\/errors>/);
  assert.match(after, /<update_condition>EXISTS \(SELECT 1 FROM warehouse t WHERE t\.id = src\.id\)<\/update_condition>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans SQLFileOutput nests file options in <file>; ExecSQLRow puts commit first', () => {
  // SQLFileOutputMeta.getXML() (491-521): connection..startnewline, then a
  // <file> wrapper (note the source typo extention).
  let ref = getReference('trans', 'SQLFileOutput');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<schema>', '<table>', '<truncate>', '<create>',
      '<encoding>', '<dateformat>', '<addtoresult>', '<startnewline>',
      '<file>'],
    'SQLFileOutput');
  assert.ok(block.includes('<extention>'),
    'SQLFileOutput keeps the source typo extention');
  let file = minimalKtr('b61-sqlfileoutput');
  addElement(file, 'SQLFileOutput', 'Dump ddl');
  setFieldPath(file, 'Dump ddl', 'connection', '${CONN}');
  setFieldPath(file, 'Dump ddl', 'table', 'orders');
  setFieldPath(file, 'Dump ddl', 'truncate', 'Y');
  setFieldPath(file, 'Dump ddl', 'create', 'Y');
  setFieldPath(file, 'Dump ddl', 'file/name', '${SQL_FILE}');
  setFieldPath(file, 'Dump ddl', 'file/append', 'Y');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<name>\$\{SQL_FILE\}<\/name>/);
  assert.match(after, /<truncate>Y<\/truncate>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // ExecSQLRowMeta.getXML() (298-313): commit FIRST, then connection,
  // sql_field, insert/update/delete/read_field, sqlFromfile, sendOneStatement.
  // No static <sql> tag (unlike ExecSQL/DBJoin): SQL comes from the field.
  ref = getReference('trans', 'ExecSQLRow');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<commit>', '<connection>', '<sql_field>', '<insert_field>',
      '<update_field>', '<delete_field>', '<read_field>', '<sqlFromfile>',
      '<sendOneStatement>'],
    'ExecSQLRow');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.commit, 1);
  assert.equal(parsed.step.sendOneStatement, 'Y');
  assert.ok(!parsed.step.sql,
    'ExecSQLRow template must not invent a static <sql> tag');
  file = minimalKtr('b61-execsqlrow');
  addElement(file, 'ExecSQLRow', 'Run row sql');
  setFieldPath(file, 'Run row sql', 'connection', '${CONN}');
  setFieldPath(file, 'Run row sql', 'sql_field', 'SQL_FILE_PATH');
  setFieldPath(file, 'Run row sql', 'commit', '100');
  setFieldPath(file, 'Run row sql', 'sqlFromfile', 'Y');
  setFieldPath(file, 'Run row sql', 'sendOneStatement', 'N');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<commit>100<\/commit>/);
  assert.match(after, /<sqlFromfile>Y<\/sqlFromfile>/);
  assert.match(after, /<sendOneStatement>N<\/sendOneStatement>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('streaming steps serialize as <step-props> with injection property order', () => {
  // Jms2Consumer: JAXB <step-props> (BaseSerializingMeta); delegate props,
  // then own (RECEIVE_TIMEOUT..JMS_REDELIVERED), then base-stream props.
  // Observed emission: jms/.../jms-consumer.ktr lines 451-537.
  let ref = getReference('trans', 'Jms2Consumer');
  let block = firstFencedXml(ref.content);
  assert.ok(block.includes('<step-props'),
    'Jms2Consumer fragment must be <step-props>, not flat tags');
  assertPropOrder(block,
    ['DESTINATION', 'IBMMQ_URL', 'IBMMQ_USERNAME', 'IBMMQ_PASSWORD',
      'AMQ_URL', 'AMQ_USERNAME', 'AMQ_PASSWORD', 'CONNECTION_TYPE',
      'DESTINATION_TYPE', 'RECEIVE_TIMEOUT', 'MESSAGE_FIELD_NAME',
      'DESTINATION_FIELD_NAME', 'MESSAGE_ID', 'JMS_TIMESTAMP',
      'JMS_REDELIVERED', 'TRANSFORMATION_PATH', 'NUM_MESSAGES', 'DURATION',
      'SUB_STEP', 'SSL_ENABLED'],
    'Jms2Consumer');
  let file = minimalKtr('b61-jmsconsumer');
  addElement(file, 'Jms2Consumer', 'Consume orders');
  setStepProp(file, 'DESTINATION', 'orders.events');
  setStepProp(file, 'AMQ_URL', '${AMQ_URL}');
  setStepProp(file, 'RECEIVE_TIMEOUT', '5000');
  setStepProp(file, 'NUM_MESSAGES', '500');
  assert.equal(stepPropValue(file, 'RECEIVE_TIMEOUT'), '5000');
  assert.equal(stepPropValue(file, 'NUM_MESSAGES'), '500');
  assert.equal(validateFile(file).summary.errors, 0);

  // Jms2Producer: delegate + FIELD_TO_SEND + delivery options + PROPERTIES
  // group; NO base-stream props. Observed: amq-producer.ktr.
  ref = getReference('trans', 'Jms2Producer');
  block = firstFencedXml(ref.content);
  assertPropOrder(block,
    ['DESTINATION', 'FIELD_TO_SEND', 'DISABLE_MESSAGE_ID',
      'DISABLE_MESSAGE_TIMESTAMP', 'DELIVERY_MODE', 'PRIORITY',
      'TIME_TO_LIVE', 'DELIVERY_DELAY', 'JMS_CORRELATION_ID', 'JMS_TYPE',
      'PROPERTY_NAMES', 'PROPERTY_VALUES', 'SSL_ENABLED'],
    'Jms2Producer');
  file = minimalKtr('b61-jmsproducer');
  addElement(file, 'Jms2Producer', 'Publish events');
  setStepProp(file, 'FIELD_TO_SEND', 'PAYLOAD_JSON');
  setStepProp(file, 'DELIVERY_MODE', 'non-persistent');
  setStepProp(file, 'TIME_TO_LIVE', '60000');
  assert.equal(stepPropValue(file, 'FIELD_TO_SEND'), 'PAYLOAD_JSON');
  assert.equal(validateFile(file).summary.errors, 0);

  // MQTTConsumer: MQTT_* props + base-stream props + SSL group.
  // Observed: mqtt/.../ConsumeRows.ktr lines 451-543.
  ref = getReference('trans', 'MQTTConsumer');
  block = firstFencedXml(ref.content);
  assertPropOrder(block,
    ['MQTT_SERVER', 'CLIENT_ID', 'TOPICS', 'MSG_OUTPUT_NAME',
      'TOPIC_OUTPUT_NAME', 'QOS', 'USERNAME', 'PASSWORD',
      'KEEP_ALIVE_INTERVAL', 'MAX_INFLIGHT', 'CONNECTION_TIMEOUT',
      'CLEAN_SESSION', 'STORAGE_LEVEL', 'SERVER_URIS', 'MQTT_VERSION',
      'AUTOMATIC_RECONNECT', 'MESSAGE_DATA_TYPE', 'TRANSFORMATION_PATH',
      'NUM_MESSAGES', 'DURATION', 'USE_SSL', 'SSL_KEYS', 'SSL_VALUES'],
    'MQTTConsumer');
  file = minimalKtr('b61-mqttconsumer');
  addElement(file, 'MQTTConsumer', 'Subscribe sensors');
  setStepProp(file, 'MQTT_SERVER', '${MQTT_SERVER}');
  setStepProp(file, 'TOPICS', 'sensors/temperature');
  setStepProp(file, 'QOS', '1');
  setStepProp(file, 'AUTOMATIC_RECONNECT', 'true');
  assert.equal(stepPropValue(file, 'QOS'), '1');
  assert.equal(validateFile(file).summary.errors, 0);

  // MQTTProducer: topic static or via FIELD_TOPIC + TOPIC_IN_FIELD.
  // Observed: mqtt/.../ProduceFourRows.ktr.
  ref = getReference('trans', 'MQTTProducer');
  block = firstFencedXml(ref.content);
  assertPropOrder(block,
    ['MQTT_SERVER', 'CLIENT_ID', 'TOPIC', 'FIELD_TOPIC', 'TOPIC_IN_FIELD',
      'QOS', 'MESSAGE_FIELD', 'USERNAME', 'PASSWORD', 'USE_SSL'],
    'MQTTProducer');
  file = minimalKtr('b61-mqttproducer');
  addElement(file, 'MQTTProducer', 'Publish readings');
  setStepProp(file, 'FIELD_TOPIC', 'TARGET_TOPIC');
  setStepProp(file, 'TOPIC_IN_FIELD', 'true');
  setStepProp(file, 'QOS', '2');
  setStepProp(file, 'MESSAGE_FIELD', 'PAYLOAD');
  assert.equal(stepPropValue(file, 'TOPIC_IN_FIELD'), 'true');
  assert.equal(validateFile(file).summary.errors, 0);

  // FileStream: one own lowercase prop (sourcePath) + base-stream props.
  ref = getReference('trans', 'FileStream');
  block = firstFencedXml(ref.content);
  assertPropOrder(block,
    ['sourcePath', 'TRANSFORMATION_PATH', 'NUM_MESSAGES', 'DURATION',
      'SUB_STEP'],
    'FileStream');
  file = minimalKtr('b61-filestream');
  addElement(file, 'FileStream', 'Tail app log');
  setStepProp(file, 'sourcePath', '${APP_LOG}');
  setStepProp(file, 'NUM_MESSAGES', '200');
  assert.equal(stepPropValue(file, 'sourcePath'), '${APP_LOG}');
  assert.equal(validateFile(file).summary.errors, 0);

  // RecordsFromStream inherits the RowsFromResult <fields> declaration
  // (RecordsFromStreamMeta has zero overrides).
  ref = getReference('trans', 'RecordsFromStream');
  block = firstFencedXml(ref.content);
  assertTagOrder(block, ['<fields>'], 'RecordsFromStream');
  const parsed = parser.parse(block);
  const rfsFields = Array.isArray(parsed.step.fields.field)
    ? parsed.step.fields.field
    : [parsed.step.fields.field];
  assert.equal(rfsFields.length, 2);
  assert.equal(rfsFields[0].type, 'String');
  assert.equal(rfsFields[1].type, 'Integer');
  file = minimalKtr('b61-recordsfromstream');
  addElement(file, 'RecordsFromStream', 'Read stream records');
  setFields(file, 'Read stream records', 'fields', 'field', [
    { name: 'order_id', type: 'Integer', length: 10, precision: 0 },
    { name: 'order_date', type: 'Date', length: -2, precision: -2 },
  ]);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans DynamicSQLRow runs per-row SQL from a field; FuzzyMatch carries a paired lookup list', () => {
  // DynamicSQLRowMeta.getXML() (274-287): connection, rowlimit, sql,
  // outer_join, replace_vars, sql_fieldname, query_only_on_change.
  // No <parameter> list (unlike DBJoin).
  let ref = getReference('trans', 'DynamicSQLRow');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<rowlimit>', '<sql>', '<outer_join>',
      '<replace_vars>', '<sql_fieldname>', '<query_only_on_change>'],
    'DynamicSQLRow');
  let parsed = parser.parse(block);
  assert.ok(!parsed.step.parameter,
    'DynamicSQLRow template must not invent a <parameter> list');
  let file = minimalKtr('b61-dynamicsqlrow');
  addElement(file, 'DynamicSQLRow', 'Run dynamic lookup');
  setFieldPath(file, 'Run dynamic lookup', 'connection', '${CONN}');
  setFieldPath(file, 'Run dynamic lookup', 'sql_fieldname', 'ROW_SQL');
  setFieldPath(file, 'Run dynamic lookup', 'rowlimit', '1');
  setFieldPath(file, 'Run dynamic lookup', 'outer_join', 'Y');
  setFieldPath(file, 'Run dynamic lookup', 'query_only_on_change', 'Y');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<sql_fieldname>ROW_SQL<\/sql_fieldname>/);
  assert.match(after, /<query_only_on_change>Y<\/query_only_on_change>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // FuzzyMatchMeta.getXML() (515-543): from (info-step NAME), lookupfield,
  // mainstreamfield, outputmatchfield, outputvaluefield, caseSensitive,
  // closervalue, minimalValue, maximalValue, separator, algorithm code,
  // always-emitted paired <lookup>.
  ref = getReference('trans', 'FuzzyMatch');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<from>', '<lookupfield>', '<mainstreamfield>', '<outputmatchfield>',
      '<outputvaluefield>', '<caseSensitive>', '<closervalue>',
      '<minimalValue>', '<maximalValue>', '<separator>', '<algorithm>',
      '<lookup>'],
    'FuzzyMatch');
  assert.ok(block.includes('</lookup>'),
    'FuzzyMatch template must carry a paired <lookup> wrapper per getXML()');
  parsed = parser.parse(block);
  assert.equal(parsed.step.algorithm, 'levenshtein');
  file = minimalKtr('b61-fuzzymatch');
  addElement(file, 'FuzzyMatch', 'Match customers');
  setFieldPath(file, 'Match customers', 'lookupfield', 'CUST_NAME');
  setFieldPath(file, 'Match customers', 'mainstreamfield', 'INPUT_NAME');
  setFieldPath(file, 'Match customers', 'caseSensitive', 'Y');
  setFieldPath(file, 'Match customers', 'algorithm', 'jarowinkler');
  setFields(file, 'Match customers', 'lookup', 'value', [
    { name: 'CUST_NAME', rename: 'CUSTOMER_NAME' },
    { name: 'CUST_ID', rename: 'CUSTOMER_ID' },
  ]);
  after = readFileSync(file, 'utf8');
  assert.match(after, /<algorithm>jarowinkler<\/algorithm>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Match customers');
  const items = Array.isArray(step.lookup.value) ? step.lookup.value : [step.lookup.value];
  assert.equal(items.length, 2);
  assert.equal(items[0].rename, 'CUSTOMER_NAME');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans WebServiceLookup keeps fieldsIn/fieldsOut apart; compatible defaults true', () => {
  // WebServiceMeta.getXML() (201-257): 17 ws* scalars, then <fieldsIn> and
  // <fieldsOut> (name, wsName, xsdType). compatible missing/empty loads TRUE.
  const ref = getReference('trans', 'WebServiceLookup');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<wsURL>', '<wsOperation>', '<wsOperationRequest>',
      '<wsOperationNamespace>', '<wsInFieldContainer>', '<wsInFieldArgument>',
      '<wsOutFieldContainer>', '<wsOutFieldArgument>', '<proxyHost>',
      '<proxyPort>', '<httpLogin>', '<httpPassword>', '<callStep>',
      '<passingInputData>', '<compatible>', '<repeating_element>',
      '<reply_as_string>', '<fieldsIn>', '<fieldsOut>'],
    'WebServiceLookup');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.callStep, 1000);
  assert.equal(parsed.step.compatible, 'Y');

  const file = minimalKtr('b61-wslookup');
  addElement(file, 'WebServiceLookup', 'Call pricing');
  setFieldPath(file, 'Call pricing', 'wsURL', '${WS_URL}');
  setFieldPath(file, 'Call pricing', 'wsOperation', 'getPrice');
  setFieldPath(file, 'Call pricing', 'httpLogin', '${WS_USER}');
  setFieldPath(file, 'Call pricing', 'httpPassword', '${WS_PASSWORD}');
  setFieldPath(file, 'Call pricing', 'callStep', '100');
  setFields(file, 'Call pricing', 'fieldsIn', 'field', [
    { name: 'CUSTOMER_ID', wsName: 'customerId', xsdType: 'int' },
    { name: 'COUNTRY', wsName: 'countryCode', xsdType: 'string' },
  ]);
  setFields(file, 'Call pricing', 'fieldsOut', 'field', [
    { name: 'PRICE', wsName: 'price', xsdType: 'double' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<callStep>100<\/callStep>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Call pricing');
  const inItems = Array.isArray(step.fieldsIn.field) ? step.fieldsIn.field : [step.fieldsIn.field];
  const outItems = Array.isArray(step.fieldsOut.field) ? step.fieldsOut.field : [step.fieldsOut.field];
  assert.equal(inItems.length, 2);
  assert.equal(inItems[0].wsName, 'customerId');
  assert.equal(outItems.length, 1);
  assert.equal(outItems[0].name, 'PRICE');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans WebServiceAvailable reads the URL from a field; GetTableNames lists objects', () => {
  // WebServiceAvailableMeta.getXML() (148-156): urlField (DYNAMIC!),
  // readTimeOut BEFORE connectTimeOut, resultfieldname.
  let ref = getReference('trans', 'WebServiceAvailable');
  let block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<urlField>', '<readTimeOut>', '<connectTimeOut>', '<resultfieldname>'],
    'WebServiceAvailable');
  let parsed = parser.parse(block);
  assert.equal(parsed.step.resultfieldname, 'result');
  assert.ok(!parsed.step.url,
    'WebServiceAvailable template must not invent a static <url> tag');
  let file = minimalKtr('b61-wsavailable');
  addElement(file, 'WebServiceAvailable', 'Probe endpoints');
  setFieldPath(file, 'Probe endpoints', 'urlField', 'ENDPOINT_URL');
  setFieldPath(file, 'Probe endpoints', 'readTimeOut', '30000');
  setFieldPath(file, 'Probe endpoints', 'connectTimeOut', '10000');
  setFieldPath(file, 'Probe endpoints', 'resultfieldname', 'IS_AVAILABLE');
  let after = readFileSync(file, 'utf8');
  assert.match(after, /<urlField>ENDPOINT_URL<\/urlField>/);
  assert.match(after, /<resultfieldname>IS_AVAILABLE<\/resultfieldname>/);
  assert.equal(validateFile(file).summary.errors, 0);

  // GetTableNamesMeta.getXML() (359-380): connection, schemaname, 4
  // *fieldname, 8 flags, schemaNameField.
  ref = getReference('trans', 'GetTableNames');
  block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<connection>', '<schemaname>', '<tablenamefieldname>',
      '<objecttypefieldname>', '<issystemobjectfieldname>',
      '<sqlcreationfieldname>', '<includeCatalog>', '<includeSchema>',
      '<includeTable>', '<includeView>', '<includeProcedure>',
      '<includeSynonym>', '<addSchemaInOutput>', '<dynamicSchema>',
      '<schemaNameField>'],
    'GetTableNames');
  parsed = parser.parse(block);
  assert.equal(parsed.step.tablenamefieldname, 'tablename');
  assert.equal(parsed.step.includeTable, 'Y');
  assert.ok(!block.includes('schenameNameField'),
    'GetTableNames template must not use the legacy 7.0 typo tag');
  file = minimalKtr('b61-gettablenames');
  addElement(file, 'GetTableNames', 'List views');
  setFieldPath(file, 'List views', 'connection', '${CONN}');
  setFieldPath(file, 'List views', 'schemaname', '${SCHEMA}');
  setFieldPath(file, 'List views', 'includeTable', 'N');
  setFieldPath(file, 'List views', 'sqlcreationfieldname', 'ddl_statement');
  setFieldPath(file, 'List views', 'dynamicSchema', 'Y');
  setFieldPath(file, 'List views', 'schemaNameField', 'SCHEMA_NAME');
  after = readFileSync(file, 'utf8');
  assert.match(after, /<dynamicSchema>Y<\/dynamicSchema>/);
  assert.match(after, /<schemaNameField>SCHEMA_NAME<\/schemaNameField>/);
  assert.match(after, /<connection>\$\{CONN\}<\/connection>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('trans MultiwayMergeJoin uses dynamic stepN tags and a keys list', () => {
  // MultiMergeJoinMeta.getXML() (148-165): join_type, DYNAMIC step0..stepN,
  // number_input (parse has NO null-guard), <keys>/<key>.
  const ref = getReference('trans', 'MultiwayMergeJoin');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<join_type>', '<step0>', '<step1>', '<number_input>', '<keys>'],
    'MultiwayMergeJoin');
  assert.ok(!block.includes('<steps>'),
    'MultiwayMergeJoin must not invent a <steps> wrapper (tags are dynamic stepN)');
  const parsed = parser.parse(block);
  assert.equal(parsed.step.join_type, 'INNER');
  assert.equal(parsed.step.number_input, 2);

  const file = minimalKtr('b61-multimerges');
  addElement(file, 'MultiwayMergeJoin', 'Merge regions');
  setFieldPath(file, 'Merge regions', 'join_type', 'FULL OUTER');
  setFields(file, 'Merge regions', 'keys', 'key', [
    { key: 'REGION_ID' },
    { key: 'YEAR_NO' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<join_type>FULL OUTER<\/join_type>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Merge regions');
  const keys = Array.isArray(step.keys.key) ? step.keys.key : [step.keys.key];
  assert.equal(keys.length, 2);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B6-1 package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b61-package.ktr');
  const transSteps = BATCH.filter((b) => b.kind === 'trans')
    .map((b) => `<step><name>${b.xmlType} step</name><type>${b.xmlType}</type></step>`)
    .join('');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b61-package</name></info>',
    transSteps,
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b61-package.kjb');
  const jobEntries = BATCH.filter((b) => b.kind === 'job')
    .map((b) => `<entry><name>${b.xmlType} entry</name><type>${b.xmlType}</type></entry>`)
    .join('');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b61-package</name><entries>',
    jobEntries,
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
