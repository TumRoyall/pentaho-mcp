# MonetDBBulkLoader — Step bulk load MonetDB (COPY INTO)

Step ghi stream rồi chạy `COPY INTO` vào bảng MonetDB qua connection đã
chọn. Ánh xạ cột ↔ field bằng các `<mapping>` ANH EM trực tiếp (không
wrapper). Hai cờ parse case-SENSITIVE (`"Y".equals`) — xem bẫy.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MonetDBBulkLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <buffer_size>100000</buffer_size>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <log_file/>
    <truncate>N</truncate>
    <fully_quote_sql>Y</fully_quote_sql>
    <field_separator>|</field_separator>
    <field_enclosure>"</field_enclosure>
    <null_representation></null_representation>
    <encoding>UTF-8</encoding>
    <mapping>
      <stream_name>{{TABLE_COLUMN}}</stream_name>
      <field_name>{{STREAM_FIELD}}</field_name>
      <field_format_ok>N</field_format_ok>
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
| `<connection>` | Y | Tên DB connection MonetDB (THAM CHIẾU — fixture phải khai báo). |
| `<buffer_size>` | N | Mặc định `"100000"`. Đứng THỨ HAI sau connection. |
| `<schema>` / `<table>` | Y | Schema/bảng đích. |
| `<log_file>` | N | File log (mặc định rỗng). |
| `<truncate>` | N | `Y` = truncate trước khi load. Parse `"Y".equals` — CHỮ HOA MỚI NHẬN. |
| `<fully_quote_sql>` | N | Mặc định `Y` (setDefault `true`). Parse `"Y".equals` — chữ hoa mới nhận. |
| `<field_separator>` | N | Mặc định `|` (cả setDefault lẫn load-fallback). |
| `<field_enclosure>` | N | Mặc định `"` (cả hai). |
| `<null_representation>` | N | setDefault RỖNG nhưng load-thiếu-tag → `"null"` (xem bẫy). |
| `<encoding>` | N | Mặc định `UTF-8` (cả hai). |
| `<mapping>` (anh em, lặp) | Y (ít nhất 1 khi chạy) | `stream_name` = CỘT BẢNG, `field_name` = FIELD STREAM (thiếu → trùng `stream_name`), `field_format_ok` Y/N boolean. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MONETDB_BULK_LOADER` | `<type>` | `MonetDBBulkLoader`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.buffer_size` | `<buffer_size>` | Chuỗi số. |
| `configuration.schema` / `configuration.table` | `<schema>` / `<table>` | Cho phép `${VAR}`. |
| `configuration.truncate` / `configuration.fully_quote_sql` | `<truncate>` / `<fully_quote_sql>` | Y/N — PHẢI hoa `Y` mới có tác dụng. |
| `configuration.mappings[].column` | `<mapping>/<stream_name>` | Node anh em, không wrapper. |
| `configuration.mappings[].field` | `<mapping>/<field_name>` | Field stream. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "MonetDBBulkLoader", …)`
  (`plugins/monet-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/monetdbbulkloader/MonetDBBulkLoaderMeta.java`
  dòng 69). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `MonetDBBulkLoaderMeta.getXML()` (dòng 369–397) — thứ tự
  `connection`, `buffer_size`, `schema`, `table`, `log_file`, `truncate`,
  `fully_quote_sql`, `field_separator`, `field_enclosure`,
  `null_representation`, `encoding` (dòng 373–385), rồi các `<mapping>`
  ANH EM (dòng 388–394) với `stream_name`, `field_name`, `field_format_ok`
  boolean Y/N (dòng 390–392).
- Deserialization: `loadXML()` (dòng 272–274) gọi `readData()` (dòng
  294–349) — `truncate`/`fully_quote_sql` parse bằng `"Y".equals` NHẠY
  HOA (dòng 303, 309 — `y` thường = false!); fallback khi thiếu tag:
  `field_separator→"|"`, `field_enclosure→"\""`,
  `null_representation→"null"`, `encoding→"UTF-8"` (dòng 311–326);
  `field_name` thiếu → trùng `stream_name` (dòng 340–342).
- Khởi tạo: `setDefault()` (dòng 351–367) — `bufferSize="100000"`,
  `fullyQuoteSQL=true`, `fieldSeparator="|"`, `fieldEnclosure="\""`,
  `NULLrepresentation=""` (RỖNG — khác fallback load `"null"`),
  `encoding="UTF-8"`, 0 mapping.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (truncate + null là chuỗi rỗng hiển thị):

```xml
<connection>${CONN}</connection>
<buffer_size>50000</buffer_size>
<table>events</table>
<truncate>Y</truncate>
<null_representation>null</null_representation>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **`truncate`/`fully_quote_sql` chỉ nhận `Y` HOA**: parse bằng
  `"Y".equals` (dòng 303, 309), không phải `equalsIgnoreCase` — ghi `y`
  thường thì load thành false lặng lẽ.
- **`null_representation` 2 default khác nhau**: step mới rỗng
  (`setDefault`, dòng 364), nhưng file thiếu tag load thành `"null"`
  (dòng 319–322). Template ghi rõ giá trị mong muốn, đừng lược tag.
- **`<mapping>` không có wrapper**: `countNodes(stepnode, "mapping")`
  trực tiếp (dòng 332) — đừng bịa `<mappings>`.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, mapping cột tồn tại; cần MonetDB thật khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/MonetDB thật) — không tuyên bố hai mức này.
