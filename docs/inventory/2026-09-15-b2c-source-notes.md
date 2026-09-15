# B2c source notes — SCD / data warehouse (2 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Wrapper (both):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**DB-connection note (both):** both steps reference a database connection BY
NAME (`<connection>` = `DatabaseMeta` name) and expose it via
`getUsedDatabaseConnections()`. The B2a connection-fixture pitfall APPLIES:
test fixtures MUST declare
`<connection><name>${CONN}</name></connection>` in the minimal `.ktr`, or the
validator reports "undefined connection" and the 0-error assertions fail.
Connection/credential/host/table/schema placeholders use `${VAR}`; no real
values are embedded anywhere.

## 1. trans DimensionLookup — `DimensionLookupMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/dimensionlookup/DimensionLookupMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 25:
  `<step id="DimensionLookup" ... classname ...dimensionlookup.DimensionLookupMeta ...
  category ...BaseStep.Category.DataWarehouse ...>`.
- `allocate(int nrkeys, int nrfields)` (lines 584-592): sizes `keyStream[]`,
  `keyLookup[]`, `fieldStream[]`, `fieldLookup[]`, `fieldUpdate[]` (int),
  `returnType[]` (int).
- `setDefault()` (lines 704-746): `schemaName=""`, `tableName` = i18n default,
  `databaseMeta=null`, `commitSize=100`, `update=true`, 0 keys + 0 fields,
  `dateField=""`, `dateFrom="date_from"`, `dateTo="date_to"`,
  `minYear=Const.MIN_YEAR` (1900), `maxYear=Const.MAX_YEAR` (2199 —
  both in `core/src/main/java/org/pentaho/di/core/Const.java`, lines 234/239),
  `keyField=""`, `keyRename=""`, `autoIncrement=false`,
  `versionField="version"`, `cacheSize=5000`, `preloadingCache=false`.
  `sequenceName`/`techKeyCreation`/`startDateFieldName` are NOT set (null);
  `useBatchUpdate`/`usingStartDateAlternative` stay false,
  `startDateAlternative` stays 0 (`none`).
- `readData(Node, ...)` (lines 896-974), via `loadXML` (lines 580-582):
  `commit` via `Const.toInt(..., 0)` (line 907 — missing tag loads 0, NOT
  the 100 of `setDefault`); `connection` resolved via
  `DatabaseMeta.findDatabase` (lines 904-905); key/field counts from the
  `<fields>` sub-node (lines 916-919); `<key>` items read `name`+`lookup`
  (lines 924-929); the single `<date>` reads `name`/`from`/`to` (lines
  933-936); `<field>` items read `name`+`lookup`+`update` (lines 938-945);
  `<sequence>` is read ONLY when `update` is true (lines 947-950);
  `min_year`/`max_year` fall back to `Const.MAX_YEAR`/`Const.MIN_YEAR`
  (lines 952-953); return block `name`/`rename`/`use_autoinc`/`version`/
  `creation_method` (lines 955-960); `cache_size` missing → -1 (line 962);
  `preload_cache`/`useBatch`/`use_start_date_alternative` via
  `"Y".equalsIgnoreCase` (missing → false, lines 963-967);
  `start_date_alternative` via `getStartDateAlternative` (lines 657-669 —
  unknown/missing → `none`).
- **PITFALL 1 (line 910):** `upd = XMLHandler.getTagValue(stepnode, "update");
  if (upd.equalsIgnoreCase("Y"))` — NO null-guard on `upd`, so a step
  missing `<update>` throws NPE (wrapped as `KettleXMLException`, lines
  970-973). The reference template MUST always include `<update>` (Y/N).
- **PITFALL 2 (line 957):** `autoIncrement =
  !"N".equalsIgnoreCase(XMLHandler.getTagValue(fields, "return",
  "use_autoinc"))` — INVERTED default: a `<return>` missing
  `<use_autoinc>` loads as **true**, while `setDefault()` sets false.
  The template MUST pin `<use_autoinc>` explicitly (N unless auto-inc is
  intended).
- **PITFALL 3 (lines 614-639, `getUpdateType`):** `<field>/<update>` is a
  STRING whose meaning flips with the step-level `<update>` flag. Update
  mode matches `typeCodes` (`Insert`, `Update`, `Punch through`,
  `DateInsertedOrUpdated`, `DateInserted`, `DateUpdated`, `LastVersion`,
  lines 104-105), then legacy `typeDesc` (lines 621-626), then `"Y"` →
  punch-through (lines 627-629), else defaults to `Insert` (line 631).
  Lookup mode maps to a value-meta type id, `NONE` → `STRING` (lines
  633-637). Writing Y/N or a numeric type id here is silently mis-mapped.
- **PITFALL 4:** tag names are `<schema>`/`<table>`, NOT
  `<schemaname>`/`<tablename>` — invented tags are silently ignored by
  `readData()`. Tag `<useBatch>` has a capital B; `<start_date_alternative>`
  takes code values (`none`, `sysdate`, `trans_start`, `null`,
  `column_value`, lines 115-120), not display labels.
- `getUpdateTypeCode` (lines 649-655): lookup mode writes the value-meta
  NAME string; update mode writes the `typeCodes` entry.
- `getXML()` (lines 832-893): emits `schema`, `table`, `connection`
  (empty when null), `commit` (int), `update` (Y/N), then the `<fields>`
  wrapper ALWAYS (lines 843/876) with `<key>` items (`name`+`lookup`),
  exactly one `<date>` (`name`/`from`/`to`), `<field>` items (`name`+
  `lookup`+`update` via `getUpdateTypeCode`), one `<return>` (`name`,
  `rename`, `creation_method`, `use_autoinc`, `version`); then `sequence`,
  `min_year`, `max_year`, `cache_size`, `preload_cache`,
  `use_start_date_alternative`, `start_date_alternative` (code),
  `start_date_field_name`, `useBatch`.
- `getFields(...)` (lines 749-829): normalizes storage/trim, THROWS
  `KettleStepException` when `keyField` is empty (lines 766-772), adds one
  `ValueMetaInteger` technical key (length 9, renamed via `keyRename`,
  lines 774-782); lookup mode appends return fields with types read from
  the live DB table (lines 786-828, needs a real connection).
- `getUsedDatabaseConnections()` (lines 1794-1800) returns the selected
  connection — DB lineage applies.
- `check()` (lines 1124-1157) requires technical key, version field,
  date-range bounds and an input stream; `creation_method` must be
  `autoinc`/`sequence`/`tablemax` when set (lines 1133-1143).
- SCD semantics (Meta-level, no runtime statement review): natural-key
  lookup bounded by the stream date against `date_from`/`date_to`;
  per-field update kinds drive Type I (Update/punch-through) vs Type II
  (Insert = new version row) writes; `version` counts versions;
  `LastVersion`/`DateInserted*`/`DateUpdated` are argument-less marker
  kinds (`isUpdateTypeWithoutArgument`, lines 687-701).

Emitted tag order: `[<schema>, <table>, <connection>, <commit>, <update>,
<fields>(<key>*, <date>, <field>*, <return>), <sequence>, <min_year>,
<max_year>, <cache_size>, <preload_cache>, <use_start_date_alternative>,
<start_date_alternative>, <start_date_field_name>, <useBatch>]`.

## 2. trans CombinationLookup — `CombinationLookupMeta`

- Class: `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/combinationlookup/CombinationLookupMeta.java`
- Registry: annotation `@Step(id = "CombinationLookup", ...)` (lines 73-75),
  `categoryDescription = "...BaseStep.Category.DataWarehouse"` (line 74).
  **NOT in `kettle-steps.xml`** — registry presence here is annotation
  evidence, not XML evidence.
- `DEFAULT_CACHE_SIZE = 9999` (line 84).
- `allocate(int nrkeys)` (lines 398-401): sizes `keyField[]` + `keyLookup[]`
  only (no field/update arrays — unlike DimensionLookup).
- `setDefault()` (lines 465-487): `schemaName=""`, `tablename` = i18n
  default, `databaseMeta=null`, `commitSize=100`,
  `cacheSize=DEFAULT_CACHE_SIZE` (9999), `replaceFields=false`,
  `preloadCache=false`, `useHash=false`, `hashField="hashcode"`, 0 keys,
  `technicalKeyField="technical/surrogate key field"`, `useAutoinc=false`.
  `techKeyCreation`/`sequenceFrom`/`lastUpdateField` are NOT set (null).
- `readData(Node, ...)` (lines 416-462), via `loadXML` (lines 394-396):
  `commit`/`cache_size` via `Const.toInt(..., 0)` (lines 425-428 — missing
  tags load 0, NOT the 100/9999 of `setDefault`); `replace`/`preloadCache`/
  `crc` via `"Y".equalsIgnoreCase` (missing → false, lines 430-432);
  `crcfield` verbatim (line 434); key count from the `<fields>` sub-node
  (lines 436-437); `<key>` items read `name`+`lookup` (lines 442-446);
  `sequence` from stepnode (line 449); return block `name`/`use_autoinc`/
  `creation_method` (lines 451-457); **`last_update_field` is read DIRECTLY
  from the step node** (line 455), NOT from inside `<fields>/<return>`.
- **PITFALL 1 (line 454):** `useAutoinc =
  !"N".equalsIgnoreCase(XMLHandler.getTagValue(retkey, "use_autoinc"))` —
  same INVERTED default as DimensionLookup: missing `<use_autoinc>` loads
  as **true** while `setDefault()` sets false. The template MUST pin it.
- **PITFALL 2:** `<return>` has NO `<version>`/`<rename>` (contrast
  DimensionLookup lines 868-874 vs CombinationLookup lines 531-535).
  Inventing them is silently ignored. Likewise `<last_update_field>`
  placed inside `<return>` is silently ignored — it must be a direct
  child of `<step>`.
- **PITFALL 3:** exact tag case — `<preloadCache>` (camelCase, line 519),
  `<crc>`/`<crcfield>` (lowercase, lines 520-521). `<preload_cache>` or
  `<CRC>` variants are silently ignored (always false/null).
- `getXML()` (lines 509-544): emits `schema`, `table`, `connection`
  (empty when null), `commit` (int), `cache_size` (int), `replace` (Y/N),
  `preloadCache` (Y/N), `crc` (Y/N), `crcfield`, then the `<fields>`
  wrapper ALWAYS (lines 523/537) with `<key>` items (`name`+`lookup`) and
  exactly one `<return>` (`name`, `creation_method`, `use_autoinc`); then
  `sequence`, `last_update_field`.
- `getFields(...)` (lines 490-506): adds one `ValueMetaInteger` technical
  key (length 10, lines 492-496); when `replaceFields` is true it REMOVES
  the original key fields from the row (lines 498-505) — output = input
  minus keys plus TK, unlike DimensionLookup which keeps the input row.
- `getUsedDatabaseConnections()` (lines 1050-1056) returns the selected
  connection — DB lineage applies.
- `check()` (lines 622-787) requires stream key fields, dimension lookup
  columns, the technical-key column in the table and an input stream;
  `creation_method` must be `autoinc`/`sequence`/`tablemax` when set
  (lines 748-760). `getSQLStatements()` (lines 790-1008) builds the
  dimension DDL: TK + key columns (+ hash column when `crc=Y`, +
  last-update Date column when set), lookup index on hash or all keys,
  unique index on TK, optional sequence; errors `NotHashFieldSpecified`
  when `crc=Y` without `hashField` (lines 935-941).
- No version/date-range machinery: one key combination ↔ one surrogate
  key (junk/combination dimension). SCD Type II history needs
  DimensionLookup instead.

Emitted tag order: `[<schema>, <table>, <connection>, <commit>,
<cache_size>, <replace>, <preloadCache>, <crc>, <crcfield>,
<fields>(<key>*, <return>), <sequence>, <last_update_field>]`.

## Proposed catalog rows (for Kiro to append to catalog.yaml, trans list)

```yaml
    - {type: DIMENSION_LOOKUP, xml_type: DimensionLookup, file: trans/DimensionLookup.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: COMBINATION_LOOKUP, xml_type: CombinationLookup, file: trans/CombinationLookup.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
```

(Alias convention follows prior batches: SNAKE_UPPER of the XML type,
e.g. `SORTED_MERGE`, `MEMORY_GROUP_BY`, `DB_JOIN`. Both rows are evidence
level `source_reviewed` — no `spoon_loaded`/runtime claims.)
