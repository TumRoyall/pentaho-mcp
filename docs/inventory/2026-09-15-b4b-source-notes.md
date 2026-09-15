# B4b source notes — XML job entries + JSON/YAML steps (5 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b4b-xmljob-json.test.js` (exit 0).
Full test run + review left to Kiro.

**Registration (all five):** all live in plugins/ and register via annotation,
NOT via `engine/.../kettle-job-entries.xml` or `kettle-steps.xml`. The
annotation is registration evidence only — XML evidence is each serializer below.

**Job wrapper (3 job IDs):** `JobEntryBase.getXML()`
(`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java`, lines
415-419: `name`, `description`, `type` = configId, `attributes`) +
`JobEntryCopy.getXML()`
(`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java`, lines
102-113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) wrap each plugin fragment
(same wrapper as the B2a `TABLE_EXISTS` reference).

**Trans wrapper (2 trans IDs):** `StepMeta.getXML()` (lines 206-208) →
`getXML(boolean)` (lines 210-230) in
`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`: emits
`<step>`, `<name>`, `<type>` = step ID, then splices the plugin fragment.

**Tag-name matching is case-insensitive:** `XMLHandler.getTagValue()` compares
with `equalsIgnoreCase` (`core/.../xml/XMLHandler.java`, line 153).

**No-DB note (all five):** none references a database connection. There is NO
`<connection>` tag in any serializer, and the B2a connection-fixture pitfall
does NOT apply. Templates must not add one.

## 1. job DTD_VALIDATOR — `JobEntryDTDValidator`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/dtdvalidator/JobEntryDTDValidator.java`
- Registry: annotation `@JobEntry(id = "DTD_VALIDATOR", ...)` (lines 63-66).
- `getXML()` (lines 88-97): `super.getXML()` then `xmlfilename`,
  `dtdfilename`, `dtdintern` (Y/N, lines 92-94).
- `loadXML()` (lines 99-111): `super.loadXML()` then the same 3 tags;
  `dtdintern` via `"Y".equalsIgnoreCase` (missing → false, line 106).
- Init: constructor (lines 72-77) — both filenames null, `dtdintern=false`;
  no separate `setDefault()`.
- Semantics: `evaluates()` = true (lines 177-179) — conditional entry.
  `execute()` (lines 145-175): `dtdintern` → `setInternDTD(true)` (lines
  156-158), else external DTD file (159-163); failure → `result=false` +
  `NrErrors` (166-172). `check()` (lines 218-226): both paths non-blank and
  existing.

Emitted order after super: `[<xmlfilename>, <dtdfilename>, <dtdintern>]`.

## 2. job XSD_VALIDATOR — `JobEntryXSDValidator`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xsdvalidator/JobEntryXSDValidator.java`
- Registry: annotation `@JobEntry(id = "XSD_VALIDATOR", ...)` (lines 77-80).
- `getXML()` (lines 107-116): `super.getXML()` then `xmlfilename`,
  `xsdfilename`, `allowExternalEntities` (Y/N, lines 111-113).
- `loadXML()` (lines 118-129): `super.loadXML()` then the same 3 tags
  (lines 122-124); flag missing → false.
- Init: constructor (lines 91-96) — nulls + `allowExternalEntities` from
  system property (line 95); no separate `setDefault()`.
- Semantics: `evaluates()` = true (lines 262-264). `execute()` (lines
  164-260): both files must exist (176-225) else `result=false` +
  `NrErrors=1`; JAXP validation (182-208); with `allowExternalEntities=N`
  the runtime disables doctype/external entities against XEE (192-201).
  `check()` (lines 303-311): both paths non-blank and existing.

Emitted order after super: `[<xmlfilename>, <xsdfilename>,
<allowExternalEntities>]`.

## 3. job XML_WELL_FORMED — `JobEntryXMLWellFormed`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xmlwellformed/JobEntryXMLWellFormed.java`
- Registry: annotation `@JobEntry(id = "XML_WELL_FORMED", ...)` (lines 74-77).
- `getXML()` (lines 131-152): `super.getXML()` then `arg_from_previous`,
  `include_subfolders`, `nr_errors_less_than`, `success_condition`,
  `resultfilenames` (lines 135-139), then PAIRED `<fields>` ALWAYS emitted
  (lines 140/149) of `<field>` items (`source_filefolder`, `wildcard`,
  lines 144-145).
- `loadXML()` (lines 154-184): `super.loadXML()`, 2 Y/N flags, 3 strings,
  counts `<field>` in `<fields>` (line 169).
- Init: constructor (lines 111-120): `resultfilenames = "all_filenames"`,
  `nr_errors_less_than = "10"`, `success_condition = "success_if_no_errors"`.
  `arg_from_previous`/`include_subfolders`/`source_filefolder`/`wildcard`
  carry `@Deprecated` (lines 89-97) but STILL serialize/load — templates
  must keep them.
- Enums: success `success_if_no_errors` / `success_when_at_least` /
  `success_if_bad_formed_files_less` (lines 81-83); result `all_filenames` /
  `only_well_formed_filenames` / `only_bad_formed_filenames` (lines 85-87).
- Semantics: `evaluates()` = true (lines 644-646).
  `limitFiles = Const.toInt(environmentSubstitute(nr_errors_less_than), 10)`
  (line 246). Early-break (`checkIfSuccessConditionBroken`, lines 336-343):
  errors>0 in no_errors mode, or bad≥X in bad_less mode. Success
  (`getSuccessStatus`, lines 345-355): 0 errors in no_errors mode, OR
  well≥X in at_least mode, OR bad<X in bad_less mode. Bad files feed result
  in all/bad modes (518-519), well-formed in all/well modes (528-529) via
  `ResultFile.FILE_TYPE_GENERAL` (550-553).

Emitted order after super: `[<arg_from_previous>, <include_subfolders>,
<nr_errors_less_than>, <success_condition>, <resultfilenames>, <fields>]`.

## 4. trans JsonOutput — `JsonOutputMeta` (extends `BaseFileOutputMeta`)

- Class: `plugins/json/core/src/main/java/org/pentaho/di/trans/steps/jsonoutput/JsonOutputMeta.java`
- Registry: annotation `@Step(id = "JsonOutput", ...)` (lines 62-64).
  NOTE: `fileName`/`extension`/`stepNrInFilename`/`partNrInFilename`/
  `dateInFilename`/`timeInFilename`/`servletOutput` are superclass
  (`BaseFileOutputMeta`) fields serialized in the same fragment.
- `allocate(int nrfields)` (lines 245-247): sizes `outputFields[]`
  (`JsonOutputField`: fieldName + elementName only).
- `setDefault()` (lines 308-324): `encoding = "UTF-8"`,
  `outputValue = "outputValue"`, `jsonBloc = "data"`, `nrRowsInBloc = "1"`,
  **`operationType = OPERATION_TYPE_WRITE_TO_FILE`**, `extension = "js"`,
  0 fields.
- `readData(Node)` (lines 270-306), via `loadXML` (lines 241-243):
  `operation_type` via `getOperationTypeByCode` (unknown → 0 = `outputvalue`,
  lines 213-224); file flags nested in `<file>` (lines 280-289); reads
  `AddToResult` (capital, line 279) while `getXML()` writes `addtoresult`
  (lowercase, line 346) — HARMLESS via case-insensitive matching.
- `getXML()` (lines 337-373): `outputValue`, `jsonBloc`, `nrRowsInBloc`,
  `operation_type` (code string, line 343), `compatibility_mode`,
  `encoding`, `addtoresult` (lowercase, line 346), `<file>` with `name`,
  **`extention`** (sic — missing `s`, line 349), `append`, `split`,
  `haspartno`, `add_date`, `add_time`, `create_parent_folder`,
  `DoNotOpenNewFileInit`, `servlet_output` (lines 348-357), then PAIRED
  `<fields>` ALWAYS emitted (lines 360/371) of `<field>` items with ONLY
  `name` + `element` (lines 366-367). **PITFALL (line 364):** empty-name
  fields silently skipped.
- Operation codes: `operationTypeCode = { "outputvalue", "writetofile",
  "both" }` (line 82).
- Semantics: `getFields()` (lines 326-335) adds the `outputValue` String
  UNLESS mode is `writetofile`. `check()` (lines 478-545): `outputValue`
  required except file mode (483-491); **filename ALWAYS required, even in
  pure `outputvalue` mode** (492-497); source fields must exist (509-515);
  input required (529-539).

Emitted tag order: `[<outputValue>, <jsonBloc>, <nrRowsInBloc>,
<operation_type>, <compatibility_mode>, <encoding>, <addtoresult>,
<file>, <fields>]`.

## 5. trans YamlInput — `YamlInputMeta`

- Class: `plugins/yaml-input/impl/src/main/java/org/pentaho/di/trans/steps/yamlinput/YamlInputMeta.java`
  (fields in `.../yamlinput/YamlInputField.java`)
- Registry: annotation `@Step(id = "YamlInput", ...)` (line 66).
- `allocate(int nrfiles, int nrfields)` (lines 525-531).
- `setDefault()` (lines 534-565): `doNotFailIfNoFile = true`, rest
  false/empty, 0 files/fields.
- `readData(Node)` (lines 476-523), via `loadXML` (lines 388-390): flags
  via `"Y".equalsIgnoreCase`; `limit` via `Const.toLong(..., 0L)` (line
  515); files as parallel sub-node lists under `<file>` (lines 497-506).
- `getXML()` (lines 415-452): `include`, `include_field`, `rownum`,
  `addresultfile`, `validating`, `IsIgnoreEmptyFile`, `doNotFailIfNoFile`,
  `rownum_field`, `encoding`, then `<file>` ALWAYS emitted (lines 429/437)
  with FLAT 4-tag tuples (`name/filemask/file_required/include_subfolders`,
  lines 431-434 — NO `exclude_filemask`, unlike getXMLData), then
  `<fields>` (lines 439/444), then `limit`, `IsInFields`, `IsAFile`,
  `YamlField` (lines 446-449).
- `YamlInputField` (YamlInputField.java lines 87-96/104-113): order `name`,
  **`path`** (NOT `xpath`), `type` (string→id, line 106), `format`,
  `currency`, `decimal`, `group`, `length`, `precision` (missing → `-1`,
  lines 111-112), `trim_type` (`none`/`left`/`right`/`both`, line 47). NO
  `element_type`/`result_type`/`repeat`.
- `check()` (lines 728-780): ERROR on missing input (734-744 — yes, even
  file mode), zero fields, or (file mode) no resolvable files.

Emitted tag order: `[<include>, <include_field>, <rownum>, <addresultfile>,
<validating>, <IsIgnoreEmptyFile>, <doNotFailIfNoFile>, <rownum_field>,
<encoding>, <file>, <fields>, <limit>, <IsInFields>, <IsAFile>,
<YamlField>]`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: DTD_VALIDATOR, xml_type: DTD_VALIDATOR, file: job/DTD_VALIDATOR.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XSD_VALIDATOR, xml_type: XSD_VALIDATOR, file: job/XSD_VALIDATOR.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XML_WELL_FORMED, xml_type: XML_WELL_FORMED, file: job/XML_WELL_FORMED.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: JSON_OUTPUT, xml_type: JsonOutput, file: trans/JsonOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: YAML_INPUT, xml_type: YamlInput, file: trans/YamlInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
