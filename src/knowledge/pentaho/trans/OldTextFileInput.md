# OldTextFileInput — Step đọc file text thế hệ cũ (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`. Replacement có nguồn: `TextFileInput` mới
> (registry `suggestion ... TypeLongDesc.TextFileInput`; class khác:
> `org.pentaho.di.trans.steps.fileinput.text.TextFileInputMeta`).

Đọc file CSV/text đời đầu (cùng họ TextFileInput cũ): cấu hình phân tách
(`separator`, `enclosure`, ...), khối `<file>` (name/mask/required/
subfolders + `type`/`compression`), khối `<filters>`, schema cột
`<fields>/<field>` (13 tag/con, gồm `nullif`/`ifnull`/`position`), giới
hạn dòng và error-handling, locale ngày tháng, các cột bổ sung tên file.
Boolean dạng Y/N (`YES.equalsIgnoreCase`); nhiều default khi tag thiếu
KHÁC với `setDefault()` (xem bẫy).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OldTextFileInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <accept_filenames>N</accept_filenames>
    <passing_through_fields>N</passing_through_fields>
    <accept_field/>
    <accept_stepname/>
    <separator>;</separator>
    <enclosure>"</enclosure>
    <enclosure_breaks>N</enclosure_breaks>
    <escapechar/>
    <header>Y</header>
    <nr_headerlines>1</nr_headerlines>
    <footer>N</footer>
    <nr_footerlines>1</nr_footerlines>
    <line_wrapped>N</line_wrapped>
    <nr_wraps>1</nr_wraps>
    <layout_paged>N</layout_paged>
    <nr_lines_per_page>80</nr_lines_per_page>
    <nr_lines_doc_header>0</nr_lines_doc_header>
    <noempty>Y</noempty>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownumByFile>N</rownumByFile>
    <rownum_field/>
    <format>DOS</format>
    <encoding/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <file>
      <name>${INPUT_FILE}</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
      <type>CSV</type>
      <compression>None</compression>
    </file>
    <filters>
      <filter>
        <filter_string/>
        <filter_position>-1</filter_position>
        <filter_is_last_line>N</filter_is_last_line>
        <filter_is_positive>N</filter_is_positive>
      </filter>
    </filters>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <ifnull/>
        <position>-1</position>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <error_ignored>N</error_ignored>
    <skip_bad_files>N</skip_bad_files>
    <file_error_field/>
    <file_error_message_field/>
    <error_line_skipped>N</error_line_skipped>
    <error_count_field/>
    <error_fields_field/>
    <error_text_field/>
    <bad_line_files_destination_directory/>
    <bad_line_files_extension>warning</bad_line_files_extension>
    <error_line_files_destination_directory/>
    <error_line_files_extension>error</error_line_files_extension>
    <line_number_files_destination_directory/>
    <line_number_files_extension>line</line_number_files_extension>
    <date_format_lenient>Y</date_format_lenient>
    <date_format_locale>en_US</date_format_locale>
    <shortFileFieldName/>
    <pathFieldName/>
    <hiddenFieldName/>
    <lastModificationTimeFieldName/>
    <uriNameFieldName/>
    <rootUriNameFieldName/>
    <extensionFieldName/>
    <sizeFieldName/>
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
| `<separator>` / `<enclosure>` / `<escapechar>` | Y | Ký tự phân tách/bọc/escape (`;` và `"` là default `setDefault()`). |
| `<header>` / `<nr_headerlines>` | Y | `Y` = bỏ qua dòng header; số dòng header (thiếu → 1). |
| `<file>/<name>` (+ `filemask`, `exclude_filemask`, `file_required`, `include_subfolders`) | Y | Lặp theo file: mask rỗng = đọc đúng file; `file_required`/`include_subfolders` dùng `Y`/`N` (`NO = "N"`). |
| `<file>/<type>` | Y | `CSV` (default) — đọc qua `getTagValue(stepnode, "file", "type")`. |
| `<file>/<compression>` | Y | `None`/`Zip`/… (thiếu → `None`; tương thích cũ: `<file>/<zipped>Y` → `Zip`). |
| `<filters>/<filter>/...` | N | Mỗi filter: `filter_string` (có tiền tố `Base64: ` khi serialize, dòng 1244–1251), `filter_position`, `filter_is_last_line`, `filter_is_positive`. Tương thích cũ: `<filter>` đơn lẻ ngoài `<filters>` vẫn được đọc (dòng 851–858). |
| `<fields>/<field>` (13 tag) | Y | `name`, `type` (chuỗi), `format`, `currency`, `decimal`, `group`, `nullif`, `ifnull`, `position`, `length`, `precision`, `trim_type` (code), `repeat` (Y/N). Số thiếu → `-1`. |
| `<limit>` | N | Giới hạn dòng (`0` = không giới hạn). |
| Error-handling (`error_ignored`, `skip_bad_files`, `file_error_field`, ...) | N | Toàn Y/N hoặc tên field; default N/rỗng. |
| `<date_format_lenient>` / `<date_format_locale>` | N | Thiếu → lenient true, locale mặc định JVM. |
| Các cột bổ sung (`shortFileFieldName`, `pathFieldName`, ...) | N | Rỗng = không thêm cột. |

`<file>` (lặp theo `<name>`), `<filters>`, `<fields>` đều paired — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: OLD_TEXT_FILE_INPUT` | `<type>` | `OldTextFileInput`. |
| `configuration.separator` | `<separator>` | Phân tách. |
| `configuration.file` | `<file>/<name>` | Đường dẫn (biến `${VAR}`). |
| `configuration.fields[].name/type/...` | `<fields>/<field>/...` | 13 tag/con theo thứ tự. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`);
file lặp theo `<name>` — set từng `file/name[i]` khi nhiều file.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 8 —
  `<step id="OldTextFileInput">` →
  `org.pentaho.di.trans.steps.textfileinput.TextFileInputMeta` (category
  Deprecated, icon deprecated, `suggestion ... TypeLongDesc.TextFileInput`
  = replacement có nguồn, class mới khác). Registry presence không phải
  XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/textfileinput/TextFileInputMeta.java`
  dòng 1197–1324) — thứ tự: accept блока (dòng 1200–1204), separator…
  encoding (1206–1227), `<file>` (1229–1240; mỗi file: `name` qua
  `saveSource` dòng 1231/2088–2090, `filemask`, `exclude_filemask`,
  `file_required`, `include_subfolders`, rồi `type` + `compression`
  dòng 1237–1239), `<filters>` (1242–1263; `filter_string` mã Base64 có
  tiền tố `Base64: ` dòng 1244–1254), `<fields>` (1265–1285; 13 tag/con
  dòng 1270–1282), `limit` + error-handling (1286–1307), locale
  (1309–1311), 8 cột bổ sung (1313–1321).
- Deserialization: `loadXML()` (dòng 782–939) — boolean qua
  `YES.equalsIgnoreCase` (thiếu → false) TRỪ: `noempty` thiếu → true
  (dòng 809–810), `add_to_result_filenames` thiếu → true (dòng 802–807),
  `date_format_lenient` thiếu → true (dòng 920); số thiếu → 1 cho
  header/wrap/page (dòng 794–801), `-1` cho position/length/precision
  (dòng 891–893); `fileCompression` thiếu → `None` (dòng 843–848);
  `filter_string` giải Base64 khi có tiền tố (dòng 866–872).
- Khởi tạo: `setDefault()` (dòng 987–1051) — `separator ";"`,
  `enclosure "\""`, `header` true, `nrHeaderLines` 1, `fileFormat "DOS"`,
  `fileType "CSV"`, `fileCompression "None"`, `noEmptyLines` true,
  `isaddresult` true, 0 file/field/filter, `rowLimit` 0 (đúng giá trị
  template mục 1).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`. Tham chiếu info-step: `accept_stepname` qua
  `searchInfoAndTargetSteps` (dòng 1338–1340) — cần hop từ step nguồn
  khi `accept_filenames = Y`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (pipe-delimited, 2 cột, kèm số dòng):

```xml
<separator>|</separator>
<enclosure/>
<include>Y</include>
<include_field>SRC_FILE</include_field>
<rownum>Y</rownum>
<rownum_field>ROW_NR</rownum_field>
<file>
  <name>${DATA_DIR}/orders.txt</name>
  <filemask>.*\.txt</filemask>
  <exclude_filemask/>
  <file_required>Y</file_required>
  <include_subfolders>N</include_subfolders>
  <type>CSV</type>
  <compression>None</compression>
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
    <ifnull/>
    <position>-1</position>
    <length>10</length>
    <precision>0</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
  <field>
    <name>ORDER_DATE</name>
    <type>Date</type>
    <format>yyyy-MM-dd</format>
    <currency/>
    <decimal/>
    <group/>
    <nullif/>
    <ifnull/>
    <position>-1</position>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category + icon deprecated, dòng registry 8): chỉ
  đọc/bảo trì; step mới dùng `TextFileInput` (class mới).
- **Default khi tag thiếu KHÁC default step mới**: `noempty`,
  `add_to_result_filenames`, `date_format_lenient` thiếu tag → true —
  file cũ lược các tag này vẫn load ra true, đừng "sửa" thành N khi đọc.
- **Boolean là Y/N** (`YES/NO`), không phải true/false.
- **`<filter_string>` serialize Base64** (`Base64: ...`) nhưng load chịu
  cả chuỗi thường (dòng 866–872) — đọc file cũ thấy chuỗi thường là bình thường.
- **`accept_filenames = Y` cần hop info** từ step nguồn filenames
  (`accept_stepname`, dòng 1326–1340).
- Template mặc định là khung cấu hình — người dùng phải điền file tồn tại
  và schema cột; không chạy I/O nghiệp vụ để test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
