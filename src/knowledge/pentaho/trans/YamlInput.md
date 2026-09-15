# YamlInput — Step đọc dữ liệu từ file YAML

Đọc một hoặc nhiều file YAML (hoặc tài liệu YAML từ trường vào), trích mỗi
trường ra bằng path YAML (`<fields>/<field>` với `<path>` + kiểu/định dạng).
Họ hàng gần của `getXMLData` nhưng gọn hơn: file chỉ có bộ 4 tag (không có
`exclude_filemask`), field dùng `<path>` (không có `xpath`/
`element_type`/`result_type`/`repeat`). `getFields()` thêm một value meta
cho mỗi trường khai báo cộng các trường phụ được bật.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>YamlInput</type>
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
    <addresultfile>N</addresultfile>
    <validating>N</validating>
    <IsIgnoreEmptyFile>N</IsIgnoreEmptyFile>
    <doNotFailIfNoFile>Y</doNotFailIfNoFile>
    <rownum_field/>
    <encoding>UTF-8</encoding>
    <file>
      <name>${YAML_FILE}</name>
      <filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{OUTPUT_FIELD}}</name>
        <path>{{YAML_PATH}}</path>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
      </field>
    </fields>
    <limit>0</limit>
    <IsInFields>N</IsInFields>
    <IsAFile>Y</IsAFile>
    <YamlField/>
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
| `<fields>/<field>/<name>` | Y (ít nhất 1) | Tên trường ra (`check()` ERROR khi 0 field). |
| `<fields>/<field>/<path>` | Y | Path YAML tới giá trị (CHÚ Ý: `path`, không phải `xpath`). |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Integer`, …). |
| `<trim_type>` | N | `none`, `left`, `right`, `both` (dòng 47); chuỗi lạ → `none`. |
| `<length>` / `<precision>` | N | Số; thiếu tag load thành `-1`. |
| `<file>/<name>` | Điều kiện | File YAML (dùng `${VAR}`); nhiều file = lặp bộ 4 tag (flat). Bỏ qua khi `IsInFields=Y`. |
| `<filemask>` | N | Regex lọc file. |
| `<file_required>` / `<include_subfolders>` | N | Y/N từng file. |
| `<IsInFields>` | N | `Y` = đọc YAML từ trường vào (`<YamlField>` tên trường, `<IsAFile>` phân biệt file/nội dung); `N` (mặc định) = đọc file. |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định) = không giới hạn. |
| `<encoding>` | N | Encoding đọc file. |
| `<doNotFailIfNoFile>` | N | `Y` (mặc định step mới!) = không fail khi thiếu file. |
| `<include>`/`<include_field>`, `<rownum>`/`<rownum_field>` | N | Bật + đặt tên trường phụ (tên file, số dòng). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: YAML_INPUT` | `<type>` | `YamlInput`. |
| `configuration.files[].path` | `<file>/<name>` | Dùng `${VAR}`; mỗi file = 1 bộ 4 tag flat. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Trường ra. |
| `configuration.fields[].path` | `<fields>/<field>/<path>` | Path YAML (không phải xpath). |
| `configuration.fields[].type/trim` | `<type>`/`<trim_type>` | Tên chuỗi / 4 giá trị. |

`<fields>` chứa list `<field>` đồng nhất → `set_fields`
(`listTag=fields`, `itemTag=field`). `<file>` flat như getXMLData nhưng CHỈ
4 tag (không có `exclude_filemask`) — viết lặp tay.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "YamlInput", ...)`
  (`plugins/yaml-input/impl/src/main/java/org/pentaho/di/trans/steps/yamlinput/YamlInputMeta.java`
  dòng 66). KHÔNG nằm trong `engine/.../kettle-steps.xml` (plugin
  yaml-input) — annotation là evidence đăng ký, serializer dưới đây mới là
  XML evidence.
- Serialization: `YamlInputMeta.getXML()`
  (`.../yamlinput/YamlInputMeta.java` dòng 415–452) — thứ tự `include`,
  `include_field`, `rownum`, `addresultfile`, `validating`,
  `IsIgnoreEmptyFile`, `doNotFailIfNoFile`, `rownum_field`, `encoding`,
  wrapper `<file>` LUÔN emit (dòng 429/437) chứa các BỘ 4 tag flat
  `name/filemask/file_required/include_subfolders` (dòng 431–434 — KHÔNG
  có `exclude_filemask` như getXMLData), wrapper `<fields>` (dòng 439/444),
  rồi `limit`, `IsInFields`, `IsAFile`, `YamlField` (dòng 446–449).
- Field: `YamlInputField` (`.../yamlinput/YamlInputField.java` dòng
  87–96/104–113) — thứ tự `name`, `path`, `type` (chuỗi→id, dòng 106),
  `format`, `currency`, `decimal`, `group`, `length`, `precision`
  (thiếu → `-1`, dòng 111–112), `trim_type` (`none`/`left`/`right`/`both`,
  dòng 47). Không có `element_type`/`result_type`/`repeat` như getXMLData.
- Deserialization: `loadXML()` (dòng 388–390) gọi `readData()` (dòng
  476–523) — cờ Y/N thiếu → false; `limit` qua `Const.toLong(..., 0L)`
  (dòng 515).
- Khởi tạo: `setDefault()` (dòng 534–565) — `doNotFailIfNoFile = true`,
  còn lại false/rỗng, 0 file/field.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 568+) thêm value meta cho mỗi
  trường khai báo và các trường phụ được bật (cùng họ với getXMLData).
  `check()` (dòng 728–780) ERROR khi thiếu input (!), 0 field, hoặc (mode
  file) không resolve được file nào.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 trường YAML):

```xml
<limit>0</limit>
<IsInFields>N</IsInFields>
<IsAFile>Y</IsAFile>
<YamlField/>
<fields>
  <field>
    <name>ORDER_ID</name>
    <path>order.id</path>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
  </field>
  <field>
    <name>CUSTOMER</name>
    <path>order.customer.name</path>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Field dùng `<path>`, không phải `<xpath>`**: copy từ getXMLData sang mà
  giữ `xpath`/`element_type`/`result_type` là tạo tag lạ bị bỏ qua, path
  thành null.
- **`<file>` chỉ 4 tag, KHÔNG có `exclude_filemask`**: khác getXMLData (5
  tag) — đừng copy bộ file của getXMLData sang.
- **`<type>` là tên chuỗi** — ghi số id kiểu sẽ bị `getIdForValueMeta` map
  sai.
- **`doNotFailIfNoFile` mặc định `Y`** (`setDefault()` dòng 536) — muốn
  fail khi thiếu file đặt `N` tường minh.
- **`check()` đòi input** (dòng 734–744, dù step đọc file) — template trong
  transformation thật cần hop vào (giống getXMLData).
- Template mặc định là khung cấu hình — người dùng phải điền file
  (`${VAR}`) hoặc trường YAML vào và ít nhất 1 field.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
