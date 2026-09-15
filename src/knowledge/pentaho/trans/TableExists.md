# TableExists — Step kiểm tra bảng có tồn tại

Đọc từng dòng đầu vào, lấy tên bảng từ một FIELD của stream
(`<tablenamefield>`), gọi `checkTableExists` trên connection đã chọn rồi
gắn thêm một cột boolean (`<resultfieldname>`) vào cuối dòng và truyền đi.
Không có tên bảng tĩnh trong step này — muốn kiểm tra một bảng cố định thì
đưa tên bảng vào stream bằng `Constant`/`DataGrid` (field) rồi trỏ
`<tablenamefield>` tới field đó.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TableExists</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <tablenamefield>{{TABLE_NAME_FIELD}}</tablenamefield>
    <resultfieldname>result</resultfieldname>
    <schemaname>${SCHEMA}</schemaname>
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
| `<tablenamefield>` | Y | TÊN FIELD của stream đầu vào chứa tên bảng cần kiểm tra (dynamic, không phải tên bảng tĩnh). `check()` báo ERROR khi rỗng. |
| `<resultfieldname>` | Y | Tên cột boolean gắn thêm vào mỗi dòng (`true` = bảng tồn tại). Mặc định step mới: `result`. `check()` báo ERROR khi rỗng. |
| `<schemaname>` | N | Schema chứa bảng (hỗ trợ biến, substitute ở `init()`); để trống/null khi DB không dùng schema. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TABLE_EXISTS` | `<type>` | `TableExists`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.table_name_field` | `<tablenamefield>` | Tên field trong stream, KHÔNG phải tên bảng. |
| `configuration.result_field` | `<resultfieldname>` | Cột boolean output; mặc định `result`. |
| `configuration.schema` | `<schemaname>` | Cho phép `${VAR}`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 67 —
  `<step id="TableExists">` →
  `org.pentaho.di.trans.steps.tableexists.TableExistsMeta` (category
  Lookup). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `TableExistsMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/tableexists/TableExistsMeta.java`
  dòng 156–165) — đúng 4 tag theo thứ tự `connection` (= tên
  `DatabaseMeta`, `""` khi null), `tablenamefield`, `resultfieldname`,
  `schemaname`. Không có tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 129–131) gọi `readData()` (dòng
  167–179) — `connection` resolve qua `DatabaseMeta.findDatabase`;
  3 tag còn lại đọc nguyên văn, thiếu tag → null.
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 139–143) đặt
  `database = null`, `schemaname = null`, `resultfieldname = "result"`;
  `tablenamefield` KHÔNG được set (null). Load thiếu tag
  `<resultfieldname>` cho null chứ KHÔNG trả về `"result"` — template pin
  `result` theo `setDefault()`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`TableExists.processRow()`,
  `engine/src/main/java/org/pentaho/di/trans/steps/tableexists/TableExists.java`
  dòng 65–123): mỗi dòng đầu vào đọc tên bảng từ field
  `indexOfTablename` (dòng 87–99), gọi
  `data.db.checkTableExists(data.realSchemaname, tablename)` (dòng 102),
  gắn boolean vào cuối dòng qua `RowDataUtil.addValueData` (dòng 104) rồi
  `putRow` (dòng 107); lỗi DB đi vào `putError(..., "TableExistsO01")`
  (dòng 123). Schema được `environmentSubstitute` ở `init()` (dòng 143).
  `getFields()` (Meta dòng 145–154) khai báo trước 1 cột
  `ValueMetaBoolean(resultfieldname)` — output = input rows + 1 cột
  boolean. `check()` (Meta dòng 212–254) đòi connection, result field,
  table field và có input.
- `getUsedDatabaseConnections()` (Meta dòng 265–271) trả connection đã
  chọn — lineage thấy step này dùng DB.

Cấu hình không mặc định (field động + schema + connection):

```xml
<connection>${CONN}</connection>
<tablenamefield>SRC_TABLE</tablenamefield>
<resultfieldname>table_exists_flag</resultfieldname>
<schemaname>${SCHEMA}</schemaname>
```

## 5. Lưu ý / bẫy

- **`<tablenamefield>` là tên FIELD, không phải tên bảng**: step không có
  tag `<tablename>` tĩnh — template bịa tag này sẽ bị loader bỏ qua lặng
  lẽ (không đọc trong `readData()`). Bảng cố định phải đi qua field
  (dùng `Constant`/`DataGrid` tạo field rồi trỏ tới).
- **Load thiếu `<resultfieldname>` → null, không phải `"result"`**:
  `"result"` chỉ là default của step MỚI (`setDefault()`); file thiếu tag
  (tay sửa/xóa) sẽ fail `check()` và `getFields()` bỏ qua không thêm cột.
- `<schemaname>` rỗng/null là hợp lệ (DB không schema); nhưng
  `<connection>` null thì `check()` ERROR và runtime không chạy.
- Mỗi dòng đầu vào = một lần `checkTableExists` — stream lớn thì cân nhắc
  lọc/distinct trước để tránh query lặp.
- Template mặc định là khung cấu hình, chưa gắn connection/step nguồn
  nghiệp vụ cụ thể — người dùng phải điền tên connection có thật và nối
  hop đầu vào (step cần input, `check()` đòi `input.length > 0`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
