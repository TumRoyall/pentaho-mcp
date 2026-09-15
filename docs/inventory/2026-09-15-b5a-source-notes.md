# B5a source notes — alias pairs (8 IDs = 4 pairs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638` (verified
`git rev-parse HEAD` in pentaho-kettle before reading).
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b5a-alias.test.js` (exit 0).
Full test run + review left to Kiro.

## ALIAS VERDICTS (all four pairs are TRUE aliases)

| # | Pair | Registry evidence | Class | Verdict |
|---|---|---|---|---|
| 1 | trans `ScriptValue` + `ScriptValuesMod` | `kettle-steps.xml` line 26 `<step id="ScriptValueMod,ScriptValue">` → `...scriptvalues_mod.ScriptValuesMetaMod` **AND** `@Step(id="ScriptValuesMod")` (`ScriptValuesMetaMod.java` lines 81-83) → same class | `ScriptValuesMetaMod` (serializer `getXML()` line 451, `setDefault()` line 374 — already documented in `trans/ScriptValueMod.md`) | TRUE alias (3 strings, 1 class). NO new reference file — 2 new rows share `trans/ScriptValueMod.md` |
| 2 | trans `Flattener` + `Flatterner` | `kettle-steps.xml` line 54 `<step id="Flattener,Flatterner">` → `...flattener.FlattenerMeta` | `FlattenerMeta` (`getXML()` lines 153-167, `readData()` 134-151, `setDefault()` 100-104) | TRUE alias (`Flatterner` = spelling alias). 1 NEW shared file `trans/Flattener.md`, canonical type `Flattener` |
| 3 | trans `TeraFast` + `TeraFastPlugin` | `@Step(id="TeraFast,TeraFastPlugin")` (`TeraFastMeta.java` lines 56-61) → `...terafastbulkloader.TeraFastMeta` | `TeraFastMeta` (no per-class serializer; inherits `AbstractStepMeta.getXML()`, `AbstractStepMeta.java` lines 131-134; `setDefault()` lines 277-286) | TRUE alias. 1 NEW shared file `trans/TeraFast.md`, canonical type `TeraFast` |
| 4 | job `MAIL_VALIDATOR` + `JobCategory.Category.Mail_VALIDATOR` | `kettle-job-entries.xml` line 54 `<job-entry id="MAIL_VALIDATOR,JobCategory.Category.Mail_VALIDATOR">` → `...mailvalidator.JobEntryMailValidator` | `JobEntryMailValidator` (`getXML()` lines 146-157, `loadXML()` 159-173, ctor 67-74) | TRUE alias (dotted i18n-key-style string). 1 NEW shared file `job/MAIL_VALIDATOR.md`, canonical type `MAIL_VALIDATOR` |

No pair required two separate references. B5 alias classification for these
8 IDs is COMPLETE (see coverage note below).

**Shared-reference mechanics (verified in `src/core/edit.js`):**
`prepareElementTemplate()` (lines 121-145) rewrites `<name>` (and
`xloc`/`yloc`) but NOT `<type>`. Therefore `addElement()` with an alias
id inserts the CANONICAL `<type>` from the shared template — correct,
because both IDs load into the same class. The batch test asserts this
explicitly. Global invariant
`test/knowledge.test.js` line 224 checks only the root tag (not
type-equality), and line 209 requires unique `type` aliases + unique
`xml_type` per kind (both hold: all 8 aliases/xml_types below are
distinct) — shared files break neither.

## 1. trans Flattener / Flatterner — `FlattenerMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/flattener/FlattenerMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 54:
  `<step id="Flattener,Flatterner" ... classname ...flattener.FlattenerMeta ...
  category ...BaseStep.Category.Transform ...>`.
- `allocate(int nrfields)` (lines 91-93): sizes `targetField[]`.
- `setDefault()` (lines 100-104): 0 targets (`fieldName` stays null).
- `readData(Node)` (lines 134-151), via `loadXML` (lines 87-89): reads
  `field_name` (line 136); counts `<field>` in `<fields>` (lines 138-139);
  each item reads `name` (line 145).
- `getXML()` (lines 153-167): emits `field_name` (line 156), then PAIRED
  `<fields>` ALWAYS emitted (lines 158/164); each `<field>` carries ONLY
  `<name>` (line 161). No other tags — identical for both IDs (shared code).
- `getFields(...)` (lines 107-132): REMOVES the source field (throws
  `UnableToLocateFieldInInputFields` when absent, lines 115-117;
  `FlattenFieldRequired` when empty, lines 129-131), then clones its TYPE
  onto every target (lines 122-128).
- `check()` (lines 201+) requires input.

Emitted tag order: `[<field_name>, <fields>]`.

## 2. trans TeraFast / TeraFastPlugin — `TeraFastMeta`

- Class: `plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java`
- Registry: annotation `@Step(id = "TeraFast,TeraFastPlugin", ...)`
  (lines 56-61, category Bulk).
- NO per-class `getXML()`/`loadXML()`: inherits `AbstractStepMeta`
  (`engine/src/main/java/org/pentaho/di/core/util/AbstractStepMeta.java`):
  `getXML()` (lines 131-134) = `PluginPropertyHandler.toXml(properties)`;
  `loadXML()` (lines 111-114) walks `LoadXml` then `initDbMeta` resolves
  the `<connection>` NAME against the transformation's connections (lines
  120-124) — **the B2a connection-fixture pitfall APPLIES** (template
  carries `<connection>`, fixtures must declare it).
- Property keys (`TeraFastMeta.java` lines 93-115 + `connection` from
  `AbstractStepMeta.java` lines 56-69): `connection`, `fastload_path`,
  `controlfile_path`, `datafile_path`, `logfile_path`, `sessions`,
  `error_limit`, `use_control_file`, `target_table`, `truncate_table`,
  `table_field_list`, `stream_field_list`, `variable_substitution`.
- Emission order is ALPHABETICAL: `KeyValueSet` stores entries in a
  `TreeMap` (`.../KeyValueSet.java` line 50), and each property appends
  `addTagValue(key, value)` (`StringPluginProperty.java` lines 72-74).
- Types: strings verbatim; booleans Y/N (`addTagValue` bool overload,
  `XMLHandler.java` lines 869-871; `BOOLEAN_STRING_TRUE = "Y"`,
  `PluginProperty.java` line 62); ints plain; lists COMMA-JOINED in ONE
  tag (`SEPARATOR_CHAR = ','`, `StringListPluginProperty.java` line 57;
  empty lists OMITTED, lines 100-106). **PITFALL:**
  `IntegerPluginProperty.loadXml` does `Integer.parseInt` with NO
  null-guard (`IntegerPluginProperty.java` lines 81-84) — a missing
  `<sessions>`/`<error_limit>` throws.
- `setDefault()` (lines 277-286): fastload `/usr/bin/fastload`, datafile
  `${Internal.Step.CopyNr}.dat`, sessions 2, errorLimit 25,
  truncate/variableSubstitution true, targetTable
  `${TARGET_TABLE}_${RUN_ID}`, useControlFile true.
- `getFields()` (lines 295-299): NO-OP pass-through. `use_control_file=N`
  reads the live table schema over the DB connection (lines 306-323) —
  needs a real Teradata; no runtime test here.

Emitted tag order (alphabetical): `[<connection>, <controlfile_path>,
<datafile_path>, <error_limit>, <fastload_path>, <logfile_path>,
<sessions>, <stream_field_list>, <table_field_list>, <target_table>,
<truncate_table>, <use_control_file>, <variable_substitution>]`.

## 3. job MAIL_VALIDATOR / JobCategory.Category.Mail_VALIDATOR — `JobEntryMailValidator`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/mailvalidator/JobEntryMailValidator.java`
- Registry: `engine/src/main/resources/kettle-job-entries.xml`, line 54:
  `<job-entry id="MAIL_VALIDATOR,JobCategory.Category.Mail_VALIDATOR" ...
  classname ...mailvalidator.JobEntryMailValidator ... category
  ...JobCategory.Category.Mail ...>`.
- `getXML()` (lines 146-157): emits `smtpCheck`, `timeout`,
  `defaultSMTP`, `emailSender`, `emailAddress` (lines 148-152) and THEN
  `super.getXML()` (line 154) — REVERSED vs every other job entry (super
  normally first). The shared template keeps this exact order.
- `loadXML()` (lines 159-173): `super.loadXML()` first (line 162), then
  the 5 tags; `smtpCheck` Y/N missing → false.
- Init: constructor (lines 67-74): `emailAddress`/`defaultSMTP` null,
  `smtpCheck` false, `timeout = "0"`, `emailSender =
  "noreply@domain.com"`; no separate `setDefault()`.
- `evaluates()` = true (lines 277-279). No `<connection>`.
- Wrapper: `JobEntryBase.getXML()` (lines 415-419) +
  `JobEntryCopy.getXML()` (lines 102-113) — standing AFTER the plugin
  tags for this entry.

Emitted order: `[<smtpCheck>, <timeout>, <defaultSMTP>, <emailSender>,
<emailAddress>]` then super (`name`, `description`, `type`,
`attributes`) then copy tags.

## 4. trans ScriptValue / ScriptValuesMod — shared `ScriptValuesMetaMod`

- Registry A: `engine/src/main/resources/kettle-steps.xml`, line 26:
  `<step id="ScriptValueMod,ScriptValue">` →
  `...scriptvalues_mod.ScriptValuesMetaMod`.
- Registry B: annotation `@Step(id = "ScriptValuesMod", ...)`
  (`.../scriptvalues_mod/ScriptValuesMetaMod.java`, lines 81-83) → the
  SAME class.
- Serializer evidence (`ScriptValuesMetaMod.java`): `loadXML()` line 234,
  `setDefault()` line 374, `getXML()` line 451 — already documented in
  the pre-existing canonical reference `trans/ScriptValueMod.md`
  (xml_type `ScriptValueMod`, alias `SCRIPT`). All three strings share
  one serializer; NO new reference file was created for this pair (plan:
  no implementation cloning for a second registry name).
- New rows point at the existing file; its first block keeps the
  canonical `<type>ScriptValueMod</type>`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: SCRIPT_VALUE, xml_type: ScriptValue, file: trans/ScriptValueMod.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: SCRIPT_VALUES_MOD, xml_type: ScriptValuesMod, file: trans/ScriptValueMod.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FLATTENER, xml_type: Flattener, file: trans/Flattener.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FLATTERNER, xml_type: Flatterner, file: trans/Flattener.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: TERA_FAST, xml_type: TeraFast, file: trans/TeraFast.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: TERA_FAST_PLUGIN, xml_type: TeraFastPlugin, file: trans/TeraFast.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: MAIL_VALIDATOR, xml_type: MAIL_VALIDATOR, file: job/MAIL_VALIDATOR.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: CATEGORY_MAIL_VALIDATOR, xml_type: JobCategory.Category.Mail_VALIDATOR, file: job/MAIL_VALIDATOR.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
