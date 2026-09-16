# ShapeFileReader — Step đọc GIS shapefile

Step nguồn KHÔNG nhận input (`check()` ERROR khi có input): đọc cặp file
GIS `.shp` + `.dbf` (3 tag lowercase `shapefilename`, `dbffilename`,
`encoding`, cho phép `${VAR}`) và phát mỗi shape/point thành dòng.
`getFields()` thêm 10 cột cố định (filename, filetype, shapenr, partnr,
nrparts, pointnr, nrpointS — giữ `S` hoa, x, y, measure) rồi mở DBF qua
`XBase` (áp `encoding` khi non-blank, strip prefix `file:`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ShapeFileReader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <shapefilename>${SHAPE_FILE}</shapefilename>
    <dbffilename>${DBF_FILE}</dbffilename>
    <encoding>UTF-8</encoding>
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
| `<shapefilename>` | Y | Đường dẫn file `.shp` (thường, không camel); cho phép `${VAR}`. `check()` ERROR khi null/rỗng. |
| `<dbffilename>` | Y | Đường dẫn file `.dbf` đi kèm; cho phép `${VAR}`. |
| `<encoding>` | N | Encoding đọc DBF (áp khi non-blank); ví dụ `UTF-8`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SHAPE_FILE_READER` | `<type>` | `ShapeFileReader`. |
| `configuration.shape_file` | `<shapefilename>` | Giữ đúng thường toàn bộ. |
| `configuration.dbf_file` | `<dbffilename>` | Giữ đúng thường toàn bộ. |
| `configuration.encoding` | `<encoding>` | Giữ đúng thường toàn bộ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="ShapeFileReader", ...)`
  (`plugins/shapefilereader/core/src/main/java/org/pentaho/di/shapefilereader/ShapeFileReaderMeta.java`
  dòng 61–67; package `org.pentaho.di.shapefilereader`). Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `ShapeFileReaderMeta.getXML()` (dòng 248–256) — đúng
  3 tag lowercase `shapefilename`, `dbffilename`, `encoding` (string, vô
  điều kiện, dòng 251–253).
- Deserialization: `readData()` (dòng 142–150, qua `loadXML` chữ ký cũ
  dòng 131–134) — 3×`getTagValue` (thiếu → null); try →
  `KettleXMLException` (dòng 147–149).
- Khởi tạo: `setDefault()` (dòng 152–156) — `"", "", " "` (empty-string,
  khác null).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 158–246, chữ ký cũ) thêm 10 cột
  cố định (`filename` String 255, `filetype` String 50, `shapenr` int,
  `partnr` int, `nrparts` int, `pointnr` int, `nrpointS` int — giữ `S`
  hoa dòng 193, `x`/`y`/`measure` number) rồi mở DBF qua `XBase` (dòng
  222–242; áp `encoding` khi `StringUtils.isNotBlank` dòng 228–230; strip
  prefix `file:` dòng 217–219); `dbFilename==null` → `KettleStepException`
  ("no filename specfied" — giữ typo gốc, dòng 244). `check()` (dòng
  280–301) ERROR khi có input (không nhận input), ERROR khi shape/dbf
  null/rỗng.
- Không có `<connection>`: step chỉ đọc file — template không mang tag
  này, fixture test không cần khai báo connection.

Cấu hình không mặc định (file districts + encoding):

```xml
<shapefilename>${GIS_DIR}/districts.shp</shapefilename>
<dbffilename>${GIS_DIR}/districts.dbf</dbffilename>
<encoding>UTF-8</encoding>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag lowercase toàn bộ**: `shapefilename`, `dbffilename`, `encoding` —
  viết camel (`shapeFileName`) là sai tag, load bỏ qua.
- **Không nhận input** — nối hop vào là `check()` ERROR.
- **Cần CẶP .shp + .dbf khớp nhau**: thiếu một trong hai là fail lúc
  runtime (check + `getFields` đều đòi).
- **Cột `nrpointS` giữ `S` hoa** — downstream SELECT * theo tên phải giữ
  đúng case.
- Template mặc định là khung cấu hình — người dùng phải điền file GIS có
  thật (qua biến); không embed đường dẫn tuyệt đối máy cá nhân.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
