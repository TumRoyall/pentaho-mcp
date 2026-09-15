# ColumnExists — Step kiểm tra cột có tồn tại trong bảng

Đọc từng dòng đầu vào, xác định bảng (tĩnh `<tablename>` HOẶC động từ field
`<tablenamefield>` khi `<istablenameInfield>=Y`) và tên cột (luôn động từ
field `<columnnamefield>`), gọi `checkColumnExists` trên connection đã chọn
rồi gắn thêm một cột boolean (`<resultfieldname>`) vào cuối dòng và truyền
đi. Không có tên cột tĩnh — tên cột bắt buộc đi qua stream field.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ColumnExists</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <tablename>{{TABLE_NAME}}</tablename>
    <schemaname>${SCHEMA}</schemaname>
    <istablenameInfield>N</istablenameInfield>
    <tablenamefield/>
    <columnnamefield>{{COLUMN_NAME_FIELD}}</columnnamefield>
    <resultfieldname>result</resultfieldname>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `check()` báo ERROR khi null. |
| `<tablename>` | Y (khi `istablenameInfield=N`) | Tên bảng TĨNH cần kiểm tra. Bị bỏ qua khi `istablenameInfield=Y`. |
| `<schemaname>` | N | Schema chứa bảng (hỗ trợ biến, substitute khi chạy). |
| `<istablenameInfield>` | N | `Y` = lấy tên bảng từ field động `<tablenamefield>`; `N` (mặc định) = dùng `<tablename>` tĩnh. |
| `<tablenamefield>` | Y (khi `istablenameInfield=Y`) | TÊN FIELD của stream chứa tên bảng. Bị bỏ qua khi `N`. |
| `<columnnamefield>` | Y | TÊN FIELD của stream chứa tên cột cần kiểm tra (luôn động — không có tag cột tĩnh). `check()` báo ERROR khi rỗng. |
| `<resultfieldname>` | Y | Tên cột boolean gắn thêm (`true` = cột tồn tại). Mặc định step mới: `result`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: COLUMN_EXISTS` | `<type>` | `ColumnExists`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.table` | `<tablename>` | Chỉ dùng khi `table_in_field: false`. |
| `configuration.schema` | `<schemaname>` | Cho phép `${VAR}`. |
| `configuration.table_in_field` | `<istablenameInfield>` | Boolean → Y/N. |
| `configuration.table_name_field` | `<tablenamefield>` | Tên field, chỉ dùng khi `table_in_field: true`. |
| `configuration.column_name_field` | `<columnnamefield>` | Tên field chứa tên cột — bắt buộc. |
| `configuration.result_field` | `<resultfieldname>` | Cột boolean output; mặc định `result`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "ColumnExists", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/columnexists/ColumnExistsMeta.java`
  dòng 59–61, category Lookup). KHÔNG có trong
  `engine/src/main/resources/kettle-steps.xml` — plugin core đăng ký bằng
  annotation; registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `ColumnExistsMeta.getXML()` (dòng 218–228) — đúng 7 tag
  theo thứ tự `connection`, `tablename`, `schemaname`,
  `istablenameInfield`, `tablenamefield`, `columnnamefield`,
  `resultfieldname`. Không có tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 189–191) gọi `readData()` (dòng
  230–244) — `istablenameInfield` parse bằng
  `"Y".equalsIgnoreCase(...)` (thiếu tag → false);
  `resultfieldname` optional, có thể null (dòng 239).
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 199–205) đặt
  `database/schemaname/tablename = null`, `istablenameInfield = false`,
  `resultfieldname = "result"`; `tablenamefield`/`columnnamefield` KHÔNG
  được set (null). Load thiếu `<resultfieldname>` cho null chứ KHÔNG trả
  về `"result"`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`ColumnExists.processRow()`,
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/columnexists/ColumnExists.java`
  dòng 65–162): mỗi dòng đầu vào xác định bảng — `istablenameInfield`
  thì đọc từ field `indexOfTablename` (dòng 94–129), ngược lại dùng
  `tablename` tĩnh đã substitute (dòng 179); đọc tên cột từ field
  `indexOfColumnname` (dòng 113–137); gọi
  `data.db.checkColumnExists(columnname, tablename)` (dòng 141), gắn
  boolean vào cuối dòng (dòng 143) rồi `putRow` (dòng 146); lỗi DB đi vào
  `putError(..., "ColumnExists001")` (dòng 162). `getFields()` (Meta dòng
  207–216) khai báo trước 1 cột `ValueMetaBoolean(resultfieldname)`.
  `check()` (Meta dòng 283–342): nhánh `istablenameInfield` đòi
  `tablenamefield`, nhánh tĩnh đòi `tablename`; luôn đòi
  `columnnamefield` + `resultfieldname` + connection.
- `getUsedDatabaseConnections()` (Meta dòng 353–360) trả connection đã
  chọn — lineage thấy step này dùng DB.

Cấu hình không mặc định (bảng tĩnh + field cột động + cờ kết quả riêng):

```xml
<connection>${CONN}</connection>
<tablename>EMP</tablename>
<columnnamefield>EMP_ID</columnnamefield>
<resultfieldname>col_exists_flag</resultfieldname>
```

## 5. Lưu ý / bẫy

- **Tên cột LUÔN động**: không có tag `<columnname>` tĩnh và không có tag
  `<valuename>` — template bịa 2 tag này sẽ bị loader bỏ qua lặng lẽ.
  Tên cột cố định phải đi qua field (dùng `Constant` tạo field).
- **Hai chế độ chọn bảng loại trừ nhau**: `istablenameInfield=Y` dùng
  `<tablenamefield>` và BỎ QUA `<tablename>` tĩnh; `=N` thì ngược lại.
  Đặt `Y` mà để `<tablenamefield/>` rỗng là `check()` ERROR.
- **Load thiếu `<resultfieldname>` → null**: `"result"` chỉ là default của
  step MỚI; file thiếu tag sẽ fail `check()` và `getFields()` bỏ qua.
- Mỗi dòng đầu vào = một lần `checkColumnExists` — stream lớn thì lọc/
  distinct cặp (bảng, cột) trước để tránh query lặp.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  có thật, tên bảng/field cột có thật và nối hop đầu vào (`check()` đòi
  `input.length > 0`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
