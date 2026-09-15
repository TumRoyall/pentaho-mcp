# SynchronizeAfterMerge — Step đồng bộ bảng đích theo kết quả merge

Đồng bộ một bảng đích với stream đã qua merge: với MỖI dòng đầu vào, đọc
trường operation (`<operation_order_field>`) rồi so với 3 marker
(`<order_insert>` / `<order_update>` / `<order_delete>`) để quyết định ghi
dòng đó bằng INSERT, UPDATE hay DELETE. Ánh xạ khóa (`<lookup>/<key>`:
stream field ↔ cột bảng + điều kiện so sánh) xác định DÒNG đích; ánh xạ
cập nhật (`<lookup>/<value>`: cột bảng ↔ stream field + cờ update) xác định
CỘT được ghi. Step thường đứng sau MergeRows/MergeJoin trong luồng SCD/lưu
kho. `perform_lookup=Y` bật bước lookup trước khi ghi.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SynchronizeAfterMerge</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <commit>100</commit>
    <tablename_in_field>N</tablename_in_field>
    <tablename_field/>
    <use_batch>N</use_batch>
    <perform_lookup>N</perform_lookup>
    <operation_order_field/>
    <order_insert/>
    <order_update/>
    <order_delete/>
    <lookup>
      <schema>${SCHEMA}</schema>
      <table>${TABLE}</table>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <field>{{KEY_TABLE_FIELD}}</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>{{UPDATE_TABLE_FIELD}}</name>
        <rename>{{UPDATE_STREAM_FIELD}}</rename>
        <update>Y</update>
      </value>
    </lookup>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `check()` ERROR khi null; `getUsedDatabaseConnections()` trả connection này. |
| `<commit>` | N | Số dòng giữa các commit (CHUỖI số; mặc định step mới: `"100"`). |
| `<tablename_in_field>` | N | `Y` = tên bảng lấy từ field động `<tablename_field>`; `N` (mặc định) = dùng `<lookup>/<table>` tĩnh. |
| `<tablename_field>` | N (chỉ khi tablename_in_field=Y) | Tên field chứa tên bảng động. |
| `<use_batch>` | N | `Y` = batch update; mặc định `N`. Chú ý snake_case — KHÔNG phải `useBatch` (như DimensionLookup). |
| `<perform_lookup>` | N | `Y` = lookup trước khi ghi; mặc định `N`. |
| `<operation_order_field>` | Y (runtime) | Tên field trên stream chứa mã operation của dòng; thiếu field → error khi chạy. |
| `<order_insert>` / `<order_update>` / `<order_delete>` | Y (runtime) | 3 marker so với giá trị trường operation (đã substitute biến) để chọn INSERT / UPDATE / DELETE. |
| `<lookup>/<schema>` + `<lookup>/<table>` | Y (khi tablename_in_field=N) | Schema + tên bảng đích (tên tag là `schema`/`table` BÊN TRONG `<lookup>`). |
| `<lookup>/<key>/<name>` | Y (mỗi key) | Stream field 1 của khóa. |
| `<lookup>/<key>/<field>` | Y (mỗi key) | Cột bảng tương ứng (tên tag là `field`, KHÔNG phải `lookup`). |
| `<lookup>/<key>/<condition>` | N | Điều kiện so sánh (`=`, `<>`, `BETWEEN`, ...); thiếu tag → load thành `"="` (default an toàn — template vẫn pin显式). |
| `<lookup>/<key>/<name2>` | N (chỉ khi condition=BETWEEN) | Stream field 2 (biên thứ hai). |
| `<lookup>/<value>/<name>` | Y (mỗi value) | Cột bảng được ghi. |
| `<lookup>/<value>/<rename>` | N | Stream field nguồn; thiếu tag → load BẰNG `name` (cùng tên) — template pin cả hai. |
| `<lookup>/<value>/<update>` | N | `Y` = ghi cột này; thiếu tag → load TRUE — template LUÔN pin `Y`/`N`显式. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SYNCHRONIZE_AFTER_MERGE` | `<type>` | `SynchronizeAfterMerge`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.commit` | `<commit>` | Chuỗi số; `"100"` mặc định. |
| `configuration.use_batch` | `<use_batch>` | Boolean → Y/N (snake_case). |
| `configuration.perform_lookup` | `<perform_lookup>` | Boolean → Y/N. |
| `configuration.operation_field` | `<operation_order_field>` | Field mã operation trên stream. |
| `configuration.order_insert/update/delete` | `<order_insert>` / ... | 3 marker (cho phép `${VAR}`). |
| `configuration.schema` / `table` | `<lookup>/<schema>` / `<lookup>/<table>` | Nằm TRONG `<lookup>`. |
| `configuration.keys[].stream` | `<lookup>/<key>/<name>` | Stream field 1. |
| `configuration.keys[].table` | `<lookup>/<key>/<field>` | Cột bảng. |
| `configuration.keys[].condition` | `<lookup>/<key>/<condition>` | `=` / `<>` / `BETWEEN` / ... |
| `configuration.keys[].stream2` | `<lookup>/<key>/<name2>` | Chỉ khi BETWEEN. |
| `configuration.values[].table` | `<lookup>/<value>/<name>` | Cột bảng. |
| `configuration.values[].stream` | `<lookup>/<value>/<rename>` | Stream field. |
| `configuration.values[].update` | `<lookup>/<value>/<update>` | Boolean → Y/N. |

`<lookup>` chứa HAI list lặp (`<key>`, `<value>`) → fill mỗi list bằng MỘT
lần `set_fields` riêng (`listTag=lookup`, `itemTag=key` / `value`); các tag
đơn (`lookup/schema`, `operation_order_field`, ...) sửa bằng
`set_field_path`. `<lookup>` LUÔN paired — self-closing `<lookup/>` làm
`setFields` từ chối.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 82 —
  `<step id="SynchronizeAfterMerge">` →
  `org.pentaho.di.trans.steps.synchronizeaftermerge.SynchronizeAfterMergeMeta`
  (category Output). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SynchronizeAfterMergeMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/synchronizeaftermerge/SynchronizeAfterMergeMeta.java`
  dòng 519–562) — thứ tự `connection`, `commit` (chuỗi, dòng 526),
  `tablename_in_field`, `tablename_field`, `use_batch`, `perform_lookup`,
  `operation_order_field`, `order_insert`, `order_update`, `order_delete`,
  rồi wrapper `<lookup>` LUÔN emit (dòng 538/559) chứa `schema` + `table`
  (dòng 539–540), các `<key>` (`name` + `field` + `condition` + `name2`,
  dòng 543–549), các `<value>` (`name` + `rename` + `update` Y/N, dòng
  551–557).
- Deserialization: `loadXML()` (dòng 390–392) gọi `readData()` (dòng
  421–483) — 3 cờ parse bằng `"Y".equalsIgnoreCase` (thiếu → false, dòng
  431–434); `condition` null → `"="` (dòng 453–455); `rename` null → bằng
  `name` (dòng 464–466); `<value>/<update>` null → TRUE, `Y` → TRUE, còn
  lại FALSE (dòng 467–477).
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 485–517) đặt
  `commitSize="100"` (chuỗi), `schemaName=""`, 0 key/0 value,
  `performLookup=false`, `tablenameInField=false`; `useBatchUpdate` không
  set (false).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`SynchronizeAfterMerge.java`, giữ mức
  `source_reviewed`): mỗi dòng input đọc trường `operation_order_field`
  (thiếu field → error, dòng 695–699) rồi so với 3 marker đã substitute
  (`insertValue`/`updateValue`/`deleteValue` từ
  `order_insert/update/delete`, dòng 706–708): bằng insert → INSERT (dòng
  104, 481, 935), bằng update → UPDATE (dòng 237–238, kèm nhánh
  `performLookup`), bằng delete → DELETE (dòng 289). Key mapping xác định
  dòng đích; update mapping (`updateStream` → `updateLookup`, dòng 747–749)
  xác định cột ghi. `check()` (dòng 648–904) đòi connection, bảng tồn tại,
  key/update fields khớp bảng + stream. `getSQLStatements()` (dòng 906–996)
  sinh DDL bảng từ key+update mapping kèm index lookup.
  `getUsedDatabaseConnections()` (dòng 1037–1043) trả connection đã chọn —
  lineage thấy step này dùng DB. `supportsErrorHandling()` = true (dòng
  1094–1096).

Cấu hình không mặc định (đồng bộ bảng customer theo cờ I/U/D, khóa
`CUST_ID`, 2 cột ghi):

```xml
<operation_order_field>OP_FLAG</operation_order_field>
<order_insert>I</order_insert>
<order_update>U</order_update>
<order_delete>D</order_delete>
<lookup>
  <schema>${SCHEMA}</schema>
  <table>${TABLE}</table>
  <key>
    <name>CUST_ID</name>
    <field>cust_id</field>
    <condition>=</condition>
    <name2></name2>
  </key>
  <value>
    <name>cust_name</name>
    <rename>CUST_NAME</rename>
    <update>Y</update>
  </value>
  <value>
    <name>cust_segment</name>
    <rename>CUST_SEGMENT</rename>
    <update>Y</update>
  </value>
</lookup>
```

Fill list bằng `set_fields` (`listTag=lookup`, `itemTag=key` / `value`);
tag đơn sửa bằng `set_field_path`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<key>/<field>` là cột bảng, KHÔNG phải `<lookup>`**: khác
  DimensionLookup (`<key>/<lookup>`) — nhầm tên tag sẽ bị loader bỏ qua
  lặng lẽ (key rỗng → check() ERROR thiếu key).
- **`<use_batch>` snake_case**: viết `useBatch` (kiểu DimensionLookup) sẽ bị
  loader bỏ qua (luôn false).
- **`<commit>` là chuỗi**: `commitSize` kiểu String — template giữ `"100"`
  dạng text.
- **`<value>/<update>` thiếu → TRUE**: ngược với cờ step-level (thiếu →
  false) — template LUÔN pin `Y`/`N`显式 để cột không bị ghi ngoài ý muốn.
- **`<rename>` thiếu → cùng tên cột**: loader default `updateStream =
  updateLookup` — template pin cả hai để không phụ thuộc default.
- **Trường operation bắt buộc tồn tại trên stream**: runtime error khi
  `operation_order_field` không tìm thấy (dòng 695–699) — template phải đặt
  tên field có thật sau khi nối hop.
- **3 marker quyết định toàn bộ hành vi ghi**: marker nào không khớp giá trị
  thực trên stream thì dòng đó không được xử lý như kỳ vọng — kiểm tra
  I/U/D (hay mã nghiệp vụ khác) khớp cả hai phía.
- Template mặc định là khung cấu hình — người dùng phải điền connection có
  thật, bảng đích tồn tại, key/value khớp stream và chọn marker đúng với
  output của step merge phía trước; credential không bao giờ nằm trong XML.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` (+ runtime `SynchronizeAfterMerge.java` ở mức statement
  vừa đủ cho semantics operation) tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
