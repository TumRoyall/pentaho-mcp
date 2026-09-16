# SQLFileOutput — Step ghi câu lệnh SQL ra file

Step tạo file `.sql` chứa `CREATE TABLE`/`TRUNCATE`/`INSERT` sinh từ các
dòng đầu vào cho bảng (`schema`/`table`) trên dialect của `<connection>`
(chỉ dùng metadata dialect — không nối DB khi chạy). Tùy chọn file lồng
trong block `<file>` (có wrapper). Chú ý typo gốc `extention` (thiếu "s").

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SQLFileOutput</type>
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
    <truncate>N</truncate>
    <create>N</create>
    <encoding>UTF-8</encoding>
    <dateformat>yyyy/MM/dd HH:mm:ss</dateformat>
    <addtoresult>N</addtoresult>
    <startnewline>Y</startnewline>
    <file>
      <name>${SQL_FILE}</name>
      <extention>sql</extention>
      <append>N</append>
      <split>N</split>
      <haspartno>N</haspartno>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <splitevery>0</splitevery>
      <create_parent_folder>N</create_parent_folder>
      <DoNotOpenNewFileInit>N</DoNotOpenNewFileInit>
    </file>
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
| `<connection>` | Y | Tên DB connection — chỉ dùng DIALECT sinh SQL (THAM CHIẾU, fixture phải khai báo). |
| `<schema>` / `<table>` | Y | Schema/bảng đích của câu lệnh sinh ra. |
| `<truncate>` / `<create>` | N | Sinh `TRUNCATE` / `CREATE TABLE` đầu file. |
| `<encoding>` / `<dateformat>` | N | Charset file + format ngày trong VALUES. |
| `<addtoresult>` | N | Thêm file sql vào result files (tag thường hết khi ghi). |
| `<startnewline>` | N | Xuống dòng đầu file (tag thường hết khi ghi). |
| `<file>/<name>` | Y | Đường dẫn file (không đuôi cũng được — đuôi từ `<extention>`). |
| `<file>/<extention>` | N | typo gốc (thiếu "s") — giữ nguyên. |
| `<file>/<append>` / `<split>` / `<haspartno>` / `<add_date>` / `<add_time>` | N | Nối file / tách theo copy / số part / thêm ngày-giờ vào tên. |
| `<file>/<splitevery>` | N | Số dòng mỗi file khi split (int, thiếu → 0). |
| `<file>/<create_parent_folder>` | N | Tự tạo thư mục cha. |
| `<file>/<DoNotOpenNewFileInit>` | N | Không mở file mới khi init (giữ hoa). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SQL_FILE_OUTPUT` | `<type>` | `SQLFileOutput`. |
| `configuration.connection` | `<connection>` | Tham chiếu (dialect). |
| `configuration.schema` / `configuration.table` | `<schema>` / `<table>` | Cho phép `${VAR}`. |
| `configuration.truncate` / `create_table` | `<truncate>` / `<create>` | Boolean → Y/N. |
| `configuration.file_name` | `<file>/<name>` | `${VAR}`; setFieldPath `file/name`. |
| `configuration.file_append` | `<file>/<append>` | Boolean → Y/N. |

Block `<file>` là wrapper cố định (không phải list) — fill từng con bằng
`setFieldPath` (`file/name`, `file/append`, …).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 60 —
  `<step id="SQLFileOutput">` →
  `org.pentaho.di.trans.steps.sqlfileoutput.SQLFileOutputMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `SQLFileOutputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/sqlfileoutput/SQLFileOutputMeta.java`
  dòng 491–521) — thứ tự `connection`, `schema`, `table`, `truncate`,
  `create`, `encoding`, `dateformat`, `addtoresult` (thường hết, dòng
  502), `startnewline` (thường hết, dòng 504), rồi block `<file>` (dòng
  506–518) với `name`, `extention` (typo, dòng 508), `append`, `split`,
  `haspartno`, `add_date`, `add_time`, `splitevery`, `create_parent_folder`,
  `DoNotOpenNewFileInit`.
- Deserialization: `readData()` (dòng 450–481, qua `loadXML()` dòng
  118+) — đọc `AddToResult`/`StartNewLine` (hoa, dòng 461, 463) trong khi
  `getXML()` ghi thường (dòng 502, 504) — khớp case-insensitive nên round-trip
  OK; `splitevery` qua `Const.toInt(..., 0)` (dòng 474); các con của
  `<file>` đọc qua `getTagValue(stepnode, "file", subtag)` (dòng 465–476).
- Khởi tạo: `setDefault()` (dòng 483–489) RẤT MỎNG — chỉ `tablename=""`,
  `createparentfolder=false`, `DoNotOpenNewFileInit=false`; còn lại
  null/false Java.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (tạo bảng + truncate + append file):

```xml
<truncate>Y</truncate>
<create>Y</create>
<file>
  <name>${SQL_FILE}</name>
  <extention>sql</extention>
  <append>Y</append>
  <split>N</split>
  <haspartno>N</haspartno>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <splitevery>0</splitevery>
  <create_parent_folder>Y</create_parent_folder>
  <DoNotOpenNewFileInit>N</DoNotOpenNewFileInit>
</file>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2) — dù step không
  nối DB khi chạy, validator vẫn đòi connection tồn tại.
- **`extention` giữ nguyên typo**: cả ghi (dòng 508) lẫn đọc (dòng 468)
  đều `extention` — sửa thành `extension` sẽ mất đuôi file lặng lẽ.
- **Case lệch `addtoresult`/`startnewline`**: `getXML()` ghi thường,
  `readData()` đọc hoa — round-trip OK nhờ case-insensitive, template giữ
  chữ thường như `getXML()` emit.
- **`setDefault()` gần như rỗng**: đừng trông chờ default — template ghi
  đủ tag.
- Template mặc định là khung cấu hình — người dùng phải nối hop có dòng
  vào và điền connection/bảng/file; không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan) — không tuyên bố hai mức này.
