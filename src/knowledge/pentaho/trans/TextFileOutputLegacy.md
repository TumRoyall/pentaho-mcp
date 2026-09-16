# TextFileOutputLegacy — Step ghi file text chạy lệnh (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`. Replacement có nguồn: `TextFileOutput`
> (javadoc `@deprecated use TextFileOutputMeta instead` + registry
> `suggestion ... TypeLongDesc.TextFileOutput`).

Kế thừa toàn bộ serializer của `TextFileOutput` và thêm ĐÚNG MỘT tag
`<is_command>` CUỐI block `<file>`: khi `is_command = Y`, filename được
dùng nguyên làm lệnh shell để pipe dữ liệu vào (`buildFilename`
override), thay vì ghi file. Mọi tag khác và thứ tự của chúng giống hệt
`TextFileOutput`. Boolean Y/N; hai default khi tag thiếu KHÁC
`setDefault()` (xem bẫy).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TextFileOutputLegacy</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <separator>;</separator>
    <enclosure>"</enclosure>
    <enclosure_forced>N</enclosure_forced>
    <enclosure_fix_disabled>N</enclosure_fix_disabled>
    <header>Y</header>
    <footer>N</footer>
    <format>DOS</format>
    <compression>None</compression>
    <encoding/>
    <endedLine/>
    <fileNameInField>N</fileNameInField>
    <fileNameField/>
    <create_parent_folder>Y</create_parent_folder>
    <file>
      <name>${OUTPUT_FILE}</name>
      <servlet_output>N</servlet_output>
      <do_not_open_new_file_init>N</do_not_open_new_file_init>
      <extention>txt</extention>
      <append>N</append>
      <split>N</split>
      <haspartno>N</haspartno>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <add_to_result_filenames>Y</add_to_result_filenames>
      <pad>N</pad>
      <fast_dump>N</fast_dump>
      <splitevery/>
      <is_command>N</is_command>
    </file>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <trim_type>none</trim_type>
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
| `<separator>` / `<enclosure>` / `<enclosure_forced>` / `<enclosure_fix_disabled>` | Y | Phân tách/bọc; ép bọc mọi field; tắt fix bọc. |
| `<header>` / `<footer>` / `<format>` (`DOS`/`UNIX`/`CR`) | Y | Header/footer; format quyết newline (`getNewLine`, dòng 751–767). |
| `<compression>` | Y | `None` (default) / `Zip` (tương thích cũ `<file>/<zipped>Y` → `Zip`). |
| `<file>/<name>` | Y | Đường dẫn file — hoặc LỆNH khi `<is_command>Y`. Luôn dùng `${VAR}`, không embed thật. |
| `<file>/<extention>` | Y | Giữ nguyên chính tả `extention` (thiếu `s` thứ hai). |
| `<file>/<SpecifyFormat>` | Y | Giữ nguyên chữ hoa `S`/`F`. |
| `<file>/<is_command>` | Y — LUÔN phải có | `Y` = filename là lệnh shell nhận pipe; `N` = ghi file thường. Tag riêng của Legacy, nằm CUỐI block `<file>` (sau `<splitevery>`). |
| `<fields>/<field>` (10 tag) | Y | `name`, `type` (chuỗi), `format`, `currency`, `decimal`, `group`, `nullif`, `trim_type` (code), `length`, `precision`. Field tên rỗng bị BỎ khi serialize (dòng 837). Số thiếu → `-1`. |

`<file>` và `<fields>` paired — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TEXT_FILE_OUTPUT_LEGACY` | `<type>` | `TextFileOutputLegacy` (alias `TEXT_FILE_OUTPUT` đã thuộc `TextFileOutput`). |
| `configuration.separator` | `<separator>` | Phân tách. |
| `configuration.filename` | `<file>/<name>` | File hoặc lệnh. |
| `configuration.run_as_command` | `<file>/<is_command>` | Boolean → Y/N. |
| `configuration.fields[].name/type/...` | `<fields>/<field>/...` | 10 tag/con theo thứ tự. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 19 —
  `<step id="TextFileOutputLegacy">` →
  `org.pentaho.di.trans.steps.textfileoutputlegacy.TextFileOutputLegacyMeta`
  (category Deprecated, icon deprecated, `suggestion ...
  TypeLongDesc.TextFileOutput` = replacement có nguồn). Class
  `@Deprecated`, javadoc "use `TextFileOutputMeta` instead"
  (`.../textfileoutputlegacy/TextFileOutputLegacyMeta.java` dòng 44–49).
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `TextFileOutputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/textfileoutput/TextFileOutputMeta.java`
  dòng 815–856) — thứ tự: `separator`…`create_parent_folder` (dòng
  818–830), `<file>` (831–833) với `saveFileOptions` (dòng 858–878:
  `name` qua `saveSource` 862/1132–1134, `servlet_output`…
  `splitevery`), rồi `<fields>` (835–853; 10 tag/con dòng 839–849, bỏ
  field tên rỗng dòng 837). Legacy override `saveFileOptions`
  (`TextFileOutputLegacyMeta.java` dòng 90–93) gọi super rồi append
  `<is_command>` CUỐI block `<file>`.
- Deserialization: `TextFileOutputMeta.readData()` (dòng 663–745) —
  `separator`/`enclosure`/`endedLine` thiếu → `""` (dòng 665–693);
  `disableEnclosureFix` thiếu → TRUE (dòng 671–673, khác `setDefault()`
  false); `createparentfolder` thiếu → TRUE (dòng 676–677, khác default
  `setDefault()` true — trùng); `add_to_result_filenames` thiếu → TRUE
  (dòng 709–710); `compression` thiếu → `None` (dòng 682–689); số
  thiếu → `-1` (dòng 739–740). Legacy `readData` override
  (`TextFileOutputLegacyMeta.java` dòng 74–81) gọi super rồi đọc
  `<file>/<is_command>` qua `"Y".equalsIgnoreCase` (dòng 77, thiếu → false).
- Khởi tạo: `TextFileOutputMeta.setDefault()` (dòng 770–799) —
  `separator ";"`, `enclosure "\""`, `header` true, `format "DOS"`,
  `compression "None"`, `fileName "file"`, `extension "txt"`,
  `addToResultFilenames` true, còn lại false/rỗng, 0 field; Legacy
  `setDefault()` (dòng 84–87) gọi super rồi `fileAsCommand = false`
  (đúng `<is_command>N` ở template mục 1).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: khi `is_command = Y`, `buildFilename()` override
  (dòng 118–125) trả filename đã substitute làm lệnh pipe, bỏ qua logic
  split/partnr/zip của cha — đây là khác biệt hành vi duy nhất của Legacy.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (pipe-delimited, ghi đè, 2 field):

```xml
<separator>|</separator>
<format>UNIX</format>
<file>
  <name>${EXPORT_DIR}/orders.dat</name>
  <servlet_output>N</servlet_output>
  <do_not_open_new_file_init>N</do_not_open_new_file_init>
  <extention>dat</extention>
  <append>Y</append>
  <split>N</split>
  <haspartno>N</haspartno>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <SpecifyFormat>N</SpecifyFormat>
  <date_time_format/>
  <add_to_result_filenames>Y</add_to_result_filenames>
  <pad>N</pad>
  <fast_dump>N</fast_dump>
  <splitevery/>
  <is_command>N</is_command>
</file>
<fields>
  <field>
    <name>ORDER_ID</name>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal>.</decimal>
    <group>,</group>
    <nullif/>
    <trim_type>none</trim_type>
    <length>10</length>
    <precision>0</precision>
  </field>
  <field>
    <name>ORDER_DATE</name>
    <type>Date</type>
    <format>yyyy-MM-dd</format>
    <currency/>
    <decimal/>
    <group/>
    <nullif/>
    <trim_type>none</trim_type>
    <length>-1</length>
    <precision>-1</precision>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category + icon deprecated, dòng registry 19): chỉ
  đọc/bảo trì; step mới dùng `TextFileOutput`.
- **Đừng nhầm alias `TEXT_FILE_OUTPUT`**: nó đã thuộc `TextFileOutput`
  trong catalog — ID này dùng alias `TEXT_FILE_OUTPUT_LEGACY`.
- **`<is_command>` LUÔN cuối block `<file>`** (sau `<splitevery>`) —
  đặt sai vị trí là sai thứ tự `getXML()`.
- **Chính tả `extention` và `SpecifyFormat`** — sửa thành `extension`/
  `specifyformat` là sai tag, load bỏ qua lặng lẽ.
- **Default khi tag thiếu KHÁC `setDefault()`**: `enclosure_fix_disabled`
  thiếu → true (setDefault false); `create_parent_folder`/
  `add_to_result_filenames` thiếu → true — file cũ lược tag vẫn load true.
- **`is_command = Y` biến filename thành lệnh shell** — đọc workload cũ
  thấy tag này phải hiểu là pipe lệnh, không phải đường dẫn.
- Template mặc định là khung cấu hình — người dùng phải điền file và
  schema cột; không chạy I/O nghiệp vụ để test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
