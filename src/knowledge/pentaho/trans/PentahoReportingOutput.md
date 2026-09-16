# PentahoReportingOutput — Step chạy báo cáo Pentaho Reporting

Chạy definition báo cáo (`.prpt`) cho mỗi (nhóm) dòng: file definition
và file output lấy từ ĐƯỜNG DẪN TĨNH (`input_file`/`output_file`) hoặc
từ FIELD (`input_file_field`/`output_file_field`), tham số báo cáo map
qua list `<parameters>/<parameter>` (`name`+`field`, sort theo tên khi
ghi), engine xuất qua `<processor_type>` code (`PDF`, `PagedHtml`,
`StreamingHtml`, `CSV`, `Excel`, `Excel 2007`, `RTF`). Không override
`getFields` (pass-through); `check()` không bao giờ error.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PentahoReportingOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <input_file_field/>
    <output_file_field/>
    <create_parent_folder>N</create_parent_folder>
    <input_file>${REPORT_DEF}</input_file>
    <output_file>${REPORT_OUT}</output_file>
    <use_values_from_fields>N</use_values_from_fields>
    <parameters>
      <parameter>
        <name>${PARAM_NAME}</name>
        <field>${PARAM_FIELD}</field>
      </parameter>
    </parameters>
    <processor_type>PDF</processor_type>
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
| `<input_file_field>` | N | Tên field chứa đường dẫn definition (thay cho `<input_file>` tĩnh). |
| `<output_file_field>` | N | Tên field chứa đường dẫn output (thay cho `<output_file>` tĩnh). |
| `<create_parent_folder>` | N | `Y` = tự tạo thư mục cha của output. |
| `<input_file>` | Y (khi không dùng field) | Đường dẫn `.prpt` tĩnh; cho phép `${VAR}`. |
| `<output_file>` | Y (khi không dùng field) | Đường dẫn file báo cáo; cho phép `${VAR}`. |
| `<use_values_from_fields>` | N | `Y` = lấy giá trị tham số từ fields; thiếu/null load thành **true** (backward-compat). |
| `<parameters>/<parameter>/<name>` | Y (mỗi param) | Tên tham số báo cáo. |
| `<parameters>/<parameter>/<field>` | Y (mỗi param) | Tên field cung cấp giá trị. |
| `<processor_type>` | N | Code engine: `PDF` (mặc định), `PagedHtml`, `StreamingHtml`, `CSV`, `Excel`, `Excel 2007`, `RTF`. Thiếu/lạ load thành null. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PENTAHO_REPORTING_OUTPUT` | `<type>` | `PentahoReportingOutput`. |
| `configuration.input_file` | `<input_file>` | Cho phép `${VAR}`. |
| `configuration.output_file` | `<output_file>` | Cho phép `${VAR}`. |
| `configuration.input_file_field` | `<input_file_field>` | Tham chiếu field. |
| `configuration.output_file_field` | `<output_file_field>` | Tham chiếu field. |
| `configuration.create_parent_folder` | `<create_parent_folder>` | Boolean → Y/N. |
| `configuration.use_values_from_fields` | `<use_values_from_fields>` | Boolean → Y/N. |
| `configuration.parameters[].name` | `<parameters>/<parameter>/<name>` | Tên tham số. |
| `configuration.parameters[].field` | `<parameters>/<parameter>/<field>` | Field nguồn. |
| `configuration.processor_type` | `<processor_type>` | Code engine. |

`<parameters>` chứa list `<parameter>` đồng nhất (luôn emit kể cả rỗng,
sort theo tên khi ghi) → fill bằng MỘT lần `set_fields`
(`listTag=parameters`, `itemTag=parameter`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="PentahoReportingOutput", ...)`
  (`plugins/pentaho-reporting/impl/src/main/java/org/pentaho/di/trans/steps/pentahoreporting/PentahoReportingOutputMeta.java`
  dòng 61–66; const tag dòng 110–121). Registry presence không phải XML
  evidence, evidence là serializer dưới đây.
- Serialization: `PentahoReportingOutputMeta.getXML()` (dòng 195–220) —
  đúng thứ tự `input_file_field`, `output_file_field`,
  `create_parent_folder` (Y/N, Boolean object), `input_file`,
  `output_file`, `use_values_from_fields` (Y/N), `<parameters>` (luôn
  emit open/close dòng 204+215 kể cả rỗng, sort theo tên dòng 205–207;
  mỗi `<parameter>` có `name`+`field` không CDATA, dòng 210–213),
  `processor_type` (code từ enum dòng 71–108 qua `getCode()` dòng 217).
  **BẪY NPE**: dòng 217 gọi `outputProcessorType.getCode()` — load thiếu
  tag mà chưa `setDefault` sẽ NPE khi ghi lại.
- Deserialization: `loadXML()` (dòng 151–153) gọi `readData()` (dòng
  161–187) — strings null khi thiếu; `use_values_from_fields` (dòng
  167–168) `"Y".equals(val)||val==null` → **thiếu/null mặc định true**
  (backward-compat, `equals` case-sensitive, không `IgnoreCase`!);
  `create_parent_folder` `"Y".equals` → thiếu = false (dòng 169);
  params đọc `getSubNode(parameters)→getNodes(parameter)` (dòng 171–172),
  bỏ cặp rỗng (dòng 176); `outputProcessorType=getProcessorTypeByCode(...)`
  → null khi thiếu/lạ (dòng 181–182).
- Khởi tạo: `setDefault()` (dòng 189–193) — `outputProcessorType=PDF`,
  `createParentFolder=false`, `useValuesFromFields=true`
  (`parameterFieldMap` new ở constructor dòng 146–149, không reset ở
  `setDefault`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: không override `getFields` (pass-through). `check()`
  (dòng 274–293) chỉ ghi OK/Comment, không bao giờ error.
- Không có `<connection>`: step chỉ đọc/ghi file — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (field-driven + Excel + 2 params):

```xml
<input_file_field>REPORT_PATH</input_file_field>
<output_file_field>OUTPUT_PATH</output_file_field>
<create_parent_folder>Y</create_parent_folder>
<use_values_from_fields>Y</use_values_from_fields>
<parameters>
  <parameter>
    <name>REGION</name>
    <field>REGION_CODE</field>
  </parameter>
  <parameter>
    <name>YEAR</name>
    <field>FISCAL_YEAR</field>
  </parameter>
</parameters>
<processor_type>Excel</processor_type>
```

Fill params bằng `set_fields` (`listTag=parameters`, `itemTag=parameter`).

## 5. Lưu ý / bẫy — CRITICAL

- **BẪY NPE `processor_type`**: entry load thiếu tag (null) rồi ghi lại mà
  chưa `setDefault` sẽ NPE — template luôn emit `<processor_type>`.
- **`use_values_from_fields` thiếu = true** (ngược với đa số flag) —
  luôn emit tường minh, đừng lược.
- **So sánh `Y` case-sensitive** ở 2 flag (`equals`, không `IgnoreCase`)
  — `y` thường load thành false.
- **`<parameters>` luôn paired** (emit cả khi rỗng) — giữ paired,
  self-closing làm `setFields` ném lỗi.
- Template mặc định là khung cấu hình — người dùng phải điền definition
  `.prpt`, output và params tồn tại trong stream; cần reporting engine
  lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
