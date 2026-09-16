# StepsMetrics — Step xuất chỉ số thực thi của các step khác

Đọc chỉ số runtime (dòng vào/ra/đọc/cập nhật/ghi/lỗi, giây chạy) của các
step liệt kê trong `<steps>/<step>` (`name` = THAM CHIẾU tên step,
`copyNr`, `stepRequired` Y/N) và phát MỖI step thành MỘT dòng với các cột
đặt tên bởi 9 tag `step*field` (`stepnamefield`, `stepidfield`,
`steplinesinputfield`, `steplinesoutputfield`, `steplinesreadfield`,
`steplinesupdatedfield`, `steplineswrittentfield`, `steplineserrorsfield`,
`stepsecondsfield`). CHÚ Ý: root `<step>` chứa block `<steps>` với các
item `<step>` lồng nhau (không nhầm với root khi parse).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>StepsMetrics</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <steps>
      <step>
        <name>{{TARGET_STEP}}</name>
        <copyNr>0</copyNr>
        <stepRequired>Y</stepRequired>
      </step>
    </steps>
    <stepnamefield>STEP_NAME</stepnamefield>
    <stepidfield>STEP_ID</stepidfield>
    <steplinesinputfield>LINES_INPUT</steplinesinputfield>
    <steplinesoutputfield>LINES_OUTPUT</steplinesoutputfield>
    <steplinesreadfield>LINES_READ</steplinesreadfield>
    <steplinesupdatedfield>LINES_UPDATED</steplinesupdatedfield>
    <steplineswrittentfield>LINES_WRITTEN</steplineswrittentfield>
    <steplineserrorsfield>LINES_ERRORS</steplineserrorsfield>
    <stepsecondsfield>SECONDS</stepsecondsfield>
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
| `<steps>/<step>/<name>` | Y | Tên step cần lấy chỉ số (tham chiếu). |
| `<steps>/<step>/<copyNr>` | N | Số copy của step (chuỗi số, `"0"`). |
| `<steps>/<step>/<stepRequired>` | N | Y/N (`YES="Y"`, `NO="N"` dòng 66–67); mặc định mới N. |
| 9 tag `step*field` | Y | Tên 9 cột output (step name/id, 6 chỉ số dòng, giây). Mặc định mới từ i18n dialog. |

`<steps>` chứa list `<step>` đồng nhất → MỘT lần `set_fields`
(`listTag=steps`, `itemTag=step`) — NHƯNG test parse phải phân biệt root
`<step>` với item `<step>` lồng (kiểm `parsed.step.type` là direct-child).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: STEPS_METRICS` | `<type>` | `StepsMetrics`. |
| `configuration.steps[].step` | `<steps>/<step>/<name>` | Tham chiếu step. |
| `configuration.steps[].required` | `<steps>/<step>/<stepRequired>` | Y/N. |
| `configuration.output_fields.*` | 9 tag `step*field` | Tên cột output. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 116 —
  `<step id="StepsMetrics">` → `...stepsmetrics.StepsMetricsMeta`
  (category Statistics).
- Hằng: `YES = "Y"`, `NO = "N"` (dòng 66–67).
- Serialization: `getXML()` (dòng 247–271) — `<steps>` (250–258; mỗi
  `<step>`: `name` 253, `copyNr` 254, `stepRequired` 255), rồi 9 tag
  field (260–268).
- Deserialization: `readData()` (dòng 220–245) — đếm `<step>` trong
  `<steps>` (222–223), `allocate` (225); 9 tag đọc nguyên văn.
- Khởi tạo: `setDefault()` (dòng 273–293) — 0 step, 9 tên cột từ i18n
  (`StepsMetricsDialog.Label.*`, 284–292).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker đọc `step.getStatus()` các step đích
  (`StepsMetrics.java` dòng 133) — step không tồn tại/chưa chạy cho chỉ
  số rỗng hoặc lỗi.
- Không có `<connection>`.

Cấu hình không mặc định (2 step):

```xml
<steps>
  <step>
    <name>Load customers</name>
    <copyNr>0</copyNr>
    <stepRequired>Y</stepRequired>
  </step>
  <step>
    <name>Sort orders</name>
    <copyNr>0</copyNr>
    <stepRequired>N</stepRequired>
  </step>
</steps>
<stepnamefield>STEP_NAME</stepnamefield>
<stepidfield>STEP_ID</stepidfield>
<steplinesinputfield>LINES_INPUT</steplinesinputfield>
<steplinesoutputfield>LINES_OUTPUT</steplinesoutputfield>
<steplinesreadfield>LINES_READ</steplinesreadfield>
<steplinesupdatedfield>LINES_UPDATED</steplinesupdatedfield>
<steplineswrittentfield>LINES_WRITTEN</steplineswrittentfield>
<steplineserrorsfield>LINES_ERRORS</steplineserrorsfield>
<stepsecondsfield>SECONDS</stepsecondsfield>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Item `<step>` lồng trong `<steps>`**: khi parse bằng
  fast-xml-parser, `parsed.step` là ROOT (có `<type>`), còn item nằm ở
  `parsed.step.steps.step` — test direct-child `<type>` phải đọc root.
- **`<name>` item là tham chiếu step**, không phải tên mới — step đích
  phải tồn tại trong transformation khi chạy.
- Không có `<connection>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
