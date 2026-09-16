# B7a source notes — deprecated trans steps (7 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**B7 policy (all 7 IDs):** source marks each component DEPRECATED
(category Deprecated and/or `deprecated.svg` icon and/or `@Deprecated`).
Default catalog decision: `verification: source_reviewed` (full
getXML/loadXML/setDefault evidence below) BUT `status: observed` +
`generator_eligible: false` (read/maintain only, no new generation).
No ID is proposed canonical. Replacements are recorded ONLY where the
source itself points at one (registry `<suggestion>` / javadoc).

**Wrapper (all seven):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**No-DB note (all seven):** none of these seven IDs references a database
connection. There is NO `<connection>` tag in any of their `getXML()` methods,
and the B2a connection-fixture pitfall does NOT apply. Templates must not add
one. (ElasticSearchBulk node addresses live in `<servers>`, not `<connection>`.)

## 1. trans AggregateRows — `AggregateRowsMeta`

- Class: `plugins/aggregate-rows/core/src/main/java/org/pentaho/di/trans/steps/aggregaterows/AggregateRowsMeta.java`
- Registry: annotation `@Step(id = "AggregateRows", ...)` (lines 58-61),
  `categoryDescription = "...JobCategory.Category.Deprecated"` (line 61).
- Deprecated evidence: category Deprecated (line 61). No `suggestion` in
  source — no in-source replacement pointer (GroupBy/MemoryGroupBy are an
  editorial note, not a source citation).
- `allocate(int nrfields)` (lines 147-151): `fieldName[]`, `fieldNewName[]`,
  `aggregateType[]` (int).
- `setDefault()` (lines 210-222): `nrfields = 0`, then `allocate(0)` — a new
  step has ZERO aggregates.
- `getType(String)` (lines 160-168): case-insensitive match against the i18n
  `aggregateTypeDesc[]` (lines 77-87); unknown string (incl. numeric codes
  like `"1"`) silently loads as `TYPE_AGGREGATE_NONE = 0`. So `<type>` is a
  STRING desc, never a number. English descs confirmed in
  `plugins/aggregate-rows/core/src/main/resources/.../aggregaterows/messages/messages_en_US.properties`
  (lines 21-30): `NONE(=first value)`, `SUM`, `AVERAGE`, `COUNT`, `MIN`,
  `MAX`, `FIRST`, `LAST`, `FIRST INCLUDING NULL`, `LAST INCLUDING NULL`.
- `readData(Node)` (lines 186-207), via `loadXML` (lines 143-145): reads
  `<fields>`/`<field>` (lines 191-192), `<name>` (line 198), `<rename>`
  (line 199), `<type>` → `getType()` (lines 200-201). Missing tags load
  null (no NPE: `aggregateTypeDesc[i].equalsIgnoreCase(null)` is false).
- `getXML()` (lines 262-276): emits **ONLY** a `<fields>` block (lines
  265/273); each `<field>` has `<name>` (line 268), `<rename>` (line 269),
  `<type>` = `getTypeDesc()` (line 270). No other tags.
- `getFields(...)` (lines 225-259): SUM/AVERAGE/COUNT clone to `TYPE_NUMBER`
  (lines 236-241), others keep type; then `row.clear()` (line 248) — output
  is ONLY the aggregate columns, all unlisted input columns are dropped.
- `check()` (lines 313-382): ERROR when an aggregate field is missing from
  input (lines 320-337), COMMENT listing ignored (dropped) fields (lines
  339-363), WARNING when zero fields (lines 364-368), ERROR with no input
  (lines 370-380).

Emitted tag order: `[<fields>]`; per field `[<name>, <rename>, <type>]`.

Catalog proposal: `type: AGGREGATE_ROWS`, `status: observed`,
`generator_eligible: false`, `verification: source_reviewed`,
note "deprecated in source 9.4".

## 2. trans DummyStep — `DummyPluginMeta`

- Class: `plugins/dummy/core/src/main/java/org/pentaho/di/be/ibridge/kettle/dummy/DummyPluginMeta.java`
- Registry: annotation `@Step(id = "DummyStep", ...)` (lines 47-53), image
  `ui/images/deprecated.svg` (line 48), category Deprecated (line 52),
  `suggestion = "DummyPlugin.Step.SuggestedStep"` (line 53).
- **Distinct from trans `Dummy`** (catalog alias `DUMMY`, pass-through with
  no config): different step ID (`DummyStep` vs `Dummy`), different class
  (`DummyPluginMeta` vs the Dummy step meta). Verified class/registry per
  batch brief.
- `getXML()` (lines 76-86): ALWAYS emits `<values>` (lines 79/83); when
  `value != null` splices `value.getXML()` (lines 80-82). The `<value>` body
  is `ValueMetaAndData.getXML()`
  (`core/src/main/java/org/pentaho/di/core/row/ValueMetaAndData.java` lines
  116-139): tag `<value>` (`XML_TAG = "value"`, line 43; emitted lines
  123/136), order `name` (124), `type` (125), `text` (127/130), `length`
  (132), `precision` (133), `isnull` (134), `mask` (135).
- `loadXML(...)` (lines 105-117): reads sub-node `values`/`value` (line 109)
  with null-guard (line 110 — missing `<value>` keeps an empty
  `ValueMetaAndData`, no throw). `ValueMetaAndData.loadXML()` (lines
  159-174): `isnull` via `"Y".equalsIgnoreCase` (line 166),
  `length`/`precision` missing → `-1` (lines 167-168).
- `setDefault()` (lines 120-124): `ValueMetaNumber("valuename")`, value
  `123.456`, `length = 12`, `precision = 4` — exactly the template defaults.
- `getFields(...)` (lines 89-96): ADDS the single `valueMeta` (when non-null),
  removes nothing.
- `check()` (lines 172-190): WARNING with no previous fields, ERROR with no
  input hop.

Emitted tag order: `[<values>]`; per value `[<name>, <type>, <text>,
<length>, <precision>, <isnull>, <mask>]`.

Catalog proposal: `type: DUMMY_STEP`, `status: observed`,
`generator_eligible: false`, `verification: source_reviewed`,
note "deprecated in source 9.4".

## 3. trans OldTextFileInput — `TextFileInputMeta` (old)

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/textfileinput/TextFileInputMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 8:
  `<step id="OldTextFileInput">` →
  `org.pentaho.di.trans.steps.textfileinput.TextFileInputMeta`, category
  Deprecated, icon `deprecated.svg`, `<suggestion>...
  TypeLongDesc.TextFileInput</suggestion>` = in-source replacement pointer.
- Replacement (sourced): new `TextFileInput` = DIFFERENT class
  `org.pentaho.di.trans.steps.fileinput.text.TextFileInputMeta`
  (`kettle-steps.xml` line 9, category Input). Same step purpose, new
  implementation.
- Boolean constants: `YES = "Y"`, `NO = "N"` (lines 85/87) — Y/N, never
  true/false. `STRING_BASE64_PREFIX = "Base64: "` (line 89).
- `setDefault()` (lines 987-1051): `separator ";"`, `enclosure "\""`,
  `header` true, `nrHeaderLines` 1, `fileFormat "DOS"`, `fileType "CSV"`,
  `fileCompression "None"`, `noEmptyLines` true, `isaddresult` true, 0
  files/fields/filters, `rowLimit` 0L, warning/error/line extensions
  `"warning"`/`"error"`/`"line"`.
- `loadXML(...)` (lines 782-939): booleans via `YES.equalsIgnoreCase`
  (missing → false) EXCEPT `noempty` missing → true (lines 809-810),
  `add_to_result_filenames` missing → true (lines 802-807),
  `date_format_lenient` missing → true (line 920); counts missing → 1 for
  header/footer/wrap/page (lines 794-801), `-1` for position/length/
  precision (lines 891-893); `fileCompression` missing → `"None"` with
  legacy `<file>/<zipped>Y` → `"Zip"` fallback (lines 843-848);
  `filter_string` Base64-decoded when prefixed, else taken literally
  (lines 866-872); legacy single `<filter>` outside `<filters>` still read
  (lines 851-858).
- `getXML()` (lines 1197-1324): order — accept block (1200-1204),
  separator…encoding (1206-1227), `<file>` (1229-1240; per file `name` via
  `saveSource` lines 1231/2088-2090, `filemask`, `exclude_filemask`,
  `file_required`, `include_subfolders`, then `type` + `compression`),
  `<filters>` (1242-1263), `<fields>` (1265-1285; 13 tags per field:
  name, type, format, currency, decimal, group, nullif, ifnull, position,
  length, precision, trim_type, repeat), `limit` + error-handling
  (1286-1307), locale (1309-1311), 8 extra file columns (1313-1321).
- Info-step reference: `accept_stepname` resolved via
  `searchInfoAndTargetSteps` (lines 1338-1340) — `accept_filenames = Y`
  needs a hop from a filenames-producing step.

Emitted tag order: `[<accept_filenames>, <passing_through_fields>,
<accept_field>, <accept_stepname>, <separator>, <enclosure>,
<enclosure_breaks>, <escapechar>, <header>, <nr_headerlines>, <footer>,
<nr_footerlines>, <line_wrapped>, <nr_wraps>, <layout_paged>,
<nr_lines_per_page>, <nr_lines_doc_header>, <noempty>, <include>,
<include_field>, <rownum>, <rownumByFile>, <rownum_field>, <format>,
<encoding>, <add_to_result_filenames>, <file>, <filters>, <fields>,
<limit>, <error_ignored>, <skip_bad_files>, <file_error_field>,
<file_error_message_field>, <error_line_skipped>, <error_count_field>,
<error_fields_field>, <error_text_field>,
<bad_line_files_destination_directory>, <bad_line_files_extension>,
<error_line_files_destination_directory>, <error_line_files_extension>,
<line_number_files_destination_directory>, <line_number_files_extension>,
<date_format_lenient>, <date_format_locale>, <shortFileFieldName>,
<pathFieldName>, <hiddenFieldName>, <lastModificationTimeFieldName>,
<uriNameFieldName>, <rootUriNameFieldName>, <extensionFieldName>,
<sizeFieldName>]`.

Catalog proposal: `type: OLD_TEXT_FILE_INPUT`, `status: observed`,
`generator_eligible: false`, `verification: source_reviewed`,
note "deprecated in source 9.4; replacement TextFileInput (new class)".

## 4. trans Script — `ScriptMeta` (old Rhino JS)

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/script/ScriptMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 102:
  `<step id="Script">` → `org.pentaho.di.trans.steps.script.ScriptMeta`,
  category Deprecated, icon deprecated, `<suggestion>...
  TypeLongDesc.JavaScriptMod</suggestion>` = in-source replacement pointer
  (`ScriptValueMod`, catalog alias `SCRIPT`).
- Tag constants (lines 76-78): `JSSCRIPT_TAG_TYPE = "jsScript_type"`,
  `JSSCRIPT_TAG_NAME = "jsScript_name"`,
  `JSSCRIPT_TAG_SCRIPT = "jsScript_script"`.
- `setDefault()` (lines 261-279): ONE script of type `TRANSFORM_SCRIPT = 0`
  (`ScriptValuesScript.java` line 30; START = 1, END = 2, lines 31-32) and
  ZERO output fields.
- `readData(Node)` (lines 223-259), via `loadXML` (lines 193-195):
  `jsScript_type` via `Integer.parseInt` (lines 231-234) — **missing or
  non-numeric THROWS** (wrapped `KettleXMLException`, lines 255-258);
  field `type` is a STRING via `getIdForValueMeta` (line 247);
  `length`/`precision` missing → `-1` (lines 251-252); `replace` via
  `"Y".equalsIgnoreCase` (line 253, missing → false).
- `getXML()` (lines 328-358): `<jsScripts>` (331-341; per `<jsScript>`:
  `jsScript_type` INT line 335, `jsScript_name` line 337, `jsScript_script`
  line 338) then `<fields>` (343-355; per `<field>`: name, rename, type
  STRING via `getValueMetaName` lines 348-349, length, precision, replace
  Y/N lines 350-352).
- `getFields(...)` (lines 281-326): `replace = Y` swaps the type in place
  (`row.setValueMeta`, line 317) and THROWS when the target field is missing
  and rename is empty (lines 292-295); otherwise appends a new column named
  `rename` (or `name`).
- `check()` (lines 420+) compiles the scripts with a JS engine.

Emitted tag order: `[<jsScripts>, <fields>]`; per jsScript
`[<jsScript_type>, <jsScript_name>, <jsScript_script>]`; per field
`[<name>, <rename>, <type>, <length>, <precision>, <replace>]`.

Catalog proposal: `type: SCRIPT_DEPRECATED` (`SCRIPT` already belongs to
`ScriptValueMod`), `status: observed`, `generator_eligible: false`,
`verification: source_reviewed`,
note "deprecated in source 9.4; replacement ScriptValueMod".

## 5. trans TextFileOutputLegacy — `TextFileOutputLegacyMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/textfileoutputlegacy/TextFileOutputLegacyMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 19:
  `<step id="TextFileOutputLegacy">` → `...textfileoutputlegacy.
  TextFileOutputLegacyMeta`, category Deprecated, icon deprecated,
  `<suggestion>... TypeLongDesc.TextFileOutput</suggestion>` = in-source
  replacement pointer. Class javadoc `@deprecated use
  TextFileOutputMeta instead` (lines 44-47).
- Delta vs parent `TextFileOutputMeta`
  (`engine/src/main/java/org/pentaho/di/trans/steps/textfileoutput/TextFileOutputMeta.java`):
  exactly ONE extra tag `<is_command>` appended LAST inside `<file>` by the
  `saveFileOptions` override (lines 90-93); read back by the `readData`
  override via `"Y".equalsIgnoreCase(getTagValue(stepnode, "file",
  "is_command"))` (lines 74-81, missing → false); `setDefault()` calls
  super then `fileAsCommand = false` (lines 84-87).
- Runtime delta: `buildFilename()` override (lines 118-125) — when
  `is_command`, the filename is used verbatim as a shell command to pipe
  into; otherwise parent logic.
- Parent tag-name constants (lines 74-142, all verified): `separator`,
  `enclosure`, `enclosure_forced`, `enclosure_fix_disabled`, `header`,
  `footer`, `format`, `compression`, `encoding`, `endedLine` (camel),
  `fileNameInField`/`fileNameField` (camel), `create_parent_folder`,
  `file/name` (via `saveSource`/`loadSource`, lines 1128-1134), then
  `servlet_output`, `do_not_open_new_file_init`, `extention` (sic, line 89),
  `append`, `split`, `haspartno`, `add_date`, `add_time`, `SpecifyFormat`
  (capitals, line 129), `date_time_format`, `add_to_result_filenames`,
  `pad`, `fast_dump`, `splitevery`; fields (lines 835-853, 10 tags:
  name, type, format, currency, decimal, group, nullif, trim_type, length,
  precision; empty-name fields SKIPPED, line 837). Compression codes
  `None`/`Zip` (lines 139/142/151).
- Parent `setDefault()` (lines 770-799): `";"`, `"\""`, header true,
  format `DOS`, compression `None`, `fileName "file"`, `extension "txt"`,
  `addToResultFilenames` true, rest false/empty, 0 fields.
- Parent load pitfalls (`readData`, lines 663-745): separator/enclosure/
  endedLine missing → `""`; `disableEnclosureFix` missing → TRUE (lines
  671-673, differs from setDefault false); `createparentfolder` missing →
  TRUE (676-677); `add_to_result_filenames` missing → TRUE (709-710);
  compression missing → `None` with legacy `<file>/<zipped>` fallback
  (682-689); field numbers missing → `-1` (739-740).

Emitted tag order: `[<separator>, <enclosure>, <enclosure_forced>,
<enclosure_fix_disabled>, <header>, <footer>, <format>, <compression>,
<encoding>, <endedLine>, <fileNameInField>, <fileNameField>,
<create_parent_folder>, <file>, <fields>]`; inside `<file>`: `[<name>,
<servlet_output>, <do_not_open_new_file_init>, <extention>, <append>,
<split>, <haspartno>, <add_date>, <add_time>, <SpecifyFormat>,
<date_time_format>, <add_to_result_filenames>, <pad>, <fast_dump>,
<splitevery>, <is_command>]`.

Catalog proposal: `type: TEXT_FILE_OUTPUT_LEGACY`
(`TEXT_FILE_OUTPUT` already belongs to `TextFileOutput`),
`status: observed`, `generator_eligible: false`,
`verification: source_reviewed`,
note "deprecated in source 9.4; replacement TextFileOutput".

## 6. trans GetPreviousRowField — `GetPreviousRowFieldMeta`

- Class: `plugins/get-previous-row-field/core/src/main/java/org/pentaho/di/trans/steps/getpreviousrowfield/GetPreviousRowFieldMeta.java`
- Registry: annotation `@Step(id = "GetPreviousRowField", ...)` (lines 61-64),
  `categoryDescription = "...JobCategory.Category.Deprecated"` (line 64).
  No in-source replacement pointer (LAG-style equivalent lives in
  `AnalyticQuery` — editorial note, not a source citation).
- `setDefault()` (lines 160-168): null arrays, `schema = ""`, then
  `allocate(0)` — zero mappings.
- `readData(Node)` (lines 138-157), via `loadXML` (lines 114-116): counts
  `<field>` under `<fields>` (lines 142-143), `allocate(nrkeys)` (145);
  values via `Const.NVL(..., "")` (lines 150-151) — missing tags become
  `""`, no NPE.
- `getXML()` (lines 171-186): emits **ONLY** `<fields>` (lines 174/183);
  per `<field>`: `<in_stream_name>` (178), `<out_stream_name>` (179).
  The `schema` field is rep-only (`readRep`/`saveRep`, lines 189-222) and
  is NEVER serialized — template must not carry `<schema>`.
- `getFields(...)` (lines 225-249): per non-empty `out_stream_name`, clones
  the input column's type/length/precision/mask under the new name (lines
  235-242); mappings pointing at missing input columns are silently skipped
  (line 231-232 guard).
- `supportsErrorHandling()` true (line 374).
- `check()` (lines 252-345): ERROR on no input, missing in-stream fields,
  empty outputs, empty/duplicate in-stream names.

Emitted tag order: `[<fields>]`; per field `[<in_stream_name>,
<out_stream_name>]`.

Catalog proposal: `type: GET_PREVIOUS_ROW_FIELD`, `status: observed`,
`generator_eligible: false`, `verification: source_reviewed`,
note "deprecated in source 9.4".

## 7. trans ElasticSearchBulk — `ElasticSearchBulkMeta`

- Class: `plugins/elasticsearch-bulk-insert/core/src/main/java/org/pentaho/di/trans/steps/elasticsearchbulk/ElasticSearchBulkMeta.java`
- Registry: annotation `@Step(id = "ElasticSearchBulk", ...)` (lines 62-66),
  `categoryDescription = "...Category.Deprecated"`, `documentationUrl =
  "Products/ElasticSearch_Bulk_Insert_(deprecated)"` (line 66). No
  in-source replacement pointer.
- Tag constants: `Dom` class (lines 75-110): `general`, `index`, `type`,
  `isJson`, `jsonField`, `idField`, `overwriteIfExists`, `idOutputField`,
  `useOutput`, `stopOnError`, `timeout`, `timeoutUnit`, `batchSize`,
  `fields`/`field`, `columnName`, `targetName`, `servers`/`server`,
  `address`, `port`, `settings`/`setting`, `name`, `value`.
- Defaults: `DEFAULT_BATCH_SIZE = 50000` (112), `DEFAULT_TIMEOUT = 10L`
  (113), `DEFAULT_TIMEOUT_UNIT = SECONDS` (114), `DEFAULT_PORT = 9300`
  (115). `setDefault()` (lines 369-380): batchSize `"50000"`, timeoutUnit
  SECONDS, index `"twitter"`, type `"tweet"`, isJson false, json/idOut
  null, useOutput false, stopOnError true (`timeout` stays null →
  self-closing `<timeout/>`).
- `loadXML(...)` (lines 395-469): booleans via `parseBool` = `"Y".equals`
  CASE-SENSITIVE (lines 471-473 — lowercase `y` loads false); `timeoutUnit`
  unknown → SECONDS (403-407); server `port` non-numeric → 9300 (444-450);
  blank target falls back to column name via `addField` (260-265, applied
  line 431); blank setting property dropped via `addSetting` (306-313,
  applied line 463).
- `getXML()` (lines 475-555): `<general>` (482-510: index, type, batchSize,
  timeout, timeoutUnit, isJson, then `jsonField`/`idOutputField`/`idField`
  ONLY when non-null (493-502), overwriteIfExists, useOutput, stopOnError),
  `<fields>` (513-524: columnName/targetName), `<servers>` (527-538:
  address/port), `<settings>` (541-552: name/value). All four wrappers always
  emitted (paired).
- `getFields(...)` (lines 383-393): adds ONLY the `<idOutputField>` String
  column when non-blank.
- `check()` (lines 709-766): ERROR on blank index/type/batchSize (719-726),
  on no input (761-764), on missing `jsonField` in JSON mode (742-752), on
  unmapped input columns in field mode (753-760).
- `supportsErrorHandling()` true (line 777).

Emitted tag order: `[<general>, <fields>, <servers>, <settings>]`; general
`[<index>, <type>, <batchSize>, <timeout>, <timeoutUnit>, <isJson>,
[jsonField?], [idOutputField?], [idField?], <overwriteIfExists>,
<useOutput>, <stopOnError>]`.

Catalog proposal: `type: ELASTIC_SEARCH_BULK`, `status: observed`,
`generator_eligible: false`, `verification: source_reviewed`,
note "deprecated in source 9.4".
