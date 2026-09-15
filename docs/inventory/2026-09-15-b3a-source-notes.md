# B3a source notes — cleanse / transform (5 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Wrapper (all five):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**No-DB note (all five):** none of these five IDs references a database
connection. There is NO `<connection>` tag in any of their `getXML()` methods,
and the B2a connection-fixture pitfall does NOT apply. Templates must not add
one; fixtures need no connection declaration.

## 1. trans CheckSum — `CheckSumMeta`

- Class: `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/checksum/CheckSumMeta.java`
- Registry: annotation `@Step(id = "CheckSum", ...)` (lines 63-65),
  `categoryDescription = "...BaseStep.Category.Transform"` (line 65).
  **NOT in `kettle-steps.xml`** — registry presence here is annotation
  evidence, not XML evidence.
- XML tag constants (lines 74-84): `checksumtype`, `fieldSeparatorString`,
  `resultfieldName` (capital N), `resultType`, `compatibilityMode`,
  `oldChecksumBehaviour`, `evaluationMethod`, `fields`/`field`/`name`.
- Checksum codes: `checksumtypeCodes` (line 96): `CRC32`, `ADLER32`, `MD5`,
  `SHA-1`, `SHA-256` (note hyphens in the SHA codes).
- Result-type codes: `resultTypeCode` (line 108): `string`, `hexadecimal`,
  `binary` (lowercase — NOT the Java constant names, NOT numbers);
  `result_TYPE_STRING = 0`, `result_TYPE_HEXADECIMAL = 1`,
  `result_TYPE_BINARY = 2` (lines 109-111).
- Evaluation-method codes: `EVALUATION_METHOD_CODES` (lines 122-124) =
  `Const.KETTLE_CHECKSUM_EVALUATION_METHOD_*`, i.e. `BYTES`,
  `PENTAHO_STRINGS`, `NATIVE_STRINGS`
  (`core/src/main/java/org/pentaho/di/core/Const.java`, lines 1554-1577);
  default `BYTES` (line 129 + `Const.KETTLE_CHECKSUM_EVALUATION_METHOD_DEFAULT`,
  `Const.java` line 1587).
- `allocate(int nrfields)` (lines 407-409): sizes `fieldName[]`.
- `setDefault()` (lines 512-520): `resultfieldName = null`,
  `checksumtype = CRC32` (codes[0]), `resultType = HEXADECIMAL`,
  `fieldSeparatorString = null`, `evaluationMethod = BYTES`, 0 fields.
  `compatibilityMode`/`oldChecksumBehaviour` are NOT touched (Java false).
- `readData(Node)` (lines 434-462), via `loadXML` (lines 392-394):
  `checksumtype`/`resultfieldName` verbatim (missing → null);
  `resultType` via `getResultTypeByCode(Const.NVL(tag, ""))` (line 438 —
  unknown/missing → 0 = `string`, lines 233-244);
  `compatibilityMode`/`oldChecksumBehaviour` via null-tolerant parsers
  (lines 439-441 + 464-478);
  `evaluationMethod` missing → env var
  `KETTLE_DEFAULT_CHECKSUM_EVALUATION_METHOD` then default `BYTES`
  (lines 442-447 + 364-374); list counted from the `<fields>` sub-node
  (lines 450-451); `<field>` items read `name` only (lines 455-458).
- **PITFALL 1 (lines 464-478):** `parseCompatibilityMode` /
  `parseOldChecksumBehaviour` return **true** when the tag is missing
  ("It was previously not saved"). A new step is false, but a file with
  the tags stripped loads as true. The template pins both to `N`.
  Compatibility mode + `SHA-256` is a `check()` ERROR (lines 674-678).
- **PITFALL 2:** `<resultType>` is a lowercase code string. A numeric id
  or uppercase name silently loads as `string` (`getResultTypeByCode`,
  lines 233-244).
- **PITFALL 3:** `<fieldSeparatorString>` is emitted ONLY when non-null
  (`getXML` lines 496-498). Its absence from a file is normal (loads
  null) — do not invent an empty tag "for completeness".
- `getResultTypeCode(int)` (lines 480-485): out-of-range index → code[0].
- `getXML()` (lines 488-509): emits `checksumtype`, `resultfieldName`,
  `resultType` (code), `compatibilityMode` (Y/N), `oldChecksumBehaviour`
  (Y/N), `evaluationMethod` (code), conditional `fieldSeparatorString`,
  then the `<fields>` wrapper ALWAYS (lines 500/506) with `<field>`
  items carrying ONLY `<name>` (lines 501-505).
- `getFields(...)` (lines 576-596): adds a column ONLY when
  `resultfieldName` is non-empty; `CRC32`/`ADLER32` → `ValueMetaInteger`
  (lines 581-582), else `BINARY` → `ValueMetaBinary`, else (string AND
  hexadecimal) → `ValueMetaString`. Note `checksumtype.equals(...)`
  (line 581) NPEs when `<checksumtype>` is missing — the template must
  always carry it.
- `check()` (lines 599-680): ERROR on empty result field (lines 605-612);
  per-field existence in the input stream (lines 629-635).

Emitted tag order: `[<checksumtype>, <resultfieldName>, <resultType>,
<compatibilityMode>, <oldChecksumBehaviour>, <evaluationMethod>,
<fieldSeparatorString>? (non-null only), <fields>(<field>/<name>*)]`.

## 2. trans CloneRow — `CloneRowMeta`

- Class: `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/clonerow/CloneRowMeta.java`
- Registry: annotation `@Step(id = "CloneRow", ...)` (lines 58-61),
  `categoryDescription = "...BaseStep.Category.Utility"` (line 59).
  **NOT in `kettle-steps.xml`** — annotation evidence only.
- `getXML()` (lines 93-105): emits exactly 7 tags in order — `nrclones`
  (verbatim STRING, line 95), `addcloneflag` (Y/N), `cloneflagfield`,
  `nrcloneinfield` (Y/N), `nrclonefield`, `addclonenum` (Y/N),
  `clonenumfield`. No lists, no other tags.
- `readData(Node)` (lines 172-186), via `loadXML` (lines 107-109):
  `nrclones` + 3 name fields verbatim (missing → null); 3 flags via
  `"Y".equalsIgnoreCase` (missing → false, lines 175/177/179).
- `setDefault()` (lines 188-196): `nrclones = "0"` (**string** `"0"`,
  not int), 3 name fields null, 3 flags false. Load-missing `<nrclones>`
  gives null (NOT `"0"`) and `check()` ERRORs.
- **PITFALL 1:** `<nrclones>` is a String (variable-capable, e.g.
  `${N}`). Do not coerce to int in YAML mapping.
- **PITFALL 2 (lines 237-253, `getFields`):** a flag with an EMPTY name
  field silently adds NO column (guarded by `Utils.isEmpty`), while
  `check()` reports ERROR (lines 271-300). A file can look configured
  yet emit no marker column.
- `getFields(...)` (lines 234-254): flag + name → `ValueMetaBoolean`
  (lines 237-244); numbering + name → `ValueMetaInteger` (lines 246-253).
  Output = input schema + up to 2 columns.
- `check()` (lines 256-324): ERROR on empty `nrclones` (lines 262-269);
  per-flag name requirements; input required (lines 314-323).

Emitted tag order: `[<nrclones>, <addcloneflag>, <cloneflagfield>,
<nrcloneinfield>, <nrclonefield>, <addclonenum>, <clonenumfield>]`.

## 3. trans IfNull — `IfNullMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/ifnull/IfNullMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 85:
  `<step id="IfNull" ... classname ...ifnull.IfNullMeta ...
  category ...BaseStep.Category.Utility ...>`.
- Config holders: inner class `Fields` (lines 58-114:
  `FIELD_NAME`/`REPLACE_VALUE`/`REPLACE_MASK`/`SET_EMPTY_STRING`) and
  inner class `ValueTypes` (lines 116-172:
  `TYPE_NAME`/`TYPE_REPLACE_VALUE`/`TYPE_REPLACE_MASK`/`SET_TYPE_EMPTY_STRING`).
- `allocate(int nrtypes, int nrfields)` (lines 237-246): sizes both arrays
  with fresh holder objects.
- `setDefault()` (lines 369-398): both replace-all values null, all 3
  flags false, 0 + 0 rows (the seeding `for` loops are commented out —
  a new step is always empty).
- `readData(Node, ...)` (lines 296-332), via `loadXML` (lines 215-217):
  `selectFields`/`selectValuesType` via `"Y"` (missing → false, lines
  298-299); `replaceAllByValue`/`replaceAllMask` verbatim (lines 300-301);
  `setEmptyStringAll` via `!isEmpty && "Y"` (lines 302-303); `valuetypes`
  sub-node → `valuetype` items (`name`/`value`/`mask`/
  `set_type_empty_string` with the same `!isEmpty && "Y"` guard, lines
  305-320); `fields` sub-node → `field` items (`name`/`value`/`mask`/
  `set_empty_string`, lines 321-328).
- `getXML()` (lines 334-367): emits `replaceAllByValue`,
  `replaceAllMask`, `selectFields` (Y/N), `selectValuesType` (Y/N),
  `setEmptyStringAll` (Y/N), then the `<valuetypes>` wrapper ALWAYS
  (lines 343/353) with `<valuetype>` items (`name`/`value`/`mask`/
  `set_type_empty_string`), then the `<fields>` wrapper ALWAYS (lines
  355/364) with `<field>` items (`name`/`value`/`mask`/
  `set_empty_string`).
- **PITFALL 1:** the two empty-string flags have DIFFERENT names —
  `<set_type_empty_string>` (valuetype) vs `<set_empty_string>`
  (field). A swapped name is silently ignored (always false).
- **PITFALL 2:** the `selectFields`/`selectValuesType` flags gate the
  tables at runtime — a populated table with its flag at `N` does
  nothing. The template sets `selectFields=Y`.
- **PITFALL 3 (lines 280-282):** `Fields[] getFields()` is a CONFIG
  accessor, not the row-schema hook. The class does NOT override
  `getFields(RowMetaInterface, ...)` — null replacement happens
  in-place, output schema = input schema.
- **PITFALL 4:** the `<fields>/<field>` shape (`name`/`value`/`mask`/
  `set_empty_string`) is IDENTICAL to SetValueConstant's — tell the two
  steps apart by the step `<type>` and the top flags
  (`select*/replaceAll*` vs `usevar`), never by field names.
- `check()` (lines 456-515): configured field names must exist in the
  input stream; WARNING on 0 fields; ERROR on missing input.

Emitted tag order: `[<replaceAllByValue>, <replaceAllMask>,
<selectFields>, <selectValuesType>, <setEmptyStringAll>,
<valuetypes>(<valuetype>*), <fields>(<field>*)]`.

## 4. trans NumberRange — `NumberRangeMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/numberrange/NumberRangeMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 81:
  `<step id="NumberRange" ... classname ...numberrange.NumberRangeMeta ...
  category ...BaseStep.Category.Transform ...>`.
- `getXML()` (lines 87-105): emits `inputField`, `outputField`,
  `fallBackValue`, then the `<rules>` wrapper ALWAYS (lines 94/102) with
  `<rule>` items (`lower_bound` + `upper_bound` + `value`, lines 95-101).
- `loadXML(...)` (lines 123-150): 3 head tags verbatim (missing → null);
  `emptyRules()` then repopulated (line 128); each `<rule>` reads
  `lower_bound`/`upper_bound`/`value` (lines 138-140).
- **PITFALL 1 (lines 142-143):** bounds go through
  `Double.parseDouble(...)` with NO null-guard — a `<rule>` missing a
  bound, or a non-numeric bound, throws `NumberFormatException` wrapped
  as `KettleXMLException` (lines 147-149). The template MUST carry
  numeric bounds on EVERY rule; "open-ended" rules must write extreme
  values explicitly.
- **PITFALL 2:** exact case — `inputField`/`outputField` (capital F),
  `fallBackValue` (capital B), `lower_bound`/`upper_bound` (snake_case).
  Wrong case is silently ignored (null).
- `setDefault()` (lines 153-161): `fallBackValue = "unknown"`, 3 seed
  rules (`-MAX_VALUE`→5 `"Less than 5"`, 5→10 `"5-10"`, 10→`MAX_VALUE`
  `"More than 10"`), `inputField = ""`, `outputField = "range"`.
- `getFields(...)` (lines 108-114): adds ONE `ValueMetaString`
  (`outputField`, length 255) — output always gains the label column,
  even for fallback rows.
- `check()` (lines 212-237) only requires an input stream — it does NOT
  validate ranges/fields, so overlapping ranges or gaps are silent
  design errors (first matching rule wins at runtime).

Emitted tag order: `[<inputField>, <outputField>, <fallBackValue>,
<rules>(<rule>/<lower_bound>+<upper_bound>+<value>*)]`.

## 5. trans SetValueConstant — `SetValueConstantMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/setvalueconstant/SetValueConstantMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 92:
  `<step id="SetValueConstant">` →
  `...setvalueconstant.SetValueConstantMeta`
  (category Transform).
- `getXML()` (lines 115-130): emits `usevar` (Y/N, line 117) then the
  `<fields>` wrapper ALWAYS (lines 118/127) with `<field>` items
  (`name` + `value` + `mask` + `set_empty_string` Y/N, lines 119-126).
- `readData(Node, ...)` (lines 93-113), via `loadXML` (lines 81-83):
  `usevar` via `"Y"` (missing → false, line 95); `<field>` items read
  `name`/`value`/`mask` verbatim (lines 102-104); `set_empty_string`
  via `!isEmpty && "Y"` (lines 105-106).
- `setDefault()` (lines 132-134) sets ONLY `usevar = false`; the list is
  pre-initialized empty at declaration (line 60: `new ArrayList<>()`) —
  a new step has 0 fields with no null trap.
- **PITFALL 1:** unconditional overwrite — every row's listed fields
  are replaced, null or not. "Replace only when null" is IfNull, not
  this step. The `<type>` tag is the only reliable tell: the
  `<fields>/<field>` item shape is identical in both steps.
- **PITFALL 2:** `<usevar>` is all-lowercase. `<useVar>` variants are
  silently ignored (always false), leaving `${VAR}` literals unsubstituted.
- `check()` (lines 170-228): configured names must exist in the input
  stream; WARNING on 0 fields (`NoFieldsEntered`, lines 203-206);
  ERROR on missing input.

Emitted tag order: `[<usevar>, <fields>(<field>/<name>+<value>+<mask>+<set_empty_string>*)]`.

## Proposed catalog rows (for Kiro to append to catalog.yaml, trans list)

```yaml
    - {type: CHECK_SUM, xml_type: CheckSum, file: trans/CheckSum.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: CLONE_ROW, xml_type: CloneRow, file: trans/CloneRow.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: IF_NULL, xml_type: IfNull, file: trans/IfNull.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: NUMBER_RANGE, xml_type: NumberRange, file: trans/NumberRange.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: SET_VALUE_CONSTANT, xml_type: SetValueConstant, file: trans/SetValueConstant.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
```

(Alias convention follows prior batches: SNAKE_UPPER of the XML type,
e.g. `SORTED_MERGE`, `DIMENSION_LOOKUP`. All rows are evidence level
`source_reviewed` — no `spoon_loaded`/runtime claims.)
