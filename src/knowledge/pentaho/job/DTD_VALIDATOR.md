# DTD_VALIDATOR — Job entry kiểm tra XML theo DTD

Entry điều kiện (`evaluates() = true`): validate một file XML
(`<xmlfilename>`) theo DTD ngoài (`<dtdfilename>`) hoặc DTD nội tại trong
chính file XML (`<dtdintern>=Y`). Hợp lệ → `result = true` (đi nhánh
success); ngược lại `result = false` + `NrErrors`. Mọi path hỗ trợ biến
(substitute khi chạy).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DTD_VALIDATOR</type>
      <attributes/>
      <xmlfilename>${XML_FILE}</xmlfilename>
      <dtdfilename>${DTD_FILE}</dtdfilename>
      <dtdintern>N</dtdintern>
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
| `<dtdfilename>` | Điều kiện | Path file DTD ngoài (dùng `${VAR}`) — bắt buộc khi `<dtdintern>=N`. Bỏ qua khi `Y`. |
| `<dtdintern>` | N | `Y` = DTD nằm nội tại trong file XML; `N` (mặc định) = DTD ngoài. Y/N, thiếu tag → false. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DTD_VALIDATOR` | `<type>` | `DTD_VALIDATOR`. |
| `configuration.xml_file` | `<xmlfilename>` | Dùng `${VAR}`. |
| `configuration.dtd_file` | `<dtdfilename>` | Dùng `${VAR}`; bỏ qua khi internal. |
| `configuration.dtd_internal` | `<dtdintern>` | Boolean → Y/N, mặc định N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@JobEntry(id = "DTD_VALIDATOR", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/job/entries/dtdvalidator/JobEntryDTDValidator.java`
  dòng 63–66, category `DTD_VALIDATOR.Category`). KHÔNG nằm trong
  `engine/.../kettle-job-entries.xml` (plugin XML) — annotation là evidence
  đăng ký, serializer dưới đây mới là XML evidence.
- Serialization: `JobEntryDTDValidator.getXML()`
  (`.../dtdvalidator/JobEntryDTDValidator.java` dòng 88–97) —
  `super.getXML()` rồi đúng thứ tự `xmlfilename`, `dtdfilename`,
  `dtdintern` (Y/N).
- Deserialization: `loadXML()` (dòng 99–111) — `super.loadXML()` rồi đọc 3
  tag; `dtdintern` Y/N thiếu → false.
- Khởi tạo: constructor (dòng 72–77) đặt 2 filename null, `dtdintern`
  false; không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime (`JobEntryDTDValidator.execute()`, dòng 145–175):
  `evaluates()` = true (dòng 177–179) — entry điều kiện, rẽ nhánh theo
  `result`. `dtdintern` true → `validator.setInternDTD(true)` (dòng
  156–158), ngược lại validate theo file DTD ngoài (dòng 159–163);
  fail → `result = false` + `NrErrors` + log (dòng 166–172). `check()`
  (dòng 218–226) đòi cả 2 path non-blank và tồn tại.

Cấu hình không mặc định (DTD nội tại):

```xml
<xmlfilename>${XML_DIR}/order.xml</xmlfilename>
<dtdfilename/>
<dtdintern>Y</dtdintern>
```

## 5. Lưu ý / bẫy

- **Entry điều kiện, không phải action**: `result` true/false rẽ nhánh hop
  success/failure — file lỗi DTD là `result = false`, KHÔNG ném exception
  dừng job (trừ khi hop failure xử lý).
- **`dtdintern=Y` bỏ qua `<dtdfilename>`**: để tag rỗng, đừng trỏ file thừa
  gây nhầm lẫn (runtime không đọc nó ở mode này).
- **Y/N chứ không phải true/false** — ghi `true` load thành false lặng lẽ.
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`, không embed path tuyệt đối của máy dev).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
