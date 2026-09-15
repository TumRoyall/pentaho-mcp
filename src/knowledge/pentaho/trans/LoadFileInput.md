# LoadFileInput — Step nạp toàn bộ nội dung file vào dòng

Đọc mỗi file thành MỘT HOẶC NHIỀU dòng mang nội dung (`element_type`
`content`) hoặc kích thước (`size`): mỗi `<fields>/<field>` chọn một trong
hai. Khác `FixedInput` (cắt cột) và `getXMLData` (parse cấu trúc) — step này
không parse gì, chỉ nạp bytes. `getFields()` XOÁ row cũ khi KHÔNG ở mode
trường vào (`r.clear()`, chỉ giữ các trường mới).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>LoadFileInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <addresultfile>Y</addresultfile>
    <IsIgnoreEmptyFile>N</IsIgnoreEmptyFile>
    <IsIgnoreMissingPath>N</IsIgnoreMissingPath>
    <rownum_field/>
    <encoding></encoding>
    <file>
      <name>${INPUT_FILE}</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{OUTPUT_FIELD}}</name>
        <element_type>content</element_type>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <IsInFields>N</IsInFields>
    <DynamicFilenameField/>
    <shortFileFieldName/>
    <pathFieldName/>
    <hiddenFieldName/>
    <lastModificationTimeFieldName/>
    <uriNameFieldName/>
    <rootUriNameFieldName/>
    <extensionFieldName/>
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
| `<file>/<name>` | Điều kiện | File cần nạp (dùng `${VAR}`); nhiều file = lặp bộ 5 tag flat. Bỏ qua khi `IsInFields=Y`. |
| `<filemask>` / `<exclude_filemask>` | N | Regex lọc/bỏ file. |
| `<file_required>` / `<include_subfolders>` | N | Y/N từng file. |
| `<fields>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Tên trường ra. |
| `<element_type>` | Y | `content` (nội dung file) hoặc `size` (kích thước). |
| `<type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`size` thường `Integer`). |
| `<trim_type>` | N | `none`/`left`/`right`/`both`. |
| `<repeat>` | N | Y/N — template ghi tường minh (thiếu tag load thành `Y` như getXMLData). |
| `<length>` / `<precision>` | N | Số; thiếu → `-1`. |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định) = không giới hạn. |
| `<IsInFields>` / `<DynamicFilenameField>` | N | `Y` = lấy tên file từ trường vào; `N` (mặc định) = đọc `<file>`. |
| `<encoding>` | N | Encoding đọc file; mặc định step mới là RỖNG (= mặc định hệ thống). |
| `<addresultfile>` | N | `Y` (mặc định step mới) = đưa file vào result. |
| `<include>`/`<include_field>`, `<rownum>`/`<rownum_field>` | N | Trường phụ tên file / số dòng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: LOAD_FILE_INPUT` | `<type>` | `LoadFileInput`. |
| `configuration.files[].path` | `<file>/<name>` | `${VAR}`; bộ 5 tag flat. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Trường ra. |
| `configuration.fields[].element` | `<element_type>` | `content`/`size`. |

`<fields>` → `set_fields` (`listTag=fields`, `itemTag=field`); `<file>`
flat viết lặp tay.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 111 —
  `<step id="LoadFileInput">` →
  `org.pentaho.di.trans.steps.loadfileinput.LoadFileInputMeta` (category
  Input). Registry presence không phải XML evidence, evidence là serializer
  dưới đây.
- Serialization: `LoadFileInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/loadfileinput/LoadFileInputMeta.java`
  dòng 616–658) — thứ tự `include`, `include_field`, `rownum`,
  `addresultfile`, `IsIgnoreEmptyFile`, `IsIgnoreMissingPath`,
  `rownum_field`, `encoding` (dòng 619–627), `<file>` LUÔN emit (dòng
  629/637) chứa các BỘ 5 tag flat `name/filemask/exclude_filemask/
  file_required/include_subfolders` (dòng 631–635), `<fields>` (dòng
  639/644), rồi `limit`, `IsInFields`, `DynamicFilenameField` và 7 tên
  trường phụ (dòng 645–656). `LoadFileInputField.getXML()`
  (`.../loadfileinput/LoadFileInputField.java` dòng 95–114) — thứ tự
  `name`, `element_type`, `type`, `format`, `currency`, `decimal`,
  `group`, `length`, `precision`, `trim_type`, `repeat` (dòng 99–109).
- Enum: `ElementTypeCode = { "content", "size" }`
  (`LoadFileInputField.java` dòng 59; mặc định ctor `content`, dòng 79).
- Deserialization: `loadXML()` (dòng 591–593) gọi `readData()` (dòng
  660–717) — cờ Y/N thiếu → false; `limit` `toLong(..., 0L)` (dòng 700);
  `length`/`precision` thiếu → `-1`; `repeat` thiếu → TRUE (dòng 127,
  cùng họ getXMLData).
- Khởi tạo: `setDefault()` (dòng 729–768) — `encoding = ""`,
  **`addresultfile = true`**, còn lại false/rỗng, 0 file/field.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 770–788+) gọi `r.clear()`
  khi KHÔNG ở mode trường vào (dòng 772–774) — step XOÁ schema cũ, output
  chỉ gồm các trường mới (+ phụ). `size` ép kiểu Integer khi type NONE
  (dòng 786–788).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (nội dung + kích thước):

```xml
<file>
  <name>${INPUT_DIR}/report.pdf</name>
  <filemask/>
  <exclude_filemask/>
  <file_required>Y</file_required>
  <include_subfolders>N</include_subfolders>
</file>
<fields>
  <field>
    <name>FILE_CONTENT</name>
    <element_type>content</element_type>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
  <field>
    <name>FILE_SIZE</name>
    <element_type>size</element_type>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`getFields()` xoá schema cũ** (mode file): downstream chỉ thấy trường
  mới — đừng mong trường từ step trước còn tồn tại sau step này.
- **`<element_type>` chỉ có 2 giá trị**: `content`/`size` — không có
  `node`/`attribute` (getXMLData) hay `path` (YamlInput); copy chéo là tag
  lạ bị bỏ qua.
- **`<repeat>` thiếu = TRUE** — luôn ghi tường minh như getXMLData.
- **`<file>` flat 5 tag** — như getXMLData (có `exclude_filemask`), khác
  YamlInput (4 tag); viết lặp tay, không `set_fields`.
- **File lớn = dòng lớn**: nạp cả file vào một String — PDF/binary hàng
  trăm MB phình bộ nhớ; cân nhắc streaming thay thế.
- Template mặc định là khung cấu hình — người dùng phải điền file
  (`${VAR}`) và ít nhất 1 field.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
