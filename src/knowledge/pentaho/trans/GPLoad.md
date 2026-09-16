# GPLoad — Step bulk load Greenplum (gpload)

Step ghi stream ra data file + control file rồi gọi tool `gpload` để load
vào Greenplum qua connection đã chọn. Ánh xạ cột ↔ field bằng các
`<mapping>` ANH EM trực tiếp (không wrapper), mỗi mapping có thêm
`date_mask` (`DATE`/`DATETIME`), `match_column`, `update_column`; kèm block
`<local_hosts>` (paired, luôn emit) liệt kê host ETL.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GPLoad</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <errors>50</errors>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <error_table/>
    <load_method>AUTO_END</load_method>
    <load_action>insert</load_action>
    <gpload_path>/usr/local/greenplum-db/bin/gpload</gpload_path>
    <control_file>control${Internal.Step.CopyNr}.cfg</control_file>
    <data_file>load${Internal.Step.CopyNr}.dat</data_file>
    <delimiter>,</delimiter>
    <log_file/>
    <null_as/>
    <erase_files>Y</erase_files>
    <encoding/>
    <enclose_numbers>N</enclose_numbers>
    <localhost_port/>
    <update_condition/>
    <mapping>
      <stream_name>{{TABLE_COLUMN}}</stream_name>
      <field_name>{{STREAM_FIELD}}</field_name>
      <date_mask></date_mask>
      <match_column>N</match_column>
      <update_column>N</update_column>
    </mapping>
    <local_hosts>
    </local_hosts>
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
| `<connection>` | Y | Tên DB connection Greenplum (THAM CHIẾU — fixture phải khai báo). |
| `<errors>` | N | Số lỗi tối đa; mặc định `"50"` (`MAX_ERRORS_DEFAULT`). |
| `<schema>` / `<table>` / `<error_table>` | Y (bảng) | Schema/bảng đích + bảng lỗi. |
| `<load_method>` | N | `AUTO_END` (mặc định). |
| `<load_action>` | N | `insert` (THƯỜNG — khác PG `INSERT` hoa). Mặc định `ACTION_INSERT`. |
| `<gpload_path>` | N | Tool path; mặc định `/usr/local/greenplum-db/bin/gpload`. |
| `<control_file>` / `<data_file>` | N | Mặc định theo `CopyNr`. |
| `<delimiter>` | N | Mặc định `,`. |
| `<log_file>` / `<null_as>` / `<encoding>` | N | Log, chuỗi NULL, charset (mặc định rỗng). |
| `<erase_files>` | N | Mặc định `Y` (xóa file tạm). |
| `<enclose_numbers>` | N | Mặc định `N` — NHƯNG thiếu tag NÉM NPE (xem bẫy). |
| `<localhost_port>` / `<update_condition>` | N | Port gpfdist + điều kiện update (mặc định rỗng). |
| `<mapping>` (anh em, lặp) | Y (ít nhất 1 khi chạy) | `stream_name` = CỘT BẢNG, `field_name` = FIELD STREAM (thiếu → trùng `stream_name`), `date_mask` ∈ {`DATE`, `DATETIME`} (lạ → `""`), `match_column`/`update_column` Y/N. |
| `<local_hosts>/<local_host>` | N | List host ETL (text node, không phải name/value) — wrapper paired luôn emit. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GP_LOAD` | `<type>` | `GPLoad`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.max_errors` | `<errors>` | Chuỗi số. |
| `configuration.load_method` / `load_action` | `<load_method>` / `<load_action>` | `AUTO_END` / `insert` (thường). |
| `configuration.erase_files` | `<erase_files>` | Boolean → Y/N. |
| `configuration.mappings[].column` | `<mapping>/<stream_name>` | Node anh em, không wrapper. |
| `configuration.mappings[].match` / `update` | `<mapping>/<match_column>` / `<update_column>` | Boolean → Y/N. |
| `configuration.local_hosts[]` | `<local_hosts>/<local_host>` | Text node từng host. |

`<mapping>` là node anh em (không wrapper) — item đầu qua template, item
bổ sung chèn thủ công (giống `OraBulkLoader`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "GPLoad", …)`
  (`plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java`
  dòng 61). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `GPLoadMeta.getXML()` (dòng 414–454) — thứ tự
  `connection`, `errors`, `schema`, `table`, `error_table`, `load_method`,
  `load_action`, `gpload_path`, `control_file`, `data_file`, `delimiter`,
  `log_file`, `null_as`, `erase_files`, `encoding`, `enclose_numbers`
  (ghi `"Y"`/`"N"` tường minh, dòng 433), `localhost_port`,
  `update_condition` (dòng 417–435), rồi các `<mapping>` ANH EM (dòng
  437–445) với `stream_name`, `field_name`, `date_mask`, `match_column`,
  `update_column`, cuối cùng `<local_hosts>` LUÔN emit (dòng 447–451).
- Mã: `MAX_ERRORS_DEFAULT = "50"` (dòng 161);
  `ACTION_INSERT = "insert"` (thường, dòng 179);
  `METHOD_AUTO_END = "AUTO_END"` (dòng 187);
  `DATE_MASK_DATE = "DATE"`, `DATE_MASK_DATETIME = "DATETIME"` (dòng
  193–194).
- Deserialization: `loadXML()` (dòng 291–293) gọi `readData()` (dòng
  324–384) — **`enclose_numbers` đọc KHÔNG null-guard**
  (`getTagValue(...).equalsIgnoreCase("Y")`, dòng 353): thiếu tag → NPE
  bọc `KettleXMLException`; `date_mask` chỉ giữ `DATE`/`DATETIME` (dòng
  370), còn lại `""`; `local_hosts` đọc text từng `<local_host>` (dòng
  344–350).
- Khởi tạo: `setDefault()` (dòng 386–412) — `maxErrors="50"`,
  `loadMethod=AUTO_END`, `loadAction=insert`, `gploadPath` mặc định,
  `delimiter=","`, `eraseFiles=true`, 0 mapping + 0 local host.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (update + match column + local host):

```xml
<load_action>insert</load_action>
<update_condition>EXISTS (SELECT 1 FROM {{TABLE}} t WHERE t.id = src.id)</update_condition>
<mapping>
  <stream_name>id</stream_name>
  <field_name>ID</field_name>
  <date_mask></date_mask>
  <match_column>Y</match_column>
  <update_column>N</update_column>
</mapping>
<local_hosts>
  <local_host>etl-host-01</local_host>
</local_hosts>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **Thiếu `<enclose_numbers>` NÉM NPE**: dòng 353 gọi trực tiếp trên kết
  quả `getTagValue` — template LUÔN ghi tag này (không bao giờ lược).
- **`load_action` chữ thường**: `insert` (dòng 179) — khác PG `INSERT`
  hoa. Đừng copy mù giữa bulk loader.
- **`date_mask` chỉ 2 mã**: `DATE`/`DATETIME` (không có `PASS THROUGH`
  như PG) — lạ → `""`.
- **`<local_hosts>` luôn paired**: `getXML()` emit wrapper kể cả rỗng
  (dòng 447–451) — giữ paired, không self-closing.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, mapping; cần Greenplum + tool `gpload` + gpfdist khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Greenplum thật) — không tuyên bố hai
  mức này.
