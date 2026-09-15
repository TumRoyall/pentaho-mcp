# B2b source notes — aggregate/merge (3 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Wrapper (all three):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**No-DB note (all three):** none of these three IDs references a database
connection. There is NO `<connection>` tag in any of their `getXML()` methods,
and the B2a connection-fixture pitfall does NOT apply. Templates must not add
one.

## 1. trans SortedMerge — `SortedMergeMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/sortedmerge/SortedMergeMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 50:
  `<step id="SortedMerge" ... classname ...sortedmerge.SortedMergeMeta ...
  category ...BaseStep.Category.Joins ...>`.
- `allocate(int nrfields)` (lines 75-78): sizes `fieldName[]` + `ascending[]`.
- `setDefault()` (lines 80-88): `nrfields = 0`, then `allocate(0)` — a new
  step has ZERO sort keys.
- `readData(Node)` (lines 102-123), via `loadXML` (lines 71-73): reads
  `<fields>`/`<field>` (lines 104-105), `<name>` (line 112), `<ascending>`
  (line 113). **PITFALL (line 114):** `if (asc.equalsIgnoreCase("Y"))` — NO
  null-guard on `asc`, so a `<field>` missing `<ascending>` throws NPE
  (wrapped as `KettleXMLException`, lines 120-122). The reference template
  MUST always include `<ascending>` (Y/N) on every `<field>`.
- `getXML()` (lines 125-138): emits **ONLY** a `<fields>` block (lines
  128-135); each `<field>` has `<name>` (line 131) and `<ascending>` (boolean
  Y/N via `XMLHandler.addTagValue`, line 132). No other tags.
- `getFields(...)` (lines 166-179): does NOT add/remove columns — it only
  sets `setSortedDescending(!ascending[i])` on existing input columns (lines
  169-177). Output schema = input schema; the step merges multiple
  already-sorted input streams (see also `check()`, lines 181-241, which
  requires input streams and known sort keys).

Emitted tag order: `[<fields>]`.

## 2. trans MemoryGroupBy — `MemoryGroupByMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/memgroupby/MemoryGroupByMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, line 48:
  `<step id="MemoryGroupBy" ... classname ...memgroupby.MemoryGroupByMeta ...
  category ...BaseStep.Category.Statistics ...>`.
- Aggregate codes: `typeGroupCode` (lines 102-105):
  `"-", "SUM", "AVERAGE", "MEDIAN", "PERCENTILE", "MIN", "MAX", "COUNT_ALL",
  "CONCAT_COMMA", "FIRST", "LAST", "FIRST_INCL_NULL", "LAST_INCL_NULL",
  "STD_DEV", "CONCAT_STRING", "COUNT_DISTINCT", "COUNT_ANY"`.
- `getType(String)` (lines 298-310): matches code (lines 299-303), else long
  desc (lines 304-308), else **returns 0 = `"-"` (NONE)** (line 309). So
  `<type>` is a STRING code and an unknown code silently loads as NONE.
- `allocate(int sizegroup, int nrfields)` (lines 233-239): `groupField[]`,
  `aggregateField[]`, `subjectField[]`, `aggregateType[]` (int),
  `valueField[]` (**String** — separator, e.g. for CONCAT_STRING).
- `readData(Node)` (lines 256-296), via `loadXML` (lines 229-231): group
  names from `<group>`/`<field>`/`<name>` (lines 266-269); aggregates from
  `<fields>`/`<field>` with `<aggregate>` (line 274), `<subject>` (line 275),
  `<type>` → `getType()` (line 276), `<valuefield>` string (line 283).
  **PITFALL (lines 286-291):** when `<give_back_row>` is missing/empty,
  `alwaysGivingBackOneRow` falls back to `hasNumberOfValues` (true if ANY
  aggregate is `COUNT_ALL`/`COUNT_DISTINCT`/`COUNT_ANY`, lines 278-281) —
  NOT a hard false. Same fallback in `readRep` (line 496).
- `setDefault()` (lines 327-332): 0 groups + 0 aggregates.
- `getFields(...)` (lines 335-441): REBUILDS the row — group fields carried
  through (lines 347-353) plus one new value meta per aggregate whose type
  derives from the aggregate kind (lines 357-435); then `r.clear()` +
  `r.addRowMeta(fields)` (lines 439-440).
- `getXML()` (lines 444-469): emits `<give_back_row>` (Y/N, line 447)
  **FIRST**, then `<group>` (lines 449-455, each `<field>` has `<name>`),
  then `<fields>` (lines 457-466, each `<field>` has `<aggregate>` line 460,
  `<subject>` line 461, `<type>` = `getTypeDesc()` string line 462,
  `<valuefield>` string line 463).

Emitted tag order: `[<give_back_row>, <group>, <fields>]`.

## 3. trans AnalyticQuery — `AnalyticQueryMeta`

- Class: `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/analyticquery/AnalyticQueryMeta.java`
- Registry: annotation `@Step(id="AnalyticQuery", ...)` (lines 62-64),
  `categoryDescription = "...BaseStep.Category.Statistics"` (line 64).
  **NOT in `kettle-steps.xml`** (grep for `AnalyticQuery` in
  `engine/src/main/resources/kettle-steps.xml` returns no match) — registry
  presence here is annotation evidence, not XML evidence.
- Function codes: `TYPE_FUNCT_LEAD = 0`, `TYPE_FUNCT_LAG = 1` (lines 69-70);
  `typeGroupCode = { "LEAD", "LAG" }` (lines 72-73).
- `getType(String)` (lines 229-241): unknown desc → returns 0 = LEAD
  (line 240).
- `allocate(int sizegroup, int nrfields)` (lines 184-192): `groupField[]`
  (String), `aggregateField[]`, `subjectField[]`, `aggregateType[]` (int),
  `valueField[]` (**int** — offset N, line 189), plus `number_of_fields`.
- `readData(Node)` (lines 199-227), via `loadXML` (lines 180-182): group
  names from `<group>`/`<field>`/`<name>` (lines 210-213); functions from
  `<fields>`/`<field>` with `<aggregate>` (line 216), `<subject>` (line 217),
  `<type>` → `getType()` (line 218). **PITFALL (line 220):**
  `valueField[i] = Integer.parseInt(XMLHandler.getTagValue(fnode, "valuefield"))`
  — NO null-guard, so a `<field>` missing `<valuefield>` throws
  (NumberFormatException on null, wrapped as `KettleXMLException`, lines
  223-226). The template MUST include a numeric `<valuefield>`.
- `setDefault()` (lines 257-263): 0 groups + 0 functions.
- `getFields(...)` (lines 265-302): KEEPS all existing rows (`fields.addRowMeta(r)`,
  line 272) and APPENDS one cloned value meta per analytic function renamed
  to `aggregateField[i]` (lines 275-297); throws `KettleStepException` if a
  subject field is missing (lines 286-296).
- `getXML()` (lines 304-327): emits `<group>` (lines 307-313) then
  `<fields>` (lines 315-324, each `<field>` has `<aggregate>` line 318,
  `<subject>` line 319, `<type>` = `getTypeDesc()` line 320, `<valuefield>`
  int line 321). **NO `<give_back_row>`.**

Emitted tag order: `[<group>, <fields>]`.
