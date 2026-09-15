# XSD_VALIDATOR — Job entry kiểm tra XML theo schema XSD

Entry điều kiện (`evaluates() = true`): validate một file XML
(`<xmlfilename>`) theo schema XSD (`<xsdfilename>`) bằng JAXP
(`SchemaFactory` W3C XML Schema). Hợp lệ → `result = true` (đi nhánh
success); thiếu file, lỗi parse hoặc sai schema → `result = false` +
`NrErrors = 1`. Cờ `<allowExternalEntities>` kiểm soát XEE protection.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>XSD_VALIDATOR</type>
      <attributes/>
      <xmlfilename>${XML_FILE}</xmlfilename>
      <xsdfilename>${XSD_FILE}</xsdfilename>
      <allowExternalEntities>N</allowExternalEntities>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<xmlfilename>` | Y | Path file XML cần validate (dùng `${VAR}`; substitute khi chạy). `check()` đòi non-blank + tồn tại. |
| `<xsdfilename>` | Y | Path file schema XSD (dùng `${VAR}`; substitute khi chạy). `check()` đòi non-blank + tồn tại. |
| `<allowExternalEntities>` | N | `Y` = cho phép external entities (tắt XEE protection); `N` (mặc định deploy) = chặn doctype/external entities. Y/N, thiếu tag → false. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XSD_VALIDATOR` | `<type>` | `XSD_VALIDATOR`. |
| `configuration.xml_file` | `<xmlfilename>` | Dùng `${VAR}`. |
| `configuration.xsd_file` | `<xsdfilename>` | Dùng `${VAR}`. |
| `configuration.allow_external_entities` | `<allowExternalEntities>` | Boolean → Y/N, mặc định N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@JobEntry(id = "XSD_VALIDATOR", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xsdvalidator/JobEntryXSDValidator.java`
  dòng 77–80, category `XSD_VALIDATOR.Category`). KHÔNG nằm trong
  `engine/.../kettle-job-entries.xml` (plugin XML) — annotation là evidence
  đăng ký, serializer dưới đây mới là XML evidence.
- Serialization: `JobEntryXSDValidator.getXML()`
  (`.../xsdvalidator/JobEntryXSDValidator.java` dòng 107–116) —
  `super.getXML()` rồi đúng thứ tự `xmlfilename`, `xsdfilename`,
  `allowExternalEntities` (Y/N).
- Deserialization: `loadXML()` (dòng 118–129) — `super.loadXML()` rồi đọc 3
  tag; `allowExternalEntities` Y/N thiếu → false.
- Khởi tạo: constructor (dòng 91–96) đặt 2 filename null,
  `allowExternalEntities` đọc từ system property (mặc định deploy false);
  không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime (`JobEntryXSDValidator.execute()`, dòng 164–260):
  `evaluates()` = true (dòng 262–264). Cả 2 file phải tồn tại (dòng
  176–225, thiếu → `result = false` + `NrErrors = 1`); validate qua
  `javax.xml.validation.Validator` (dòng 188–208); `SAXException`/lỗi khác
  → `result = false` (dòng 233–243). Khi `allowExternalEntities=N`,
  runtime chặn doctype + external entities chống XEE (dòng 192–201).
  `check()` (dòng 303–311) đòi cả 2 path non-blank và tồn tại.

Cấu hình không mặc định (cho phép external entities):

```xml
<xmlfilename>${XML_DIR}/order.xml</xmlfilename>
<xsdfilename>${XSD_DIR}/order.xsd</xsdfilename>
<allowExternalEntities>Y</allowExternalEntities>
```

## 5. Lưu ý / bẫy

- **Entry điều kiện, không phải action**: `result` true/false rẽ nhánh hop
  success/failure — XML sai schema là `result = false`, KHÔNG ném exception.
- **Mặc định chặn external entities**: `N` là default an toàn (chống XEE) —
  chỉ đặt `Y` khi schema/XML thật sự cần external DTD/schema và nguồn tin
  cậy.
- **Phân biệt step trans `XSDValidator`**: step trans validate từng DÒNG
  (field chứa XML), entry job này validate FILE — khác input, khác tag
  (`xdsfilename` ở step vs `xsdfilename` ở job).
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`, không embed path tuyệt đối của máy dev).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
