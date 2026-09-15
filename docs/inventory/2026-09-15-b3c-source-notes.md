# B3c source notes — pivot + validate (4 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b3c-pivot-validate.test.js` (exit 0).
Full test run + review left to Kiro.

**Wrapper (all four):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**No-DB note (all four):** none of these four IDs references a database
connection. There is NO `<connection>` tag in any of their `getXML()` methods,
and the B2a connection-fixture pitfall does NOT apply. Templates must not add
one.

## 1. trans Normaliser — `NormaliserMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/normaliser/NormaliserMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 53:
  `<step id="Normaliser" ... classname ...normaliser.NormaliserMeta ...
  category ...BaseStep.Category.Transform ...>`.
- `allocate(int nrfields)` (lines 140-145): sizes `normaliserFields[]`
  (each a `NormaliserField` with `name`/`value`/`norm`, lines 384-398).
- `setDefault()` (lines 185-197): `typeField = "typefield"`, 0 fields (loop
  lines 192-196 never runs).
- `readData(Node)` (lines 162-182), via `loadXML` (lines 136-138): reads
  `<typefield>` (line 164), counts `<field>` in sub-node `<fields>` (lines
  166-167), `allocate(nrfields)` (line 169), each `<field>` reads `name`
  (line 174), `value` (line 175), `norm` (line 176). Missing tags load as
  null (no load-time crash).
- `getXML()` (lines 255-271): emits `<typefield>` FIRST (line 258), then a
  PAIRED `<fields>` wrapper ALWAYS emitted even with zero fields (lines
  260/268); each `<field>` has `<name>` (line 263), `<value>` (line 264),
  `<norm>` (line 265). No other tags.
- `getFields(...)` (lines 200-252): ADDS a `String` type field (length = max
  `<value>` length, line 214/221-224), clones each distinct `<norm>` keeping
  the source column's type (lines 230-242), then REMOVES all normalised
  source columns (lines 246-251). **PITFALL (line 214):**
  `normaliserFields[i].getValue().length()` — NO null-guard, so a `<field>`
  missing `<value>` throws NPE at `getFields()` time. Missing source column
  throws `KettleStepException` (`UnableToFindField`, line 237).
- `check()` (lines 312-371): requires input and every `<name>` present in
  the previous row; requires input streams (lines 360-370).

Emitted tag order: `[<typefield>, <fields>]`.

## 2. trans Denormaliser — `DenormaliserMeta` + `DenormaliserTargetField`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/denormaliser/DenormaliserMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 52:
  `<step id="Denormaliser" ... classname ...denormaliser.DenormaliserMeta ...
  category ...BaseStep.Category.Transform ...>`.
- `allocate(int sizegroup, int nrfields)` (lines 144-147): `groupField[]` +
  `denormaliserTargetField[]`.
- `setDefault()` (lines 154-159): 0 groups + 0 targets.
- `readData(Node)` (lines 212-255), via `loadXML` (lines 140-142): reads
  `<key_field>` (line 214); group names from `<group>`/`<field>`/`<name>`
  (lines 224-227); targets from `<fields>`/`<field>` with 12 tags (lines
  232-249). **Length/precision:** `Const.toInt(..., -1)` (lines 237-240) —
  missing tag loads as `-1`. **Target type:** `setTargetType(String)` maps
  the value-meta NAME string to id (line 235). **Aggregation:**
  `setTargetAggregationType(String)` → `getAggregationType`
  (`DenormaliserTargetField.java` lines 275-287).
- `getXML()` (lines 257-296): emits `<key_field>` (line 260), then `<group>`
  (lines 262-268, each `<field>` has ONLY `<name>`, line 265), then
  `<fields>` (lines 270-293, each `<field>` has exactly 12 tags in order:
  `field_name` line 275, `key_value` line 276, `target_name` line 277,
  `target_type` = desc string via `getTargetTypeDesc()` line 278,
  `target_format` line 279, `target_length` line 280, `target_precision`
  line 281, `target_decimal_symbol` line 282-283, `target_grouping_symbol`
  lines 284-285, `target_currency_symbol` lines 286-287,
  `target_null_string` line 288, `target_aggregation_type` = desc via
  `getTargetAggregationTypeDesc()` lines 289-290). No other tags.
- Aggregation enum: `typeAggrDesc = { "-", "SUM", "AVERAGE", "MIN", "MAX",
  "COUNT_ALL", "CONCAT_COMMA" }` (`DenormaliserTargetField.java` lines
  58-60). **PITFALL (lines 275-287):** unknown string silently loads as
  0 = `"-"` — no error.
- `getFields(...)` (lines 162-210): REMOVES `<key_field>` (throws
  `RequiredKeyField` when empty, lines 174-176; throws when absent from the
  row, lines 169-172), removes source columns, then RE-ADDS each target
  with declared type/format/length/precision/symbols (lines 193-209).

Emitted tag order: `[<key_field>, <group>, <fields>]`.

## 3. trans Validator — `ValidatorMeta` + `Validation`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/validator/ValidatorMeta.java`
  (rules in `.../validator/Validation.java`)
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 59:
  `<step id="Validator" ... classname ...validator.ValidatorMeta ...
  category ...BaseStep.Category.Validation ...>`.
- `allocate(int nrValidations)` (lines 90-92): sizes the `validations` list.
- `setDefault()` (lines 149-152): empty validation list,
  `concatenationSeparator = "|"` (both booleans keep Java default false).
  Ctor `Validation()` (Validation.java lines 106-112): `nullAllowed = true`,
  rest false/empty.
- `loadXML` (lines 94-105): counts `validator_field` DIRECTLY under the step
  node (line 95 — NO wrapper list); `validatingAll`/`concatenatingErrors`
  parse via `"Y".equalsIgnoreCase(...)` (missing tag → false, lines 97-98).
- `getXML()` (lines 107-119): emits `validate_all`, `concat_errors`,
  `concat_separator` (lines 110-112), then each rule's raw
  `Validation.getXML()` block (lines 114-116).
- `Validation.getXML()` (Validation.java lines 132-183): opens tag
  `validator_field` (`XML_TAG`, line 43/135); order: `name` (= FIELD under
  test, line 137), `validation_name` (= rule name, line 138), `max_length`,
  `min_length`, `null_allowed`, `only_null_allowed`,
  `only_numeric_allowed`, `data_type` (value-meta NAME string via
  `ValueMetaFactory.getValueMetaName`, line 146), `data_type_verified`,
  `conversion_mask`, `decimal_symbol`, `grouping_symbol`, then **`max_value`
  BEFORE `min_value`** (lines 152-153), start/end allowed-then-not-allowed
  pairs, two regexes, `error_code`, `error_description`,
  `is_sourcing_values`, `sourcing_step`, `sourcing_field`, finally the
  `<allowed_value>` wrapper ALWAYS emitted paired (lines 171-178) holding
  `<value>` items.
- `Validation(Node)` (lines 185-232): `validation_name` empty falls back to
  the field name — backward-compat (lines 190-192); ALL booleans via
  `"Y".equalsIgnoreCase(...)` (missing → false); `data_type` maps
  string→id (line 201); allowed values read from sub-node `allowed_value` /
  `value` (lines 225-231).
- **PITFALL — swapped names:** `<name>` is the FIELD, `<validation_name>`
  is the rule (lines 137-138) — the reverse of what the tag names suggest.
- **PITFALL — Y/N only:** writing `true`/`false` loads as false silently.
- **PITFALL — max before min:** `max_value` is emitted before `min_value`;
  keep this order.
- Semantics: `supportsErrorHandling()` = true (lines 215-217) — failing rows
  go to the step's error stream. `getStepIOMeta()` (lines 286-305) registers
  one INFO stream per validation with a sourcing step — when
  `is_sourcing_values=Y`, `sourcing_step` is a live step-name reference
  needing a hop (`searchInfoAndTargetSteps`, lines 307-316). Template
  defaults to `N` with static `<allowed_value>` list.

Emitted tag order: `[<validate_all>, <concat_errors>, <concat_separator>,
<validator_field>*]`; inside each rule `[..., <max_value>, <min_value>, ...,
<allowed_value>]`.

## 4. trans Formula — `FormulaMeta` + `FormulaMetaFunction`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/formula/FormulaMeta.java`
  (per-field in `.../formula/FormulaMetaFunction.java`)
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 86:
  `<step id="Formula" ... classname ...formula.FormulaMeta ...
  category ...BaseStep.Category.Scripting ...>`.
- `allocate(int nrCalcs)` (lines 78-80): sizes `formula[]`.
- `setDefault()` (lines 131-133): 0 formulas.
- `loadXML` (lines 82-89): counts `formula` DIRECTLY under the step node
  (line 83 — NO wrapper list); each block parsed by
  `FormulaMetaFunction(Node)` (lines 114-121): `value_type` maps
  string→id (line 117); `value_length`/`value_precision` via
  `Const.toInt(..., -1)` (missing → `-1`, lines 118-119).
- `getXML()` (lines 91-101): emits NO scalar tags — only repeated
  `formula[i].getXML()` blocks (lines 94-98).
  `FormulaMetaFunction.getXML()` (lines 97-112): opens tag `formula`
  (`XML_TAG`, line 37/100); order: `field_name` (line 102),
  `formula_string` (line 103), `value_type` (value-meta NAME string, line
  104), `value_length` (line 105), `value_precision` (line 106),
  `replace_field` (line 107). No other tags.
- `getFields(...)` (lines 150-183): empty `replace_field` + named
  `field_name` = ADD a new field (lines 154-167); named `replace_field` =
  REPLACE that field in place, throwing `KettleStepException` when it does
  not exist (lines 168-181).
- **PITFALL — `<value_type>` is a NAME string** (`Number`, `String`, ...),
  never a numeric id.
- **PITFALL — no wrapper:** `<formula>` blocks sit directly under `<step>` —
  do not invent `<fields>`/`<formulas>`.
- **PITFALL — escaping:** `<`/`&` in `formula_string` must be XML-escaped.

Emitted tag order: `[<formula>*]`; inside each `[<field_name>,
<formula_string>, <value_type>, <value_length>, <value_precision>,
<replace_field>]`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: NORMALISER, xml_type: Normaliser, file: trans/Normaliser.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: DENORMALISER, xml_type: Denormaliser, file: trans/Denormaliser.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: VALIDATOR, xml_type: Validator, file: trans/Validator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FORMULA, xml_type: Formula, file: trans/Formula.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
