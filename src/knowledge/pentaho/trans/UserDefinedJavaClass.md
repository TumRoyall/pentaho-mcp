# UserDefinedJavaClass — Step code Java tự do (UDJC)

Thực thi class Java do người dùng viết (biên dịch bằng Janino lúc chạy)
trên MỖI dòng/batch. XML gồm 6 block theo thứ tự: `<definitions>`
(các `<definition>`: `class_type` = `TRANSFORM_CLASS`/`NORMAL_CLASS`,
`class_name`, `class_source` giữ nguyên văn), `<fields>` (các `<field>`:
`field_name`/`field_type` chuỗi/`field_length`/`field_precision`),
`<clear_result_fields>`, `<info_steps>`, `<target_steps>`,
`<usage_parameters>`. Schema output do CHÍNH code quyết định lúc chạy
(`getFields()` gọi vào class đã biên dịch) — template chỉ mang khung.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>UserDefinedJavaClass</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <definitions>
      <definition>
        <class_type>TRANSFORM_CLASS</class_type>
        <class_name>Processor</class_name>
        <class_source>public boolean processRow(StepMetaInterface smi, StepDataInterface sdi) throws KettleException
{
  Object[] r = getRow();
  if (r == null) {
    setOutputDone();
    return false;
  }
  putRow(data.outputRowMeta, r);
  return true;
}</class_source>
      </definition>
    </definitions>
    <fields>
      <field>
        <field_name>{{EXTRA_FIELD}}</field_name>
        <field_type>String</field_type>
        <field_length>-1</field_length>
        <field_precision>-1</field_precision>
      </field>
    </fields>
    <clear_result_fields>N</clear_result_fields>
    <info_steps>
    </info_steps>
    <target_steps>
    </target_steps>
    <usage_parameters>
    </usage_parameters>
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
| `<definitions>/<definition>/<class_type>` | Y | `TRANSFORM_CLASS` (class xử lý chính) hoặc `NORMAL_CLASS` (class phụ). |
| `<definitions>/<definition>/<class_name>` | Y | Tên class (class chính mặc định `"Processor"` trong dialog). |
| `<definitions>/<definition>/<class_source>` | Y | Source Java nguyên văn (escape XML). |
| `<fields>/<field>` | N | Khai báo field phụ: `field_name`, `field_type` chuỗi, `field_length`, `field_precision`. |
| `<clear_result_fields>` | N | Y = xóa schema trước khi code thêm cột. THIẾU → TRUE (`!"N".equals(...)`). Luôn pin tường minh. |
| `<info_steps>/<info_step>` | N | Tham chiếu step nguồn phụ: `step_tag`, `step_name`, `step_description`. Rỗng khi không dùng. |
| `<target_steps>/<target_step>` | N | Tham chiếu step đích: cùng 3 tag. |
| `<usage_parameters>/<usage_parameter>` | N | Tham số: `parameter_tag`, `parameter_value`, `parameter_description`. |

Mọi tag đều viết thường (tên enum `ElementNames` dùng nguyên văn).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: USER_DEFINED_JAVA_CLASS` | `<type>` | `UserDefinedJavaClass`. |
| `configuration.class_source` | `<definitions>/<definition>/<class_source>` | Giữ nguyên văn. |
| `configuration.clear_result_fields` | `<clear_result_fields>` | Y/N (thiếu → TRUE). |
| `configuration.info_steps[].step` | `<info_steps>/<info_step>/<step_name>` | Tham chiếu step. |
| `configuration.target_steps[].step` | `<target_steps>/<target_step>/<step_name>` | Tham chiếu step. |

Các block list fill từng block riêng (không phải một `set_fields` chung).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 100 —
  `<step id="UserDefinedJavaClass">` → `...userdefinedjavaclass.UserDefinedJavaClassMeta`
  (category Scripting).
- Tên tag: enum `ElementNames` (dòng 78–87) — `class_type`,
  `class_name`, `class_source`, `definitions`, `definition`, `fields`,
  `field`, `field_name`, `field_type`, `field_length`,
  `field_precision`, `clear_result_fields`, `info_steps`, `info_step`,
  `target_steps`, `target_step`, `usage_parameters`,
  `usage_parameter`, `parameter_tag`, `parameter_value`,
  `parameter_description`, ... — TẤT CẢ thường.
- Serialization: `getXML()` (dòng 499–567) — `<definitions>` (502–513;
  `class_type` enum name 506, `class_name` 508, `class_source` 510),
  `<fields>` (515–526), `<clear_result_fields>` Y/N (527),
  `<info_steps>` (531–540), `<target_steps>` (544–553),
  `<usage_parameters>` (555–564).
- Deserialization: `readData()` (dòng 349–~418) — `class_type` qua
  `ClassType.valueOf` (357, sai tên → EXCEPTION, không fallback);
  `clear_result_fields` là `!"N".equals(...)` (375, THIẾU → TRUE).
- Khởi tạo: `setDefault()` RỖNG (dòng 420–423) — code mẫu do Dialog
  (`Snippits`, gói UI) sinh, không nằm trong Meta; constructor chỉ tạo
  list rỗng (151–157).
- Ngữ nghĩa runtime: `getFields()` (dòng 476–497) GỌI VÀO class đã biên
  dịch (`getFieldsMethod.invoke`, 488–493) — schema chỉ biết khi code
  compile được; compile lỗi → `KettleStepException`.
- Không có `<connection>`.

Cấu hình không mặc định (thêm info step + tham số):

```xml
<clear_result_fields>N</clear_result_fields>
<info_steps>
  <info_step>
    <step_tag>lookup</step_tag>
    <step_name>Lookup rows</step_name>
    <step_description/>
  </info_step>
</info_steps>
<target_steps>
</target_steps>
<usage_parameters>
  <usage_parameter>
    <parameter_tag>FACTOR</parameter_tag>
    <parameter_value>0.9</parameter_value>
    <parameter_description>Discount factor</parameter_description>
  </usage_parameter>
</usage_parameters>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<clear_result_fields>` thiếu → TRUE**: xóa schema input trước khi
  code chạy — luôn pin `Y`/`N` tường minh.
- **`<class_type>` parse nghiêm** (`valueOf`, không fallback): chỉ
  `TRANSFORM_CLASS` hoặc `NORMAL_CLASS`, sai chính tả → load EXCEPTION.
- **Schema output do code quyết định**: validator XML không kiểm được
  cột — test chỉ assert cấu trúc block.
- Source Java phải XML-escape (`<`, `>`, `&`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
  `keepInputFields`-tương đương (`clearingResultFields`) là runtime state;
  compile cần Janino lúc chạy.
