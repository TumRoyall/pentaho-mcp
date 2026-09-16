import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  findByXmlType, getReference, isGeneratorEligible, verifiedVersions,
} from '../src/knowledge/loader.js';
import { addElement, setFieldPath } from '../src/core/edit.js';
import { validateFile } from '../src/core/validate.js';
import { knowledgeCoverage } from '../src/core/knowledge-coverage.js';

// Batch B4d (file-management job entries): job CREATE_FILE,
// job WRITE_TO_FILE, job FILE_COMPARE, job FOLDERS_COMPARE,
// job FOLDER_IS_EMPTY.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b4d-source-notes.md.
//
// Grounding (all at the pinned commit; all five register in
// engine/src/main/resources/kettle-job-entries.xml):
// - job CREATE_FILE -> .../job/entries/createfile/JobEntryCreateFile.
//   getXML() (lines 88-99) = super.getXML() then filename,
//   fail_if_file_exists, add_filename_result. Constructor (lines 72-77):
//   failIfFileExists=true, addfilenameresult=false. evaluates()=true
//   (239-241). check() (265-271): filename non-null + not-yet-existing.
// - job WRITE_TO_FILE -> .../job/entries/writetofile/JobEntryWriteToFile.
//   getXML() (lines 91-108) = super.getXML() then filename,
//   createParentFolder, appendFile, content (CRs encoded as &#xd; via
//   encodeCR, lines 98-101/319-321), encoding. Constructor (lines 73-80):
//   all null/false. evaluates()=true (281-283).
// - job FILE_COMPARE -> .../job/entries/filecompare/JobEntryFileCompare.
//   getXML() (lines 94-106) = super.getXML() then filename1, filename2,
//   add_filename_result. Constructor (lines 78-83): nulls + false.
//   evaluates()=true (285-287). Binary compare; identical => true flow
//   (class javadoc lines 62-64).
// - job FOLDERS_COMPARE ->
//   .../job/entries/folderscompare/JobEntryFoldersCompare. getXML()
//   (lines 113-130) = super.getXML() then include_subfolders,
//   compare_filecontent, compare_filesize, compareonly, wildcard,
//   filename1, filename2. Constructor (lines 84-94): flags false,
//   compareonly="all". compareonly values: all / only_files /
//   only_folders / specify-with-wildcard (lines 537-549; anything else
//   matches nothing). evaluates()=true (592-594).
// - job FOLDER_IS_EMPTY ->
//   .../job/entries/folderisempty/JobEntryFolderIsEmpty (Conditions).
//   getXML() (lines 94-106) = super.getXML() then foldername,
//   include_subfolders, specify_wildcard, wildcard. Constructor (lines
//   77-83): nulls + false. execute() (lines 187-259): filescount==0 =>
//   result=true (228-231); missing/non-folder path => NrErrors=1.
//   evaluates()=true (360-362).
// None of the five references a DB connection: NO <connection> tag.
// Paths use ${VAR} placeholders; content is escaped, never a real secret.
const BATCH = [
  { kind: 'job', xmlType: 'CREATE_FILE', alias: 'CREATE_FILE' },
  { kind: 'job', xmlType: 'WRITE_TO_FILE', alias: 'WRITE_TO_FILE' },
  { kind: 'job', xmlType: 'FILE_COMPARE', alias: 'FILE_COMPARE' },
  { kind: 'job', xmlType: 'FOLDERS_COMPARE', alias: 'FOLDERS_COMPARE' },
  { kind: 'job', xmlType: 'FOLDER_IS_EMPTY', alias: 'FOLDER_IS_EMPTY' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// Assert each tag of `order` (e.g. '<filename>') appears in `block` after
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b4d-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

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

test('B4d catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B4d references resolve and their first XML block is one valid <entry> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('job', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.entry, `${ref.file}: root should be <entry>`);
    assert.equal(parsed.entry.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B4d templates carry no <connection> and insert via addElement with escaped names, validating clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('job', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(!/<connection(?:\s|\/?>)/.test(block),
      `${xmlType} template must not carry <connection> (no DB reference in source)`);
    const file = freshKjb(`b4d-${xmlType.toLowerCase()}`);
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

test('job CREATE_FILE template follows getXML: filename, fail_if_file_exists (default Y), add_filename_result', () => {
  // JobEntryCreateFile.getXML() (lines 88-99) = super.getXML() then
  // filename, fail_if_file_exists, add_filename_result. Constructor
  // (lines 72-77): failIfFileExists=true, addfilenameresult=false.
  const ref = getReference('job', 'CREATE_FILE');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<filename>', '<fail_if_file_exists>', '<add_filename_result>'],
    'CREATE_FILE');
  assert.equal(parsed.entry.fail_if_file_exists, 'Y',
    'fail_if_file_exists defaults Y (constructor true)');
  assert.equal(parsed.entry.add_filename_result, 'N',
    'add_filename_result defaults N (constructor false)');
  assert.match(block, /<filename>\$\{TARGET_FILE\}<\/filename>/);

  // Non-default configuration: idempotent create that feeds the result.
  const file = freshKjb('b4d-create-file');
  addElement(file, 'CREATE_FILE', 'Touch flag file');
  setFieldPath(file, 'Touch flag file', 'filename', '${FLAG_DIR}/ready.flag');
  setFieldPath(file, 'Touch flag file', 'fail_if_file_exists', 'N');
  setFieldPath(file, 'Touch flag file', 'add_filename_result', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename>\$\{FLAG_DIR\}\/ready\.flag<\/filename>/);
  assert.match(after, /<fail_if_file_exists>N<\/fail_if_file_exists>/);
  assert.match(after, /<add_filename_result>Y<\/add_filename_result>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job WRITE_TO_FILE template follows getXML: filename, flags, content, encoding', () => {
  // JobEntryWriteToFile.getXML() (lines 91-108) = super.getXML() then
  // filename, createParentFolder, appendFile, content (CRs encoded as
  // &#xd;, lines 98-101/319-321), encoding. Constructor (lines 73-80):
  // all null/false.
  const ref = getReference('job', 'WRITE_TO_FILE');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<filename>', '<createParentFolder>', '<appendFile>', '<content>', '<encoding>'],
    'WRITE_TO_FILE');
  assert.match(block, /<filename>\$\{TARGET_FILE\}<\/filename>/);

  // Non-default configuration: appended UTF-8 log with escaped content.
  const file = freshKjb('b4d-write-to-file');
  addElement(file, 'WRITE_TO_FILE', 'Append run log');
  setFieldPath(file, 'Append run log', 'filename', '${LOG_DIR}/run.log');
  setFieldPath(file, 'Append run log', 'createParentFolder', 'Y');
  setFieldPath(file, 'Append run log', 'appendFile', 'Y');
  setFieldPath(file, 'Append run log', 'content', 'A < B & C');
  setFieldPath(file, 'Append run log', 'encoding', 'UTF-8');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename>\$\{LOG_DIR\}\/run\.log<\/filename>/);
  assert.match(after, /<createParentFolder>Y<\/createParentFolder>/);
  assert.match(after, /<appendFile>Y<\/appendFile>/);
  assert.match(after, /<content>A &lt; B &amp; C<\/content>/);
  assert.match(after, /<encoding>UTF-8<\/encoding>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FILE_COMPARE template follows getXML: filename1, filename2, add_filename_result', () => {
  // JobEntryFileCompare.getXML() (lines 94-106) = super.getXML() then
  // filename1, filename2, add_filename_result. Constructor (lines 78-83):
  // nulls + false. Binary compare; identical => true flow (javadoc 62-64).
  const ref = getReference('job', 'FILE_COMPARE');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<filename1>', '<filename2>', '<add_filename_result>'],
    'FILE_COMPARE');
  assert.equal(parsed.entry.add_filename_result, 'N',
    'add_filename_result defaults N (constructor false)');
  assert.match(block, /<filename1>\$\{FILE_1\}<\/filename1>/);
  assert.match(block, /<filename2>\$\{FILE_2\}<\/filename2>/);

  // Non-default configuration: compare two exports and keep the names.
  const file = freshKjb('b4d-file-compare');
  addElement(file, 'FILE_COMPARE', 'Diff daily exports');
  setFieldPath(file, 'Diff daily exports', 'filename1', '${DATA_DIR}/export_new.csv');
  setFieldPath(file, 'Diff daily exports', 'filename2', '${DATA_DIR}/export_old.csv');
  setFieldPath(file, 'Diff daily exports', 'add_filename_result', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename1>\$\{DATA_DIR\}\/export_new\.csv<\/filename1>/);
  assert.match(after, /<filename2>\$\{DATA_DIR\}\/export_old\.csv<\/filename2>/);
  assert.match(after, /<add_filename_result>Y<\/add_filename_result>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FOLDERS_COMPARE template follows getXML: 3 flags, compareonly, wildcard, two folders', () => {
  // JobEntryFoldersCompare.getXML() (lines 113-130) = super.getXML() then
  // include_subfolders, compare_filecontent, compare_filesize,
  // compareonly, wildcard, filename1, filename2. Constructor (lines
  // 84-94): flags false, compareonly="all". compareonly values: all /
  // only_files / only_folders / specify-with-wildcard (lines 537-549).
  const ref = getReference('job', 'FOLDERS_COMPARE');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<include_subfolders>', '<compare_filecontent>', '<compare_filesize>',
      '<compareonly>', '<wildcard>', '<filename1>', '<filename2>'],
    'FOLDERS_COMPARE');
  assert.equal(parsed.entry.compareonly, 'all', 'compareonly defaults to "all" (constructor)');
  assert.match(block, /<filename1>\$\{DIR_1\}<\/filename1>/);
  assert.match(block, /<filename2>\$\{DIR_2\}<\/filename2>/);

  // Non-default configuration: content-compare of XML files including subfolders.
  const file = freshKjb('b4d-folders-compare');
  addElement(file, 'FOLDERS_COMPARE', 'Diff XML trees');
  setFieldPath(file, 'Diff XML trees', 'include_subfolders', 'Y');
  setFieldPath(file, 'Diff XML trees', 'compare_filecontent', 'Y');
  setFieldPath(file, 'Diff XML trees', 'compareonly', 'specify');
  setFieldPath(file, 'Diff XML trees', 'wildcard', '.*\\.xml');
  setFieldPath(file, 'Diff XML trees', 'filename1', '${DIR_1}');
  setFieldPath(file, 'Diff XML trees', 'filename2', '${DIR_2}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<include_subfolders>Y<\/include_subfolders>/);
  assert.match(after, /<compare_filecontent>Y<\/compare_filecontent>/);
  assert.match(after, /<compareonly>specify<\/compareonly>/);
  assert.match(after, /<filename1>\$\{DIR_1\}<\/filename1>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('job FOLDER_IS_EMPTY template follows getXML: foldername, include_subfolders, specify_wildcard, wildcard', () => {
  // JobEntryFolderIsEmpty.getXML() (lines 94-106) = super.getXML() then
  // foldername, include_subfolders, specify_wildcard, wildcard.
  // Constructor (lines 77-83): nulls + false. execute() (lines 187-259):
  // filescount==0 => result=true (228-231); missing/non-folder =>
  // NrErrors=1.
  const ref = getReference('job', 'FOLDER_IS_EMPTY');
  const block = firstFencedXml(ref.content);
  assertTagOrder(block,
    ['<foldername>', '<include_subfolders>', '<specify_wildcard>', '<wildcard>'],
    'FOLDER_IS_EMPTY');
  assert.match(block, /<foldername>\$\{TARGET_DIR\}<\/foldername>/);

  // Non-default configuration: count only XML files including subfolders.
  const file = freshKjb('b4d-folder-is-empty');
  addElement(file, 'FOLDER_IS_EMPTY', 'Inbox drained check');
  setFieldPath(file, 'Inbox drained check', 'foldername', '${INBOX_DIR}');
  setFieldPath(file, 'Inbox drained check', 'include_subfolders', 'Y');
  setFieldPath(file, 'Inbox drained check', 'specify_wildcard', 'Y');
  setFieldPath(file, 'Inbox drained check', 'wildcard', '.*\\.xml');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<foldername>\$\{INBOX_DIR\}<\/foldername>/);
  assert.match(after, /<include_subfolders>Y<\/include_subfolders>/);
  assert.match(after, /<specify_wildcard>Y<\/specify_wildcard>/);
  assert.match(after, /<wildcard>\.\*\\.xml<\/wildcard>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B4d package as canonical with nothing missing', () => {
  const kjb = path.join(tmp, 'b4d-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b4d-package</name><entries>',
    '<entry><name>Touch flag file</name><type>CREATE_FILE</type></entry>',
    '<entry><name>Append run log</name><type>WRITE_TO_FILE</type></entry>',
    '<entry><name>Diff daily exports</name><type>FILE_COMPARE</type></entry>',
    '<entry><name>Diff XML trees</name><type>FOLDERS_COMPARE</type></entry>',
    '<entry><name>Inbox drained check</name><type>FOLDER_IS_EMPTY</type></entry>',
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
