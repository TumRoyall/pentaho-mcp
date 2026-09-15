# MappingOutput — Step khai báo output của sub-transformation

Nằm BÊN TRONG sub-transformation được gọi bởi step `Mapping`, đánh dấu
điểm thoát dữ liệu trả về transformation cha. Class này KHÔNG có block
XML cấu hình riêng — rename field do step `Mapping` phía gọi điều khiển
(`inputValueRenames`/`outputValueRenames`), nên template thân step là
RỖNG (chỉ còn wrapper `StepMeta`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MappingOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
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
| (không có config riêng) | — | Step không serialize node cấu hình nào. Mọi rename output được step `Mapping` phía gọi truyền vào qua `setInputValueRenames`/`setOutputValueRenames` lúc runtime, không nằm trong XML của step này. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAPPING_OUTPUT` | `<type>` | `MappingOutput`. |
| `configuration.output_renames[].from` / `[].to` | (không có XML tương ứng trong step này) | Khai báo ở `<mappings/output/mapping>` của step `Mapping` phía gọi (`trans/Mapping.md`): `input_step` = tên step `MappingOutput` BÊN TRONG sub-transformation; `output_step` = tên step BÊN CHA nhận dòng ra (tên step, không phải tên field). Rename field nằm trong `<connector>`: `<parent>` = tên field tại `MappingOutput` (phía sub), `<child>` = tên field phía cha nhìn thấy. |

Định tuyến step và rename field là hai cấu hình tách bạch trong cùng
một `<mapping>` (không có `<connector>` thì không có rename):

```xml
<mappings>
  <output>
    <mapping>
      <input_step>{{MAPPING_OUTPUT_STEP_NAME}}</input_step>
      <output_step>{{PARENT_TARGET_STEP}}</output_step>
      <main_path>Y</main_path>
      <rename_on_output>N</rename_on_output>
      <description/>
      <connector>
        <parent>{{SUB_FIELD_NAME}}</parent>
        <child>{{PARENT_FIELD_NAME}}</child>
      </connector>
    </mapping>
  </output>
</mappings>
```

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (`<step
  id="MappingOutput">`,
  `classname=org.pentaho.di.trans.steps.mappingoutput.MappingOutputMeta`,
  category Mapping). Class không mang annotation `@Step`.
- Serialization: class
  `engine/src/main/java/org/pentaho/di/trans/steps/mappingoutput/MappingOutputMeta.java`
  (đọc toàn file, 177 dòng) KHÔNG override `getXML()`/`loadXML()` —
  fragment plugin là chuỗi RỖNG theo
  `BaseStepMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/step/BaseStepMeta.java`
  dòng 200–201: `return ""`) và `loadXML()` no-op (dòng 1108–1110).
  Toàn bộ XML của step do wrapper `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) sinh ra: `name`, `type`, `description`, `distribute`,
  `custom_distribution`, `copies`, `partitioning`, `attributes`,
  `cluster_schema`, `remotesteps`, `GUI`.
- Khởi tạo: `setDefault()` (dòng 72–76) gọi `allocate(nrfields)` rỗng
  (dòng 69–70, thân rỗng) — step mới không có gì để khởi tạo.
- Định tuyến output (nằm ở step `Mapping` phía CHA, không phải step
  này):
  `engine/src/main/java/org/pentaho/di/trans/steps/mapping/Mapping.java`
  — dòng 423–429: `input_step` của output-mapping là MappingOutput step
  BÊN TRONG sub-trans (`findRunThread(getInputStepname())`); dòng
  471–481 (`pickupTargetStepsFor`): `output_step` là step BÊN CHA nhận
  dòng (`findStepInterfaces(getOutputStepname())`). Tương ứng phía
  design-time: `MappingMeta.java` dòng 564–565
  (`findMappingOutputStep(getInputStepname())`) và dòng 547
  (`nextStep.getName().equals(getOutputStepname())`).
- Rename field output:
  `engine/src/main/java/org/pentaho/di/trans/steps/mapping/MappingIODefinition.java`
  — constructor Node (dòng 103–121): mỗi `<connector>` đọc
  `<parent>`/`<child>` thành `MappingValueRename(parent, child)`;
  `getXML()` (dòng 123–143) ghi đúng thứ tự `input_step`,
  `output_step`, `main_path`, `rename_on_output`, `description`, rồi
  0..n `<connector>` (`parent` = `getSourceValueName()`, `child` =
  `getTargetValueName()`). `MappingOutputMeta.getFields()` (dòng
  95–106, kiểm chứng bởi `MappingOutputMetaIT`) tìm
  `sourceValueName` trong row tại MappingOutput rồi đổi thành
  `targetValueName` — tức `<parent>` = tên field phía sub,
  `<child>` = tên field phía cha. Chiều này ngược với input-mapping
  (ở đó `<parent>` = field phía cha): xem tương thích ngược trong
  `MappingMeta.java` dòng 182–199 (`(inputField, inputMapping)` so với
  `(outputMapping, outputField)`).
- Ngữ nghĩa runtime: `getFields()` (dòng 78–107) KHÔNG tự đổi schema —
  nó áp `inputValueRenames` (đổi `target`→`source`, revert rename của
  chiều input) rồi `outputValueRenames` (clone ValueMeta tại đúng index
  để giữ thứ tự cột — comment `BACKLOG-23372` trong source) do step
  `Mapping` phía gọi truyền vào (`Mapping.java` dòng 456–457,
  `MappingMeta.java` dòng 571–575). `check()` (dòng 109–137) yêu cầu
  step PHẢI có input stream (không input → ERROR), ngược với
  `MappingInput`.
- Nhãn dialog xác nhận (không thay serializer):
  `engine/src/main/resources/org/pentaho/di/trans/steps/mapping/messages/messages_en_US.properties`
  — output tab:
  `input_step` = "Mapping source step name:", `output_step` =
  "Output target step name:", cột rename `SourceField` =
  "Fieldname from mapping step", `TargetField` =
  "Fieldname to target step".
- KHÔNG sao chép: `MappingInput` có `<fields>/<field>`
  (`name`/`type`/`length`/`precision`) + `<select_unspecified>`; class
  này không có các members đó và không serialize chúng. Template trên
  cố ý không có `<fields>` — mọi block `<fields>` thêm vào đều là bịa.

## 5. Lưu ý / bẫy

- **Đừng thêm `<fields>` vào step này** vì thấy `MappingInput` có —
  hai class khác implementation hoàn toàn; `MappingOutput` không đọc
  field nào từ XML của chính nó.
- Muốn đổi tên field output: sửa `<mappings/output/mapping>` ở step
  `Mapping` phía gọi — `input_step` = tên step `MappingOutput` này
  (trong sub), `output_step` = tên step BÊN CHA nhận dòng (tên step,
  không phải tên field), rename field trong `<connector>`
  (`<parent>` = field phía sub, `<child>` = field phía cha). Đừng điền
  tên field vào `output_step`: `pickupTargetStepsFor` sẽ tìm step cha
  theo tên đó và báo `StepNameNotFound`.
- Thiếu `<connector>` nghĩa là không rename — field giữ nguyên tên từ
  sub ra cha. Có rename mà sai chiều `parent`/`child` thì
  `getFields()` tìm không thấy và bỏ qua lặng lẽ.
- Step này BẮT BUỘC có input hop (luồng xử lý đổ vào điểm thoát);
  thiếu input → `check()` ERROR.
- Thường đi cặp với `MappingInput` trong cùng sub-transformation:
  `MappingInput` (cổng vào) → ...xử lý... → `MappingOutput` (cổng ra).
- Template mặc định là khung vị trí trong sub-transformation — rename
  thực tế nằm ở mapping phía gọi.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu toàn file class (không có
  `getXML`/`loadXML` riêng → serialization kế thừa rỗng),
  `setDefault()`, `getFields()` và wrapper `StepMeta` tại commit đã
  ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed` — không tuyên bố
  hai mức này.
