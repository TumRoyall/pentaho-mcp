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

// Batch B1 (package 1): RowsFromResult, MappingInput, MappingOutput.
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
const BATCH = [
  { kind: 'trans', xmlType: 'RowsFromResult', alias: 'ROWS_FROM_RESULT' },
  { kind: 'trans', xmlType: 'MappingInput', alias: 'MAPPING_INPUT' },
  { kind: 'trans', xmlType: 'MappingOutput', alias: 'MAPPING_OUTPUT' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

function fencedXmlBlocks(content) {
  const blocks = [];
  const re = /```xml\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) blocks.push(m[1].trim());
  return blocks;
}

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b1-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b1') {
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

test('B1 catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B1 references resolve and their first XML block is one valid <step> with the right direct-child <type>', () => {
  for (const { kind, xmlType } of BATCH) {
    const ref = getReference(kind, xmlType);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    assert.ok(parsed.step, `${ref.file}: root should be <step>`);
    // Direct-child <type> (not a nested field <type>).
    assert.equal(parsed.step.type, xmlType, `${ref.file}: direct-child <type>`);
  }
});

test('B1 templates insert via addElement with escaped names and validate clean', () => {
  for (const { kind, xmlType } of BATCH) {
    void kind;
    const file = minimalKtr(`b1-${xmlType.toLowerCase()}`);
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

test('RowsFromResult template follows RowsFromResultMeta.getXML: <fields>/<field> name/type/length/precision, no select_unspecified', () => {
  const ref = getReference('trans', 'RowsFromResult');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  const fields = parsed.step.fields;
  assert.ok(fields, 'RowsFromResult template must carry <fields>');
  assert.ok(fields.field, 'RowsFromResult template must carry <fields>/<field>');
  const field = Array.isArray(fields.field) ? fields.field[0] : fields.field;
  for (const tag of ['name', 'type', 'length', 'precision']) {
    assert.ok(Object.prototype.hasOwnProperty.call(field, tag), `field must carry <${tag}>`);
  }
  assert.ok(!Object.prototype.hasOwnProperty.call(fields, 'select_unspecified'),
    'RowsFromResult has no select_unspecified in source; template must not invent it');

  // Non-default configuration: two fields per the source structure.
  const file = minimalKtr('b1-rowsfromresult');
  addElement(file, 'RowsFromResult', 'Get rows from result');
  setFields(file, 'Get rows from result', 'fields', 'field', [
    { name: 'order_id', type: 'Integer', length: '10', precision: '0' },
    { name: 'order_date', type: 'Date', length: '-2', precision: '-2' },
  ]);
  const after = readFileSync(file, 'utf8');
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Get rows from result');
  assert.ok(step, 'inserted step present');
  const items = Array.isArray(step.fields.field) ? step.fields.field : [step.fields.field];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'order_id');
  assert.equal(items[0].type, 'Integer');
  assert.equal(items[1].name, 'order_date');
  assert.equal(items[1].type, 'Date');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('MappingInput template follows MappingInputMeta.getXML: fields plus <select_unspecified> inside <fields>', () => {
  const ref = getReference('trans', 'MappingInput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  const fields = parsed.step.fields;
  assert.ok(fields, 'MappingInput template must carry <fields>');
  assert.ok(fields.field, 'MappingInput template must carry <fields>/<field>');
  const field = Array.isArray(fields.field) ? fields.field[0] : fields.field;
  for (const tag of ['name', 'type', 'length', 'precision']) {
    assert.ok(Object.prototype.hasOwnProperty.call(field, tag), `field must carry <${tag}>`);
  }
  assert.ok(Object.prototype.hasOwnProperty.call(fields, 'select_unspecified'),
    '<select_unspecified> must sit inside <fields> per MappingInputMeta.getXML()');

  // Non-default configuration: two fields of different types + select_unspecified.
  const file = minimalKtr('b1-mappinginput');
  addElement(file, 'MappingInput', 'Mapping input specification');
  setFields(file, 'Mapping input specification', 'fields', 'field', [
    { name: 'customer_id', type: 'Integer', length: '10', precision: '0' },
    { name: 'customer_name', type: 'String', length: '50', precision: '-1' },
  ]);
  setFieldPath(file, 'Mapping input specification', 'fields/select_unspecified', 'Y');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<fields>[\s\S]*<select_unspecified>Y<\/select_unspecified>[\s\S]*<\/fields>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('MappingOutput template uses inherited BaseStepMeta serialization: no own <fields> block', () => {
  // MappingOutputMeta does not override getXML/loadXML (BaseStepMeta.getXML
  // returns ""); renames are driven by the calling Mapping step, so the
  // template must not invent a <fields> block copied from MappingInput.
  const ref = getReference('trans', 'MappingOutput');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assert.equal(parsed.step.type, 'MappingOutput');
  assert.ok(!parsed.step.fields, 'MappingOutput template must not invent <fields>');
});

test('MappingOutput secondary example routes steps and renames fields per MappingIODefinition', () => {
  // The second fenced block documents the CALLER-side output mapping
  // (<mappings>/<output>/<mapping>), not the MappingOutput step itself.
  // Routing (step names) and rename (field names) must stay separated:
  // input_step = MappingOutput step inside the sub-transformation,
  // output_step = parent-side target step (Mapping.pickupTargetStepsFor),
  // connector parent/child = sub-side/parent-side field names
  // (MappingIODefinition ctor + getXML, MappingOutputMeta.getFields).
  const ref = getReference('trans', 'MappingOutput');
  const blocks = fencedXmlBlocks(ref.content);
  assert.ok(blocks.length >= 2, `${ref.file}: expected a secondary routing/rename example`);
  const block = blocks[1];
  assert.equal(XMLValidator.validate(block), true, `${ref.file}: secondary example must parse`);
  const parsed = parser.parse(block);
  const mapping = parsed?.mappings?.output?.mapping;
  assert.ok(mapping, 'secondary example must carry <mappings>/<output>/<mapping>');

  // Tag order follows MappingIODefinition.getXML(): input_step,
  // output_step, main_path, rename_on_output, description, connectors.
  // ('<description' prefix-matches the self-closing '<description/>'.)
  const order = ['<input_step>', '<output_step>', '<main_path>', '<rename_on_output>', '<description', '<connector>'];
  let at = -1;
  for (const tag of order) {
    const i = block.indexOf(tag);
    assert.ok(i > at, `${tag} must follow MappingIODefinition.getXML() order`);
    at = i;
  }

  // Routing uses step names: the sub-side MappingOutput step and the
  // parent-side target step. They must differ, and neither is a field.
  assert.match(mapping.input_step, /MAPPING_OUTPUT/, 'input_step names the MappingOutput step in the sub');
  assert.match(mapping.output_step, /PARENT_TARGET/, 'output_step names the parent-side target step');
  assert.notEqual(mapping.input_step, mapping.output_step);

  // Rename uses field names with the output-side direction: parent =
  // sub-side field, child = parent-side field.
  const connectors = Array.isArray(mapping.connector) ? mapping.connector : [mapping.connector];
  assert.ok(connectors.length >= 1, 'example must show at least one <connector> rename');
  for (const c of connectors) {
    assert.match(c.parent, /SUB.*FIELD/, 'connector <parent> is the sub-side field name');
    assert.match(c.child, /PARENT.*FIELD/, 'connector <child> is the parent-side field name');
    assert.notEqual(c.parent, c.child);
    assert.notEqual(c.parent, mapping.input_step);
    assert.notEqual(c.child, mapping.output_step);
  }
});

test('knowledgeCoverage reports the B1 package as canonical with nothing missing', () => {
  const file = path.join(tmp, 'b1-package.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b1-package</name></info>',
    '<step><name>Get rows from result</name><type>RowsFromResult</type></step>',
    '<step><name>Mapping input specification</name><type>MappingInput</type></step>',
    '<step><name>Mapping output specification</name><type>MappingOutput</type></step>',
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
