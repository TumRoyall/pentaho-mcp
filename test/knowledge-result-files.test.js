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

// Batch B1 package 2 (result files): FilesFromResult, FilesToResult,
// ADD_RESULT_FILENAMES, DELETE_RESULT_FILENAMES, COPY_MOVE_RESULT_FILENAMES.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b1-package2-source-notes.md.
const BATCH = [
  { kind: 'trans', xmlType: 'FilesFromResult', alias: 'FILES_FROM_RESULT' },
  { kind: 'trans', xmlType: 'FilesToResult', alias: 'FILES_TO_RESULT' },
  { kind: 'job', xmlType: 'ADD_RESULT_FILENAMES', alias: 'ADD_RESULT_FILENAMES' },
  { kind: 'job', xmlType: 'DELETE_RESULT_FILENAMES', alias: 'DELETE_RESULT_FILENAMES' },
  { kind: 'job', xmlType: 'COPY_MOVE_RESULT_FILENAMES', alias: 'COPY_MOVE_RESULT_FILENAMES' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b1p2-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b1p2') {
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

function minimalKjb(name = 'b1p2') {
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

test('B1p2 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B1p2 references resolve and their first XML block is one valid step/entry with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // Direct-child <type> (not a nested field <type>).
    assert.equal(parsed[rootTag].type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B1p2 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    const file = kind === 'job'
      ? minimalKjb(`b1p2-${xmlType.toLowerCase()}`)
      : minimalKtr(`b1p2-${xmlType.toLowerCase()}`);
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

test('FilesFromResult template uses inherited BaseStepMeta serialization: no own config tags', () => {
  // FilesFromResultMeta does not override getXML (BaseStepMeta.getXML returns
  // ""); readData/setDefault are empty. The template must not invent config
  // tags such as <filename_field>, <file_type>, or <fields>.
  const ref = getReference('trans', 'FilesFromResult');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.equal(parsed.step.type, 'FilesFromResult');
  assert.ok(!parsed.step.fields, 'FilesFromResult template must not invent <fields>');
  assert.ok(!parsed.step.filename_field, 'FilesFromResult template must not invent <filename_field>');
  assert.ok(!parsed.step.file_type, 'FilesFromResult template must not invent <file_type>');
});

test('FilesToResult template follows FilesToResultMeta.getXML: filename_field plus file_type code', () => {
  const ref = getReference('trans', 'FilesToResult');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'filename_field'),
    'FilesToResult template must carry <filename_field>');
  assert.equal(parsed.step.file_type, 'GENERAL',
    'FilesToResult default file_type is the GENERAL code (setDefault FILE_TYPE_GENERAL)');

  // Non-default configuration: filename field plus a non-GENERAL type code.
  const file = minimalKtr('b1p2-filestoresult');
  addElement(file, 'FilesToResult', 'Set files in result');
  setFieldPath(file, 'Set files in result', 'filename_field', 'result_filename');
  setFieldPath(file, 'Set files in result', 'file_type', 'ERROR');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<filename_field>result_filename<\/filename_field>/);
  assert.match(after, /<file_type>ERROR<\/file_type>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ADD_RESULT_FILENAMES template follows JobEntryAddResultFilenames.getXML: three Y/N flags plus fields/name/filemask', () => {
  const ref = getReference('job', 'ADD_RESULT_FILENAMES');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  for (const tag of ['arg_from_previous', 'include_subfolders', 'delete_all_before']) {
    assert.ok(Object.prototype.hasOwnProperty.call(parsed.entry, tag),
      `ADD_RESULT_FILENAMES template must carry <${tag}>`);
  }
  assert.ok(parsed.entry.fields?.field, 'ADD_RESULT_FILENAMES template must carry <fields>/<field>');
  const order = ['<arg_from_previous>', '<include_subfolders>', '<delete_all_before>', '<fields>'];
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + "(?:\\s|/?>)"));
    assert.ok(i > at, `${tag} must follow JobEntryAddResultFilenames.getXML() order`);
    at = i;
  }

  // Non-default configuration: two file items per the source structure.
  const file = minimalKjb('b1p2-addresultfilenames');
  addElement(file, 'ADD_RESULT_FILENAMES', 'Add filenames to result');
  setFields(file, 'Add filenames to result', 'fields', 'field', [
    { name: '${SOURCE_DIR}', filemask: '.*\\.csv$' },
    { name: '${ARCHIVE_DIR}', filemask: '.*\\.zip$' },
  ]);
  setFieldPath(file, 'Add filenames to result', 'include_subfolders', 'Y');
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const entries = Array.isArray(reparsed.job.entries.entry) ? reparsed.job.entries.entry : [reparsed.job.entries.entry];
  const entry = entries.find((e) => e.name === 'Add filenames to result');
  assert.ok(entry, 'inserted entry present');
  const items = Array.isArray(entry.fields.field) ? entry.fields.field : [entry.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, '${SOURCE_DIR}');
  assert.equal(items[0].filemask, '.*\\.csv$');
  assert.equal(entry.include_subfolders, 'Y');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('DELETE_RESULT_FILENAMES template follows JobEntryDeleteResultFilenames.getXML tag order', () => {
  const ref = getReference('job', 'DELETE_RESULT_FILENAMES');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  for (const tag of ['foldername', 'specify_wildcard', 'wildcard', 'wildcardexclude']) {
    assert.ok(Object.prototype.hasOwnProperty.call(parsed.entry, tag),
      `DELETE_RESULT_FILENAMES template must carry <${tag}>`);
  }
  const order = ['<foldername>', '<specify_wildcard>', '<wildcard>', '<wildcardexclude>'];
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + "(?:\\s|/?>)"));
    assert.ok(i > at, `${tag} must follow JobEntryDeleteResultFilenames.getXML() order`);
    at = i;
  }

  // Non-default configuration: wildcard-filtered delete.
  const file = minimalKjb('b1p2-deleteresultfilenames');
  addElement(file, 'DELETE_RESULT_FILENAMES', 'Delete filenames from result');
  setFieldPath(file, 'Delete filenames from result', 'specify_wildcard', 'Y');
  setFieldPath(file, 'Delete filenames from result', 'wildcard', '.*\\.tmp$');
  setFieldPath(file, 'Delete filenames from result', 'wildcardexclude', 'keep_.*');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<specify_wildcard>Y<\/specify_wildcard>/);
  assert.match(after, /<wildcard>\.\*\\.tmp\$<\/wildcard>/);
  assert.match(after, /<wildcardexclude>keep_\.\*<\/wildcardexclude>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('COPY_MOVE_RESULT_FILENAMES template follows JobEntryCopyMoveResultFilenames.getXML 17-tag order', () => {
  // getXML() emits super.getXML() then exactly: foldername, specify_wildcard,
  // wildcard, wildcardexclude, destination_folder, nr_errors_less_than,
  // success_condition, add_date, add_time, SpecifyFormat, date_time_format,
  // action, AddDateBeforeExtension, OverwriteFile, CreateDestinationFolder,
  // RemovedSourceFilename, AddDestinationFilename.
  const ref = getReference('job', 'COPY_MOVE_RESULT_FILENAMES');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  const order = [
    '<foldername>', '<specify_wildcard>', '<wildcard>', '<wildcardexclude>',
    '<destination_folder>', '<nr_errors_less_than>', '<success_condition>',
    '<add_date>', '<add_time>', '<SpecifyFormat>', '<date_time_format>',
    '<action>', '<AddDateBeforeExtension>', '<OverwriteFile>',
    '<CreateDestinationFolder>', '<RemovedSourceFilename>', '<AddDestinationFilename>',
  ];
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + "(?:\\s|/?>)"));
    assert.ok(i > at, `${tag} must follow JobEntryCopyMoveResultFilenames.getXML() order`);
    at = i;
  }
  assert.equal(parsed.entry.action, 'copy', 'default action is copy (constructor)');
  assert.equal(parsed.entry.success_condition, 'success_if_no_errors',
    'default success_condition is success_if_no_errors (constructor)');
  // Constructor-true flags must stay Y; every other boolean flag defaults N.
  // (Load-missing-tag falls back to false, so the template pins all of them.)
  assert.equal(parsed.entry.RemovedSourceFilename, 'Y', 'RemovedSourceFilename defaults Y');
  assert.equal(parsed.entry.AddDestinationFilename, 'Y', 'AddDestinationFilename defaults Y');
  for (const tag of ['specify_wildcard', 'add_date', 'add_time', 'SpecifyFormat',
    'AddDateBeforeExtension', 'OverwriteFile', 'CreateDestinationFolder']) {
    assert.equal(parsed.entry[tag], 'N', `${tag} defaults N`);
  }

  // Non-default configuration: move with destination folder.
  const file = minimalKjb('b1p2-copymoveresultfilenames');
  addElement(file, 'COPY_MOVE_RESULT_FILENAMES', 'Process result filenames');
  setFieldPath(file, 'Process result filenames', 'action', 'move');
  setFieldPath(file, 'Process result filenames', 'destination_folder', '${DEST_DIR}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<action>move<\/action>/);
  assert.match(after, /<destination_folder>\$\{DEST_DIR\}<\/destination_folder>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B1p2 package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b1p2-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b1p2-package</name></info>',
    '<step><name>Get files from result</name><type>FilesFromResult</type></step>',
    '<step><name>Set files in result</name><type>FilesToResult</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b1p2-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b1p2-package</name><entries>',
    '<entry><name>Add filenames to result</name><type>ADD_RESULT_FILENAMES</type></entry>',
    '<entry><name>Delete filenames from result</name><type>DELETE_RESULT_FILENAMES</type></entry>',
    '<entry><name>Process result filenames</name><type>COPY_MOVE_RESULT_FILENAMES</type></entry>',
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
