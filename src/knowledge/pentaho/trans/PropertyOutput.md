# PropertyOutput — Step ghi cặp key/value ra file .properties

Với MỖI dòng vào, ghi cặp (`<keyfield>`, `<valuefield>`) ra file
`.properties` (`<file>/<name>` + `<extention>` — giữ typo thiếu `s`),
kèm comment đầu file (`<comment>`). Tên file có thể tĩnh hoặc lấy từ trường
(`<fileNameInField>=Y` + `<fileNameField>`), tên file tự thêm
stepnr/partnr/ngày/giờ. Step OUTPUT thuần — không thêm trường nào vào dòng
(không override `getFields`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PropertyOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <keyfield>{{KEY_FIELD}}</keyfield>
    <valuefield>{{VALUE_FIELD}}</valuefield>
    <comment>{{COMMENT}}</comment>
    <fileNameInField>N</fileNameInField>
    <fileNameField/>
    <file>
      <name>${PROP_FILE}</name>
      <extention>properties</extention>
      <split>N</split>
      <haspartno>N</haspartno>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <create_parent_folder>N</create_parent_folder>
      <addtoresult>N</addtoresult>
      <append>N</append>
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
| `<keyfield>` | Y | Tên trường dòng chứa KEY property. |
| `<valuefield>` | Y | Tên trường dòng chứa VALUE property. |
| `<comment>` | N | Comment ghi đầu file .properties. |
| `<fileNameInField>` | N | `Y` = tên file lấy từ trường `<fileNameField>`; `N` (mặc định) = dùng `<file>/<name>`. |
| `<fileNameField>` | Điều kiện | Tên trường chứa tên file khi dynamic. |
| `<file>/<name>` | Điều kiện | Path file (không đuôi, dùng `${VAR}`); đuối ở `<extention>`. |
| `<file>/<extention>` | N | Đuôi file, thường `properties`. CHÚ Ý thiếu chữ `s`. |
| `<file>/<split>` / `<haspartno>` | N | `Y` = thêm stepnr/partnr vào tên file; `N` (mặc định). |
| `<file>/<add_date>` / `<add_time>` | N | `Y` = thêm ngày (`yyyMMdd`)/giờ (`HHmmss`) vào tên file. |
| `<file>/<create_parent_folder>` | N | `Y` = tự tạo thư mục cha. |
| `<file>/<addtoresult>` | N | `Y` = đưa file vào result. CHÚ Ý chữ thường (read `AddToResult`, vô hại nhờ match hoa-thường). |
| `<file>/<append>` | N | `Y` = nối vào file; `N` (mặc định) = ghi đè. |

Thứ tự tên file build (`buildFilename`, dòng 318–346): base + `_yyyMMdd`
+ `_HHmmss` + `_stepnr` + `.extention`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PROPERTY_OUTPUT` | `<type>` | `PropertyOutput`. |
| `configuration.key_field/value_field` | `<keyfield>`/`<valuefield>` | Trường dòng có thật. |
| `configuration.file` | `<file>/<name>` | `${VAR}`, không đuôi. |
| `configuration.extension` | `<file>/<extention>` | Nhớ typo thiếu `s`. |

`<file>` là block đơn (không lặp) — đổi con bằng `set_field_path`
(`file/<tag>`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 64 —
  `<step id="PropertyOutput">` →
  `org.pentaho.di.trans.steps.propertyoutput.PropertyOutputMeta`
  (category Output). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `PropertyOutputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/propertyoutput/PropertyOutputMeta.java`
  dòng 386–412) — thứ tự `keyfield`, `valuefield`, `comment` (dòng
  391–393), `fileNameInField`, `fileNameField` (dòng 395–396), rồi block
  `<file>` với `name`, `extention` (thiếu `s`, dòng 400), `split`,
  `haspartno`, `add_date`, `add_time`, `create_parent_folder`,
  `addtoresult` (thường, dòng 407), `append` (dòng 399–408). Không có
  `<fields>`.
- Deserialization: `loadXML()` (dòng 107–109) gọi `readData()` (dòng
  348–373) — đọc `file/AddToResult` (hoa, dòng 364) trong khi `getXML()`
  ghi `addtoresult` (thường): VÔ HẠI (match hoa-thường); cờ Y/N thiếu →
  false.
- Khởi tạo: `setDefault()` (dòng 376–383) — `append`/`createparentfolder`
  false, key/value/comment null; không có `setDefault()` cho tên file.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: step OUTPUT thuần (không override `getFields`) —
  dòng đi qua giữ nguyên, tác dụng phụ duy nhất là file. Thứ tự build tên
  file: base, ngày, giờ, stepnr, rồi `.extention` (dòng 318–346).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (append + tạo thư mục cha):

```xml
<keyfield>PROP_KEY</keyfield>
<valuefield>PROP_VALUE</valuefield>
<comment>Generated by ETL</comment>
<file>
  <name>${PROP_DIR}/app-config</name>
  <extention>properties</extention>
  <create_parent_folder>Y</create_parent_folder>
  <addtoresult>N</addtoresult>
  <append>Y</append>
</file>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag `extention` thiếu `s`** (cả ghi dòng 400 lẫn đọc dòng 359) — viết
  `extension` đúng chính tả lại là SAI (tag lạ bị bỏ qua, đuôi thành null
  → file không đuôi).
- **`<file>` là block đơn, không lặp** — khác họ file-input (nhiều file);
  step này MỖI instance một file (muốn nhiều file dùng tên động).
- **Step không đổi schema**: không `getFields` — downstream thấy nguyên
  dòng vào; đừng mong cột mới xuất hiện.
- **Ghi đè mặc định**: `append=N` — chạy lại transformation ghi đè file cũ
  lặng lẽ.
- Template mặc định là khung cấu hình — người dùng phải điền 2 trường key/
  value có thật và file ra (`${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
