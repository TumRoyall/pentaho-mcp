# B2d source notes — DB proc / sync + job SQL (4 IDs, đều có DB connection)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Phạm vi DUY NHẤT batch này (không làm ID khác):** trans `DBProc`,
trans `SynchronizeAfterMerge`, job `WAIT_FOR_SQL`, job `COLUMNS_EXIST`.
Hoàn tất B2 (13/13 ID: B2a 4 + B2b 3 + B2c 2 + B2d 4).

**Wrapper (cả 4):**
- trans: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment plugin bằng `name`, `type` (= step ID, dòng 215),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`, `GUI`
  (`xloc`/`yloc`/`draw`, dòng 258–260). `getXML()` của plugin chỉ trả
  fragment — template reference = wrapper + fragment.
- job: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài.

**DB-connection note (cả 4):** cả 4 ID đều tham chiếu DB connection BẰNG TÊN
(`<connection>` chứa tên `DatabaseMeta`, resolve qua
`DatabaseMeta.findDatabase`) và expose qua `getUsedDatabaseConnections()`.
BẪY FIXTURE B2 ÁP DỤNG CHO CẢ `.ktr` LẪN `.kjb`: test fixture PHẢI khai báo
`<connection><name>${CONN}</name></connection>` trong file minimal, nếu không
validator báo "undefined connection" và assertion 0-error FAIL (B2a đã dính).
Connection/credential/host/table/schema placeholders dùng `${VAR}`; không bao
giờ embed giá trị thật.

**Mức bằng chứng đề xuất (cả 4):** `source_reviewed`,
`source_version: 9.4`, `verified_versions: 9.4` →
`canonical + generator_eligible: true`. Chưa có Spoon/runtime verification —
không nâng mức, không bịa xác minh.

**Test hồi quy:** `test/knowledge-b2d-db.test.js` (viết trước theo plan —
hiện FAIL vì 4 ID chưa có catalog/reference; chuyển GREEN sau khi thêm
reference + dòng catalog).

## 1. trans `DBProc` — `DBProcMeta` (Lookup)

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/dbproc/DBProcMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 51:
  `<step id="DBProc">` →
  `org.pentaho.di.trans.steps.dbproc.DBProcMeta` (category Lookup).
- `allocate(int nrargs)` (dòng 217–221): sizes `argument[]`,
  `argumentDirection[]`, `argumentType[]` (int).
- `setDefault()` (dòng 236–255): `database = null`, 0 args
  (`allocate(0)` — vòng for không chạy nên `"arg"+i`/`"IN"` chỉ là dead code
  khi nrargs=0), `resultName = "result"`, `resultType = TYPE_NUMBER`,
  `autoCommit = true`.
- `getXML()` (dòng 288–316): emits `connection` (tên DB, `""` khi null, dòng
  292), `procedure` (dòng 293), rồi wrapper `<lookup>` LUÔN emit kể cả 0 arg
  (dòng 294/305) chứa các `<arg>` với `<name>` (tên field argu­ment, dòng
  298), `<direction>` (dòng 299), `<type>` là TÊN value-meta chuỗi qua
  `ValueMetaFactory.getValueMetaName` (dòng 300–301); rồi block `<result>`
  LUÔN emit (dòng 307/311) với `<name>` (dòng 308) + `<type>` tên value-meta
  chuỗi (dòng 309–310); rồi `auto_commit` (Y/N, dòng 313).
- `readData(Node, ...)` (dòng 318–347), via `loadXML` (dòng 213–215):
  `connection` resolve qua `DatabaseMeta.findDatabase` (dòng 323–324);
  `procedure` đọc nguyên văn (dòng 325); arg count từ sub-node `<lookup>`
  (dòng 327–328); mỗi `<arg>` đọc `name` + `direction` + `type` (map về id qua
  `ValueMetaFactory.getIdForValueMeta`, dòng 335–337); `resultName` optional
  có thể null (dòng 340); `resultType` qua `getIdForValueMeta` (dòng 342);
  `autoCommit = !"N".equalsIgnoreCase(getTagValue(stepnode, "auto_commit"))`
  (dòng 343) — INVERTED default: thiếu tag load thành **true** (khớp
  `setDefault` true; template vẫn PIN tag này显式 để `setFieldPath` và review
  không nhầm với cờ thường).
- **PITFALL 1 (dòng 273):** `if (argumentDirection[i].equalsIgnoreCase("OUT"))`
  trong `getFields()` — KHÔNG null-guard, nên `<arg>` thiếu `<direction>`
  NÉM NPE khi tính output fields. Template PHẢI có `<direction>` trên MỌI
  `<arg>`.
- **PITFALL 2:** `<direction>` chỉ nhận `IN` / `OUT` / `OUT`+`INOUT` (khai báo
  dòng 74–75: `IN / OUT / INOUT`). Giá trị lạ không được map tường minh —
  chỉ `OUT` (case-insensitive) mới thêm output field, còn lại coi như input.
- **PITFALL 3:** `<arg>/<type>` và `<result>/<type>` là TÊN value-meta chuỗi
  (`String`, `Integer`, `Number`, ...) — ghi số id kiểu sẽ bị
  `getIdForValueMeta` map sai (cùng bẫy DBJoin B2a).
- Semantics: `getFields()` (dòng 258–286) thêm một field `resultName` (nếu
  non-empty) + một field cho MỖI arg có direction `OUT` — output = input row
  + result + OUT args. `check()` (dòng 399–477) khi nối DB: mọi arg phải tồn
  tại trong stream trước (dòng 416–439, kèm check trùng kiểu số) và step phải
  có input (dòng 465–475); thiếu connection → ERROR (dòng 458–462).
  `getUsedDatabaseConnections()` (dòng 488–494) trả connection đã chọn —
  DB lineage applies. `supportsErrorHandling()` = true (dòng 496–498).
- Catalog đề xuất: `{type: DB_PROC, xml_type: DBProc,
  file: trans/DBProc.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}` (alias SNAKE_UPPER theo quy ước B2a/B2c:
  `DB_JOIN`, `DIMENSION_LOOKUP`).

Emitted tag order: `[<connection>, <procedure>, <lookup>(<arg>(<name>,
<direction>, <type>)*), <result>(<name>, <type>), <auto_commit>]`.

## 2. trans `SynchronizeAfterMerge` — `SynchronizeAfterMergeMeta` (Output)

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/synchronizeaftermerge/SynchronizeAfterMergeMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 82:
  `<step id="SynchronizeAfterMerge">` →
  `org.pentaho.di.trans.steps.synchronizeaftermerge.SynchronizeAfterMergeMeta`
  (category Output).
- `allocate(int nrkeys, int nrvalues)` (dòng 394–402): sizes `keyStream[]`,
  `keyLookup[]`, `keyCondition[]`, `keyStream2[]`, `updateLookup[]`,
  `updateStream[]`, `update[]` (Boolean).
- `setDefault()` (dòng 485–517): `tablenameInField=false`,
  `tablenameField=null`, `databaseMeta=null`, `commitSize="100"` (CHUỖI, dòng
  491), `schemaName=""`, `tableName` = i18n default,
  `operationOrderField=null`, `OrderInsert/Update/Delete=null`,
  `performLookup=false`; 0 keys + 0 values (`allocate(0, 0)`).
  `useBatchUpdate` KHÔNG được set → false (boolean default).
- `getXML()` (dòng 519–562): emits `connection` (dòng 523–525), `commit`
  (chuỗi, dòng 526), `tablename_in_field` (Y/N, dòng 528), `tablename_field`
  (dòng 529), `use_batch` (Y/N, dòng 530), `perform_lookup` (Y/N, dòng 531),
  `operation_order_field` (dòng 533), `order_insert`/`order_update`/
  `order_delete` (dòng 534–536), rồi wrapper `<lookup>` LUÔN emit (dòng
  538/559) chứa `schema` + `table` (dòng 539–540), các `<key>` với `name`
  (stream field 1) + `field` (cột bảng) + `condition` + `name2` (stream field
  2 cho BETWEEN, dòng 543–549), các `<value>` với `name` (cột bảng) +
  `rename` (stream field) + `update` (Y/N, dòng 551–557).
- `readData(Node, ...)` (dòng 421–483), via `loadXML` (dòng 390–392):
  `commit` đọc nguyên văn chuỗi (dòng 427); `schema`/`table` đọc từ sub-node
  `<lookup>` (dòng 428–429); `use_batch`/`perform_lookup`/`tablename_in_field`
  parse bằng `"Y".equalsIgnoreCase` (thiếu → false, dòng 431–434);
  `tablename_field`, `operation_order_field`, `order_insert/update/delete`
  đọc nguyên văn (dòng 435–439); key count/value count từ sub-node `<lookup>`
  (dòng 442–443).
- **PITFALL 1 (dòng 453–455):** `keyCondition` null → default `"="` (an toàn,
  không NPE — khác DBProc). Template vẫn pin `<condition>=</condition>`显式.
- **PITFALL 2 (dòng 464–466):** `updateStream` (rename) null → default BẰNG
  `updateLookup` (cùng tên). Template pin cả hai để không phụ thuộc default.
- **PITFALL 3 (dòng 467–477):** `<value>/<update>` null → default TRUE; `Y`
  → TRUE, còn lại FALSE. Template LUÔN pin `<update>Y/N</update>`显式
  (getXML dòng 555 gọi `update[i].booleanValue()` — NPE nếu phần tử null,
  `normalizeAllocation` dòng 1109–1123 lấp null→TRUE khi inject lệch độ dài).
- **PITFALL 4:** tag chính xác `use_batch` (snake_case, dòng 530) và
  `tablename_in_field`/`tablename_field` (dòng 528–529) — viết `useBatch`
  (như DimensionLookup) sẽ bị loader bỏ qua lặng lẽ (luôn false).
- **PITFALL 5:** `<commit>` là CHUỖI (`commitSize` String, dòng 112 + 236–246),
  không phải int — template giữ `"100"` dạng text (parse số vẫn đọc được vì
  cùng serialization, nhưng tài liệu phải ghi đúng kiểu String).
- Semantics runtime (`SynchronizeAfterMerge.java`, Meta-level + statement
  review mức vừa đủ, giữ `source_reviewed`): step đồng bộ bảng đích theo
  trường operation trên MỖI dòng input — giá trị trường
  `operation_order_field` (dòng 695–699: thiếu field → error) được so với 3
  marker đã substitute (`insertValue`/`updateValue`/`deleteValue` từ
  `order_insert/update/delete`, dòng 706–708): bằng insert → INSERT (dòng
  104, 481, 935), bằng update → UPDATE (dòng 237–238, kèm nhánh
  `performLookup`), bằng delete → DELETE (dòng 289). `perform_lookup`
  (dòng 169, 238, 773) bật/tắt bước lookup trước ghi. Key mapping
  (`keyStream` stream ↔ `keyLookup` cột bảng + `condition`/`keyStream2`) xác
  định dòng đích; update mapping (`updateLookup` cột bảng ↔ `updateStream`
  stream + cờ `update`) xác định cột được ghi (dòng 747–749). `check()` (dòng
  648–904) đòi connection, bảng tồn tại, key/update fields khớp bảng + stream.
  `getSQLStatements()` (dòng 906–996) sinh DDL bảng từ key+update mapping +
  index lookup. `getUsedDatabaseConnections()` (dòng 1037–1043) — DB lineage
  applies. `supportsErrorHandling()` = true (dòng 1094–1096).
- Catalog đề xuất: `{type: SYNCHRONIZE_AFTER_MERGE,
  xml_type: SynchronizeAfterMerge, file: trans/SynchronizeAfterMerge.md,
  status: canonical, generator_eligible: true, source_version: "9.4",
  verified_versions: "9.4", verification: source_reviewed}`.

Emitted tag order: `[<connection>, <commit>, <tablename_in_field>,
<tablename_field>, <use_batch>, <perform_lookup>, <operation_order_field>,
<order_insert>, <order_update>, <order_delete>,
<lookup>(<schema>, <table>, <key>(<name>, <field>, <condition>, <name2>)*,
<value>(<name>, <rename>, <update>)*)]`.

## 3. job `WAIT_FOR_SQL` — `JobEntryWaitForSQL` (Utility)

- Class: `engine/src/main/java/org/pentaho/di/job/entries/waitforsql/JobEntryWaitForSQL.java`
- Registry: `engine/src/main/resources/kettle-job-entries.xml`, dòng 50:
  `<job-entry id="WAIT_FOR_SQL">` →
  `org.pentaho.di.job.entries.waitforsql.JobEntryWaitForSQL` (category
  Utility).
- Success codes: `successConditionsCode` (dòng 97–99):
  `rows_count_equal`, `rows_count_different`, `rows_count_smaller`,
  `rows_count_smaller_equal`, `rows_count_greater`, `rows_count_greater_equal`
  (6 mã, hằng int dòng 101–106: EQUAL=0 … GREATER_EQUAL=5).
- Constructor (dòng 113–128): `isClearResultList=true`, `rowsCountValue="0"`,
  `successCondition=GREATER(4)`, `iscustomSQL=false`, `isUseVars=false`,
  `isAddRowsResult=false`, `customSQL=null`, `schemaname/tablenam/connection=
  null`, `maximumTimeout="0"` (= chờ VÔ HẠN), `checkCycleTime="60"`,
  `successOnTimeout=false`.
- `getXML()` (dòng 160–180): `super.getXML()` rồi đúng thứ tự `connection`
  (dòng 164–165), `schemaname` (166), `tablename` (167), `success_condition`
  (MÃ code qua `getSuccessConditionCode`, dòng 168–169), `rows_count_value`
  (170), `is_custom_sql` (171), `is_usevars` (172), `custom_sql` (173),
  `add_rows_result` (174), `maximum_timeout` (175), `check_cycle_time` (176),
  `success_on_timeout` (177), `clear_result_rows` (178).
- `loadXML()` (dòng 239–262): `connection` resolve qua
  `DatabaseMeta.findDatabase` (dòng 243–244); `successCondition` qua
  `getSucessConditionByCode(NVL(tag, ""))` (dòng 247–248).
- **PITFALL 1:** `success_condition` thiếu/không khớp mã → load thành 0 =
  EQUAL, TRONG KHI constructor default là GREATER(4). Template PHẢI pin
  `<success_condition>rows_count_greater</success_condition>`显式 (khớp
  default ctor) để file round-trip không đổi nghĩa.
- **PITFALL 2:** `clear_result_rows` parse bằng `"Y".equalsIgnoreCase`
  (dòng 257, thiếu → false) TRONG KHI constructor default true (dòng 115).
  Template PHẢI pin `<clear_result_rows>Y</clear_result_rows>`显式.
- **PITFALL 3:** `maximum_timeout`/`check_cycle_time` là CHUỖI số giây
  (dòng 82–83), đọc qua `Const.toInt(environmentSubstitute(...))` khi chạy
  (dòng 415–418): `maximum_timeout=0` = chờ vô hạn (dòng 434–438);
  `check_cycle_time<1` reset về default 60 (dòng 429–432). Template giữ
  `"0"`/`"60"` dạng text.
- Semantics runtime (`execute()`, dòng 363–500): `evaluates()`=true (dòng
  337–339), `isUnconditional()`=false (dòng 342–344) — entry điều kiện. Hai
  chế độ (dòng 376–400): custom SQL (`iscustomSQL=Y`, đếm SỐ DÒNG trả về,
  dòng 530–538; `is_usevars=Y` thì substitute biến trong SQL, dòng 383–385;
  SQL rỗng → error, dòng 390–393) vs table mode (`SELECT count(*) FROM
  [schema.]table`, dòng 515–522; thiếu tablename → error, dòng 396–399).
  Poll loop (dòng 441–488): so rowsCount với ngưỡng theo `successCondition`
  (dòng 550–571); hết timeout thì `success_on_timeout` quyết định result
  (dòng 453–460); success → `NrErrors=0` (dòng 493–497, PDI-15437). Thiếu
  connection → error giữ nguyên (dòng 371–374). `isAddRowsResult=Y` (+ custom
  SQL) append các dòng query vào result rows (dòng 577–595).
  `getUsedDatabaseConnections()` (dòng 601–603) — DB lineage applies.
- Catalog đề xuất: `{type: WAIT_FOR_SQL, xml_type: WAIT_FOR_SQL,
  file: job/WAIT_FOR_SQL.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}` (trùng chuỗi alias giữa type/xml_type là
  hợp lệ — cùng pattern job `TABLE_EXISTS` B2a; catalog tách list theo kind).

Emitted tag order: `[<connection>, <schemaname>, <tablename>,
<success_condition>, <rows_count_value>, <is_custom_sql>, <is_usevars>,
<custom_sql>, <add_rows_result>, <maximum_timeout>, <check_cycle_time>,
<success_on_timeout>, <clear_result_rows>]` (sau `super.getXML()`).

## 4. job `COLUMNS_EXIST` — `JobEntryColumnsExist` (Conditions)

- Class: `engine/src/main/java/org/pentaho/di/job/entries/columnsexist/JobEntryColumnsExist.java`
- Registry: `engine/src/main/resources/kettle-job-entries.xml`, dòng 45:
  `<job-entry id="COLUMNS_EXIST">` →
  `org.pentaho.di.job.entries.columnsexist.JobEntryColumnsExist` (category
  Conditions).
- Constructor (dòng 69–74): `schemaname/tablename/connection = null`;
  `arguments` KHÔNG allocate (null — khác `allocate(0)` của step; test phải
  giữ `<fields>` paired để `setFields` hoạt động).
- `allocate(int nrFields)` (dòng 80–82): sizes `arguments[]` (tên cột tĩnh).
- `getXML()` (dòng 94–115): `super.getXML()` rồi đúng thứ tự `tablename`
  (dòng 99), `schemaname` (dòng 100), `connection` (dòng 101–102), rồi wrapper
  `<fields>` LUÔN emit kể cả 0 field (dòng 104/112) chứa các `<field>` với
  `<name>` (tên cột, dòng 107–109).
- `loadXML()` (dòng 117–142): `tablename`/`schemaname` nguyên văn (dòng
  121–122); `connection` resolve qua `DatabaseMeta.findDatabase` (dòng
  124–125); arg count từ sub-node `<fields>` (dòng 127–131); mỗi `<field>`
  đọc `name` (dòng 134–137).
- **PITFALL 1:** danh sách cột là `<fields>/<field>/<name>` (tên cột TĨNH
  trên bảng) — KHÔNG phải stream field động (khác trans `ColumnExists`
  B2a dùng `<columnnamefield>` động). Nhầm hai chiều là lỗi phổ biến nhất
  batch này: job = tĩnh, trans = động.
- **PITFALL 2:** `<fields>` luôn paired (source luôn emit paired kể cả 0
  field) — self-closing `<fields/>` làm `setFields(listTag=fields,
  itemTag=field)` ném lỗi (cùng bẫy `<parameter>` của DBJoin B2a).
- Semantics runtime (`execute()`, dòng 226–296): `evaluates()`=true (dòng
  218–220), `isUnconditional()`=false (dòng 222–224) — entry điều kiện.
  Thiếu `tablename` → error (dòng 234–237); `arguments` null → error (dòng
  238–241); thiếu connection → error (dòng 284–286). Kiểm tra bảng tồn tại
  rồi TỪNG cột (`db.checkColumnExists`, dòng 256–270); **result true CHỈ khi
  TẤT CẢ cột tồn tại** (`nrexistcolums == arguments.length`, dòng 291–294,
  PDI-15801) — một cột thiếu là cả entry false (không phải error count).
  `check()` (dòng 318–322) chỉ đòi `tablename` non-blank.
  `getUsedDatabaseConnections()` (dòng 302–304) — DB lineage applies.
- Catalog đề xuất: `{type: COLUMNS_EXIST, xml_type: COLUMNS_EXIST,
  file: job/COLUMNS_EXIST.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

Emitted tag order: `[<tablename>, <schemaname>, <connection>,
<fields>(<field>(<name>)*)]` (sau `super.getXML()`).

## Ghi cho lượt implement (không làm trong phase này)

- Chỉ viết 4 reference + 4 dòng catalog + test cho 4 ID trên; không sửa B1,
  B2a/B2b/B2c, handoff hay runner. Placeholder connection dùng `${VAR}`.
- Test assert direct-child `<type>` (DBProc có nested `<lookup>/<arg>/<type>`
  là tên value-meta — giống bẫy nested `<type>` của DBJoin B2a; test đã làm
  đúng bằng cách đọc `parsed.step.type`).
- Fixture minimal `.ktr`/`.kjb` PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- Không thêm 4 ID vào `EVIDENCE_BACKED_TYPES` của `test/knowledge.test.js`
  (nhất quán B2a/B2b/B2c — batch test riêng đã kiểm eligibility).
