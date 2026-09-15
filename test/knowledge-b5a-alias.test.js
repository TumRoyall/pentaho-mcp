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

// Batch B5a (alias pairs): trans ScriptValue + ScriptValuesMod (share
// ScriptValuesMetaMod), trans Flattener + Flatterner (share FlattenerMeta),
// trans TeraFast + TeraFastPlugin (share TeraFastMeta), job
// MAIL_VALIDATOR + JobCategory.Category.Mail_VALIDATOR (share
// JobEntryMailValidator).
// Source: pentaho-kettle @ 1a939ab5cabe4517867879684aeca2a526bcc638, branch 9.4.
// Per-plan source notes: docs/inventory/2026-09-15-b5a-source-notes.md.
//
// Alias verdicts (all TRUE aliases — same class, same serializer; one
// shared reference file + two catalog rows each):
// - trans ScriptValueMod,ScriptValue -> ScriptValuesMetaMod
//   (kettle-steps.xml line 26, comma pair) AND trans ScriptValuesMod ->
//   same class (annotation @Step(id="ScriptValuesMod"),
//   ScriptValuesMetaMod.java lines 81-83). Shared file:
//   trans/ScriptValueMod.md (pre-existing, canonical type ScriptValueMod).
// - trans Flattener,Flatterner -> FlattenerMeta (kettle-steps.xml line 54,
//   comma pair; Flatterner is a spelling alias). Shared file:
//   trans/Flattener.md (canonical type Flattener). FlattenerMeta.getXML()
//   (lines 153-167): field_name then PAIRED <fields> of name-only
//   <field> items. setDefault() (lines 100-104): 0 targets.
// - trans TeraFast,TeraFastPlugin -> TeraFastMeta (annotation
//   @Step(id="TeraFast,TeraFastPlugin"), TeraFastMeta.java lines 56-61).
//   Shared file: trans/TeraFast.md (canonical type TeraFast). No
//   per-class getXML: inherited AbstractStepMeta.getXML()
//   (AbstractStepMeta.java lines 131-134) emits one flat tag per property
//   key in ALPHABETICAL order (TreeMap, KeyValueSet.java line 50),
//   including <connection> (the DB connection NAME — the B2a fixture
//   pitfall APPLIES here). setDefault() (TeraFastMeta.java lines
//   277-286). Missing <sessions>/<error_limit> throws on load
//   (Integer.parseInt with no null-guard, IntegerPluginProperty.java
//   lines 81-84).
// - job MAIL_VALIDATOR,JobCategory.Category.Mail_VALIDATOR ->
//   JobEntryMailValidator (kettle-job-entries.xml line 54, comma pair).
//   Shared file: job/MAIL_VALIDATOR.md (canonical type MAIL_VALIDATOR).
//   JobEntryMailValidator.getXML() (lines 146-157) emits the 5 plugin tags
//   BEFORE super.getXML() (line 154) — reversed vs every other entry.
//   Constructor (lines 67-74): timeout "0", emailSender
//   "noreply@domain.com".
//
// Shared-serializer consequence (verified against src/core/edit.js):
// prepareElementTemplate() rewrites <name> but NOT <type>, so
// addElement() with an ALIAS id inserts the CANONICAL <type> from the
// shared template. That is correct behavior (same class either way) and
// is asserted below — not a bug to work around.
const BATCH = [
  { kind: 'trans', xmlType: 'ScriptValue', alias: 'SCRIPT_VALUE', sharedFile: 'trans/ScriptValueMod.md', canonicalType: 'ScriptValueMod' },
  { kind: 'trans', xmlType: 'ScriptValuesMod', alias: 'SCRIPT_VALUES_MOD', sharedFile: 'trans/ScriptValueMod.md', canonicalType: 'ScriptValueMod' },
  { kind: 'trans', xmlType: 'Flattener', alias: 'FLATTENER', sharedFile: 'trans/Flattener.md', canonicalType: 'Flattener' },
  { kind: 'trans', xmlType: 'Flatterner', alias: 'FLATTERNER', sharedFile: 'trans/Flattener.md', canonicalType: 'Flattener' },
  { kind: 'trans', xmlType: 'TeraFast', alias: 'TERA_FAST', sharedFile: 'trans/TeraFast.md', canonicalType: 'TeraFast' },
  { kind: 'trans', xmlType: 'TeraFastPlugin', alias: 'TERA_FAST_PLUGIN', sharedFile: 'trans/TeraFast.md', canonicalType: 'TeraFast' },
  { kind: 'job', xmlType: 'MAIL_VALIDATOR', alias: 'MAIL_VALIDATOR', sharedFile: 'job/MAIL_VALIDATOR.md', canonicalType: 'MAIL_VALIDATOR' },
  { kind: 'job', xmlType: 'JobCategory.Category.Mail_VALIDATOR', alias: 'CATEGORY_MAIL_VALIDATOR', sharedFile: 'job/MAIL_VALIDATOR.md', canonicalType: 'MAIL_VALIDATOR' },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-b5a-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function minimalKtr(name = 'b5a', withConnection = false) {
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

test('B5a catalog rows exist, are canonical, and are generator-eligible for PDI 9.4', () => {
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

test('B5a alias pairs resolve to their shared reference file with the canonical direct-child <type>', () => {
  for (const { kind, xmlType, sharedFile, canonicalType } of BATCH) {
    const ref = getReference(kind, xmlType);
    assert.equal(ref.file, sharedFile,
      `${kind}/${xmlType} must resolve to shared reference ${sharedFile}`);
    const block = firstFencedXml(ref.content);
    assert.ok(block, `${ref.file}: no fenced xml block`);
    assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
    const parsed = parser.parse(block);
    const rootTag = kind === 'job' ? 'entry' : 'step';
    assert.ok(parsed[rootTag], `${ref.file}: root should be <${rootTag}>`);
    // The shared template carries the CANONICAL type (same serializer
    // serves every alias of the pair).
    assert.equal(parsed[rootTag].type, canonicalType,
      `${ref.file}: direct-child <type> is the canonical ${canonicalType}`);
  }
});

test('B5a canonical ids insert with their exact <type>; alias ids insert the canonical <type> (shared serializer)', () => {
  for (const { kind, xmlType, canonicalType } of BATCH) {
    const file = kind === 'job'
      ? freshKjb(`b5a-${canonicalType.toLowerCase()}-${xmlType.length}`)
      : minimalKtr(`b5a-${canonicalType.toLowerCase()}-${xmlType.length}`,
        canonicalType === 'TeraFast');
    const out = addElement(file, xmlType, `New ${canonicalType} & <Item>`);
    const after = readFileSync(file, 'utf8');
    // Alias or canonical: the inserted block always carries the canonical
    // type because prepareElementTemplate() rewrites <name> but not
    // <type> — correct, since both IDs load into the same class.
    assert.match(after, new RegExp(`<type>${canonicalType}<\\/type>`));
    assert.match(after, /<name>New .* &amp; &lt;Item&gt;<\/name>/);
    assert.equal(XMLValidator.validate(after), true);
    assert.equal(validateFile(file).summary.errors, 0);
    assert.equal(out.catalogStatus, 'canonical');
    assert.equal(out.manualReviewRequired, false);
  }
});

test('Flattener template follows FlattenerMeta.getXML: field_name then name-only fields', () => {
  // FlattenerMeta.getXML() (lines 153-167): field_name, then a PAIRED
  // <fields> wrapper (always emitted) of <field> items carrying ONLY
  // <name>. setDefault() (lines 100-104): 0 targets. Registered as the
  // comma pair Flattener,Flatterner (kettle-steps.xml line 54).
  const ref = getReference('trans', 'Flattener');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block, ['<field_name>', '<fields>'], 'Flattener');
  assert.ok(!/<connection(?:\s|\/?>)/.test(block),
    'Flattener template must not carry <connection> (no DB reference in source)');
  const fields = parsed.step.fields;
  assert.ok(fields && fields.field, 'Flattener template must carry <fields>/<field>');
  const items = Array.isArray(fields.field) ? fields.field : [fields.field];
  for (const f of items) {
    assert.ok(hasOwn(f, 'name'), 'every <field> must carry <name> per getXML line 161');
  }
  assert.ok(block.includes('</fields>'),
    'Flattener template must carry a paired <fields> wrapper per getXML()');

  // Non-default configuration: flatten one column into three.
  const file = minimalKtr('b5a-flattener');
  addElement(file, 'Flatterner', 'Spread months');
  setFieldPath(file, 'Spread months', 'field_name', 'MONTH_VALUE');
  setFields(file, 'Spread months', 'fields', 'field', [
    { name: 'JAN' },
    { name: 'FEB' },
    { name: 'MAR' },
  ]);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<type>Flattener<\/type>/);
  assert.match(after, /<field_name>MONTH_VALUE<\/field_name>/);
  const reparsed = parser.parse(after);
  const steps = Array.isArray(reparsed.transformation.step)
    ? reparsed.transformation.step
    : [reparsed.transformation.step];
  const step = steps.find((s) => s.name === 'Spread months');
  assert.ok(step, 'inserted step present');
  const configured = Array.isArray(step.fields.field)
    ? step.fields.field
    : [step.fields.field];
  assert.equal(configured.length, 3);
  assert.equal(configured[2].name, 'MAR');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('TeraFast template follows the property serializer: alphabetical tags including <connection>', () => {
  // No per-class getXML: AbstractStepMeta.getXML()
  // (AbstractStepMeta.java lines 131-134) emits one flat tag per
  // property key in ALPHABETICAL order (TreeMap, KeyValueSet.java line
  // 50). Registered as @Step(id="TeraFast,TeraFastPlugin")
  // (TeraFastMeta.java lines 56-61). <connection> is the DB connection
  // NAME (AbstractStepMeta.java lines 56-69; resolved in initDbMeta,
  // lines 120-124) — the B2a fixture pitfall applies.
  const ref = getReference('trans', 'TeraFast');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<connection>', '<controlfile_path>', '<datafile_path>', '<error_limit>',
      '<fastload_path>', '<logfile_path>', '<sessions>', '<stream_field_list>',
      '<table_field_list>', '<target_table>', '<truncate_table>',
      '<use_control_file>', '<variable_substitution>'],
    'TeraFast');
  assert.ok(hasOwn(parsed.step, 'connection'),
    'TeraFast template must carry <connection> (DB connection reference)');
  assert.match(block, /<connection>\$\{CONN\}<\/connection>/);
  assert.ok(hasOwn(parsed.step, 'sessions') && hasOwn(parsed.step, 'error_limit'),
    '<sessions>/<error_limit> must be present (missing tag throws on load)');
  assert.equal(String(parsed.step.sessions), '2', 'sessions defaults 2 (setDefault)');
  assert.equal(String(parsed.step.error_limit), '25', 'error_limit defaults 25 (setDefault)');
  assert.equal(parsed.step.truncate_table, 'Y', 'truncate_table defaults Y (setDefault true)');

  // Non-default configuration: staging table with four comma-joined columns.
  // Fixture MUST declare ${CONN} (undefined-connection rule).
  const file = minimalKtr('b5a-terafast', true);
  addElement(file, 'TeraFastPlugin', 'Bulk load staging');
  setFieldPath(file, 'Bulk load staging', 'connection', '${TERADATA_CONN}');
  setFieldPath(file, 'Bulk load staging', 'target_table', '${TARGET_TABLE}_${RUN_ID}');
  setFieldPath(file, 'Bulk load staging', 'table_field_list', 'ID,NAME,AMOUNT,LOAD_DT');
  setFieldPath(file, 'Bulk load staging', 'stream_field_list', 'ID,NAME,AMOUNT,LOAD_DT');
  setFieldPath(file, 'Bulk load staging', 'truncate_table', 'N');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<type>TeraFast<\/type>/);
  assert.match(after, /<connection>\$\{TERADATA_CONN\}<\/connection>/);
  assert.match(after, /<table_field_list>ID,NAME,AMOUNT,LOAD_DT<\/table_field_list>/);
  assert.match(after, /<truncate_table>N<\/truncate_table>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('MAIL_VALIDATOR template follows getXML: plugin tags BEFORE super tags', () => {
  // JobEntryMailValidator.getXML() (lines 146-157) emits smtpCheck,
  // timeout, defaultSMTP, emailSender, emailAddress (lines 148-152)
  // BEFORE super.getXML() (line 154) — reversed vs every other entry.
  // Registered as the comma pair
  // MAIL_VALIDATOR,JobCategory.Category.Mail_VALIDATOR
  // (kettle-job-entries.xml line 54). Constructor (lines 67-74):
  // timeout "0", emailSender "noreply@domain.com".
  const ref = getReference('job', 'MAIL_VALIDATOR');
  const block = firstFencedXml(ref.content);
  const parsed = parser.parse(block);
  assertTagOrder(block,
    ['<smtpCheck>', '<timeout>', '<defaultSMTP>', '<emailSender>',
      '<emailAddress>', '<name>', '<description>', '<type>'],
    'MAIL_VALIDATOR');
  assert.equal(String(parsed.entry.timeout), '0', 'timeout defaults to "0" (constructor)');
  assert.equal(parsed.entry.emailSender, 'noreply@domain.com',
    'emailSender defaults to noreply@domain.com (constructor)');
  assert.match(block, /<emailAddress>\$\{EMAIL\}<\/emailAddress>/);

  // Non-default configuration via the dotted alias: SMTP check.
  const file = freshKjb('b5a-mail-validator');
  addElement(file, 'JobCategory.Category.Mail_VALIDATOR', 'Verify signup email');
  setFieldPath(file, 'Verify signup email', 'smtpCheck', 'Y');
  setFieldPath(file, 'Verify signup email', 'timeout', '30');
  setFieldPath(file, 'Verify signup email', 'emailAddress', '${EMAIL}');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<type>MAIL_VALIDATOR<\/type>/);
  assert.match(after, /<smtpCheck>Y<\/smtpCheck>/);
  assert.match(after, /<timeout>30<\/timeout>/);
  assert.match(after, /<emailAddress>\$\{EMAIL\}<\/emailAddress>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('ScriptValue/ScriptValuesMod share the ScriptValueMod serializer (no new reference file)', () => {
  // Registry: <step id="ScriptValueMod,ScriptValue"> (kettle-steps.xml
  // line 26) -> ScriptValuesMetaMod, plus @Step(id="ScriptValuesMod")
  // (ScriptValuesMetaMod.java lines 81-83) -> the SAME class. All three
  // strings share trans/ScriptValueMod.md (pre-existing); this batch
  // adds NO new reference file for the pair.
  for (const xmlType of ['ScriptValue', 'ScriptValuesMod']) {
    const ref = getReference('trans', xmlType);
    assert.equal(ref.file, 'trans/ScriptValueMod.md',
      `${xmlType} must resolve to the shared ScriptValueMod reference`);
    const block = firstFencedXml(ref.content);
    const parsed = parser.parse(block);
    assert.equal(parsed.step.type, 'ScriptValueMod',
      'shared template carries the canonical ScriptValueMod type');
  }
  const file = minimalKtr('b5a-scriptvalue');
  addElement(file, 'ScriptValue', 'Uppercase names');
  const after = readFileSync(file, 'utf8');
  assert.match(after, /<type>ScriptValueMod<\/type>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('knowledgeCoverage reports the B5a package as canonical with nothing missing', () => {
  const ktr = path.join(tmp, 'b5a-package.ktr');
  writeFileSync(ktr, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation><info><name>b5a-package</name></info>',
    '<connection><name>${CONN}</name></connection>',
    '<step><name>Legacy script</name><type>ScriptValue</type></step>',
    '<step><name>Mod script</name><type>ScriptValuesMod</type></step>',
    '<step><name>Spread months</name><type>Flattener</type></step>',
    '<step><name>Spread months typo</name><type>Flatterner</type></step>',
    '<step><name>Bulk load</name><type>TeraFast</type></step>',
    '<step><name>Bulk load plugin</name><type>TeraFastPlugin</type></step>',
    '<order/></transformation>',
  ].join('\n'));
  const kjb = path.join(tmp, 'b5a-package.kjb');
  writeFileSync(kjb, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job><name>b5a-package</name><entries>',
    '<entry><name>Verify email</name><type>MAIL_VALIDATOR</type></entry>',
    '<entry><name>Verify email legacy</name><type>JobCategory.Category.Mail_VALIDATOR</type></entry>',
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
