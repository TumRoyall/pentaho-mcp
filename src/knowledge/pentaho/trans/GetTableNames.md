# GetTableNames — Step liệt kê bảng/view/procedure

Step input (không cần hop vào): nối `<connection>`, liệt kê object DB
theo bộ lọc (`includeTable`/`includeView`/`includeProcedure`/
`includeSynonym`/`includeCatalog`/`includeSchema`) trong schema
(`schemaname` tĩnh hoặc động từ field khi `dynamicSchema=Y` +
`schemaNameField`) và phát mỗi object MỘT dòng với tối đa 4 cột
(`tablenamefieldname` String 500, `objecttypefieldname` String 500,
`issystemobjectfieldname` Boolean, `sqlcreationfieldname` String 500 —
cột nào tên rỗng thì KHÔNG phát).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetTableNames</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <schemaname>${SCHEMA}</schemaname>
    <tablenamefieldname>tablename</tablenamefieldname>
    <objecttypefieldname>type</objecttypefieldname>
    <issystemobjectfieldname>is system</issystemobjectfieldname>
    <sqlcreationfieldname/>
    <includeCatalog>N</includeCatalog>
    <includeSchema>N</includeSchema>
    <includeTable>Y</includeTable>
    <includeView>Y</includeView>
    <includeProcedure>Y</includeProcedure>
    <includeSynonym>Y</includeSynonym>
    <addSchemaInOutput>N</addSchemaInOutput>
    <dynamicSchema>N</dynamicSchema>
    <schemaNameField/>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — fixture phải khai báo). |
| `<schemaname>` | N | Schema tĩnh cần quét (`${VAR}`); bỏ qua khi `dynamicSchema=Y`. |
| `<tablenamefieldname>` | N | Tên cột tên object; mặc định `tablename`. Rỗng = không phát cột. |
| `<objecttypefieldname>` | N | Tên cột loại object (`TABLE`/`VIEW`/…); mặc định `type`. Rỗng = không phát. |
| `<issystemobjectfieldname>` | N | Tên cột cờ system (Boolean); mặc định `is system`. Rỗng = không phát. |
| `<sqlcreationfieldname>` | N | Tên cột DDL tạo object; mặc định null (không phát). |
| `<includeCatalog>` / `<includeSchema>` | N | Liệt kê cả catalog/schema; mặc định `N`. Chữ C/S hoa. |
| `<includeTable>` / `<includeView>` / `<includeProcedure>` / `<includeSynonym>` | N | Loại object lấy; mặc định `Y` cả bốn. |
| `<addSchemaInOutput>` | N | Gộp schema vào tên bảng output; mặc định `N`. |
| `<dynamicSchema>` | N | `Y` = đọc schema từ field `schemaNameField` từng dòng vào; mặc định `N`. Chữ S hoa. |
| `<schemaNameField>` | N (bắt buộc khi `dynamicSchema=Y`) | Field chứa schema động. Chữ N/F hoa. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_TABLE_NAMES` | `<type>` | `GetTableNames`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` | `<schemaname>` | Tĩnh; `${VAR}`. |
| `configuration.table_field` / `type_field` / `system_field` / `ddl_field` | 4 `*fieldname` | Tên cột (rỗng = bỏ cột). |
| `configuration.include_table` / `view` / `procedure` / `synonym` | 4 cờ `include*` | Boolean → Y/N. |
| `configuration.dynamic_schema` / `schema_field` | `<dynamicSchema>` / `<schemaNameField>` | Schema động. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 99 —
  `<step id="GetTableNames">` →
  `org.pentaho.di.trans.steps.gettablenames.GetTableNamesMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `GetTableNamesMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/gettablenames/GetTableNamesMeta.java`
  dòng 359–380) — thứ tự `connection`, `schemaname`, 4 `*fieldname`
  (`tablenamefieldname`, `objecttypefieldname`, `issystemobjectfieldname`,
  `sqlcreationfieldname`, dòng 364–367), 8 cờ (`includeCatalog`,
  `includeSchema`, `includeTable`, `includeView`, `includeProcedure`,
  `includeSynonym`, `addSchemaInOutput`, `dynamicSchema`, dòng 369–376),
  `schemaNameField` cuối (dòng 377).
- Deserialization: `loadXML()` (dòng 295–297) gọi `readData()` (dòng
  382–414) — 8 cờ Y/N (thiếu → false); **tương thích ngược 7.0**: tag typo
  `schenameNameField` (thiếu "m") nếu có sẽ GHI ĐÈ `schemaNameField`
  (dòng 403–409) — đừng dùng typo này khi viết mới.
- Khởi tạo: `setDefault()` (dòng 305–321) —
  `tablenamefieldname="tablename"`, `objecttypefieldname="type"`,
  `issystemobjectfieldname="is system"`, 4 include loại = true, còn lại
  false/null.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 323–357) thêm tối đa 4 cột —
  mỗi cột chỉ thêm khi tên non-rỗng (2 String 500 + 1 Boolean + 1 String
  DDL). Cần DB thật nên không test runtime ở đây.

Cấu hình không mặc định (chỉ view + kèm DDL + schema động):

```xml
<sqlcreationfieldname>ddl_statement</sqlcreationfieldname>
<includeTable>N</includeTable>
<includeView>Y</includeView>
<includeProcedure>N</includeProcedure>
<includeSynonym>N</includeSynonym>
<dynamicSchema>Y</dynamicSchema>
<schemaNameField>SCHEMA_NAME</schemaNameField>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **Tên cột rỗng = bỏ cột đó**: `getFields()` chỉ thêm cột khi tên
  non-rỗng (dòng 325–356) — muốn ít cột thì để trống tên, không xóa tag.
- **Đừng dùng typo `schenameNameField`**: chỉ đọc để tương thích file
  7.0 cũ (dòng 403–409); file mới luôn viết `schemaNameField`.
- **Cờ camelCase giữ hoa**: `includeCatalog`, `includeSchema`,
  `dynamicSchema`, `schemaNameField`, `addSchemaInOutput` — viết thường
  vẫn load (case-insensitive) nhưng lệch serializer.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  (và field schema khi dùng schema động); không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/DB thật) — không tuyên bố hai mức này.
