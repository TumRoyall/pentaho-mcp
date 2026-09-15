# B4a source notes — XML plugin steps (6 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b4a-xml.test.js` (exit 0).
Full test run + review left to Kiro.

**Registration (all six):** these steps live under `plugins/xml/core/...` and
register via `@Step` annotation, NOT via `engine/src/main/resources/kettle-steps.xml`
(grep for each id there returns no match). The annotation is registration
evidence only — XML evidence is each serializer below.

**Wrapper (all six):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**Tag-name matching is case-insensitive:** `XMLHandler.getTagValue()` compares
with `equalsIgnoreCase` (`core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java`,
line 153). Spelling differences in case between `getXML()` and `readData()`
(e.g. XMLJoin `valueXMLField` vs `valueXMLfield`) round-trip safely.

**No-DB note (all six):** none references a database connection. There is NO
`<connection>` tag in any `getXML()`, and the B2a connection-fixture pitfall
does NOT apply. Templates must not add one.

## 1. trans AddXML — `AddXMLMeta`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/addxml/AddXMLMeta.java`
- Registry: annotation `@Step(id = "AddXML", ...)` (lines 63-65).
- `allocate(int nrfields)` (lines 148-150): sizes `outputFields[]`
  (`XMLField`: fieldName/elementName/type/format/symbols/nullString/length/
  precision/attribute/attributeParentName).
- `setDefault()` (lines 201-229): `omitXMLheader = true`,
  `omitNullValues = false`, `encoding = "UTF-8"` (`Const.XML_ENCODING`,
  `core/.../Const.java` line 405), `valueName = "xmlvaluename"`,
  `rootNode = "Row"`, 0 fields.
- `readData(Node)` (lines 165-199), via `loadXML` (lines 144-146): reads
  `encoding`/`valueName`/`xml_repeat_element` (lines 167-169); the two flags
  NESTED in sub-node `<file>` (lines 171-172); `<fields>`/`<field>` count
  (lines 174-175) with `name`/`element`/`type`/`format`/`currency`/`decimal`/
  `group`/`nullif`/`length`/`precision`/`attribute`/`attributeParentName`
  (lines 183-194). `length`/`precision` via `Const.toInt(..., -1)`;
  `attribute` via `"Y".equalsIgnoreCase` (missing → false).
- `getXML()` (lines 239-275): emits `encoding`, `valueName`,
  `xml_repeat_element` (lines 242-244), `<file>` with `omitXMLheader` then
  `omitNullValues` (lines 246-249), then PAIRED `<fields>` ALWAYS emitted
  (lines 250/272). **PITFALL (line 254):** fields with an empty `fieldName`
  are SILENTLY SKIPPED on save.
- `getFields(...)` (lines 231-237): adds EXACTLY ONE `String` field named
  `valueName` — output = input + XML field.
- `check()` (lines 342-396): requires input and every `<name>` present in
  the previous row.

Emitted tag order: `[<encoding>, <valueName>, <xml_repeat_element>, <file>,
<fields>]`.

## 2. trans getXMLData — `GetXMLDataMeta` + `GetXMLDataField`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXMLDataMeta.java`
  (fields in `.../getxmldata/GetXMLDataField.java`)
- Registry: annotation `@Step(id = "getXMLData", ...)` (lines 65-67) —
  lowercase leading `g`; `<type>` must be `getXMLData` exactly.
- `allocate(int nrfiles, int nrfields)` (lines 869-872).
- `setDefault()` (lines 882-929): **`doNotFailIfNoFile = true`**, all other
  flags false/empty, `loopxpath = ""`, `rowLimit = 0`, 0 files/fields.
- `readData(Node)` (lines 799-867), via `loadXML` (lines 695-697): all flags
  via `"Y".equalsIgnoreCase` (missing → false); `rowLimit` via
  `Const.toLong(..., 0L)` (line 845); files read as PARALLEL sub-node lists
  under `<file>` (lines 825-836); fields via `new GetXMLDataField(fnode)`
  (lines 838-842).
- `getXML()` (lines 723-775): emits 11 flags `include … doNotFailIfNoFile`
  (lines 726-736), `rownum_field`, `encoding`, then `<file>` ALWAYS emitted
  (lines 741/750) holding FLAT per-file tag quintuples
  (`name/filemask/exclude_filemask/file_required/include_subfolders`, lines
  743-747 — NO per-file sub-wrapper), then `<fields>` (lines 752/757),
  then `limit`, `loopxpath`, `IsInFields`, `IsAFile`, `XmlField`,
  `prunePath` and 8 extra-file-field names (lines 759-773).
- `GetXMLDataField.getXML()` (GetXMLDataField.java lines 121-137): order
  `name`, `xpath`, `element_type`, `result_type`, `type`, `format`,
  `currency`, `decimal`, `group`, `length`, `precision`, `trim_type`,
  `repeat`. Enums: `element_type ∈ {node, attribute}` (line 78),
  `result_type ∈ {valueof, singlenode}` (line 45),
  `trim_type ∈ {none, left, right, both}` (line 58, unknown/null → `none`,
  lines 160-163). `length`/`precision` missing → `-1` (lines 154-155).
  **PITFALL (line 157):** `repeat = !"N".equalsIgnoreCase(...)` — a missing
  `<repeat>` loads as TRUE. Templates must always write it explicitly.
- `getFields(...)` (lines 931-1022): one value meta per declared field
  (type `NONE` falls back to `String`, lines 937-940) plus opted-in extras
  (filename lines 956-962, rownumber 964-969, file metadata 972-1021).
- `check()` (lines 1180-1239): ERROR when `loopxpath` empty, zero fields,
  or (file mode) no resolvable files. `supportsErrorHandling()` = true
  (lines 1250-1252).

Emitted tag order: `[<include>, <include_field>, <rownum>, <addresultfile>,
<namespaceaware>, <ignorecomments>, <readurl>, <validating>, <usetoken>,
<IsIgnoreEmptyFile>, <doNotFailIfNoFile>, <rownum_field>, <encoding>,
<file>, <fields>, <limit>, <loopxpath>, <IsInFields>, <IsAFile>,
<XmlField>, <prunePath>, <shortFileFieldName>, ...]`.

## 3. trans XMLJoin — `XMLJoinMeta`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmljoin/XMLJoinMeta.java`
- Registry: annotation `@Step(id = "XMLJoin", ...)` (lines 63-65).
- `setDefault()` (lines 148-151): sets ONLY `encoding = "UTF-8"` — all
  step/field references stay null, flags false.
- `readData(Node)` (lines 129-146), via `loadXML` (lines 120-122): reads
  `valueXMLfield` (lowercase f, line 131) while `getXML()` writes
  `valueXMLField` (uppercase F, line 188) — HARMLESS via case-insensitive
  matching (see header note). Flags via `"Y".equalsIgnoreCase`.
- `getXML()` (lines 185-201): 11 scalars in order — `valueXMLField`,
  `targetXMLstep`, `targetXMLfield`, `sourceXMLstep`, `sourceXMLfield`,
  `complexJoin`, `joinCompareField`, `targetXPath`, `encoding`,
  `omitXMLHeader`, `omitNullValues`. No lists, no other tags.
- `getFields(...)` (lines 153-183): adds ONE `String` field `valueXMLfield`
  and REMOVES source-only fields (lines 171-177) — output = target fields
  + joined result.
- `check()` (lines 242-354): ERROR on any empty reference AND unless BOTH
  `targetXMLstep` and `sourceXMLstep` are on the input hops (lines 316-353)
  — a 2-input step; both hops are required.

Emitted tag order: the 11 scalars listed above.

## 4. trans XSDValidator — `XsdValidatorMeta`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xsdvalidator/XsdValidatorMeta.java`
- Registry: annotation `@Step(id = "XSDValidator", ...)` (lines 63-66).
- `setDefault()` (lines 232-245): `resultfieldname = "result"`,
  `validationMessageField = "ValidationMsgField"`,
  `xsdSource = "filename"` (`SPECIFY_FILENAME`, lines 85/243);
  `allowExternalEntities` from system property (line 244).
- `readData(Node)` (lines 208-230), via `loadXML` (lines 198-200): reads
  the same 12 tags (lines 211-224); 3 flags via `"Y".equalsIgnoreCase`.
- `getXML()` (lines 273-291): 12 scalars in order — `xdsfilename` (line
  276 — note `xds`, missing an `s`), `xmlstream`, `resultfieldname`,
  `addvalidationmsg`, `validationmsgfield`, **`ifxmlunvalid` BEFORE
  `ifxmlvalid`** (lines 281-282 — note `unvalid`), `outputstringfield`,
  `xmlsourcefile`, `xsddefinedfield`, `xsdsource`, `allowExternalEntities`.
  No lists.
- `xsdSource` enum: `SPECIFY_FILENAME = "filename"`,
  `SPECIFY_FIELDNAME = "fieldname"`, `NO_NEED = "noneed"` (lines 85-87).
  `fieldname` mode reads the schema from `<xsddefinedField>`; `xmlsourcefile=Y`
  makes `<xmlstream>` a FILE path instead of a field name.
- `getFields(...)` (lines 247-271): adds the result field (`Boolean`, or
  `String` when `outputStringField`, lines 250-261) plus the message field
  when enabled (lines 265-269).
- `supportsErrorHandling()` = true (lines 417-419). `check()` (lines
  341-405): ERROR on empty `xmlstream`/`resultfieldname`, empty XSD filename
  in filename mode, or no input.

Emitted tag order: `[<xdsfilename>, <xmlstream>, <resultfieldname>,
<addvalidationmsg>, <validationmsgfield>, <ifxmlunvalid>, <ifxmlvalid>,
<outputstringfield>, <xmlsourcefile>, <xsddefinedfield>, <xsdsource>,
<allowExternalEntities>]`.

## 5. trans XSLT — `XsltMeta`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xslt/XsltMeta.java`
- Registry: annotation `@Step(id = "XSLT", ...)` (lines 59-61).
- `allocate(int nrParameters, int outputProps)` (lines 206-212): parallel
  `parameterName[]`/`parameterField[]` + `outputPropertyName[]`/`Value[]`.
- `setDefault()` (lines 287-308): `resultfieldname = "result"`,
  `xslFactory = "JAXP"`, `xslFieldIsAFile = true`, 0 params/props.
- `readData(Node)` (lines 248-285), via `loadXML` (lines 202-204): counts
  `<parameter>` in `<parameters>` (lines 264-265) and `<outputproperty>` in
  `<outputproperties>` (lines 267-268); flags via `"Y".equalsIgnoreCase`;
  **backward-compat** (lines 256-260): `xslfilefielduse=Y` + missing
  `xslfieldisafile` → `xslFieldIsAFile = true`.
- `getXML()` (lines 318-350): 7 scalars (`xslfilename`, `fieldname`,
  `resultfieldname`, `xslfilefield`, `xslfilefielduse`, `xslfieldisafile`,
  `xslfactory`, lines 321-328), then PAIRED `<parameters>` ALWAYS emitted
  (lines 329/338) with `<parameter>` items carrying `<field>` (row field)
  BEFORE `<name>` (stylesheet parameter, lines 333-334), then PAIRED
  `<outputproperties>` ALWAYS emitted (lines 339/348) with
  `<outputproperty>` items (`name` then `value`, lines 343-344).
- Output property vocabulary: `outputProperties = { method, version,
  encoding, standalone, indent, omit-xml-declaration, doctype-public,
  doctype-system, media-type }` (lines 65-66) — anything else is ignored.
- `getFields(...)` (lines 310-316): adds ONE `String` result field.
  `supportsErrorHandling()` = true (lines 513-515).

Emitted tag order: `[<xslfilename>, <fieldname>, <resultfieldname>,
<xslfilefield>, <xslfilefielduse>, <xslfieldisafile>, <xslfactory>,
<parameters>, <outputproperties>]`.

## 6. trans XMLInputStream — `XMLInputStreamMeta`

- Class: `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmlinputstream/XMLInputStreamMeta.java`
- Registry: annotation `@Step(id = "XMLInputStream", ...)` (lines 54-57).
- `setDefault()` (lines 380-431): `encoding = "UTF-8"`,
  `defaultStringLen = "1024"` (`DEFAULT_STRING_LEN`, line 61),
  **`enableTrim = true`** (line 389); 7 metadata columns ON
  (datatype_description, element_id, parent_element_id, element_level,
  path, parent_path, data_name, data_value — lines 401-429);
  filename/rownumber/location OFF.
- `loadXML()` inline (lines 238-310, no `readData`): strings via
  `Const.NVL(..., default)` — missing tags fall back safely (`filename ""`,
  `nrRowsToSkip`/`rowLimit` `"0"`, `defaultStringLen "1024"`, `encoding
  "UTF-8"`); flags via `"Y".equalsIgnoreCase`.
- `getXML()` (lines 321-377): 34 scalars, NO lists — source/filename/
  skip/limit-as-STRINGS/defaultStringLen/encoding/namespace/trim flags,
  then 12 include+name pairs (lines 336-374).
- **PITFALL — asymmetric names:** the datatype-numeric pair is
  `includeDataTypeNumericField`/`dataTypeNumericField` (lines 342-343,
  261-264 — no `Xml`) while every other pair uses `includeXml…`. Copying
  the pattern invents a dead tag.
- **PITFALL — 7 hardcoded output names:** `getFields()` (lines 137-235)
  ignores the custom names for element_id (line 187: `xml_element_id`),
  parent_element_id (194), element_level (201), path (208), parent_path
  (215), data_name (222), data_value (229). Renaming those `xml…Field`
  tags does NOT rename the output columns.
- `nrRowsToSkip`/`rowLimit` are STRINGS (lines 69/71 — variable-friendly
  chunk loading), not ints.

Emitted tag order: `[<sourceFromInput>, <sourceFieldName>, <filename>,
<addResultFile>, <nrRowsToSkip>, <rowLimit>, <defaultStringLen>,
<encoding>, <enableNamespaces>, <enableTrim>, <includeFilenameField>,
<filenameField>, <includeRowNumberField>, <rowNumberField>,
<includeDataTypeNumericField>, <dataTypeNumericField>,
<includeDataTypeDescriptionField>, <dataTypeDescriptionField>,
<includeXmlLocationLineField>, <xmlLocationLineField>,
<includeXmlLocationColumnField>, <xmlLocationColumnField>,
<includeXmlElementIDField>, <xmlElementIDField>,
<includeXmlParentElementIDField>, <xmlParentElementIDField>,
<includeXmlElementLevelField>, <xmlElementLevelField>,
<includeXmlPathField>, <xmlPathField>, <includeXmlParentPathField>,
<xmlParentPathField>, <includeXmlDataNameField>, <xmlDataNameField>,
<includeXmlDataValueField>, <xmlDataValueField>]`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: ADD_XML, xml_type: AddXML, file: trans/AddXML.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: GET_XML_DATA, xml_type: getXMLData, file: trans/getXMLData.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XML_JOIN, xml_type: XMLJoin, file: trans/XMLJoin.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XSD_VALIDATOR, xml_type: XSDValidator, file: trans/XSDValidator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XSLT, xml_type: XSLT, file: trans/XSLT.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: XML_INPUT_STREAM, xml_type: XMLInputStream, file: trans/XMLInputStream.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
