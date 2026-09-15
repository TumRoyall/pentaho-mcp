# XSDValidator — Step kiểm tra XML theo schema XSD

Với MỖI dòng vào, validate tài liệu XML (từ trường chứa XML hoặc từ file)
theo schema XSD (từ file, từ trường, hoặc bỏ qua) và ghi kết quả vào trường
mới (`<resultfieldname>` — Boolean, hoặc String khi
`<outputstringfield>=Y`) cộng trường thông báo lỗi tùy chọn
(`<validationmsgfield>`). Dòng lỗi đi vào luồng error-handling của step
(`supportsErrorHandling() = true`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XSDValidator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <xdsfilename>${XSD_FILE}</xdsfilename>
    <xmlstream>{{XML_FIELD}}</xmlstream>
    <resultfieldname>result</resultfieldname>
    <addvalidationmsg>N</addvalidationmsg>
    <validationmsgfield>ValidationMsgField</validationmsgfield>
    <ifxmlunvalid/>
    <ifxmlvalid/>
    <outputstringfield>N</outputstringfield>
    <xmlsourcefile>N</xmlsourcefile>
    <xsddefinedfield/>
    <xsdsource>filename</xsdsource>
    <allowExternalEntities>N</allowExternalEntities>
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
| `<xdsfilename>` | Điều kiện | Path file XSD (dùng `${VAR}`) — bắt buộc khi `<xsdsource>=filename`. CHÚ Ý: `xds`, không phải `xsd`. |
| `<xmlstream>` | Y | Tên TRƯỜNG chứa XML cần validate — hoặc path FILE khi `<xmlsourcefile>=Y` (`check()` ERROR khi rỗng). |
| `<resultfieldname>` | Y | Trường kết quả mới: Boolean (mặc định) hoặc String khi `<outputstringfield>=Y`. Mặc định step mới là `result`. |
| `<addvalidationmsg>` | N | `Y` = thêm trường thông báo lỗi; `N` (mặc định). |
| `<validationmsgfield>` | Điều kiện | Tên trường thông báo lỗi; mặc định step mới là `ValidationMsgField`. |
| `<ifxmlunvalid>` | N | Giá trị ghi khi XML KHÔNG hợp lệ (chú ý `unvalid`). Rỗng = mặc định runtime. |
| `<ifxmlvalid>` | N | Giá trị ghi khi XML hợp lệ. Rỗng = mặc định runtime. |
| `<outputstringfield>` | N | `Y` = trường kết quả kiểu String; `N` (mặc định) = Boolean. |
| `<xmlsourcefile>` | N | `Y` = `<xmlstream>` là path file; `N` (mặc định) = tên trường. |
| `<xsddefinedfield>` | Điều kiện | Tên trường chứa XSD — bắt buộc khi `<xsdsource>=fieldname`. |
| `<xsdsource>` | Y | `filename` (mặc định) = XSD từ file; `fieldname` = XSD từ trường; `noneed` = bỏ qua XSD. |
| `<allowExternalEntities>` | N | `Y` = cho phép external entities; `N` (mặc định deploy). Mặc định step mới đọc từ system property. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XSD_VALIDATOR` | `<type>` | `XSDValidator`. |
| `configuration.xsd_file` | `<xdsfilename>` | Dùng `${VAR}`; nhớ `xds`. |
| `configuration.xml_field` | `<xmlstream>` | Tên trường (hoặc file). |
| `configuration.result_field` | `<resultfieldname>` | Mặc định `result`. |
| `configuration.xsd_source` | `<xsdsource>` | `filename`/`fieldname`/`noneed`. |
| `configuration.if_valid/if_invalid` | `<ifxmlvalid>`/`<ifxmlunvalid>` | Chú ý `unvalid`. |

Toàn scalar, không có list — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "XSDValidator", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xsdvalidator/XsdValidatorMeta.java`
  dòng 63–66, category `XSDValidator.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin XML) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `XsdValidatorMeta.getXML()`
  (`.../xsdvalidator/XsdValidatorMeta.java` dòng 273–291) — 12 scalar theo
  thứ tự: `xdsfilename` (dòng 276), `xmlstream`, `resultfieldname`,
  `addvalidationmsg`, `validationmsgfield`, **`ifxmlunvalid` TRƯỚC
  `ifxmlvalid`** (dòng 281–282), `outputstringfield`, `xmlsourcefile`,
  `xsddefinedfield`, `xsdsource`, `allowExternalEntities`. Không có list.
- Deserialization: `loadXML()` (dòng 198–200) gọi `readData()` (dòng
  208–230) — đọc đúng 12 tag trên (dòng 211–224); 3 cờ Y/N thiếu → false.
- Khởi tạo: `setDefault()` (dòng 232–245) — `resultfieldname = "result"`,
  `validationMessageField = "ValidationMsgField"`,
  `xsdSource = "filename"` (`SPECIFY_FILENAME`, dòng 85/243),
  `allowExternalEntities` đọc từ system property
  (dòng 244, mặc định deploy `N`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 247–271) thêm trường kết quả
  (Boolean, hoặc String khi `outputStringField`, dòng 250–261) và — khi
  `addValidationMessage` — trường thông báo String (dòng 265–269).
  `supportsErrorHandling()` = true (dòng 417–419). `check()` (dòng
  341–405) ERROR khi thiếu `xmlstream`, thiếu `resultfieldname`, (mode
  filename) thiếu `xsdFilename`, hoặc thiếu input.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (XSD từ trường, kết quả String, gom message):

```xml
<xdsfilename/>
<xmlstream>ORDER_DOC</xmlstream>
<resultfieldname>IS_VALID</resultfieldname>
<addvalidationmsg>Y</addvalidationmsg>
<validationmsgfield>VALIDATION_ERROR</validationmsgfield>
<ifxmlunvalid>INVALID</ifxmlunvalid>
<ifxmlvalid>VALID</ifxmlvalid>
<outputstringfield>Y</outputstringfield>
<xmlsourcefile>N</xmlsourcefile>
<xsddefinedfield>SCHEMA_DEF</xsddefinedfield>
<xsdsource>fieldname</xsdsource>
<allowExternalEntities>N</allowExternalEntities>
```

Đổi bằng `set_field_path` từng scalar.

## 5. Lưu ý / bẫy — CRITICAL

- **Tag là `xdsfilename`, không phải `xsd…`**: thiếu chữ `s`
  (`getXML()` dòng 276, `readData()` dòng 211) — viết `xsdfilename` load
  thành rỗng lặng lẽ.
- **Tag là `ifxmlunvalid`, không phải `invalid`**: `unvalid`
  (`getXML()` dòng 281) — và thứ tự `ifxmlunvalid` TRƯỚC `ifxmlvalid`.
- **`<xsdsource>` chỉ có 3 giá trị**: `filename`, `fieldname`, `noneed`
  (hằng `SPECIFY_*`, dòng 85–87) — giá trị khác cho hành vi không xác định
  (so sánh `equals(SPECIFY_FILENAME)` ở `check()` dòng 372).
- **`xmlstream` 2 nghĩa**: tên trường (mặc định) hoặc path file khi
  `xmlsourcefile=Y` — nhầm 2 mode là lỗi phổ biến nhất.
- **Y/N chứ không phải true/false** cho 3 cờ — ghi `true` load thành false.
- Template mặc định là khung cấu hình — người dùng phải điền XSD (`${VAR}`,
  không embed path thật) và trường XML có thật trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
