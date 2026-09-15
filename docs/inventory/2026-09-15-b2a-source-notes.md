# B2a — Source notes (existence checks + DB join, 4 ID)

Ngày: 2026-09-15. Source: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`,
branch `9.4`, commit `1a939ab5cabe4517867879684aeca2a526bcc638` (mọi số dòng
dưới đây ứng với commit đã ghim trong plan; reviewer xác nhận bằng
`git -C ../pentaho-kettle rev-parse HEAD`).

Phạm vi DUY NHẤT batch này (không làm thêm ID nào): trans `TableExists`,
job `TABLE_EXISTS`, trans `ColumnExists`, trans `DBJoin`.
`WAIT_FOR_SQL` KHÔNG thuộc batch này. B1 (12 component) đã commit — không
chạm tới.

Mức bằng chứng đề xuất cho cả 4: `source_reviewed`, `source_version: 9.4`,
`verified_versions: 9.4` → `canonical + generator_eligible: true`.
Chưa có Spoon/runtime verification — không nâng mức, không bịa xác minh.

Test hồi quy: `test/knowledge-b2a-existence.test.js` (viết trước theo plan —
hiện FAIL vì 4 ID chưa có catalog/reference; chuyển GREEN sau khi thêm
reference + dòng catalog). Primary chạy RED, agent implement mới viết
reference/catalog/evidence/inventory.

## Quy ước chung đã xác minh (dùng cho cả 4 reference)

- `XMLHandler.addTagValue(tag, (String) null)` → self-closing `<tag/>`;
  `addTagValue(tag, boolean)` → `Y`/`N`; `addTagValue(tag, int)` → số
  (kế thừa xác minh gói B1 — `core/.../xml/XMLHandler.java` dòng 795–804,
  869–871; batch này không đọc lại file đó).
- Load boolean kiểu `"Y".equalsIgnoreCase(getTagValue(...))` — tag thiếu →
  false (`TableExists`/`ColumnExists`/`DBJoin` đều dùng mẫu này).
- Wrapper trans: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment plugin bằng `name`, `type` (= step ID, dòng 215),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`, `GUI`
  (`xloc`/`yloc`/`draw`, dòng 258–260). `getXML()` của plugin chỉ trả
  fragment — template reference = wrapper + fragment.
- Wrapper job: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài.
- Cả 4 ID đều tham chiếu DB connection BẰNG TÊN (`<connection>` chứa tên
  `DatabaseMeta`, resolve qua `DatabaseMeta.findDatabase`). Đây là
  connection reference (variable/name) — template và ví dụ chỉ dùng
  placeholder `${CONN}`/`${SCHEMA}`/`${TABLE}`, không bao giờ embed
  credential, host hay tên DB thật.
- Registry presence KHÔNG phải XML evidence — evidence là serializer/loader
  từng ID dưới đây.

## 1. trans `TableExists`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 67 —
  `<step id="TableExists">` →
  `org.pentaho.di.trans.steps.tableexists.TableExistsMeta` (category Lookup).
- Serialization: `TableExistsMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/tableexists/TableExistsMeta.java`
  dòng 156–165) — đúng 4 tag theo thứ tự `connection` (= `database.getName()`,
  `""` khi null), `tablenamefield`, `resultfieldname`, `schemaname`.
- Deserialization: `loadXML()` (dòng 129–131) gọi `readData()` (dòng
  167–179) — `connection` resolve qua `DatabaseMeta.findDatabase`; 3 tag còn
  lại đọc nguyên văn, thiếu tag → null.
- Khởi tạo: `setDefault()` (dòng 139–143): `database = null`,
  `schemaname = null`, `resultfieldname = "result"`. `tablenamefield`
  KHÔNG được set → null.
- Semantics: `getFields()` (dòng 145–154) thêm một
  `ValueMetaBoolean(resultfieldname)` vào stream — output = input rows +
  1 cột boolean. `check()` (dòng 212–254) yêu cầu connection, resultfield,
  table field và có input. `getUsedDatabaseConnections()` (dòng 265–271).
- BẪY: KHÔNG có tag `<tablename>` tĩnh — `<tablenamefield>` là TÊN FIELD
  của stream đầu vào chứa tên bảng (dynamic). Đừng viết reference với
  `<tablename>`; test assert template không chứa tag đó.
- Catalog đề xuất: `{type: TABLE_EXISTS, xml_type: TableExists,
  file: trans/TableExists.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

## 2. job `TABLE_EXISTS`

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 15 —
  `<job-entry id="TABLE_EXISTS">` →
  `org.pentaho.di.job.entries.tableexists.JobEntryTableExists`
  (category Conditions).
- Serialization: `JobEntryTableExists.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/tableexists/JobEntryTableExists.java`
  dòng 81–92) — `super.getXML()` rồi đúng thứ tự `tablename`, `schemaname`,
  `connection` (= tên `DatabaseMeta`, null khi chưa chọn).
- Deserialization: `loadXML()` (dòng 94–106) — `super.loadXML()` rồi đọc 3
  tag; `connection` resolve qua `DatabaseMeta.findDatabase`.
- Khởi tạo: constructor (dòng 65–70) đặt cả 3 về null; không có
  `setDefault()` riêng.
- Semantics: `evaluates()` = true (dòng 156–158), `isUnconditional()` =
  false (dòng 160–162) — entry điều kiện. `execute()` (dòng 164–203):
  `db.checkTableExists(realSchemaname, realTablename)` (đã
  `environmentSubstitute`) → `result=true` nếu tồn tại; thiếu connection →
  `NrErrors=1`. Không như step, đây là tên bảng TĨNH (`tablename`).
- Catalog đề xuất: `{type: TABLE_EXISTS, xml_type: TABLE_EXISTS,
  file: job/TABLE_EXISTS.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`. Trùng chuỗi alias với trans
  `TABLE_EXISTS` nhưng khác kind — catalog tách list theo kind nên không
  xung đột (tra cứu `findByXmlType` luôn kèm kind).

## 3. trans `ColumnExists`

- Đăng ký: annotation `@Step(id = "ColumnExists", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/columnexists/ColumnExistsMeta.java`
  dòng 59–61, category Lookup). KHÔNG có trong `kettle-steps.xml`
  (registry engine chỉ chứa step core; plugin core đăng ký bằng annotation)
  — registry presence không phải XML evidence.
- Serialization: `getXML()` (dòng 218–228) — đúng 7 tag theo thứ tự
  `connection`, `tablename`, `schemaname`, `istablenameInfield`,
  `tablenamefield`, `columnnamefield`, `resultfieldname`.
- Deserialization: `loadXML()` (dòng 189–191) gọi `readData()` (dòng
  230–244) — `istablenameInfield` parse bằng `"Y".equalsIgnoreCase(...)`;
  `resultfieldname` optional, có thể null (dòng 239).
- Khởi tạo: `setDefault()` (dòng 199–205): `database/schemaname/tablename =
  null`, `istablenameInfield = false`, `resultfieldname = "result"`;
  `tablenamefield`/`columnnamefield` không set → null.
- Semantics: `getFields()` (dòng 207–216) thêm
  `ValueMetaBoolean(resultfieldname)`. `check()` (dòng 283–342): nếu
  `istablenameInfield` yêu cầu `tablenamefield`, ngược lại yêu cầu
  `tablename` tĩnh; luôn yêu cầu `columnnamefield` + `resultfieldname` +
  connection.
- BẪY (đã đưa vào test): cột cần kiểm tra là stream field động
  `<columnnamefield>` — KHÔNG có tag `<columnname>` tĩnh; kết quả boolean
  nằm ở `<resultfieldname>` — KHÔNG có tag `<valuename>`. Template không
  được bịa 2 tag này.
- Catalog đề xuất: `{type: COLUMN_EXISTS, xml_type: ColumnExists,
  file: trans/ColumnExists.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

## 4. trans `DBJoin`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 24 —
  `<step id="DBJoin">` →
  `org.pentaho.di.trans.steps.databasejoin.DatabaseJoinMeta`
  (category Lookup).
- Serialization: `DatabaseJoinMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/databasejoin/DatabaseJoinMeta.java`
  dòng 338–359) — thứ tự `connection`, `rowlimit` (int), `sql`,
  `outer_join` (Y/N), `replace_vars` (Y/N), rồi wrapper `<parameter>`
  LUÔN emit (kể cả 0 field, dòng 348/356) chứa các `<field>` với `<name>`
  (tên field input-stream điền vào marker `?`) và `<type>` (tên value-meta
  chuỗi qua `ValueMetaFactory.getValueMetaName`, dòng 352–353).
- Deserialization: `loadXML()` (dòng 196–202) reset
  `parameterField/parameterType = null`, 2 flag = false rồi gọi `readData()`
  (dòng 223–247) — `outer_join`/`replace_vars` Y-check; `rowlimit` qua
  `Const.toInt(..., 0)`; list đọc từ sub-node `<parameter>`, mỗi `<field>`
  đọc `name` + `type` (map về id qua `ValueMetaFactory.getIdForValueMeta`,
  dòng 239–241).
- Khởi tạo: `setDefault()` (dòng 250–268): `databaseMeta = null`,
  `rowLimit = 0` (= ALL), `sql = ""`, cả 2 flag false, `allocate(0)`.
- Semantics: `getFields()` (dòng 285–335) append các field kết quả của query
  vào row — cần DB thật nên KHÔNG test runtime; chỉ ghi nhận semantics.
  `check()` (dòng 411–462) còn đối chiếu số marker `?`
  (`db.countParameters`) với `parameterField.length` — số lượng
  `<field>` phải khớp số `?` trong SQL (ghi vào reference, không test).
- BẪY (đã đưa vào test): list parameter là `<parameter>/<field>`, KHÔNG
  phải `<lookup>` (tên dễ nhầm với `StreamLookup`/`DBLookup`); `<type>`
  trong item là tên value-meta chuỗi (`Integer`, `String`, ...), không phải
  số. Template phải giữ `<parameter>` dạng paired (source luôn emit paired)
  để `setFields(listTag=parameter, itemTag=field)` hoạt động — self-closing
  `<parameter/>` sẽ làm `setFields` ném lỗi.
- Catalog đề xuất: `{type: DB_JOIN, xml_type: DBJoin,
  file: trans/DBJoin.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

## Ghi cho lượt implement (không làm trong phase này)

- Chỉ viết 4 reference + 4 dòng catalog + evidence/inventory cho 4 ID trên;
  không sửa B1, handoff hay runner. Placeholder connection dùng `${VAR}`.
- Test assert `parsed.step.type === 'DBJoin'` ở direct-child — reference
  DBJoin có nested `<parameter>/<field>/<type>` nên implement/test phải đọc
  direct-child `<type>`, không nhầm nested (test đã làm đúng).
