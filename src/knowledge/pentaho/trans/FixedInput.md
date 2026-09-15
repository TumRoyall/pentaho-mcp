# FixedInput — Step đọc file bản rộng cố định

Đọc file text bản rộng cố định: mỗi dòng cắt thành các trường theo ĐỘ RỘNG
ký tự (`<fields>/<field>/<width>` — khác `<length>`!), kiểu/định dạng mỗi
trường khai báo riêng. Header dòng đầu, line-feed, lazy conversion và chạy
song song đều có cờ riêng. `file_type` (`NONE`/`UNIX`/`DOS`) cho biết kiểu
kết dòng của file nguồn.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FixedInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename>${INPUT_FILE}</filename>
    <line_width>80</line_width>
    <header>Y</header>
    <buffer_size>50000</buffer_size>
    <lazy_conversion>Y</lazy_conversion>
    <line_feed>Y</line_feed>
    <parallel>N</parallel>
    <file_type>DOS</file_type>
    <encoding>UTF-8</encoding>
    <add_to_result_filenames>N</add_to_result_filenames>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <trim_type>none</trim_type>
        <currency/>
        <decimal/>
        <group/>
        <width>{{WIDTH}}</width>
        <length>-1</length>
        <precision>-1</precision>
      </field>
    </fields>
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
| `<filename>` | Y | File bản rộng cố định (dùng `${VAR}`). |
| `<line_width>` | Y | Tổng độ rộng dòng, chuỗi số; mặc định step mới `"80"`. |
| `<header>` | N | `Y` (mặc định) = bỏ dòng đầu; `N` = đọc cả. |
| `<buffer_size>` | N | Kích thước buffer đọc, chuỗi số; mặc định `"50000"`. |
| `<lazy_conversion>` | N | `Y` (mặc định) = chuyển kiểu lười; `N` = chuyển ngay. |
| `<line_feed>` | N | `Y` (mặc định) = dòng kết thúc bằng line-feed. |
| `<parallel>` | N | `Y` = đọc song song (chia file); `N` (mặc định). |
| `<file_type>` | Y | `NONE` / `UNIX` / `DOS` (kiểu kết dòng); lạ → `NONE`. |
| `<encoding>` | N | Encoding đọc file. |
| `<add_to_result_filenames>` | N | `Y` = đưa file vào result; `N` (mặc định). |
| `<fields>/<field>/<name>` | Y | Tên trường ra. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI. |
| `<trim_type>` | N | `none`/`left`/`right`/`both` (qua `ValueMetaString`). |
| `<width>` | Y | ĐỘ RỘNG cắt của trường (số ký tự) — KHÁC `<length>`. Thiếu → `-1`. |
| `<length>` / `<precision>` | N | Độ dài/độ chính xác kiểu; thiếu → `-1`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FIXED_INPUT` | `<type>` | `FixedInput`. |
| `configuration.file/line_width` | `<filename>`/`<line_width>` | `${VAR}` / chuỗi số. |
| `configuration.file_type` | `<file_type>` | `NONE`/`UNIX`/`DOS`. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Tên trường. |
| `configuration.fields[].width` | `<fields>/<field>/<width>` | Độ rộng cắt — đừng nhầm `length`. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 105 —
  `<step id="FixedInput">` →
  `org.pentaho.di.trans.steps.fixedinput.FixedInputMeta` (category Input).
  Registry presence không phải XML evidence, evidence là serializer dưới
  đây.
- Serialization: `FixedInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/fixedinput/FixedInputMeta.java`
  dòng 160–182) — thứ tự `filename`, `line_width`, `header`,
  `buffer_size`, `lazy_conversion`, `line_feed`, `parallel`, `file_type`
  (code), `encoding`, `add_to_result_filenames` (dòng 163–173), rồi
  `<fields>` LUÔN emit paired (dòng 175/179). `FixedFileInputField.getXML()`
  (`.../fixedinput/FixedFileInputField.java` dòng 114–133, `XML_TAG =
  "field"` dòng 43) — thứ tự `name`, `type` (tên chuỗi), `format`,
  `trim_type`, `currency`, `decimal`, `group`, `width`, `length`,
  `precision` (dòng 118–129).
- Deserialization: `loadXML()` (dòng 111–113) gọi `readData()` (dòng
  129–154) — cờ Y/N thiếu → false; `file_type` map code→id, lạ → `NONE`
  (dòng 501–511); `width`/`length`/`precision` thiếu → `-1` (dòng 83–85).
- Khởi tạo: `setDefault()` (dòng 120–127) — `lineWidth = "80"`,
  `headerPresent = true`, `lazyConversionActive = true`,
  `bufferSize = "50000"`, `lineFeedPresent = true`, `isaddresult = false`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 trường bản rộng):

```xml
<filename>${INPUT_DIR}/customer.txt</filename>
<line_width>50</line_width>
<header>Y</header>
<file_type>DOS</file_type>
<fields>
  <field>
    <name>CUSTOMER_ID</name>
    <type>String</type>
    <format/>
    <trim_type>both</trim_type>
    <currency/>
    <decimal/>
    <group/>
    <width>10</width>
    <length>-1</length>
    <precision>-1</precision>
  </field>
  <field>
    <name>CUSTOMER_NAME</name>
    <type>String</type>
    <format/>
    <trim_type>both</trim_type>
    <currency/>
    <decimal/>
    <group/>
    <width>40</width>
    <length>-1</length>
    <precision>-1</precision>
  </field>
</fields>
```

Fill bằng `set_field_path` cho scalar + `set_fields`
(`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<width>` ≠ `<length>`**: `width` là số ký tự CẮT từ dòng, `length` là
  độ dài KIỂU — đảo hai tag cho kết quả sai lặng lẽ.
- **`<file_type>` lạ → `NONE` lặng lẽ** (dòng 501–511) — sai chính tả
  (`DOS` viết `dos` vẫn OK nhờ match, nhưng `WIN` thì thành `NONE`).
- **Tổng `width` phải khớp `line_width`**: lệch là cắt sai cột — step không
  tự kiểm tra tổng.
- **`<fields>` luôn paired** — giữ paired kể cả rỗng, không self-closing.
- Template mặc định là khung cấu hình — người dùng phải điền file
  (`${VAR}`) và định nghĩa trường khớp layout file thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
