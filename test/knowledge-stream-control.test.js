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

// Batch B1 package 3 (stream control): Append, BlockingStep,
// DetectEmptyStream, DetectLastRow.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b1-package3-source-notes.md.
const BATCH = [
  { kind: 'trans', xmlType: 'Append', alias: 'APPEND' },
  { kind: 'trans', xmlType: 'BlockingStep', alias: 'BLOCKING_STEP' },
  { kind: 'trans', xmlType: 'DetectEmptyStream', alias: 'DETECT_EMPTY_STREAM' },
  { kind: 'trans', xmlType: 'DetectLastRow', alias: 'DETECT_LAST_ROW' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b1p3-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b1p3') {
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

test('B1p3 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B1p3 references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const ref = getReference('trans', xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested field <type>).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B1p3 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const file = minimalKtr(`b1p3-${xmlType.toLowerCase()}`);
    const out = addElement(file, xmlType, `New ${xmlType} & <Step>`);
    const after = readFileSync(file, 'utf8');
    assert.match(after, new RegExp(`<type>${xmlType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Step&gt;<\/name>/);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'canonical');
    assert.equal(out.manualReviewRequired, false);
  }
});

test('Append template follows AppendMeta.getXML: head_name then tail_name step references', () => {
  // AppendMeta.getXML() emits exactly head_name, tail_name from the two INFO
  // streams; setDefault() is empty so the template pins both tags.
  const ref = getReference('trans', 'Append');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'head_name'),
    'Append template must carry <head_name>');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'tail_name'),
    'Append template must carry <tail_name>');
  const headAt = block.search(/<head_name(?:\s|\/?>)/);
  const tailAt = block.search(/<tail_name(?:\s|\/?>)/);
  assert.ok(headAt >= 0 && tailAt > headAt, '<head_name> must precede <tail_name> per getXML() order');

  // Non-default configuration: head/tail step-name references.
  const file = minimalKtr('b1p3-append');
  addElement(file, 'Append', 'Append streams');
  setFieldPath(file, 'Append streams', 'head_name', 'Head input');
  setFieldPath(file, 'Append streams', 'tail_name', 'Tail input');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<head_name>Head input<\/head_name>/);
  assert.match(after, /<tail_name>Tail input<\/tail_name>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('BlockingStep template follows BlockingStepMeta.getXML 5-tag order with setDefault defaults', () => {
  // getXML() emits: pass_all_rows, directory, prefix, cache_size, compress.
  // setDefault(): pass_all_rows N, directory %%java.io.tmpdir%%, prefix
  // block, cache_size 5000, compress Y.
  const ref = getReference('trans', 'BlockingStep');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  const order = ['<pass_all_rows>', '<directory>', '<prefix>', '<cache_size>', '<compress>'];
  let at = -1;
  for (const tag of order) {
    const i = block.search(new RegExp(tag.slice(0, -1) + "(?:\\s|/?>)"));
    assert.ok(i > at, `${tag} must follow BlockingStepMeta.getXML() order`);
    at = i;
  }
  assert.equal(parsed.step.pass_all_rows, 'N', 'pass_all_rows defaults N (setDefault false)');
  assert.equal(parsed.step.directory, '%%java.io.tmpdir%%', 'directory default');
  assert.equal(parsed.step.prefix, 'block', 'prefix default');
  assert.equal(parsed.step.cache_size, 5000, 'cache_size defaults to CACHE_SIZE 5000');
  // Fresh-step default is Y, but load-missing-tag falls back to N, so the
  // template must pin <compress> explicitly.
  assert.equal(parsed.step.compress, 'Y', 'compress defaults Y (setDefault true)');

  // Non-default configuration: pass-all-rows spooling with a small cache.
  const file = minimalKtr('b1p3-blockingstep');
  addElement(file, 'BlockingStep', 'Block rows');
  setFieldPath(file, 'Block rows', 'pass_all_rows', 'Y');
  setFieldPath(file, 'Block rows', 'cache_size', '100');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<pass_all_rows>Y<\/pass_all_rows>/);
  assert.match(after, /<cache_size>100<\/cache_size>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('DetectEmptyStream template has an empty body per source: no config tags', () => {
  // DetectEmptyStreamMeta does not override getXML (BaseStepMeta.getXML
  // returns ""); readData/setDefault are empty. The template must not invent
  // config tags.
  const ref = getReference('trans', 'DetectEmptyStream');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.equal(parsed.step.type, 'DetectEmptyStream');
  assert.ok(!parsed.step.fields, 'DetectEmptyStream template must not invent <fields>');
  assert.ok(!parsed.step.head_name, 'DetectEmptyStream template must not invent <head_name>');
  assert.ok(!parsed.step.tail_name, 'DetectEmptyStream template must not invent <tail_name>');
  assert.ok(!parsed.step.pass_all_rows, 'DetectEmptyStream template must not invent <pass_all_rows>');
  assert.ok(!parsed.step.cache_size, 'DetectEmptyStream template must not invent <cache_size>');
  assert.ok(!parsed.step.resultfieldname, 'DetectEmptyStream template must not invent <resultfieldname>');
});

test('DetectLastRow template follows DetectLastRowMeta.getXML: single resultfieldname, default result', () => {
  // getXML() emits only <resultfieldname>; setDefault() sets "result".
  const ref = getReference('trans', 'DetectLastRow');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.step, 'resultfieldname'),
    'DetectLastRow template must carry <resultfieldname>');
  assert.equal(parsed.step.resultfieldname, 'result', 'resultfieldname defaults to "result"');

  // Non-default configuration: custom boolean result field name.
  const file = minimalKtr('b1p3-detectlastrow');
  addElement(file, 'DetectLastRow', 'Flag last row');
  setFieldPath(file, 'Flag last row', 'resultfieldname', 'is_last');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<resultfieldname>is_last<\/resultfieldname>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B1p3 package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b1p3-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b1p3-package</name></info>',
    '<step><name>Append streams</name><type>Append</type></step>',
    '<step><name>Block rows</name><type>BlockingStep</type></step>',
    '<step><name>Detect empty stream</name><type>DetectEmptyStream</type></step>',
    '<step><name>Flag last row</name><type>DetectLastRow</type></step>',
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
