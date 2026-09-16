# MondrianInput — Step truy vấn Mondrian (MDX qua DB)

Chạy câu MDX trên schema Mondrian thông qua một DB connection đã khai
báo (`<connection>` THAM CHIẾU theo tên — fixture PHẢI khai báo
`<connection><name>${CONN}</name></connection>`), kèm `catalog` và `role`
tùy chọn. Output schema = kết quả MDX hình chữ nhật (set origin từng
cột). Flag `variables_active=Y` cho phép substitute `${VAR}` trong MDX.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MondrianInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <sql>SELECT {[Measures].[Sales]} ON COLUMNS FROM [Sales]</sql>
    <catalog>${CATALOG}</catalog>
    <role/>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `getFields()` return lặng lẽ khi null; `check()` ERROR. |
| `<sql>` | Y | Câu MDX; giữ NGUYÊN VĂN (XML-escape `<`/`&`). |
| `<catalog>` | N | Mondrian catalog/schema; cho phép `${VAR}`. |
| `<role>` | N | Role Mondrian; trống = không áp role. |
| `<variables_active>` | N | `Y` = substitute `${VAR}` trong MDX trước khi chạy; `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MONDRIAN_INPUT` | `<type>` | `MondrianInput`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.sql` | `<sql>` | MDX nguyên văn, XML-escape. |
| `configuration.catalog` | `<catalog>` | Cho phép `${VAR}`. |
| `configuration.role` | `<role>` | Chuỗi rỗng = không role. |
| `configuration.variables_active` | `<variables_active>` | Boolean → Y/N (so sánh case-SENSITIVE khi load). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="MondrianInput", ...)`
  (`plugins/mondrianinput/impl/src/main/java/org/pentaho/di/trans/steps/mondrianinput/MondrianInputMeta.java`
  dòng 64–69). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `MondrianInputMeta.getXML()` (dòng 193–204) — đúng thứ
  tự `connection` (tên DB, `""` khi null), `sql`, `catalog`, `role`,
  `variables_active` (Y/N), tất cả vô điều kiện.
- Deserialization: `loadXML()` (dòng 127–129) gọi `readData()` (dòng
  136–146) — `databaseMeta=DatabaseMeta.findDatabase(databases,
  getTagValue("connection"))` (tên lạ → null, không throw);
  `sql/catalog/role=getTagValue` (thiếu → null); **BẪY**:
  `variableReplacementActive="Y".equals(...)` — so sánh case-SENSITIVE
  (`equals`, không `equalsIgnoreCase`): `y` thường → false, khác với đa
  số step. Bọc try/catch → `KettleXMLException`.
- Khởi tạo: `setDefault()` (dòng 148–157) — `databaseMeta=null`,
  `sql` = MDX Sales mẫu, `variableReplacementActive=false`;
  catalog/role giữ null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 159–191) return lặng lẽ khi
  `databaseMeta==null`; ngược lại mở query qua `MondrianHelper`
  (có cache) và set origin từng cột. `check()` (dòng 236–252) ERROR khi
  thiếu connection. `getUsedDatabaseConnections()` (dòng 269–275) trả
  connection đã chọn — lineage thấy step này dùng DB.
- Có `<connection>`: step tham chiếu DB theo tên — fixture test PHẢI
  khai báo `<connection><name>${CONN}</name></connection>`, nếu không
  validator báo "undefined connection".

Cấu hình không mặc định (role + variable substitution):

```xml
<connection>${CONN}</connection>
<sql>SELECT {[Measures].[${MEASURE}]} ON COLUMNS FROM [Sales] WHERE [Year].[${YEAR}]</sql>
<catalog>${CATALOG}</catalog>
<role>${ROLE}</role>
<variables_active>Y</variables_active>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Fixture PHẢI khai báo connection** (bẫy B2): `<connection>` là tham
  chiếu theo tên — thiếu khai báo, test 0-error FAIL.
- **`variables_active` case-sensitive**: chỉ đúng `Y` hoa mới true —
  `y` thường load thành false (khác Convention `equalsIgnoreCase`).
- **Connection lạ → null lặng lẽ**: `findDatabase` không throw — mở lại
  file thiếu shared connection thấy step mất DB mà không báo khi load.
- **XML-escape MDX**: `WHERE x < y` phải viết `&lt;` — quên → XML hỏng.
  `${VAR}` chỉ substitute khi `variables_active=Y`.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  có thật, MDX nghiệp vụ và catalog; cần DB + Mondrian lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
