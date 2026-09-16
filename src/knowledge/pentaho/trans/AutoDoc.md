# AutoDoc — Step sinh tài liệu lineage (kettle-autodoc)

Step nguồn KHÔNG nhận input (`check()` ERROR khi có input): quét
transformation/job và sinh tài liệu lineage. Output gồm đường dẫn file
tài liệu tĩnh `<target_file>` + định dạng `<output_type>` (tên enum
`KettleReportBuilder.OutputType`: `PDF` mặc định, `METADATA`, ...),
nguồn quét từ FIELD (`filename_field`/`file_type_field`) hoặc file hiện
tại, và 10 cờ include (Y/N). `getFields()` hai chế độ: `METADATA` giữ
input + append cột meta; còn lại `rowMeta.clear()` + 1 cột filename.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AutoDoc</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename_field/>
    <file_type_field/>
    <target_file>${AUTODOC_FILE}</target_file>
    <output_type>PDF</output_type>
    <include_name>Y</include_name>
    <include_description>Y</include_description>
    <include_extended_description>Y</include_extended_description>
    <include_creation>Y</include_creation>
    <include_modification>Y</include_modification>
    <include_image>Y</include_image>
    <include_logging_config>Y</include_logging_config>
    <include_last_exec_result>N</include_last_exec_result>
    <include_image_area_list>N</include_image_area_list>
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
| `<filename_field>` | N | Tên field chứa đường dẫn file cần document (thay cho file hiện tại). |
| `<file_type_field>` | N | Tên field chứa loại file (trans/job). |
| `<target_file>` | Y | Đường dẫn file tài liệu sinh ra; cho phép `${VAR}`. |
| `<output_type>` | Y | Tên enum `OutputType` (`PDF` mặc định, `METADATA`, ...). Tên lạ/null load fallback `PDF`. |
| `<include_name>` ... `<include_image_area_list>` | N | 10 cờ Y/N chọn nội dung đưa vào tài liệu. `include_last_exec_result` và `include_image_area_list` mặc định `N` (mới). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: AUTO_DOC` | `<type>` | `AutoDoc`. |
| `configuration.filename_field` | `<filename_field>` | Tham chiếu field. |
| `configuration.file_type_field` | `<file_type_field>` | Tham chiếu field. |
| `configuration.target_file` | `<target_file>` | Cho phép `${VAR}`. |
| `configuration.output_type` | `<output_type>` | Tên enum (`PDF`, ...). |
| `configuration.include_*` | `<include_*>` | Boolean → Y/N từng cờ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="AutoDoc", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/autodoc/AutoDocMeta.java`
  dòng 60–62). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `AutoDocMeta.getXML()` (dòng 154–175) — đúng thứ tự
  `filename_field`, `file_type_field`, `target_file` (3 string,
  null → tag rỗng), `output_type` (`outputType.name()` — NPE nếu
  `outputType==null`, luôn phải có giá trị), rồi 10 cờ boolean → Y/N
  (`include_name`, `include_description`,
  `include_extended_description`, `include_creation`,
  `include_modification`, `include_image`, `include_logging_config`,
  `include_last_exec_result`, `include_image_area_list`), tất cả vô điều
  kiện, không điều kiện emit.
- Deserialization: `loadXML()` (dòng 96–98) gọi `readData()` (dòng
  121–148) — strings `getTagValue` (thiếu → null); booleans
  `"Y".equalsIgnoreCase(...)` (thiếu/rỗng → false); `output_type`:
  `OutputType.valueOf(getTagValue)` trong try/catch → mọi exception
  (null/sai tên) fallback `PDF` (dòng 140–144).
- Khởi tạo: `setDefault()` (dòng 107–119) — `outputType=PDF`;
  `targetFilename="${Internal.Entry.Current.Directory}/kettle-autodoc.pdf"`;
  `includingName/Description/ExtendedDescription/Created/Modified/Image/
  LoggingConfiguration=true`; `includingLastExecutionResult=true` rồi
  **ghi đè `=false` (dòng 118)** → giá trị cuối `false` (template giữ
  `N`); `filenameField/fileTypeField` null;
  `includingImageAreaList` false.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 225–290) hai chế độ —
  `outputType==METADATA`: giữ input + append `meta` (Serializable) và
  các cột điều kiện (`name/description/extended_description/created/
  modified`:String; `image`:Binary; `logging/last_result`:String;
  `area`:Serializable); ngược lại `rowMeta.clear()` + 1 cột
  `filename`:String. `check()` (dòng 293–321) đòi KHÔNG có input
  (`prev` rỗng = OK, `input.length>0` = ERROR).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (METADATA + quét theo field):

```xml
<filename_field>SRC_PATH</filename_field>
<file_type_field>SRC_TYPE</file_type_field>
<target_file>${AUTODOC_DIR}/lineage.xml</target_file>
<output_type>METADATA</output_type>
<include_name>Y</include_name>
<include_last_exec_result>Y</include_last_exec_result>
<include_image_area_list>Y</include_image_area_list>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`output_type` bắt buộc có giá trị**: null gây NPE khi ghi (`getCode`
  trên null) — template luôn emit; tên lạ load fallback `PDF` lặng lẽ.
- **`include_last_exec_result` mặc định mới = false** (dòng 118 ghi đè
  true) — đừng suy default từ tên setter; template giữ `N`.
- **Hai chế độ output khác hẳn nhau**: `METADATA` giữ input + append
  nhiều cột; còn lại nuốt hết chỉ còn `filename` — chọn sai type là mất
  dữ liệu downstream.
- **Không nhận input** — nối hop vào là `check()` ERROR.
- Template mặc định là khung cấu hình — người dùng phải điền target file
  (qua biến); chạy document generation lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
