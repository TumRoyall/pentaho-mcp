# VectorWiseBulkLoader — Step bulk load Actian VectorWise (vwload)

Step ghi stream ra FIFO rồi gọi `sql`/`vwload` để load vào VectorWise qua
connection đã chọn. Ánh xạ cột ↔ field bằng block `<fields>/<field>`
(`column_name` + `stream_name`) — CÓ WRAPPER (khác `<mapping>` anh em của
MySQL/PG/GPLoad/MonetDB).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>VectorWiseBulkLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <table>{{TABLE}}</table>
    <fifo_file_name>${java.io.tmpdir}/fifoVW-${Internal.Step.CopyNr}</fifo_file_name>
    <sql_path>/opt/Ingres/IngresVW/ingres/bin/sql</sql_path>
    <encoding/>
    <delimiter>|</delimiter>
    <continue_on_error>N</continue_on_error>
    <error_file_name/>
    <use_standard_conversion>N</use_standard_conversion>
    <use_authentication>N</use_authentication>
    <use_dynamic_vnode>N</use_dynamic_vnode>
    <use_SSV_delimiter>N</use_SSV_delimiter>
    <escape_special_characters>Y</escape_special_characters>
    <use_vwload>N</use_vwload>
    <truncate_table>N</truncate_table>
    <max_errors>50</max_errors>
    <buffer_size>5000</buffer_size>
    <fields>
      <field>
        <column_name>{{TABLE_COLUMN}}</column_name>
        <stream_name>{{STREAM_FIELD}}</stream_name>
      </field>
    </fields>
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
| `<connection>` | Y | Tên DB connection VectorWise (THAM CHIẾU — fixture phải khai báo). |
| `<table>` | Y | Bảng đích (KHÔNG có `<schema>` riêng — khác các bulk loader khác). |
| `<fifo_file_name>` | N | Mặc định `${java.io.tmpdir}/fifoVW-${Internal.Step.CopyNr}`. |
| `<sql_path>` | N | Đường dẫn tool `sql`; mặc định `/opt/Ingres/IngresVW/ingres/bin/sql`. |
| `<encoding>` | N | Mặc định null. |
| `<delimiter>` | N | Mặc định `|`. |
| `<continue_on_error>` / `<error_file_name>` | N | Tiếp tục khi lỗi + file lỗi. |
| `<use_standard_conversion>` / `<use_authentication>` / `<use_dynamic_vnode>` | N | Mặc định `N` cả ba. |
| `<use_SSV_delimiter>` | N | SSV thay vì CSV; chữ SSV hoa. Mặc định `N`. |
| `<escape_special_characters>` | N | Mặc định `Y`, và load-thiếu-tag → `true` (xem bẫy). |
| `<use_vwload>` | N | Dùng `vwload` thay `sql`; mặc định `N`. |
| `<truncate_table>` | N | Mặc định `N`. |
| `<max_errors>` | N | Mặc định `"50"` (chuỗi số). |
| `<buffer_size>` | N | Mặc định `"5000"` (chuỗi số). |
| `<fields>/<field>/<column_name>` + `<stream_name>` | Y (ít nhất 1 khi chạy) | CỘT BẢNG + FIELD STREAM (CÓ wrapper `<fields>`). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: VECTORWISE_BULK_LOADER` | `<type>` | `VectorWiseBulkLoader`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.table` | `<table>` | Không có schema riêng. |
| `configuration.sql_path` | `<sql_path>` | Đường dẫn tool. |
| `configuration.use_vwload` | `<use_vwload>` | Boolean → Y/N. |
| `configuration.max_errors` / `buffer_size` | `<max_errors>` / `<buffer_size>` | Chuỗi số. |
| `configuration.fields[].column` / `[].field` | `<fields>/<field>/<column_name>` / `<stream_name>` | `set_fields` (`listTag=fields`, `itemTag=field`). |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "VectorWiseBulkLoader", …)`
  (`plugins/ivw-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/ivwloader/IngresVectorwiseLoaderMeta.java`
  dòng 55). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `IngresVectorwiseLoaderMeta.getXML()` (dòng 209–243) —
  thứ tự `connection`, `table`, `fifo_file_name`, `sql_path`, `encoding`,
  `delimiter`, `continue_on_error`, `error_file_name`,
  `use_standard_conversion`, `use_authentication`, `use_dynamic_vnode`,
  `use_SSV_delimiter`, `escape_special_characters`, `use_vwload`,
  `truncate_table`, `max_errors`, `buffer_size` (dòng 212–230), rồi block
  `<fields>` LUÔN emit (dòng 232–240) với `column_name` + `stream_name`
  mỗi item (dòng 236–237). KHÔNG có `<schema>`.
- Deserialization: `loadXML()` (dòng 246–282) — các cờ Y/N (thiếu →
  false), NGOẠI TRỪ `escape_special_characters`: thiếu/rỗng → `true`
  (dòng 261–262); list `<fields>/<field>` đọc `column_name` +
  `stream_name` (dòng 268–278).
- Khởi tạo: `setDefault()` (dòng 173–188) — `sqlPath` mặc định install
  path, `delimiter="|"`, `fifoFileName` mẫu tmpdir, `escapingSpecialCharacters=true`,
  `maxNrErrors="50"`, `bufferSize="5000"`, còn lại false, 0 field.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (vwload + truncate + 2 cột):

```xml
<use_vwload>Y</use_vwload>
<truncate_table>Y</truncate_table>
<max_errors>100</max_errors>
<fields>
  <field>
    <column_name>sale_id</column_name>
    <stream_name>SALE_ID</stream_name>
  </field>
  <field>
    <column_name>amount</column_name>
    <stream_name>AMOUNT</stream_name>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **`escape_special_characters` ngược với cờ thường**: thiếu tag → `true`
  (dòng 261–262) — đừng lược tag này khỏi template.
- **KHÔNG có `<schema>`**: khác MySQL/PG/MonetDB/GPLoad — đừng bịa thêm.
- **`<fields>` có wrapper (paired)**: khác `<mapping>` anh em của 4 bulk
  loader kia — fill bằng `set_fields` bình thường.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, cột tồn tại; cần VectorWise client + tool `sql`/`vwload` khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/VectorWise thật) — không tuyên bố hai
  mức này.
