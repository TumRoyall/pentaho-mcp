# B4e source notes — file input/output steps (5 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638` (verified
`git rev-parse HEAD` in pentaho-kettle before reading).
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b4e-fileio.test.js` (exit 0).
Full test run + review left to Kiro.

**Registration (all five):** all register in
`engine/src/main/resources/kettle-steps.xml`: `GetFilesRowsCount` line 58,
`PropertyOutput` line 64 (Output), `GetSubFolders` line 70,
`FixedInput` line 105, `LoadFileInput` line 111 (all others Input).

**Wrapper (all five):** `StepMeta.getXML()` (lines 206-208) →
`getXML(boolean)` (lines 210-230) in
`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`.

**No-DB note (all five):** none references a database connection. NO
`<connection>` tag anywhere. All file paths use `${VAR}` placeholders.

## 1. trans FixedInput — `FixedInputMeta` + `FixedFileInputField`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/fixedinput/FixedInputMeta.java`
  (fields in `.../fixedinput/FixedFileInputField.java`)
- `allocate(int nrFields)` (lines 156-158).
- `setDefault()` (lines 120-127): `lineWidth = "80"`,
  `headerPresent/lazyConversionActive/lineFeedPresent = true`,
  `bufferSize = "50000"`, `isaddresult = false`.
- `readData(Node)` (lines 129-154), via `loadXML` (lines 111-113): flags
  Y/N missing → false; `file_type` via `getFileType` (line 138); fields
  via `new FixedFileInputField(fnode)` (lines 147-150).
- `getXML()` (lines 160-182): `filename`, `line_width`, `header`,
  `buffer_size`, `lazy_conversion`, `line_feed`, `parallel`, `file_type`
  (code), `encoding`, `add_to_result_filenames` (lines 163-173), then
  `<fields>` ALWAYS emitted paired (lines 175/179).
- `FixedFileInputField.getXML()` (FixedFileInputField.java lines 114-133,
  `XML_TAG = "field"` line 43): order `name`, `type` (name string, lines
  119-120), `format`, `trim_type`, `currency`, `decimal`, `group`,
  **`width`** (cut width, line 127), `length`, `precision` (lines 128-129).
  Load: `width`/`length`/`precision` missing → `-1` (lines 83-85).
- `file_type` codes: `fileTypeCode = { "NONE", "UNIX", "DOS" }` (lines
  73-77); unknown → `FILE_TYPE_NONE` (`getFileType`, lines 501-511).

Emitted order: `[<filename>, <line_width>, <header>, <buffer_size>,
<lazy_conversion>, <line_feed>, <parallel>, <file_type>, <encoding>,
<add_to_result_filenames>, <fields>]`.

## 2. trans LoadFileInput — `LoadFileInputMeta` + `LoadFileInputField`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/loadfileinput/LoadFileInputMeta.java`
  (fields in `.../loadfileinput/LoadFileInputField.java`)
- Tag constants (lines 65-89): `include`, `include_field`, `rownum`,
  `addresultfile`, `IsIgnoreEmptyFile`, `IsIgnoreMissingPath`,
  `rownum_field`, `encoding`, `name`, `filemask`, `exclude_filemask`,
  `file_required`, `include_subfolders`, `limit`, `IsInFields`,
  `DynamicFilenameField` (capital D), `shortFileFieldName`,
  `pathFieldName`, `hiddenFieldName`, `lastModificationTimeFieldName`,
  `uriNameFieldName`, `rootUriNameFieldName`, `extensionFieldName`,
  `file`, `fields`.
- `allocate(int nrfiles, int nrfields)` (lines 719-727).
- `setDefault()` (lines 729-768): `encoding = ""`,
  **`addresultfile = true`**, rest false/empty, 0 files/fields.
- `readData(Node)` (lines 660-717), via `loadXML` (lines 591-593): flags
  Y/N missing → false; `limit` via `Const.toLong(..., 0L)` (line 700);
  files as parallel sub-node lists (lines 680-691).
- `getXML()` (lines 616-658): 8 scalars (lines 619-627), `<file>` ALWAYS
  emitted (lines 629/637) with FLAT 5-tag tuples (lines 631-635),
  `<fields>` (lines 639/644), then `limit`, `IsInFields`,
  `DynamicFilenameField` and 7 extra-file-field names (lines 645-656).
- `LoadFileInputField.getXML()` (LoadFileInputField.java lines 95-114):
  order `name`, `element_type`, `type`, `format`, `currency`, `decimal`,
  `group`, `length`, `precision`, `trim_type`, `repeat` (lines 99-109).
  `ElementTypeCode = { "content", "size" }` (line 59; ctor default
  `content`, line 79). `length`/`precision` missing → `-1` (lines
  124-125); **`repeat` missing → TRUE** (`!"N".equalsIgnoreCase`, line
  127 — same family pitfall as getXMLData).
- Semantics: `getFields()` (lines 770-788+) calls `r.clear()` in file
  mode (lines 772-774) — incoming schema is WIPED, output is only the new
  columns; `size` coerces NONE type to Integer (lines 786-788).

Emitted order: 8 scalars, `[<file> (flat quintuples)], [<fields>
(name, element_type, type, format, currency, decimal, group, length,
precision, trim_type, repeat)], [<limit>, <IsInFields>,
<DynamicFilenameField>, 7 extra names]`.

## 3. trans GetFilesRowsCount — `GetFilesRowsCountMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/getfilesrowscount/GetFilesRowsCountMeta.java`
- `allocate(int nrfiles)` (lines 463-469).
- `setDefault()` (lines 471-493): `rowsCountFieldName = "rowscount"`,
  `RowSeparator_format = "CR"`, `isaddresult = true`, rest false/empty, 0
  files.
- `readData(Node)` (lines 419-461), via `loadXML` (lines 354-356):
  `rowseparator_format` through `scrubOldRowSeparator` (line 426):
  **legacy `"CR"` loads as `"LINEFEED"`, `"LF"` as `"CARRIAGERETURN"`**
  (lines 407-417 — swapped legacy names); `isaddresult` empty/missing →
  TRUE (lines 431-436); files as parallel sub-node lists (lines 445-456).
- `getXML()` (lines 373-398): `files_count`, `files_count_fieldname`,
  `rows_count_fieldname`, `rowseparator_format`, `row_separator`,
  `isaddresult`, `filefield`, `filename_Field` (capital F, line 383),
  `smartCount` (lines 376-384), then `<file>` ALWAYS emitted (lines
  386/395) with FLAT 5-tag tuples (lines 388-392). **NO `<fields>` list.**
- Semantics: `getFields()` (lines 495-509) ALWAYS adds the Integer
  rows-count column, plus the Integer files-count column only when
  `includeFilesCount` — output is 1-2 count columns, ONE ROW PER FILE.

Emitted order: `[<files_count>, <files_count_fieldname>,
<rows_count_fieldname>, <rowseparator_format>, <row_separator>,
<isaddresult>, <filefield>, <filename_Field>, <smartCount>, <file>]`.

## 4. trans GetSubFolders — `GetSubFoldersMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/getsubfolders/GetSubFoldersMeta.java`
- `allocate(int nrfiles)` (lines 249-252): `folderName[]` +
  `folderRequired[]` only (2-tag pairs).
- `setDefault()` (lines 254-267): 0 folders, flags false, strings empty
  (`rowLimit` keeps Java default 0).
- `readData(Node)` (lines 359-383), via `loadXML` (lines 232-234): flags
  Y/N missing → false; `limit` via `Const.toLong(..., 0L)` (line 367);
  folders as parallel `name`/`file_required` sub-nodes (lines 374-379).
- `getXML()` (lines 339-357): `rownum`, `foldername_dynamic`,
  `rownum_field`, `foldername_field`, `limit` (lines 342-346), then
  `<file>` ALWAYS emitted paired (lines 347/354) with FLAT 2-tag pairs
  (`name`, `file_required`, lines 350-351 — NO masks/subfolders).
  **NO `<fields>` list.**
- Semantics: `getFields()` (lines 269-337) adds 10 HARDCODED columns
  (`folderName`, `short_folderName`, `path` — String 500; `ishidden`,
  `isreadable`, `iswriteable` — Boolean; `lastmodifiedtime` — Date; `uri`,
  `rooturi` — String; `childrens` — Integer; lines 273-328) plus the
  rownumber when enabled. Output names are NOT configurable.

Emitted order: `[<rownum>, <foldername_dynamic>, <rownum_field>,
<foldername_field>, <limit>, <file> (name/file_required pairs)]`.

## 5. trans PropertyOutput — `PropertyOutputMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/propertyoutput/PropertyOutputMeta.java`
- `setDefault()` (lines 376-383): `append`/`createparentfolder` false,
  key/value/comment null; no filename defaults.
- `readData(Node)` (lines 348-373), via `loadXML` (lines 107-109): reads
  `file/AddToResult` (capital, line 364) while `getXML()` writes
  `addtoresult` (lowercase, line 407) — HARMLESS (case-insensitive);
  flags Y/N missing → false.
- `getXML()` (lines 386-412): `keyfield`, `valuefield`, `comment` (lines
  391-393), `fileNameInField`, `fileNameField` (lines 395-396), then a
  SINGLE `<file>` block: `name`, **`extention`** (sic, line 400), `split`,
  `haspartno`, `add_date`, `add_time`, `create_parent_folder`,
  `addtoresult` (lowercase, line 407), `append` (lines 399-408 — note
  `addtoresult`/`append` sit textually inside `<file>` before its close
  tag despite step-level indentation). **NO `<fields>` list.**
- Filename build order (`buildFilename`, lines 318-346): base +
  `_yyyMMdd` + `_HHmmss` + `_stepnr` + `.extention`.
- Semantics: NO `getFields` override — pass-through rows; the only effect
  is the file side-effect.

Emitted order: `[<keyfield>, <valuefield>, <comment>, <fileNameInField>,
<fileNameField>, <file>(name, extention, split, haspartno, add_date,
add_time, create_parent_folder, addtoresult, append)]`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: FIXED_INPUT, xml_type: FixedInput, file: trans/FixedInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: LOAD_FILE_INPUT, xml_type: LoadFileInput, file: trans/LoadFileInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: GET_FILES_ROWS_COUNT, xml_type: GetFilesRowsCount, file: trans/GetFilesRowsCount.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: GET_SUB_FOLDERS, xml_type: GetSubFolders, file: trans/GetSubFolders.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: PROPERTY_OUTPUT, xml_type: PropertyOutput, file: trans/PropertyOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
