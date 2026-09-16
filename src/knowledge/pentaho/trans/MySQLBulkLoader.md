# MySQLBulkLoader — Step bulk load MySQL (LOAD DATA)

Step ghi stream ra FIFO file rồi chạy `LOAD DATA [LOCAL] INFILE` vào bảng
MySQL qua connection đã chọn. Ánh xạ cột bảng ↔ field stream bằng các
`<mapping>` là node ANH EM trực tiếp dưới `<step>` (KHÔNG có wrapper —
giống `OraBulkLoader`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MySQLBulkLoader</type>
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
    <encoding/>
    <delimiter>	</delimiter>
    <enclosure>"</enclosure>
    <escape_char>\</escape_char>
    <replace>N</replace>
    <ignore>N</ignore>
    <local>Y</local>
    <fifo_file_name>/tmp/fifo</fifo_file_name>
    <bulk_size/>
    <mapping>
      <stream_name>{{TABLE_COLUMN}}</stream_name>
      <field_name>{{STREAM_FIELD}}</field_name>
      <field_format_ok>OK</field_format_ok>
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
| `<connection>` | Y | Tên DB connection MySQL (THAM CHIẾU — fixture phải khai báo). |
| `<schema>` / `<table>` | Y | Schema/bảng đích. |
| `<encoding>` | N | Charset file (mặc định rỗng). |
| `<delimiter>` | N | Mặc định TAB (`\t`). Chứa TAB thật trong XML. |
| `<enclosure>` | N | Mặc định `"`. |
| `<escape_char>` | N | Mặc định `\`. |
| `<replace>` | N | `Y` = `REPLACE` (ghi đè trùng key); mặc định `N` (`IGNORE` semantics theo `ignoringErrors`). |
| `<ignore>` | N | `Y` = bỏ qua dòng lỗi; mặc định `N`. |
| `<local>` | N | `Y` (mặc định) = `LOAD DATA LOCAL INFILE`. |
| `<fifo_file_name>` | N | FIFO file; mặc định `/tmp/fifo`. |
| `<bulk_size>` | N | Mặc định null (không giới hạn lô). |
| `<mapping>` (anh em, lặp) | Y (ít nhất 1 khi chạy) | Mỗi block: `<stream_name>` = CỘT BẢNG, `<field_name>` = FIELD STREAM (thiếu → mặc định trùng `stream_name`), `<field_format_ok>` mã format. |

Mã `<field_format_ok>`: `OK` (0), `DATE` (1), `TIMESTAMP` (2), `NUMBER`
(3), `STRING_ESC` (4).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MYSQL_BULK_LOADER` | `<type>` | `MySQLBulkLoader`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` / `configuration.table` | `<schema>` / `<table>` | Cho phép `${VAR}`. |
| `configuration.delimiter` / `enclosure` / `escape` | `<delimiter>` / `<enclosure>` / `<escape_char>` | Ký tự thuần. |
| `configuration.replace` / `ignore_errors` / `local_file` | `<replace>` / `<ignore>` / `<local>` | Boolean → Y/N. |
| `configuration.mappings[].column` | `<mapping>/<stream_name>` | Cột bảng (node anh em, không wrapper). |
| `configuration.mappings[].field` | `<mapping>/<field_name>` | Field stream. |
| `configuration.mappings[].format` | `<mapping>/<field_format_ok>` | Mã `OK`/`DATE`/… |

`<mapping>` là node anh em trực tiếp (KHÔNG wrapper) — generator chèn
`addElement` + `setFieldPath` cho item đầu, item bổ sung chèn thủ công
(giống `OraBulkLoader`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "MySQLBulkLoader", …)`
  (`plugins/mysql-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/mysqlbulkloader/MySQLBulkLoaderMeta.java`
  dòng 81). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `MySQLBulkLoaderMeta.getXML()` (dòng 305–332) — thứ tự
  `connection` (tên DB, rỗng khi null, dòng 308–309), `schema`, `table`,
  `encoding`, `delimiter`, `enclosure`, `escape_char`, `replace`,
  `ignore`, `local`, `fifo_file_name`, `bulk_size` (dòng 310–320), rồi các
  `<mapping>` ANH EM (dòng 322–329), mỗi block có `stream_name`,
  `field_name`, `field_format_ok` mã qua `getFieldFormatTypeCode` (dòng
  326–327).
- Mã format: `fieldFormatTypeCodes = {OK, DATE, TIMESTAMP, NUMBER,
  STRING_ESC}` (dòng 98); `getFieldFormatTypeCode(int)` (dòng 747–748).
- Deserialization: `loadXML()` (dòng 225–227) gọi `readData()` (dòng
  247–285) — `connection` resolve qua `DatabaseMeta.findDatabase` (dòng
  249–250); 3 cờ Y/N (thiếu → false); `<mapping>` đếm trực tiếp dưới step
  (dòng 268); `field_name` thiếu → trùng `stream_name` (dòng 276–278).
- Khởi tạo: `setDefault()` (dòng 287–303) — `schemaName=""`,
  `fifoFileName="/tmp/fifo"`, `delimiter="\t"`, `enclosure="\""`,
  `escapeChar="\\"`, `localFile=true`, còn lại false/null, 0 mapping.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: cần MySQL client/`LOAD DATA` + FIFO — không test
  runtime ở đây.

Cấu hình không mặc định (REPLACE + enclosure `|` + 2 cột):

```xml
<connection>${CONN}</connection>
<schema>${SCHEMA}</schema>
<table>customers</table>
<replace>Y</replace>
<local>Y</local>
<fifo_file_name>/tmp/fifo_customers</fifo_file_name>
<mapping>
  <stream_name>customer_id</stream_name>
  <field_name>CUSTOMER_ID</field_name>
  <field_format_ok>NUMBER</field_format_ok>
</mapping>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2), credential
  không bao giờ nằm trong XML.
- **`<mapping>` không có wrapper**: đừng bịa `<mappings>` bao ngoài —
  `readData()` đếm `countNodes(stepnode, "mapping")` trực tiếp (dòng 268).
- **`stream_name` = CỘT BẢNG, `field_name` = FIELD STREAM**: tên node
  ngược trực giác (giống `OraBulkLoader`) — đừng đảo.
- **Delimiter TAB thật**: default `"\t"` là ký tự TAB trong XML, không
  phải chuỗi `\t` hai ký tự.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, mapping cột tồn tại; cần MySQL + quyền `FILE` khi chạy thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/MySQL thật) — không tuyên bố hai mức này.
