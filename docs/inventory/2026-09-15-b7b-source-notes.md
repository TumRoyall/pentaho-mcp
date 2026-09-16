# B7b source notes — deprecated trans steps (7 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`
(rev-parse verified `1a939ab5cabe4517867879684aeca2a526bcc638`).
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent beyond `rev-parse`
and file reads.

**Batch rule (B7):** every ID below is DEPRECATED in source
(`deprecated.svg` icon and/or `Category.Deprecated`). Proposed catalog rows
are `status: observed`, `generator_eligible: false`,
`verification: source_reviewed` — read/maintain only, never generate new.
No canonical replacement is proposed for any ID (replacements are noted
where source gives one, for reader guidance only).

**Wrapper (all seven):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**DB-connection note:** OpenERPObjectInput, OpenERPObjectOutputImport,
OpenERPObjectDelete, GPBulkLoader, LucidDBStreamingLoader all carry a
`<connection>` DatabaseMeta-name reference. The B2a fixture pitfall applies:
test fixtures MUST declare
`<connection><name>${CONN}</name></connection>`. XMLInput and XMLInputSax
have NO `<connection>` tag — their templates/fixtures must not add one.
All connection/credential/host/table/schema values use `${VAR}`
placeholders; no real values anywhere.

## 1. trans OpenERPObjectInput — `OpenERPObjectInputMeta`

- Class: `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectinput/OpenERPObjectInputMeta.java`
- Registry: annotation `@Step(id="OpenERPObjectInput", image="ui/images/deprecated.svg",
  ..., categoryDescription="...BaseStep.Category.Deprecated")` (lines 52-55).
- `getXML()` (lines 105-139): order `connection` (DatabaseMeta name, ""
  when null, 108-109), `modelName` (110), `readBatchSize` (111), then
  `<mappings>` ALWAYS emitted (113-125; each `<mapping>`: `source_model`
  116, `source_field` 117, `source_index` 118, `target_model` 119,
  `target_field` 120, `target_field_label` 121, `target_field_type` 122),
  then `<filters>` ALWAYS emitted (127-136; each `<filter>`: `operator`
  130, `field_name` 131, `comparator` 132, `value` 133).
- `readData()` (lines 225-272) via `loadXML` (142-144): `findDatabase`
  connection (228); `readBatchSize` via `Integer.parseInt` NO null-guard
  (230 — missing tag throws, wrapped as `KettleXMLException` 269-271);
  mappings list reset (232), counted from sub-node `<mappings>` (234-235);
  `source_index`/`target_field_type` parseInt (244/248 — NUMERIC type id,
  not a name string).
- `setDefault()` EMPTY (lines 220-223): a new step keeps field
  initializers — `readBatchSize = 1000` (line 60), empty
  mappings/filterList (61-62).
- `getFields()` (lines 64-80): THROWS when `databaseMeta == null`
  (68-70); else output row = `getRowMeta()` (82-88), one value-meta per
  mapping (`target_field`, `target_field_type`).
- No replacement in source 9.4.

Emitted tag order: `[<connection>, <modelName>, <readBatchSize>, <mappings>, <filters>]`.

## 2. trans OpenERPObjectOutputImport — `OpenERPObjectOutputMeta`

- Class: `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectoutput/OpenERPObjectOutputMeta.java`
- Registry: annotation `@Step(id="OpenERPObjectOutputImport", image=
  "ui/images/deprecated.svg", ..., categoryDescription="...Deprecated")`
  (lines 48-51). **XML type is `OpenERPObjectOutputImport`, NOT
  `OpenERPObjectOutput`.**
- `getXML()` (lines 94-124): order `connection` (97-98), `modelName`
  (99), **`readBatchSize` holding `commitBatchSize`** (100 — the XML tag
  is NOT `commitBatchSize`), `outputIDField` Y/N (101),
  `outputIDFieldName` (102), then `<mappings>` ALWAYS emitted (104-111;
  each `<mapping>`: `model_field` 107, `stream_field` 108), then
  `<key_mappings>` ALWAYS emitted (113-121; each `<key_map>`:
  `model_key_field` 116, **`comparitor` [sic] 117**, `stream_key_field`
  118).
- `readData()` (lines 204-244) via `loadXML` (127-129): commitBatchSize
  read from tag `readBatchSize` (209); **PITFALL (line 210):**
  `XMLHandler.getTagValue(stepnode, "outputIDField").equals("Y")` — NO
  null-guard, missing tag throws NPE (wrapped 241-243). Template MUST
  always carry `<outputIDField>` Y/N.
- `setDefault()` EMPTY (199-202): initializers `commitBatchSize = 100`
  (line 56), `outputIDField = false` (59), `outputIDFieldName = ""` (60).
- `getFields()` (lines 64-76): appends ONE Integer column
  `outputIDFieldName` only when `outputIDField` true; THROWS when the
  name is empty (67-69).
- Side note (repo path only, not XML): `readRep` (lines 146-155) calls
  `allocate()` twice, the second sizing model/stream arrays by the KEY
  count — repository round-trip quirk, XML path unaffected.
- No replacement in source 9.4.

Emitted tag order: `[<connection>, <modelName>, <readBatchSize>, <outputIDField>, <outputIDFieldName>, <mappings>, <key_mappings>]`.

## 3. trans OpenERPObjectDelete — `OpenERPObjectDeleteMeta`

- Class: `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectdelete/OpenERPObjectDeleteMeta.java`
- Registry: annotation `@Step(id="OpenERPObjectDelete", image=
  "ui/images/deprecated.svg", ..., categoryDescription="...Deprecated")`
  (lines 41-44).
- `getXML()` (lines 67-77): EXACTLY four scalar tags, no list wrappers —
  `connection` (70-71), `modelName` (72), **`readBatchSize` holding
  `commitBatchSize`** (73), `idFieldName` (74).
- `readData()` (lines 118-129) via `loadXML` (80-82): parseInt
  `readBatchSize` NO null-guard (123 — missing tag throws, wrapped
  126-128).
- `setDefault()` EMPTY (113-116): initializers `commitBatchSize = 1000`
  (line 49), `idFieldName = ""` (50). `getIdFieldName()` null-guards to
  `""` (160-161).
- No `getFields()` override — input schema passes through; runtime reads
  the id per row from the `idFieldName` column (dynamic, not a static id).
- No replacement in source 9.4.

Emitted tag order: `[<connection>, <modelName>, <readBatchSize>, <idFieldName>]`.

## 4. trans XMLInput — `XMLInputMeta`

- Class: `plugins/xml-input/core/src/main/java/org/pentaho/di/trans/steps/xmlinput/XMLInputMeta.java`
- Registry: annotation `@Step(id="XMLInput", ...,
  categoryDescription="i18n:org.pentaho.di.job:JobCategory.Category.Deprecated")`
  (lines 65-68) — note the job-category string on a trans step.
- `getXML()` (lines 277-313): order `include` Y/N (280),
  `include_field` (281), `rownum` Y/N (282), `rownum_field` (283),
  `file_base_uri` (284), `ignore_entities` Y/N (285), `namespace_aware`
  Y/N (286), `<file>` ALWAYS emitted (288-293; `name`+`filemask` pairs
  by shared index), `<fields>` ALWAYS emitted (295-300 via
  `XMLInputField.getXML()`), `<positions>` ALWAYS emitted (302-307),
  `limit` (309), `skip` (310).
- `XMLInputField.getXML()` (`XMLInputField.java` lines 91-115): `name`,
  `type` = type-desc STRING (96), `format`/`currency`/`decimal`/`group`,
  `length`, `precision`, `trim_type` = **CODE** via `getTrimTypeCode()`
  (103; codes `none`/`left`/`right`/`both` per
  `core/.../row/value/ValueMetaBase.java` line 194), `repeat` (104),
  nested `<positions>` (106-110). Load: `length`/`precision` via
  `Const.toInt(..., -1)` (124-125); trim via `getTrimTypeByCode()`
  (126); `repeat` via `!"N".equalsIgnoreCase(...)` (127).
- `readData()` (lines 315-359) via `loadXML` (251-253): 4 booleans via
  `"Y".equalsIgnoreCase` (317/319/322/323 — missing tag = false, safe);
  files by shared index (334-339); `limit` via `Const.toLong(..., 0L)`
  (353); `skip` via `Const.toInt(..., 0)` (355).
- `setDefault()` (lines 370-400): all flags false, strings "", 0
  files/fields/positions, `rowLimit = 0`, `nrRowsToSkip = 0`.
- `getFields()` (lines 402-431): APPENDS input-field columns (NONE type
  coerced to STRING, 407-410) plus filename/rownum columns when flagged.
- Replacement (sourced): step `getXMLData`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXmlDataMeta.java`
  line 65: `@Step(id = "getXMLData", ...)`).

Emitted tag order: `[<include>, <include_field>, <rownum>, <rownum_field>, <file_base_uri>, <ignore_entities>, <namespace_aware>, <file>, <fields>, <positions>, <limit>, <skip>]`.

## 5. trans XMLInputSax — `XMLInputSaxMeta`

- Class: `plugins/xml-input-stream/core/src/main/java/org/pentaho/di/trans/steps/xmlinputsax/XMLInputSaxMeta.java`
- Registry: annotation `@Step(id="XMLInputSax", ...,
  categoryDescription="i18n:org.pentaho.di.job:JobCategory.Category.Deprecated")`
  (lines 65-68).
- `getXML()` (lines 258-297): order `include` (261), `include_field`
  (262), `rownum` (263), `rownum_field` (264), `<file>` ALWAYS emitted
  (266-271), **`<def_attributes>` ALWAYS emitted (273-278;
  `def_element` 275 + `def_attribute` 276 pairs)**, `<fields>` ALWAYS
  emitted (280-285 via `XMLInputSaxField.getXML()`), `<positions>`
  ALWAYS emitted (287-292), `limit` (294). **NO `file_base_uri`,
  `ignore_entities`, `namespace_aware`, or `skip`.**
- `XMLInputSaxField.getXML()` (`XMLInputSaxField.java` lines 86-99):
  same shape as XMLInput EXCEPT `trim_type` = **DESC** via
  `getTrimTypeDesc()` (line 94; descs are i18n strings per
  `ValueMetaBase.java` lines 199-203) — load via `getTrimType(desc)`
  (line 117). **Do NOT copy field blocks verbatim between XMLInput and
  XMLInputSax.**
- `readData()` (lines 299-353) via `loadXML` (227-229): def attributes
  cleared then reloaded pairwise (326-333); loop positions parsed via
  `new XMLInputSaxFieldPosition(encoded)` (341-345); `limit` via
  `Const.toLong(..., 0L)` (348-349).
- `setDefault()` (lines 366-397): flags false, strings "", 0
  files/fields/positions, `rowLimit = 0L` (396).
- Replacement (sourced): step `getXMLData` (same citation as §4). Note:
  plugin `xml-input-stream` in 9.4 contains ONLY this SAX step — there is
  NO `XMLInputStream` step in source, so no such replacement is claimed.

Emitted tag order: `[<include>, <include_field>, <rownum>, <rownum_field>, <file>, <def_attributes>, <fields>, <positions>, <limit>]`.

**Tooling trap (verified by local simulation, not source):** `setFields()`
learns only FLAT child tags of the template `<field>` item, so driving
`<fields>/<field>` with it flattens each field's NESTED `<positions>`
into escaped text (`&lt;position&gt;...`, placeholder leaks) instead of
real markup. The B7b test therefore configures XMLInput/XMLInputSax
fields via `setFieldPath()` (`fields/field/...`,
`fields/field/positions/position`), keeping nested markup real; the
references document the same caveat.

## 6. trans GPBulkLoader — `GPBulkLoaderMeta`

- Class: `plugins/gp-bulk-loader/core/src/main/java/org/pentaho/di/trans/steps/gpbulkloader/GPBulkLoaderMeta.java`
- Registry: annotation `@Step(id="GPBulkLoader", image=
  "ui/images/deprecated.svg", ...,
  categoryDescription="...BaseStep.Category.Deprecated",
  suggestion="GPBulkLoaderMeta.SuggestedStep")` (lines 65-70).
- Fixed vocab, "Do not translate" (lines 127-143): actions
  `APPEND`/`INSERT`/`REPLACE`/`TRUNCATE` (127-130); methods `AUTO_END`/
  `MANUAL` (136-137); date masks `DATE`/`DATETIME` (142-143).
- `getXML()` (lines 326-354): order `connection` (330-331), `errors`
  (332), `schema` (333), `table` (334), `load_method` (335),
  `load_action` (336), `PsqlPath` case-preserved (337), `control_file`
  (338), `data_file` (339), `log_file` (340), `erase_files` Y/N (341),
  `encoding` (342), `dbname_override` (343), then `<mapping>` items
  DIRECTLY under `<step>` (345-351; `stream_name` 347, `field_name` 348,
  `date_mask` 349) — **NO wrapper**.
- `readData()` (lines 253-301) via `loadXML` (228-230): `errors` via
  `Const.toInt(..., 50)` (259); `erase_files` via `"Y".equalsIgnoreCase`
  (270 — missing = false, vs setDefault true); mappings counted DIRECTLY
  `countNodes(stepnode, "mapping")` (274); **PITFALL (lines 280-284):**
  `stream_name` fills `fieldTable[i]` (the TABLE column) and
  `field_name` fills `fieldStream[i]` (the stream column) — names are
  counter-intuitive; null `field_name` defaults to the table name;
  `date_mask` keeps only `DATE`/`DATETIME`, else `""` (289-294).
- `setDefault()` (lines 304-323): `maxErrors = 50` (307), i18n default
  table (309), `AUTO_END`/`APPEND` (310-311), `PsqlPath = "PsqlPath"`
  (312), control/data files with `${Internal.Step.CopyNr}` (313-314),
  `eraseFiles = true` (319), 0 mappings (321-322).
- Replacement (sourced): step `GPLoad`
  (`plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java`
  line 61: `@Step(id = "GPLoad", ...)`), consistent with the
  `suggestion` attribute on this step.

Emitted tag order: `[<connection>, <errors>, <schema>, <table>, <load_method>, <load_action>, <PsqlPath>, <control_file>, <data_file>, <log_file>, <erase_files>, <encoding>, <dbname_override>, <mapping>...]`.

## 7. trans LucidDBStreamingLoader — `LucidDBStreamingLoaderMeta`

- Class: `plugins/lucid-db-streaming-loader/core/src/main/java/org/pentaho/di/trans/steps/luciddbstreamingloader/LucidDBStreamingLoaderMeta.java`
- Registry: annotation `@Step(id="LucidDBStreamingLoader", image=
  "ui/images/deprecated.svg", ...,
  categoryDescription="...BaseStep.Category.Deprecated",
  suggestion="LucidDBStreamingLoaderMeta.SuggestedStep")` (lines 64-68).
- Operations (lines 78-81): `MERGE`/`INSERT`/`UPDATE`/`CUSTOM`.
- `getXML()` (lines 274-309): order `connection` (277-279), `schema`
  (280), `table` (281), `host` (282), `port` (283), `operation` (284),
  `custom_sql` (285), then `<keys_mapping>` DIRECTLY (287-292;
  `key_field_name` 289, `key_stream_name` 290), `<fields_mapping>`
  DIRECTLY (294-300; `field_field_name` 296, `field_stream_name` 297,
  `insert_or_update_flag` Y/N 298), `<tab_is_enable_mapping>` DIRECTLY
  (302-306; `tab_is_enable` Y/N 304) — **NO wrappers** (singular tag
  names, direct children).
- `readData()` (lines 210-262) via `loadXML` (168-170): three lists
  counted DIRECTLY (220-222); null stream names default to the table
  name, SILENTLY (230-234, 242-244 — always write both tags); flags via
  `"Y".equalsIgnoreCase` (248/254 — missing = false).
- `setDefault()` (lines 264-272): `schema ""` (266), i18n default table
  (267), `host "localhost"` (268), `port "9034"` (269), `operation
  "MERGE"` (270), 0 mappings (271). Templates use
  `${LUCID_HOST}`/`${LUCID_PORT}` placeholders, never real endpoints.
- Replacement: the `suggestion` attribute names a message key whose value
  was not read — NO replacement is claimed (nothing invented).

Emitted tag order: `[<connection>, <schema>, <table>, <host>, <port>, <operation>, <custom_sql>, <keys_mapping>..., <fields_mapping>..., <tab_is_enable_mapping>...]`.

## Proposed catalog rows (for Kiro to add to catalog.yaml)

```yaml
    - {type: OPENERP_OBJECT_INPUT, xml_type: OpenERPObjectInput, file: trans/OpenERPObjectInput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: OPENERP_OBJECT_OUTPUT_IMPORT, xml_type: OpenERPObjectOutputImport, file: trans/OpenERPObjectOutputImport.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: OPENERP_OBJECT_DELETE, xml_type: OpenERPObjectDelete, file: trans/OpenERPObjectDelete.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: XML_INPUT, xml_type: XMLInput, file: trans/XMLInput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: XML_INPUT_SAX, xml_type: XMLInputSax, file: trans/XMLInputSax.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: GP_BULK_LOADER, xml_type: GPBulkLoader, file: trans/GPBulkLoader.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: LUCID_DB_STREAMING_LOADER, xml_type: LucidDBStreamingLoader, file: trans/LucidDBStreamingLoader.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
```

Note: each row carries a `deprecated in source 9.4` note by virtue of the
reference header; no `deprecated:` catalog key exists in the current
`parseCatalog()` shape, so no new key is introduced. Verified no alias
collision: `OpenERP|XMLInput|GPBulkLoader|LucidDB` have zero matches in
the current catalog.yaml.
