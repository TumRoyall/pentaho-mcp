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

// Batch B6-2 (services/directory/scripting/stats/file-utility): 29 trans +
// 3 job (32 IDs). The 4 Palo steps once scoped here are now covered at the
// `observed` level by B7c (deprecated) and are excluded from this batch.
// Source: pentaho-kettle @
// 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b6-2-source-notes.md.
//
// Families:
// - Salesforce (5 trans): Input/Insert/Update/Upsert/Delete share
//   SalesforceStepMeta (targeturl/username/password/timeout/useCompression/
//   module). No <connection>.
// - Crypto/PGP (4 trans + 3 job): PGPEncryptStream, PGPDecryptStream
//   (typo tag <passhrase>), SymmetricCryptoTrans (encrypt/decrypt codes),
//   SecretKeyGenerator (<fields> first + duplicate <algorithmFieldName> emit
//   in source), job PGP_ENCRYPT/DECRYPT/VERIFY_FILES.
// - LDAP + Access + LDIF (5 trans): LDAPInput (typo <dynamicseachfieldname>),
//   LDAPOutput (<update> missing => TRUE, <searchBase> capital B),
//   LDIFInput + AccessInput (flat <file> block, <attribut> no e),
//   AccessOutput (<table>, no <fields>).
// - Palo (4 trans, DEPRECATED): CellInput/CellOutput/DimInput/DimOutput are
//   now covered by B7c at the `observed` level and are NOT part of this batch.
// - Scripting/rules (5 trans): Janino (<formula> direct), JavaFilter
//   (send_true_to/send_false_to + condition), UserDefinedJavaClass (6 blocks,
//   <clear_result_fields> missing => TRUE), RuleAccumulator/RuleExecutor
//   (hyphen tags column-name/rule-file).
// - Statistics/sampling (5 trans): SampleRows, ReservoirSampling
//   (<reservoir_sampling> wrapper), UnivariateStats (<univariate_stats>
//   direct, every flag tag required), StepsMetrics (<steps>/<step> nested),
//   FieldsChangeSequence (<resultfieldName> camelCase).
// - File/lock/process utility (5 trans): FileExists (+filetype pair),
//   FileLocked (3 tags only), ExecProcess (<argumentFields> nesting),
//   ZipFile (operation_type ""/move/delete), ChangeFileEncoding (missing-e
//   tags addsourceresultfilenames/addtargetresultfilenames).
// Credentials/keys/hosts are always ${VAR} placeholders.
const BATCH = [
  { kind: 'trans', xmlType: 'SalesforceInput' },
  { kind: 'trans', xmlType: 'SalesforceInsert' },
  { kind: 'trans', xmlType: 'SalesforceUpdate' },
  { kind: 'trans', xmlType: 'SalesforceUpsert' },
  { kind: 'trans', xmlType: 'SalesforceDelete' },
  { kind: 'trans', xmlType: 'PGPEncryptStream' },
  { kind: 'trans', xmlType: 'PGPDecryptStream' },
  { kind: 'trans', xmlType: 'SymmetricCryptoTrans' },
  { kind: 'trans', xmlType: 'SecretKeyGenerator' },
  { kind: 'job', xmlType: 'PGP_ENCRYPT_FILES' },
  { kind: 'job', xmlType: 'PGP_DECRYPT_FILES' },
  { kind: 'job', xmlType: 'PGP_VERIFY_FILES' },
  { kind: 'trans', xmlType: 'LDAPInput' },
  { kind: 'trans', xmlType: 'LDAPOutput' },
  { kind: 'trans', xmlType: 'LDIFInput' },
  { kind: 'trans', xmlType: 'AccessInput' },
  { kind: 'trans', xmlType: 'AccessOutput' },
  // Palo (4 trans) removed from B6-2 scope: they are now covered at the
  // `observed` level by B7c (deprecated). See
  // docs/inventory/2026-09-15-b7c-source-notes.md. B6-2 scope is now 32 IDs.
  { kind: 'trans', xmlType: 'Janino' },
  { kind: 'trans', xmlType: 'JavaFilter' },
  { kind: 'trans', xmlType: 'UserDefinedJavaClass' },
  { kind: 'trans', xmlType: 'RuleAccumulator' },
  { kind: 'trans', xmlType: 'RuleExecutor' },
  { kind: 'trans', xmlType: 'SampleRows' },
  { kind: 'trans', xmlType: 'ReservoirSampling' },
  { kind: 'trans', xmlType: 'UnivariateStats' },
  { kind: 'trans', xmlType: 'StepsMetrics' },
  { kind: 'trans', xmlType: 'FieldsChangeSequence' },
  { kind: 'trans', xmlType: 'FileExists' },
  { kind: 'trans', xmlType: 'FileLocked' },
  { kind: 'trans', xmlType: 'ExecProcess' },
  { kind: 'trans', xmlType: 'ZipFile' },
  { kind: 'trans', xmlType: 'ChangeFileEncoding' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` appears in `block` after the previous one,
// mirroring the emission order of the source getXML().
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b6-2-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b6-2', withConnection = false) {
  const file = path.join(tmp, `${name}.ktr`);
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    `  <info><name>${name}</name></info>`,
    ...(withConnection ? ['  <connection><name>${CONN}</name></connection>'] : []),
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

function stepsOf(reparsed) {
  const s = reparsed.transformation.step;
  return Array.isArray(s) ? s : [s];
}

function entriesOf(reparsed) {
  const e = reparsed.job.entries.entry;
  return Array.isArray(e) ? e : [e];
}

test('B6-2 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
  assert.equal(BATCH.length, 32, 'B6-2 scope is 32 IDs (Palo moved to B7c observed)');
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

test('B6-2 references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    if (kind === 'trans') {
      assert.ok(parsed.step, `${ref.file}: root should be <step>`);
      // Direct-child <type> (not a nested field <type> such as
      // SalesforceInput's <fields>/<field>/<type> or the nested <step>
      // items of StepsMetrics).
      assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
    } else {
      assert.ok(parsed.entry, `${ref.file}: root should be <entry>`);
      assert.equal(parsed.entry.type, xmlType, `${ref.file}: direct-child <type>`);
    }
  }
});

test('B6-2 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType, needsConnection } of BATCH) {
    const file = kind === 'job'
      ? freshKjb(`b6-2-${xmlType.toLowerCase()}`)
      : minimalKtr(`b6-2-${xmlType.toLowerCase()}`, needsConnection === true);
    const out = addElement(file, xmlType, `New ${xmlType} & <Item>`);
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0, `${xmlType} validates clean`);
    assert.equal(out.catalogStatus, 'canonical');
    assert.equal(out.manualReviewRequired, false);
  }
});

test('Salesforce family follows SalesforceStepMeta + per-class getXML order', () => {
  // Superclass order (SalesforceStepMeta.getXML lines 76-86): targeturl,
  // username, password, timeout, useCompression, module.
  const input = getReference('trans', 'SalesforceInput');
  const inputBlock = firstFencedXml(input.content);
  assertTagOrder(inputBlock,
    ['<targeturl>', '<username>', '<password>', '<timeout>', '<useCompression>', '<module>',
      '<condition>', '<specifyQuery>', '<query>', '<include_targeturl>', '<records_filter>',
      '<queryAll>', '<fields>', '<limit>'],
    'SalesforceInput');
  // include_Timestamp keeps its capital T (line 512).
  assert.ok(/<include_Timestamp>/.test(inputBlock), 'include_Timestamp capital T');
  assert.ok(!/<connection(?:\s|\/?>)/.test(inputBlock), 'no <connection> (own credentials)');
  const inputParsed = parser.parse(inputBlock);
  const inField = inputParsed.step.fields.field;
  for (const tag of ['name', 'field', 'idlookup', 'type', 'trim_type', 'repeat']) {
    assert.ok(hasOwn(inField, tag), `SalesforceInput field carries <${tag}>`);
  }

  // Non-default: specified query + updated filter + row limit.
  // NOTE: setFields()/setFieldPath() cannot drive <fields>/<field> items here
  // — the item tag <field> collides with the child tag <field> (source column),
  // which breaks the edit span logic (writes land inside the wrong element).
  // Item mapping is asserted from the reference template above; API writes use
  // step-level scalars only.
  const file = minimalKtr('b6-2-sfinput');
  addElement(file, 'SalesforceInput', 'Read accounts');
  setFieldPath(file, 'Read accounts', 'specifyQuery', 'Y');
  setFieldPath(file, 'Read accounts', 'query', 'SELECT Id, Name FROM Account');
  setFieldPath(file, 'Read accounts', 'records_filter', 'updated');
  setFieldPath(file, 'Read accounts', 'limit', '1000');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<specifyQuery>Y<\/specifyQuery>/);
  assert.match(after, /<records_filter>updated<\/records_filter>/);
  assert.match(after, /<limit>1000<\/limit>/);
  const reparsed = parser.parse(after);
  const step = stepsOf(reparsed).find((s) => s.name === 'Read accounts');
  assert.equal(step.specifyQuery, 'Y');
  // repeat MUST be present on every template field (missing => TRUE pitfall).
  assert.ok(hasOwn(step.fields.field, 'repeat'), 'repeat present (NPE guard)');
  assert.equal(validateFile(file).summary.errors, 0);

  // Insert: batchSize, salesforceIDFieldName, fields(name/field/useExternalId),
  // rollbackAllChangesOnError.
  const insertBlock = firstFencedXml(getReference('trans', 'SalesforceInsert').content);
  assertTagOrder(insertBlock,
    ['<batchSize>', '<salesforceIDFieldName>', '<fields>', '<rollbackAllChangesOnError>'],
    'SalesforceInsert');
  const f2 = minimalKtr('b6-2-sfinsert');
  addElement(f2, 'SalesforceInsert', 'Insert accounts');
  setFieldPath(f2, 'Insert accounts', 'batchSize', '200');
  setFieldPath(f2, 'Insert accounts', 'salesforceIDFieldName', 'NEW_ID');
  setFieldPath(f2, 'Insert accounts', 'rollbackAllChangesOnError', 'Y');
  const after2 = readFileSync(f2, 'utf8');
  assert.match(after2, /<batchSize>200<\/batchSize>/);
  assert.match(after2, /<salesforceIDFieldName>NEW_ID<\/salesforceIDFieldName>/);
  assert.match(after2, /<rollbackAllChangesOnError>Y<\/rollbackAllChangesOnError>/);
  const r2 = parser.parse(after2);
  const s2 = stepsOf(r2).find((s) => s.name === 'Insert accounts');
  for (const tag of ['name', 'field', 'useExternalId']) {
    assert.ok(hasOwn(s2.fields.field, tag), `template mapping item carries <${tag}>`);
  }
  assert.equal(validateFile(f2).summary.errors, 0);

  // Update has NO salesforceIDFieldName (differs from Insert/Upsert).
  const updateBlock = firstFencedXml(getReference('trans', 'SalesforceUpdate').content);
  assertTagOrder(updateBlock, ['<batchSize>', '<fields>', '<rollbackAllChangesOnError>'], 'SalesforceUpdate');
  assert.ok(!/<salesforceIDFieldName(?:\s|\/?>)/.test(updateBlock), 'Update has no salesforceIDFieldName');
  const f3 = minimalKtr('b6-2-sfupdate');
  addElement(f3, 'SalesforceUpdate', 'Update accounts');
  setFieldPath(f3, 'Update accounts', 'batchSize', '200');
  setFieldPath(f3, 'Update accounts', 'rollbackAllChangesOnError', 'Y');
  const r3 = parser.parse(readFileSync(f3, 'utf8'));
  const s3 = stepsOf(r3).find((s) => s.name === 'Update accounts');
  assert.equal(String(s3.batchSize), '200');
  for (const tag of ['name', 'field', 'useExternalId']) {
    assert.ok(hasOwn(s3.fields.field, tag), `template mapping item carries <${tag}>`);
  }
  assert.equal(validateFile(f3).summary.errors, 0);

  // Upsert: lowercase <upsertfield> first.
  const upsertBlock = firstFencedXml(getReference('trans', 'SalesforceUpsert').content);
  assertTagOrder(upsertBlock,
    ['<upsertfield>', '<batchSize>', '<salesforceIDFieldName>', '<fields>', '<rollbackAllChangesOnError>'],
    'SalesforceUpsert');
  const f4 = minimalKtr('b6-2-sfupsert');
  addElement(f4, 'SalesforceUpsert', 'Upsert accounts');
  setFieldPath(f4, 'Upsert accounts', 'upsertfield', 'External_Id__c');
  setFieldPath(f4, 'Upsert accounts', 'batchSize', '200');
  setFieldPath(f4, 'Upsert accounts', 'salesforceIDFieldName', 'NEW_ID');
  const r4u = parser.parse(readFileSync(f4, 'utf8'));
  const s4u = stepsOf(r4u).find((s) => s.name === 'Upsert accounts');
  assert.equal(s4u.upsertfield, 'External_Id__c');
  for (const tag of ['name', 'field', 'useExternalId']) {
    assert.ok(hasOwn(s4u.fields.field, tag), `template mapping item carries <${tag}>`);
  }
  assert.match(readFileSync(f4, 'utf8'), /<upsertfield>External_Id__c<\/upsertfield>/);
  assert.equal(validateFile(f4).summary.errors, 0);

  // Delete: capital <DeleteField>, NO <fields> block.
  const deleteBlock = firstFencedXml(getReference('trans', 'SalesforceDelete').content);
  assertTagOrder(deleteBlock,
    ['<DeleteField>', '<batchSize>', '<rollbackAllChangesOnError>'], 'SalesforceDelete');
  assert.ok(!/<fields(?:\s|\/?>)/.test(deleteBlock), 'Delete has no <fields>');
  const f5 = minimalKtr('b6-2-sfdelete');
  addElement(f5, 'SalesforceDelete', 'Delete accounts');
  setFieldPath(f5, 'Delete accounts', 'DeleteField', 'SF_ID');
  setFieldPath(f5, 'Delete accounts', 'batchSize', '200');
  assert.match(readFileSync(f5, 'utf8'), /<DeleteField>SF_ID<\/DeleteField>/);
  assert.equal(validateFile(f5).summary.errors, 0);
});

test('Crypto trans family follows source getXML order with typo/code pitfalls', () => {
  // PGPEncryptStream: gpglocation, keyname, keynameInField, keynameFieldName,
  // streamfield, resultfieldname.
  const encBlock = firstFencedXml(getReference('trans', 'PGPEncryptStream').content);
  assertTagOrder(encBlock,
    ['<gpglocation>', '<keyname>', '<keynameInField>', '<keynameFieldName>', '<streamfield>', '<resultfieldname>'],
    'PGPEncryptStream');
  const f1 = minimalKtr('b6-2-pgpe');
  addElement(f1, 'PGPEncryptStream', 'Encrypt rows');
  setFieldPath(f1, 'Encrypt rows', 'keynameInField', 'Y');
  setFieldPath(f1, 'Encrypt rows', 'keynameFieldName', 'RECIPIENT_KEY');
  setFieldPath(f1, 'Encrypt rows', 'streamfield', 'MESSAGE');
  assert.match(readFileSync(f1, 'utf8'), /<keynameInField>Y<\/keynameInField>/);
  assert.equal(validateFile(f1).summary.errors, 0);

  // PGPDecryptStream: typo <passhrase> (one s) — never <passphrase>.
  const decBlock = firstFencedXml(getReference('trans', 'PGPDecryptStream').content);
  assertTagOrder(decBlock,
    ['<gpglocation>', '<passhrase>', '<streamfield>', '<resultfieldname>', '<passphraseFromField>', '<passphraseFieldName>'],
    'PGPDecryptStream');
  assert.ok(!/<passphrase(?:\s|\/?>)/.test(decBlock), 'keeps source typo <passhrase>');
  const f2 = minimalKtr('b6-2-pgpd');
  addElement(f2, 'PGPDecryptStream', 'Decrypt rows');
  setFieldPath(f2, 'Decrypt rows', 'passphraseFromField', 'Y');
  setFieldPath(f2, 'Decrypt rows', 'passphraseFieldName', 'ROW_PASSPHRASE');
  assert.match(readFileSync(f2, 'utf8'), /<passphraseFromField>Y<\/passphraseFromField>/);
  assert.equal(validateFile(f2).summary.errors, 0);

  // SymmetricCryptoTrans: string codes encrypt/decrypt; secretKey encrypted.
  const symBlock = firstFencedXml(getReference('trans', 'SymmetricCryptoTrans').content);
  assertTagOrder(symBlock,
    ['<operation_type>', '<algorithm>', '<schema>', '<secretKeyField>', '<messageField>',
      '<resultfieldname>', '<secretKey>', '<secretKeyInField>', '<readKeyAsBinary>', '<outputResultAsBinary>'],
    'SymmetricCryptoTrans');
  const f3 = minimalKtr('b6-2-symm');
  addElement(f3, 'SymmetricCryptoTrans', 'Decrypt secret');
  setFieldPath(f3, 'Decrypt secret', 'operation_type', 'decrypt');
  setFieldPath(f3, 'Decrypt secret', 'algorithm', 'AES');
  setFieldPath(f3, 'Decrypt secret', 'secretKeyInField', 'Y');
  setFieldPath(f3, 'Decrypt secret', 'secretKeyField', 'ROW_KEY');
  setFieldPath(f3, 'Decrypt secret', 'outputResultAsBinary', 'Y');
  const a3 = readFileSync(f3, 'utf8');
  assert.match(a3, /<operation_type>decrypt<\/operation_type>/);
  assert.match(a3, /<outputResultAsBinary>Y<\/outputResultAsBinary>/);
  assert.equal(validateFile(f3).summary.errors, 0);

  // SecretKeyGenerator: <fields> FIRST, then output names + outputKeyInBinary.
  // Template keeps ONE <algorithmFieldName> (source emits it twice).
  const genBlock = firstFencedXml(getReference('trans', 'SecretKeyGenerator').content);
  assertTagOrder(genBlock,
    ['<fields>', '<secretKeyFieldName>', '<secretKeyLengthFieldName>', '<algorithmFieldName>', '<outputKeyInBinary>'],
    'SecretKeyGenerator');
  assert.equal((genBlock.match(/<algorithmFieldName>/g) || []).length, 1,
    'template keeps a single <algorithmFieldName>');
  const genParsed = parser.parse(genBlock);
  const gField = genParsed.step.fields.field;
  for (const tag of ['algorithm', 'scheme', 'secretKeyLen', 'secretKeyCount']) {
    assert.ok(hasOwn(gField, tag), `key <field> carries <${tag}> (note secretKeyLen)`);
  }
  const f4 = minimalKtr('b6-2-skeygen');
  addElement(f4, 'SecretKeyGenerator', 'Make keys');
  setFields(f4, 'Make keys', 'fields', 'field', [
    {
      algorithm: 'DES', scheme: 'DES', secretKeyLen: '56', secretKeyCount: '1',
    },
    {
      algorithm: 'AES', scheme: 'AES', secretKeyLen: '256', secretKeyCount: '2',
    },
  ]);
  setFieldPath(f4, 'Make keys', 'outputKeyInBinary', 'Y');
  const r4 = parser.parse(readFileSync(f4, 'utf8'));
  const s4 = stepsOf(r4).find((s) => s.name === 'Make keys');
  const g4 = Array.isArray(s4.fields.field) ? s4.fields.field : [s4.fields.field];
  assert.equal(g4.length, 2);
  assert.equal(String(g4[1].secretKeyLen), '256', 'secretKeyLen round-trips (parser yields a number)');
  assert.equal(validateFile(f4).summary.errors, 0);
});

test('Job PGP entries follow source getXML order with paired <fields>', () => {
  // Encrypt: ... asciiMode, then fields(action_type/userid/...).
  const encBlock = firstFencedXml(getReference('job', 'PGP_ENCRYPT_FILES').content);
  assertTagOrder(encBlock,
    ['<gpglocation>', '<arg_from_previous>', '<nr_errors_less_than>', '<success_condition>',
      '<iffileexists>', '<asciiMode>', '<fields>'],
    'PGP_ENCRYPT_FILES');
  const encParsed = parser.parse(encBlock);
  const encField = encParsed.entry.fields.field;
  for (const tag of ['action_type', 'source_filefolder', 'userid', 'destination_filefolder', 'wildcard']) {
    assert.ok(hasOwn(encField, tag), `encrypt <field> carries <${tag}>`);
  }
  const f1 = freshKjb('b6-2-pgpef');
  addElement(f1, 'PGP_ENCRYPT_FILES', 'Encrypt files');
  setFieldPath(f1, 'Encrypt files', 'asciiMode', 'Y');
  setFieldPath(f1, 'Encrypt files', 'iffileexists', 'overwrite_file');
  setFields(f1, 'Encrypt files', 'fields', 'field', [
    {
      action_type: 'signandencrypt', source_filefolder: '${SOURCE_FILE}', userid: '${PGP_KEY_USER}', destination_filefolder: '${DEST_FILE}', wildcard: '.*\\.csv',
    },
  ]);
  const a1 = readFileSync(f1, 'utf8');
  assert.match(a1, /<action_type>signandencrypt<\/action_type>/);
  assert.match(a1, /<asciiMode>Y<\/asciiMode>/);
  assert.equal(validateFile(f1).summary.errors, 0);

  // Decrypt: same scalar order, NO asciiMode/action_type/userid; per-field
  // <passphrase> (correct spelling here, unlike the stream step).
  const decBlock = firstFencedXml(getReference('job', 'PGP_DECRYPT_FILES').content);
  assertTagOrder(decBlock,
    ['<gpglocation>', '<arg_from_previous>', '<nr_errors_less_than>', '<success_condition>',
      '<iffileexists>', '<fields>'],
    'PGP_DECRYPT_FILES');
  assert.ok(!/<asciiMode(?:\s|\/?>)/.test(decBlock), 'decrypt has no asciiMode');
  assert.ok(!/<action_type(?:\s|\/?>)/.test(decBlock), 'decrypt has no action_type');
  const f2 = freshKjb('b6-2-pgpdf');
  addElement(f2, 'PGP_DECRYPT_FILES', 'Decrypt files');
  setFields(f2, 'Decrypt files', 'fields', 'field', [
    {
      source_filefolder: '${SOURCE_FILE}', passphrase: '${PGP_PASSPHRASE}', destination_filefolder: '${DEST_FILE}', wildcard: '.*\\.gpg',
    },
  ]);
  const r2 = parser.parse(readFileSync(f2, 'utf8'));
  const e2 = entriesOf(r2).find((e) => e.name === 'Decrypt files');
  assert.ok(hasOwn(e2.fields.field, 'passphrase'), 'decrypt field carries <passphrase>');
  assert.equal(validateFile(f2).summary.errors, 0);

  // Verify: exactly 4 plugin tags, no <fields>.
  const verBlock = firstFencedXml(getReference('job', 'PGP_VERIFY_FILES').content);
  assertTagOrder(verBlock,
    ['<gpglocation>', '<filename>', '<detachedfilename>', '<useDetachedSignature>'],
    'PGP_VERIFY_FILES');
  assert.ok(!/<fields(?:\s|\/?>)/.test(verBlock), 'verify has no <fields>');
  const f3 = freshKjb('b6-2-pgpvf');
  addElement(f3, 'PGP_VERIFY_FILES', 'Verify file');
  setFieldPath(f3, 'Verify file', 'detachedfilename', '${SIG_FILE}');
  setFieldPath(f3, 'Verify file', 'useDetachedSignature', 'Y');
  assert.match(readFileSync(f3, 'utf8'), /<useDetachedSignature>Y<\/useDetachedSignature>/);
  assert.equal(validateFile(f3).summary.errors, 0);
});

test('LDAP/Access/LDIF family follows source order with typo-tag pitfalls', () => {
  // LDAPInput: paging/auth/host block, fields, limit block, scope/protocol/TLS.
  // Typo <dynamicseachfieldname> (missing r) must be kept verbatim.
  const liBlock = firstFencedXml(getReference('trans', 'LDAPInput').content);
  assertTagOrder(liBlock,
    ['<usepaging>', '<useauthentication>', '<host>', '<port>', '<filterstring>', '<searchbase>',
      '<fields>', '<limit>', '<timelimit>', '<dynamicseachfieldname>', '<searchScope>', '<protocol>',
      '<useCertificate>'],
    'LDAPInput');
  assert.ok(/<dynamicseachfieldname(?:\s|\/?)>/.test(liBlock), 'keeps typo <dynamicseachfieldname> (self-closing in template)');
  const f1 = minimalKtr('b6-2-ldapin');
  addElement(f1, 'LDAPInput', 'Read directory');
  setFields(f1, 'Read directory', 'fields', 'field', [
    {
      name: 'FULL_NAME', attribute: 'cn', attribute_fetch_as: 'string', sorted_key: 'N', type: 'String', format: '', length: '255', precision: '-1', currency: '', decimal: '', group: '', trim_type: 'both', repeat: 'N',
    },
    {
      name: 'PHOTO', attribute: 'jpegPhoto', attribute_fetch_as: 'binary', sorted_key: 'N', type: 'Binary', format: '', length: '-1', precision: '-1', currency: '', decimal: '', group: '', trim_type: 'none', repeat: 'N',
    },
  ]);
  setFieldPath(f1, 'Read directory', 'searchScope', 'onelevel');
  setFieldPath(f1, 'Read directory', 'limit', '500');
  const r1 = parser.parse(readFileSync(f1, 'utf8'));
  const s1 = stepsOf(r1).find((s) => s.name === 'Read directory');
  const l1 = Array.isArray(s1.fields.field) ? s1.fields.field : [s1.fields.field];
  assert.equal(l1.length, 2);
  assert.equal(l1[1].attribute_fetch_as, 'binary');
  assert.equal(validateFile(f1).summary.errors, 0);

  // LDAPOutput: <searchBase> capital B; <update> missing => TRUE so the
  // template pins it explicitly.
  const loBlock = firstFencedXml(getReference('trans', 'LDAPOutput').content);
  assertTagOrder(loBlock,
    ['<dnFieldName>', '<failIfNotExist>', '<operationType>', '<searchBase>', '<referralType>',
      '<derefAliasesType>', '<fields>', '<protocol>', '<useCertificate>'],
    'LDAPOutput');
  assert.ok(/<searchBase>/.test(loBlock), '<searchBase> capital B');
  const f2 = minimalKtr('b6-2-ldapout');
  addElement(f2, 'LDAPOutput', 'Rename entry');
  setFieldPath(f2, 'Rename entry', 'operationType', 'rename');
  setFieldPath(f2, 'Rename entry', 'dnFieldName', 'DN');
  setFieldPath(f2, 'Rename entry', 'oldDnFieldName', 'OLD_DN');
  setFieldPath(f2, 'Rename entry', 'newDnFieldName', 'NEW_DN');
  setFieldPath(f2, 'Rename entry', 'deleteRDN', 'Y');
  const r2 = parser.parse(readFileSync(f2, 'utf8'));
  const s2 = stepsOf(r2).find((s) => s.name === 'Rename entry');
  assert.equal(s2.operationType, 'rename');
  assert.equal(s2.newDnFieldName, 'NEW_DN');
  // <update> is pinned on the template item (missing => TRUE pitfall).
  assert.ok(hasOwn(s2.fields.field, 'update'), '<update> pinned (missing => TRUE)');
  assert.equal(validateFile(f2).summary.errors, 0);

  // LDIFInput: flat <file> block (parallel tags, counted by <name>) then
  // paired <fields> with <attribut> (no e); <repeat> missing => TRUE.
  const ldBlock = firstFencedXml(getReference('trans', 'LDIFInput').content);
  assertTagOrder(ldBlock,
    ['<filefield>', '<dn_field>', '<dn>', '<multiValuedSeparator>', '<file>', '<fields>', '<limit>'],
    'LDIFInput');
  assert.ok(/<attribut>/.test(ldBlock), 'field tag is <attribut> (no e)');
  const ldParsed = parser.parse(ldBlock);
  assert.ok(ldParsed.step.file, 'flat <file> block present (not <field> items)');
  assert.ok(!ldParsed.step.file.field, 'file block must not wrap items in <field>');
  const f3 = minimalKtr('b6-2-ldif');
  addElement(f3, 'LDIFInput', 'Read ldif');
  setFieldPath(f3, 'Read ldif', 'dn', 'Y');
  setFieldPath(f3, 'Read ldif', 'dn_field', 'ENTRY_DN');
  setFieldPath(f3, 'Read ldif', 'limit', '1000');
  setFields(f3, 'Read ldif', 'fields', 'field', [
    {
      name: 'COMMON_NAME', attribut: 'cn', type: 'String', format: '', currency: '', decimal: '', group: '', length: '255', precision: '-1', trim_type: 'both', repeat: 'N',
    },
  ]);
  const r3 = parser.parse(readFileSync(f3, 'utf8'));
  const s3 = stepsOf(r3).find((s) => s.name === 'Read ldif');
  assert.ok(hasOwn(s3.fields.field, 'repeat'), 'repeat pinned (missing => TRUE)');
  assert.equal(validateFile(f3).summary.errors, 0);

  // AccessInput: <filename_Field> capital F; <isaddresult> missing => TRUE.
  const aiBlock = firstFencedXml(getReference('trans', 'AccessInput').content);
  assertTagOrder(aiBlock,
    ['<filename_Field>', '<isaddresult>', '<filefield>', '<table_name>', '<file>', '<fields>', '<limit>'],
    'AccessInput');
  const f4 = minimalKtr('b6-2-accessin');
  addElement(f4, 'AccessInput', 'Read mdb');
  setFieldPath(f4, 'Read mdb', 'filefield', 'Y');
  setFieldPath(f4, 'Read mdb', 'filename_Field', 'SOURCE_FILE');
  setFields(f4, 'Read mdb', 'fields', 'field', [
    {
      name: 'CUST_ID', attribut: 'CustomerID', type: 'Integer', format: '', length: '-1', precision: '-1', currency: '', decimal: '', group: '', trim_type: 'none', repeat: 'N',
    },
  ]);
  assert.match(readFileSync(f4, 'utf8'), /<filename_Field>SOURCE_FILE<\/filename_Field>/);
  assert.equal(validateFile(f4).summary.errors, 0);

  // AccessOutput: 8 tags, table is <table> (not <table_name>), no <fields>.
  const aoBlock = firstFencedXml(getReference('trans', 'AccessOutput').content);
  assertTagOrder(aoBlock,
    ['<filename>', '<table>', '<truncate>', '<create_file>', '<create_table>', '<commit_size>',
      '<add_to_result_filenames>', '<do_not_open_newfile_init>'],
    'AccessOutput');
  assert.ok(!/<fields(?:\s|\/?>)/.test(aoBlock), 'AccessOutput has no <fields>');
  const f5 = minimalKtr('b6-2-accessout');
  addElement(f5, 'AccessOutput', 'Write mdb');
  setFieldPath(f5, 'Write mdb', 'table', 'AUDIT_LOG');
  setFieldPath(f5, 'Write mdb', 'truncate', 'Y');
  setFieldPath(f5, 'Write mdb', 'commit_size', '100');
  const a5 = readFileSync(f5, 'utf8');
  assert.match(a5, /<table>AUDIT_LOG<\/table>/);
  assert.match(a5, /<commit_size>100<\/commit_size>/);
  assert.equal(validateFile(f5).summary.errors, 0);
});

// Palo family test removed: the 4 Palo steps are no longer part of the B6-2
// canonical scope. They are covered at the `observed` level by B7c
// (deprecated components) — see docs/inventory/2026-09-15-b7c-source-notes.md.
// Their reference templates still exist and their catalog rows are now
// status: observed, generator_eligible: false.

test('Scripting/rules family: direct blocks, hop refs, hyphen tags', () => {
  // Janino: <formula> items sit DIRECTLY under <step> (no <fields>); load
  // counts them at the step node.
  const janBlock = firstFencedXml(getReference('trans', 'Janino').content);
  assert.ok(/<formula>/.test(janBlock), '<formula> block present');
  assert.ok(!/<fields(?:\s|\/?>)/.test(janBlock), 'Janino has no <fields> wrapper');
  const janParsed = parser.parse(janBlock);
  for (const tag of ['field_name', 'formula_string', 'value_type', 'value_length', 'value_precision', 'replace_field']) {
    assert.ok(hasOwn(janParsed.step.formula, tag), `formula carries <${tag}>`);
  }
  const f1 = minimalKtr('b6-2-janino');
  addElement(f1, 'Janino', 'Compute net');
  setFieldPath(f1, 'Compute net', 'formula/value_type', 'Number');
  setFieldPath(f1, 'Compute net', 'formula/field_name', 'AMOUNT_NET');
  const r1 = parser.parse(readFileSync(f1, 'utf8'));
  const s1 = stepsOf(r1).find((s) => s.name === 'Compute net');
  assert.equal(s1.formula.value_type, 'Number');
  assert.equal(s1.formula.field_name, 'AMOUNT_NET');
  assert.equal(validateFile(f1).summary.errors, 0);

  // JavaFilter: send_true_to, send_false_to, condition (default "true").
  const jfBlock = firstFencedXml(getReference('trans', 'JavaFilter').content);
  assertTagOrder(jfBlock, ['<send_true_to>', '<send_false_to>', '<condition>'], 'JavaFilter');
  const f2 = minimalKtr('b6-2-javafilter');
  addElement(f2, 'JavaFilter', 'Positive only');
  setFieldPath(f2, 'Positive only', 'send_true_to', 'Positive rows');
  setFieldPath(f2, 'Positive only', 'send_false_to', 'Other rows');
  setFieldPath(f2, 'Positive only', 'condition', 'AMOUNT != null && AMOUNT > 0');
  const a2 = readFileSync(f2, 'utf8');
  assert.match(a2, /<condition>AMOUNT != null &amp;&amp; AMOUNT &gt; 0<\/condition>/);
  assert.equal(validateFile(f2).summary.errors, 0);

  // UDJC: 6 blocks in order; <clear_result_fields> missing => TRUE so the
  // template pins it; <class_type> is strict (TRANSFORM_CLASS/NORMAL_CLASS).
  const udBlock = firstFencedXml(getReference('trans', 'UserDefinedJavaClass').content);
  assertTagOrder(udBlock,
    ['<definitions>', '<fields>', '<clear_result_fields>', '<info_steps>', '<target_steps>', '<usage_parameters>'],
    'UserDefinedJavaClass');
  assert.ok(/<class_type>TRANSFORM_CLASS<\/class_type>/.test(udBlock), 'strict class_type value');
  const f3 = minimalKtr('b6-2-udjc');
  addElement(f3, 'UserDefinedJavaClass', 'Custom code');
  setFieldPath(f3, 'Custom code', 'clear_result_fields', 'Y');
  setFields(f3, 'Custom code', 'usage_parameters', 'usage_parameter', [
    { parameter_tag: 'FACTOR', parameter_value: '0.9', parameter_description: 'Discount factor' },
  ]);
  const a3 = readFileSync(f3, 'utf8');
  assert.match(a3, /<clear_result_fields>Y<\/clear_result_fields>/);
  assert.match(a3, /<parameter_tag>FACTOR<\/parameter_tag>/);
  assert.equal(validateFile(f3).summary.errors, 0);

  // Rules: hyphen tags column-name/column-type/rule-file/rule-definition;
  // <fields> first. Accumulator and Executor share the serializer.
  for (const xmlType of ['RuleAccumulator', 'RuleExecutor']) {
    const block = firstFencedXml(getReference('trans', xmlType).content);
    assertTagOrder(block, ['<fields>', '<rule-file>', '<rule-definition>'], xmlType);
    assert.ok(!/<column_name(?:\s|\/?>)/.test(block), `${xmlType}: hyphen, not underscore`);
  }
  // Rules: setFields() cannot learn hyphen children (column-name) — the
  // order regex only matches [A-Za-z0-9_]+, so hyphen leaves are set via
  // setFieldPath on the existing template items instead.
  const f4 = minimalKtr('b6-2-ruleexec');
  addElement(f4, 'RuleExecutor', 'Apply rules');
  setFieldPath(f4, 'Apply rules', 'fields/field/column-name', 'DISCOUNT');
  setFieldPath(f4, 'Apply rules', 'fields/field/column-type', 'Number');
  setFieldPath(f4, 'Apply rules', 'rule-file', '${RULES_FILE}');
  const r4 = parser.parse(readFileSync(f4, 'utf8'));
  const s4 = stepsOf(r4).find((s) => s.name === 'Apply rules');
  assert.equal(s4.fields.field['column-name'], 'DISCOUNT');
  assert.equal(s4.fields.field['column-type'], 'Number');
  assert.equal(validateFile(f4).summary.errors, 0);
  const f5 = minimalKtr('b6-2-ruleacc');
  addElement(f5, 'RuleAccumulator', 'Accumulate rules');
  setFieldPath(f5, 'Accumulate rules', 'fields/field/column-name', 'TOTAL');
  setFieldPath(f5, 'Accumulate rules', 'fields/field/column-type', 'Number');
  assert.equal(validateFile(f5).summary.errors, 0);
});

test('Statistics/sampling family: wrappers, required flags, nested steps', () => {
  // SampleRows: exactly linesrange + linenumfield.
  const srBlock = firstFencedXml(getReference('trans', 'SampleRows').content);
  assertTagOrder(srBlock, ['<linesrange>', '<linenumfield>'], 'SampleRows');
  const f1 = minimalKtr('b6-2-samplerows');
  addElement(f1, 'SampleRows', 'First hundred');
  setFieldPath(f1, 'First hundred', 'linesrange', '1..100');
  setFieldPath(f1, 'First hundred', 'linenumfield', 'ROW_NR');
  assert.match(readFileSync(f1, 'utf8'), /<linesrange>1\.\.100<\/linesrange>/);
  assert.equal(validateFile(f1).summary.errors, 0);

  // ReservoirSampling: config wrapped in <reservoir_sampling>.
  const rsBlock = firstFencedXml(getReference('trans', 'ReservoirSampling').content);
  assertTagOrder(rsBlock, ['<reservoir_sampling>', '<sample_size>', '<seed>'], 'ReservoirSampling');
  const f2 = minimalKtr('b6-2-reservoir');
  addElement(f2, 'ReservoirSampling', 'Random fifty');
  setFieldPath(f2, 'Random fifty', 'reservoir_sampling/sample_size', '50');
  setFieldPath(f2, 'Random fifty', 'reservoir_sampling/seed', '7');
  const r2 = parser.parse(readFileSync(f2, 'utf8'));
  const s2 = stepsOf(r2).find((s) => s.name === 'Random fifty');
  assert.equal(s2.reservoir_sampling.sample_size, 50);
  assert.equal(s2.reservoir_sampling.seed, 7);
  assert.equal(validateFile(f2).summary.errors, 0);

  // UnivariateStats: <univariate_stats> direct blocks; EVERY flag tag is
  // required (missing => NPE on temp.equalsIgnoreCase).
  const usBlock = firstFencedXml(getReference('trans', 'UnivariateStats').content);
  assert.ok(/<univariate_stats>/.test(usBlock), 'direct block present');
  assert.ok(!/<fields(?:\s|\/?>)/.test(usBlock), 'no <fields> wrapper');
  const usParsed = parser.parse(usBlock);
  for (const tag of ['source_field_name', 'N', 'mean', 'stdDev', 'min', 'max', 'median', 'percentile', 'interpolate']) {
    assert.ok(hasOwn(usParsed.step.univariate_stats, tag), `<univariate_stats> carries <${tag}> (NPE guard)`);
  }
  const f3 = minimalKtr('b6-2-univar');
  addElement(f3, 'UnivariateStats', 'Describe totals');
  setFieldPath(f3, 'Describe totals', 'univariate_stats/source_field_name', 'ORDER_TOTAL');
  setFieldPath(f3, 'Describe totals', 'univariate_stats/median', 'Y');
  setFieldPath(f3, 'Describe totals', 'univariate_stats/percentile', '0.95');
  const r3 = parser.parse(readFileSync(f3, 'utf8'));
  const s3 = stepsOf(r3).find((s) => s.name === 'Describe totals');
  assert.equal(s3.univariate_stats.source_field_name, 'ORDER_TOTAL');
  assert.equal(s3.univariate_stats.percentile, 0.95);
  assert.equal(validateFile(f3).summary.errors, 0);

  // StepsMetrics: <steps>/<step> items (name/copyNr/stepRequired) + 9 field
  // tags. Nested <step> items must not be confused with the root.
  const smBlock = firstFencedXml(getReference('trans', 'StepsMetrics').content);
  assertTagOrder(smBlock, ['<steps>', '<stepnamefield>', '<stepsecondsfield>'], 'StepsMetrics');
  const smParsed = parser.parse(smBlock);
  assert.equal(smParsed.step.type, 'StepsMetrics', 'root direct-child <type>');
  assert.ok(smParsed.step.steps.step, 'nested <steps>/<step> items present');
  // NOTE: no edit-API writes for this step — nested <step> items break the
  // edit span logic (setFieldPath duplicates the leaf inside the nested item
  // instead of updating the step-level tag; setFields throws). Verified with a
  // scratch repro (see source-notes limitation L1). The non-default config
  // below is asserted from the reference's second fenced block instead.
  const smRef = getReference('trans', 'StepsMetrics');
  const smBlocks = [...smRef.content.matchAll(/```xml\r?\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  assert.ok(smBlocks.length >= 2, 'reference carries a non-default example block');
  const smNonDefault = smBlocks[smBlocks.length - 1];
  // The example block is a fragment (plugin tags only, no <step> wrapper),
  // so order/count are asserted textually: exactly two nested <step> items
  // (<step> with closing bracket — <steps> does not match).
  assertTagOrder(smNonDefault, ['<steps>', '<stepnamefield>', '<stepsecondsfield>'], 'StepsMetrics example');
  assert.equal((smNonDefault.match(/<step>/g) || []).length, 2, 'example watches two steps');
  assert.ok(/<name>Load customers<\/name>/.test(smNonDefault), 'first watched step');
  assert.ok(/<name>Sort orders<\/name>/.test(smNonDefault), 'second watched step');
  assert.ok(/<stepRequired>Y<\/stepRequired>/.test(smNonDefault), 'required flag Y');
  assert.ok(/<stepRequired>N<\/stepRequired>/.test(smNonDefault), 'required flag N');
  const f4 = minimalKtr('b6-2-stepsmetrics');
  addElement(f4, 'StepsMetrics', 'Watch steps');
  assert.equal(validateFile(f4).summary.errors, 0);

  // FieldsChangeSequence: camelCase <resultfieldName>; items carry only <name>.
  const fcBlock = firstFencedXml(getReference('trans', 'FieldsChangeSequence').content);
  assertTagOrder(fcBlock, ['<start>', '<increment>', '<resultfieldName>', '<fields>'], 'FieldsChangeSequence');
  assert.ok(!/<resultFieldName(?:\s|\/?>)/.test(fcBlock), 'camelCase resultfieldName (capital F would load null)');
  const f5 = minimalKtr('b6-2-fcs');
  addElement(f5, 'FieldsChangeSequence', 'Sequence customers');
  setFieldPath(f5, 'Sequence customers', 'start', '100');
  setFieldPath(f5, 'Sequence customers', 'increment', '10');
  setFieldPath(f5, 'Sequence customers', 'resultfieldName', 'CUSTOMER_SEQ');
  setFields(f5, 'Sequence customers', 'fields', 'field', [
    { name: 'CUSTOMER_ID' },
    { name: 'REGION' },
  ]);
  const r5 = parser.parse(readFileSync(f5, 'utf8'));
  const s5 = stepsOf(r5).find((s) => s.name === 'Sequence customers');
  const c5 = Array.isArray(s5.fields.field) ? s5.fields.field : [s5.fields.field];
  assert.equal(c5.length, 2);
  assert.deepEqual(Object.keys(c5[0]), ['name'], 'name-only items');
  assert.equal(validateFile(f5).summary.errors, 0);
});

test('File/lock/process utility family: field refs, nesting, code/enum tags', () => {
  // FileExists: filenamefield + Boolean result + optional filetype pair.
  const feBlock = firstFencedXml(getReference('trans', 'FileExists').content);
  assertTagOrder(feBlock,
    ['<filenamefield>', '<resultfieldname>', '<includefiletype>', '<filetypefieldname>', '<addresultfilenames>'],
    'FileExists');
  const f1 = minimalKtr('b6-2-fileexists');
  addElement(f1, 'FileExists', 'Check input');
  setFieldPath(f1, 'Check input', 'filenamefield', 'SOURCE_PATH');
  setFieldPath(f1, 'Check input', 'resultfieldname', 'EXISTS_FLAG');
  setFieldPath(f1, 'Check input', 'includefiletype', 'Y');
  setFieldPath(f1, 'Check input', 'filetypefieldname', 'PATH_KIND');
  const a1 = readFileSync(f1, 'utf8');
  assert.match(a1, /<resultfieldname>EXISTS_FLAG<\/resultfieldname>/);
  assert.match(a1, /<includefiletype>Y<\/includefiletype>/);
  assert.equal(validateFile(f1).summary.errors, 0);

  // FileLocked: ONLY 3 tags (no filetype pair).
  const flBlock = firstFencedXml(getReference('trans', 'FileLocked').content);
  assertTagOrder(flBlock,
    ['<filenamefield>', '<resultfieldname>', '<addresultfilenames>'], 'FileLocked');
  assert.ok(!/<includefiletype(?:\s|\/?>)/.test(flBlock), 'FileLocked has no filetype pair');
  const f2 = minimalKtr('b6-2-filelocked');
  addElement(f2, 'FileLocked', 'Check lock');
  setFieldPath(f2, 'Check lock', 'resultfieldname', 'IS_LOCKED');
  assert.match(readFileSync(f2, 'utf8'), /<resultfieldname>IS_LOCKED<\/resultfieldname>/);
  assert.equal(validateFile(f2).summary.errors, 0);

  // ExecProcess: command comes from a COLUMN; 2-level argumentFields nesting.
  const epBlock = firstFencedXml(getReference('trans', 'ExecProcess').content);
  assertTagOrder(epBlock,
    ['<processfield>', '<resultfieldname>', '<errorfieldname>', '<exitvaluefieldname>',
      '<failwhennotsuccess>', '<outputlinedelimiter>', '<argumentsInFields>', '<argumentFields>'],
    'ExecProcess');
  const f3 = minimalKtr('b6-2-execproc');
  addElement(f3, 'ExecProcess', 'Run checker');
  setFieldPath(f3, 'Run checker', 'processfield', 'CMD');
  setFieldPath(f3, 'Run checker', 'failwhennotsuccess', 'Y');
  setFieldPath(f3, 'Run checker', 'argumentsInFields', 'Y');
  setFields(f3, 'Run checker', 'argumentFields', 'argumentField', [
    { argumentFieldName: 'ARG1' },
  ]);
  const r3 = parser.parse(readFileSync(f3, 'utf8'));
  const s3 = stepsOf(r3).find((s) => s.name === 'Run checker');
  assert.equal(s3.argumentFields.argumentField.argumentFieldName, 'ARG1');
  assert.equal(validateFile(f3).summary.errors, 0);

  // ZipFile: operation_type codes ""/move/delete (empty = do nothing).
  const zfBlock = firstFencedXml(getReference('trans', 'ZipFile').content);
  assertTagOrder(zfBlock,
    ['<sourcefilenamefield>', '<targetfilenamefield>', '<baseFolderField>', '<operation_type>',
      '<addresultfilenames>', '<movetofolderfield>'],
    'ZipFile');
  const f4 = minimalKtr('b6-2-zipfile');
  addElement(f4, 'ZipFile', 'Archive out');
  setFieldPath(f4, 'Archive out', 'operation_type', 'move');
  setFieldPath(f4, 'Archive out', 'movetofolderfield', 'ARCHIVE_DIR');
  setFieldPath(f4, 'Archive out', 'addresultfilenames', 'Y');
  const a4 = readFileSync(f4, 'utf8');
  assert.match(a4, /<operation_type>move<\/operation_type>/);
  assert.equal(validateFile(f4).summary.errors, 0);

  // ChangeFileEncoding: missing-e tags addsourceresultfilenames /
  // addtargetresultfilenames; default source encoding is machine-dependent
  // so the template pins it explicitly. The result-filename tags keep the
  // source spelling without the extra e (addsourceresultfilenames).
  const ceBlock = firstFencedXml(getReference('trans', 'ChangeFileEncoding').content);
  assertTagOrder(ceBlock,
    ['<filenamefield>', '<targetfilenamefield>', '<sourceencoding>', '<targetencoding>',
      '<addsourceresultfilenames>', '<addtargetresultfilenames>', '<createparentfolder>'],
    'ChangeFileEncoding');
  assert.ok(/<addsourceresultfilenames>/.test(ceBlock),
    'missing-e spelling addsourceresultfilenames kept verbatim');
  const f5 = minimalKtr('b6-2-chenc');
  addElement(f5, 'ChangeFileEncoding', 'To utf8');
  setFieldPath(f5, 'To utf8', 'filenamefield', 'LEGACY_PATH');
  setFieldPath(f5, 'To utf8', 'targetfilenamefield', 'UTF8_PATH');
  setFieldPath(f5, 'To utf8', 'sourceencoding', 'ISO-8859-1');
  setFieldPath(f5, 'To utf8', 'targetencoding', 'UTF-8');
  setFieldPath(f5, 'To utf8', 'addtargetresultfilenames', 'Y');
  const a5 = readFileSync(f5, 'utf8');
  assert.match(a5, /<sourceencoding>ISO-8859-1<\/sourceencoding>/);
  assert.match(a5, /<addtargetresultfilenames>Y<\/addtargetresultfilenames>/);
  assert.equal(validateFile(f5).summary.errors, 0);
});

test('knowledgeCoverage reports the B6-2 package as canonical with nothing missing', () => {
  const transIds = BATCH.filter((b) => b.kind === 'trans').map((b) => b.xmlType);
  const jobIds = BATCH.filter((b) => b.kind === 'job').map((b) => b.xmlType);
  assert.equal(transIds.length, 29, '29 trans IDs (4 Palo moved to B7c observed)');
  assert.equal(jobIds.length, 3, '3 job IDs');
  const ktr = path.join(tmp, 'b6-2-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b6-2-package</name></info>',
    ...transIds.map((t) => `<step><name>Uses ${t}</name><type>${t}</type></step>`),
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b6-2-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b6-2-package</name><entries>',
    ...jobIds.map((t) => `<entry><name>Uses ${t}</name><type>${t}</type></entry>`),
    '</entries><hops/></job>',
  ].join('\n'));
  void kjb;
  const report = knowledgeCoverage(tmp);
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const row = report.types.find((t) => t.xmlType === xmlType);
    assert.ok(row, `${xmlType} covered`);
    assert.equal(row.status, 'canonical', `${xmlType} canonical`);
    assert.equal(row.generatorEligible, true, `${xmlType} eligible`);
  }
  assert.equal(report.summary.missing, 0);
});
