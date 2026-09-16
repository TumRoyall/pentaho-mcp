# PGBulkLoader — Step bulk load PostgreSQL (COPY)

Step ghi stream ra file tạm rồi chạy `COPY <table> FROM STDIN` (hoặc qua
`psql`) vào PostgreSQL qua connection đã chọn. Ánh xạ cột ↔ field bằng các
`<mapping>` ANH EM trực tiếp (không wrapper), mỗi mapping có thêm
`<date_mask>` (`PASS THROUGH`/`DATE`/`DATETIME`, lạ → rỗng).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PGBulkLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <load_action>INSERT</load_action>
    <dbname_override/>
    <enclosure>"</enclosure>
    <delimiter>;</delimiter>
    <stop_on_error>N</stop_on_error>
    <mapping>
      <stream_name>{{TABLE_COLUMN}}</stream_name>
      <field_name>{{STREAM_FIELD}}</field_name>
      <date_mask>PASS THROUGH</date_mask>
    </mapping>
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
| `<connection>` | Y | Tên DB connection PostgreSQL (THAM CHIẾU — fixture phải khai báo). |
| `<schema>` / `<table>` | Y | Schema/bảng đích. |
| `<load_action>` | N | `INSERT` / `TRUNCATE`; setDefault KHÔNG đặt (null) — template ghi `INSERT`. |
| `<dbname_override>` | N | Ghi đè tên DB khi chạy (mặc định rỗng). |
| `<enclosure>` | N | Mặc định `"`. |
| `<delimiter>` | N | Mặc định `;` (chấm phẩy — khác MySQL TAB, MonetDB `|`). |
| `<stop_on_error>` | N | `Y` = dừng khi lỗi; mặc định `N`. |
| `<mapping>` (anh em, lặp) | Y (ít nhất 1 khi chạy) | `stream_name` = CỘT BẢNG, `field_name` = FIELD STREAM (thiếu → trùng `stream_name`), `date_mask` ∈ {`PASS THROUGH`, `DATE`, `DATETIME`} — thiếu/lạ → `""`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PG_BULK_LOADER` | `<type>` | `PGBulkLoader`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` / `configuration.table` | `<schema>` / `<table>` | Cho phép `${VAR}`. |
| `configuration.load_action` | `<load_action>` | `INSERT`/`TRUNCATE` (hoa). |
| `configuration.stop_on_error` | `<stop_on_error>` | Boolean → Y/N. |
| `configuration.mappings[].column` | `<mapping>/<stream_name>` | Node anh em, không wrapper. |
| `configuration.mappings[].date_mask` | `<mapping>/<date_mask>` | Chỉ 3 mã hợp lệ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "PGBulkLoader", …)`
  (`plugins/postgresql-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/pgbulkloader/PGBulkLoaderMeta.java`
  dòng 67). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `PGBulkLoaderMeta.getXML()` (dòng 279–302) — thứ tự
  `connection`, `schema`, `table`, `load_action`, `dbname_override`,
  `enclosure`, `delimiter`, `stop_on_error` (dòng 282–291), rồi các
  `<mapping>` ANH EM (dòng 293–299) với `stream_name`, `field_name`,
  `date_mask` (dòng 295–297).
- Mã: `ACTION_INSERT = "INSERT"`, `ACTION_TRUNCATE = "TRUNCATE"` (dòng
  114–115); `DATE_MASK_PASS_THROUGH = "PASS THROUGH"`,
  `DATE_MASK_DATE = "DATE"`, `DATE_MASK_DATETIME = "DATETIME"` (dòng
  120–122).
- Deserialization: `loadXML()` (dòng 200–202) gọi `readData()` (dòng
  221–264) — `field_name` thiếu → trùng `stream_name` (dòng 244–246);
  `date_mask` chỉ giữ khi khớp đúng 1 trong 3 mã (so bằng `.equals`
  case-sensitive, dòng 251–257), còn lại → `""`.
- Khởi tạo: `setDefault()` (dòng 266–277) — `delimiter=";"`,
  `enclosure="\""`, `stopOnError=false`, `dbNameOverride=""`; KHÔNG đặt
  `loadAction` (null); 0 mapping.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (TRUNCATE trước + dừng khi lỗi):

```xml
<connection>${CONN}</connection>
<table>staging_orders</table>
<load_action>TRUNCATE</load_action>
<stop_on_error>Y</stop_on_error>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **`load_action` không có default**: `setDefault()` không đặt (dòng
  266–277) — file thiếu tag load thành null; template luôn ghi `INSERT`
  hoặc `TRUNCATE` rõ ràng.
- **`date_mask` whitelist 3 mã**: mã khác (kể cả `TIMESTAMP`, `NONE`)
  lặng lẽ thành `""` (dòng 251–257). `PASS THROUGH` có dấu cách giữa.
- **Delimiter mặc định `;`**: khác MySQL (`\t`) và MonetDB (`|`) — đừng
  copy mù giữa các bulk loader.
- **`<mapping>` không có wrapper**: `countNodes(stepnode, "mapping")`
  trực tiếp (dòng 236).
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, mapping cột tồn tại; cần PostgreSQL thật khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/PostgreSQL thật) — không tuyên bố hai
  mức này.
