# WAIT_FOR_SQL — Job entry chờ dữ liệu SQL sẵn sàng

Chặn job cho tới khi một điều kiện số-dòng thỏa mãn (hoặc hết timeout):
poll định kỳ một câu đếm (`SELECT count(*) FROM [schema.]table` ở chế độ
bảng, hoặc custom SQL ở chế độ `is_custom_sql=Y` — khi đó đếm SỐ DÒNG query
trả về) rồi so với ngưỡng `<rows_count_value>` theo `<success_condition>`
(6 mã `rows_count_*`). Hết `<maximum_timeout>` mà chưa thỏa thì
`<success_on_timeout>` quyết định entry success hay fail. Entry điều kiện
(`evaluates() = true`, không unconditional): success đi nhánh tiếp, fail rẽ
nhánh lỗi.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>WAIT_FOR_SQL</type>
      <attributes/>
      <connection>${CONN}</connection>
      <schemaname>${SCHEMA}</schemaname>
      <tablename>${TABLE}</tablename>
      <success_condition>rows_count_greater</success_condition>
      <rows_count_value>0</rows_count_value>
      <is_custom_sql>N</is_custom_sql>
      <is_usevars>N</is_usevars>
      <custom_sql/>
      <add_rows_result>N</add_rows_result>
      <maximum_timeout>0</maximum_timeout>
      <check_cycle_time>60</check_cycle_time>
      <success_on_timeout>N</success_on_timeout>
      <clear_result_rows>Y</clear_result_rows>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). Thiếu → error khi chạy. |
| `<schemaname>` | N | Schema chứa bảng (chế độ bảng); hỗ trợ biến. |
| `<tablename>` | Y (chế độ bảng) | Bảng cần đếm (`SELECT count(*) FROM`); hỗ trợ biến. Chế độ custom SQL thì không dùng. |
| `<success_condition>` | Y — LUÔN phải có | Một trong 6 mã: `rows_count_equal`, `rows_count_different`, `rows_count_smaller`, `rows_count_smaller_equal`, `rows_count_greater` (mặc định ctor), `rows_count_greater_equal`. Thiếu/không khớp mã → load thành EQUAL (khác default ctor!) — template pin显式. |
| `<rows_count_value>` | N | Ngưỡng so sánh (chuỗi số; mặc định `"0"`). |
| `<is_custom_sql>` | N | `Y` = dùng `<custom_sql>` thay vì đếm bảng; mặc định `N`. |
| `<is_usevars>` | N | `Y` = substitute biến trong custom SQL trước khi chạy; mặc định `N`. |
| `<custom_sql>` | Y (khi is_custom_sql=Y) | SQL tự do; success đếm SỐ DÒNG trả về (không phải giá trị count). Rỗng → error. |
| `<add_rows_result>` | N | `Y` (+ custom SQL) = append các dòng query vào result rows khi success; mặc định `N`. |
| `<maximum_timeout>` | N | Thời gian chờ tối đa, giây, dạng chuỗi (mặc định `"0"` = chờ VÔ HẠN). Âm → reset về default. |
| `<check_cycle_time>` | N | Chu kỳ poll lại, giây, dạng chuỗi (mặc định `"60"`). `<1` → reset về 60. |
| `<success_on_timeout>` | N | `Y` = hết timeout vẫn success; `N` (mặc định) = hết timeout là fail. |
| `<clear_result_rows>` | N | `Y` (mặc định ctor) = xóa result rows trước khi chạy custom SQL; thiếu tag → load FALSE (khác default!) — template pin显式. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WAIT_FOR_SQL` | `<type>` | `WAIT_FOR_SQL`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` / `table` | `<schemaname>` / `<tablename>` | Chế độ bảng; cho phép `${VAR}`. |
| `configuration.success_condition` | `<success_condition>` | 1 trong 6 mã code (không phải nhãn UI). |
| `configuration.rows_count_value` | `<rows_count_value>` | Chuỗi số. |
| `configuration.is_custom_sql` | `<is_custom_sql>` | Y/N. |
| `configuration.is_usevars` | `<is_usevars>` | Y/N. |
| `configuration.custom_sql` | `<custom_sql>` | Giữ nguyên văn, XML-escape. |
| `configuration.maximum_timeout` | `<maximum_timeout>` | Chuỗi số giây; `"0"`=vô hạn. |
| `configuration.check_cycle_time` | `<check_cycle_time>` | Chuỗi số giây. |
| `configuration.success_on_timeout` | `<success_on_timeout>` | Y/N. |

Toàn tag đơn → sửa bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 50 —
  `<job-entry id="WAIT_FOR_SQL">` →
  `org.pentaho.di.job.entries.waitforsql.JobEntryWaitForSQL` (category
  Utility). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryWaitForSQL.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/waitforsql/JobEntryWaitForSQL.java`
  dòng 160–180) — `super.getXML()` rồi đúng thứ tự `connection`,
  `schemaname`, `tablename`, `success_condition` (MÃ code qua
  `getSuccessConditionCode`, dòng 168–169), `rows_count_value`,
  `is_custom_sql`, `is_usevars`, `custom_sql`, `add_rows_result`,
  `maximum_timeout`, `check_cycle_time`, `success_on_timeout`,
  `clear_result_rows`.
- Deserialization: `loadXML()` (dòng 239–262) — `super.loadXML()` rồi
  `connection` resolve qua `DatabaseMeta.findDatabase`;
  `successCondition` qua `getSucessConditionByCode(NVL(tag, ""))`
  (thiếu/không khớp → 0 = EQUAL, dòng 247–248); `rowsCountValue` NVL → `"0"`
  (dòng 249); các cờ boolean parse bằng `"Y".equalsIgnoreCase` (thiếu →
  false, dòng 250–257).
- Khởi tạo: constructor (dòng 113–128) đặt `isClearResultList=true`,
  `rowsCountValue="0"`, `successCondition=GREATER(4)`, `iscustomSQL=false`,
  `isUseVars=false`, `isAddRowsResult=false`, `maximumTimeout="0"` (chờ vô
  hạn), `checkCycleTime="60"`, `successOnTimeout=false`; connection/schema/
  table null.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime (`execute()`, dòng 363–500): `evaluates()` = true (dòng
  337–339), `isUnconditional()` = false (dòng 342–344) — entry điều kiện, rẽ
  nhánh theo `result`. Hai chế độ (dòng 376–400): custom SQL (`is_custom_sql`
  =Y — đếm SỐ DÒNG trả về, dòng 530–538; `is_usevars=Y` thì substitute biến,
  dòng 383–385; SQL rỗng → error, dòng 390–393) vs table mode
  (`SELECT count(*) FROM [schema.]table`, dòng 515–522; thiếu tablename →
  error, dòng 396–399). Poll loop (dòng 441–488) so rowsCount với ngưỡng
  theo `successCondition` (dòng 550–571); hết timeout thì
  `success_on_timeout` quyết định result (dòng 453–460); success →
  `NrErrors=0` (dòng 493–497, PDI-15437). Thiếu connection → error (dòng
  371–374). `isAddRowsResult=Y` (+ custom SQL) append dòng query vào result
  rows khi success (dòng 577–595). `getUsedDatabaseConnections()` (dòng
  601–603) — DB lineage applies.

Cấu hình không mặc định (chờ bảng staging đạt đúng 1000 dòng, poll 30s,
tối đa 10 phút):

```xml
<tablename>${TABLE}</tablename>
<schemaname>${SCHEMA}</schemaname>
<connection>${CONN}</connection>
<success_condition>rows_count_equal</success_condition>
<rows_count_value>1000</rows_count_value>
<maximum_timeout>600</maximum_timeout>
<check_cycle_time>30</check_cycle_time>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`success_condition` là MÃ code, không phải nhãn UI**: ghi nhãn hiển thị
  (ví dụ tiếng Anh trong dialog) sẽ không khớp mã nào → load thành EQUAL
  lặng lẽ. Chỉ dùng 1 trong 6 mã `rows_count_*`.
- **Thiếu `<success_condition>` load thành EQUAL, không phải GREATER**:
  constructor default GREATER(4) nhưng loader fallback 0 — template LUÔN
  pin tag này显式.
- **Thiếu `<clear_result_rows>` load thành false, không phải true**:
  constructor default true nhưng loader Y-check — template LUÔN pin `Y`
  显式.
- **`maximum_timeout=0` = chờ VÔ HẠN**: đặt giá trị dương để tránh treo job
  (trừ khi chủ ý chờ vô hạn kèm cơ chế dừng job bên ngoài).
- **Custom SQL đếm SỐ DÒNG, không phải giá trị count**: `SELECT count(*)`
  trong custom SQL luôn trả đúng 1 dòng → với `rows_count_greater/0` sẽ
  success ngay; muốn chờ theo giá trị thì viết SQL trả về N dòng tương ứng
  (hoặc dùng chế độ bảng).
- **Chế độ bảng bỏ qua custom SQL và ngược lại**: `tablename` rỗng ở chế độ
  bảng là error; `custom_sql` rỗng ở chế độ custom là error — điền đúng phía
  theo `is_custom_sql`.
- Template mặc định là khung cấu hình — người dùng phải điền bảng/SQL và
  connection có thật, chọn mã condition + ngưỡng đúng ý đồ chờ; credential
  không bao giờ nằm trong XML.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
