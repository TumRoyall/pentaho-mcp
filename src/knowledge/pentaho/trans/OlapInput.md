# OlapInput — Step truy vấn OLAP qua XMLA

Chạy câu MDX lên server OLAP qua giao thức XMLA (driver olap4j cố định
trong code, KHÔNG serialize). Kết nối là 4 chuỗi thuần `url`/`username`/
`password` (mã hóa)/`catalog` — KHÔNG có `<connection>` DB nên fixture
không cần khai báo connection. `variables_active=Y` cho phép substitute
`${VAR}` trong url/user/pass/catalog (MDX chỉ substitute khi flag bật,
qua `initData`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OlapInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <url>${OLAP_URL}</url>
    <username>${OLAP_USER}</username>
    <password>Encrypted ${OLAP_PASS}</password>
    <mdx>SELECT {[Measures].[Sales]} ON COLUMNS FROM [Sales]</mdx>
    <catalog>${CATALOG}</catalog>
    <variables_active>N</variables_active>
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
| `<url>` | Y | URL endpoint XMLA; luôn dùng `${VAR}`, không embed host thật. |
| `<username>` | N | User OLAP; luôn dùng `${VAR}`. |
| `<password>` | N | Password (mã hóa); luôn dùng `${VAR}`. |
| `<mdx>` | Y | Câu MDX; giữ NGUYÊN VĂN (XML-escape `<`/`&`). |
| `<catalog>` | N | Catalog OLAP; cho phép `${VAR}`. |
| `<variables_active>` | N | `Y` = substitute `${VAR}` trước khi chạy; `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: OLAP_INPUT` | `<type>` | `OlapInput`. |
| `configuration.url` | `<url>` | Placeholder `${VAR}`. |
| `configuration.username` | `<username>` | Placeholder `${VAR}`. |
| `configuration.password` | `<password>` | Placeholder `${VAR}` (mã hóa). |
| `configuration.mdx` | `<mdx>` | MDX nguyên văn, XML-escape. Chú ý thứ tự EMIT là `mdx` trước `catalog`. |
| `configuration.catalog` | `<catalog>` | Cho phép `${VAR}`. |
| `configuration.variables_active` | `<variables_active>` | Boolean → Y/N (so sánh case-SENSITIVE khi load). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 57 —
  `<step id="OlapInput">` →
  `org.pentaho.di.trans.steps.olapinput.OlapInputMeta` (category Input).
  Registry presence không phải XML evidence, evidence là serializer dưới
  đây.
- Serialization: `OlapInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/olapinput/OlapInputMeta.java`
  dòng 160–172) — đúng thứ tự `url`, `username`, `password` (mã hóa qua
  `Encr.encryptPasswordIfNotUsingVariables`, dòng 165–166), `mdx`,
  `catalog`, `variables_active` (Y/N). Chú ý thứ tự ĐỌC khác thứ tự GHI
  (đọc `catalog` trước `mdx`).
- Deserialization: `loadXML()` (dòng 90–92) gọi `readData()` (dòng
  100–112) — `password=Encr.decryptPasswordOptionallyEncrypted(...)`
  (chịu null/`${VAR}`); **BẪY**: `variableReplacementActive="Y".equals(...)`
  case-SENSITIVE (như MondrianInput) — `y` thường → false. Driver là
  const `olap4jDriver="org.olap4j.driver.xmla.XmlaOlap4jDriver"` (dòng
  64), không bao giờ serialize — đừng bịa tag driver.
- Khởi tạo: `setDefault()` (dòng 115–133) — `url="http://localhost:8080/pentaho/Xmla"`,
  `username="joe"`, `password="password"`, `catalog="SampleData"`,
  `mdx` = MDX Quadrant Analysis mẫu, `variableReplacementActive=false`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 136–157) chạy query thật qua
  `initData()` (dòng 305–339: substitute url/user/pass/catalog, MDX chỉ
  khi flag bật) — cần server thật nên không test runtime ở đây.
  `createRowMeta()` (dòng 235–252) đặt tên cột từ header hoặc
  `Column+i`, tất cả String. `check()` (dòng 206–214) là TODO no-op.
- Không có `<connection>`: kết nối là strings thuần — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (variable substitution + catalog):

```xml
<url>${OLAP_URL}</url>
<username>${OLAP_USER}</username>
<password>Encrypted ${OLAP_PASS}</password>
<mdx>SELECT {[Measures].[${MEASURE}]} ON COLUMNS FROM [${CUBE}]</mdx>
<catalog>${CATALOG}</catalog>
<variables_active>Y</variables_active>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Không bịa tag driver/connection**: driver cố định trong code, kết
  nối là 4 strings — template chỉ có đúng 6 tag trên.
- **`variables_active` case-sensitive**: chỉ `Y` hoa mới true.
- **Thứ tự emit `mdx` trước `catalog`** — giữ đúng order khi assert.
- **Credential/host luôn `${VAR}`**: không embed URL/user/pass thật.
- **XML-escape MDX** (`<`, `&`).
- Template mặc định là khung cấu hình — người dùng phải điền endpoint,
  MDX nghiệp vụ và credential (qua biến); cần server XMLA lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
