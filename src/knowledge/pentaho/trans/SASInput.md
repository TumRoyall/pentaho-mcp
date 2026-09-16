# SASInput — Step đọc file SAS từ tên file động

Đọc file SAS (Statistical Analysis System) mà tên file được truyền động
trong từng dòng đầu vào qua field `<accept_field>` — step KHÔNG có tên
file tĩnh và BẮT BUỘC có input stream. Schema output do người dùng khai
báo qua list `<field>` lặp TRỰC TIẾP dưới `<step>` (không có wrapper
`<fields>`). `getFields()` append một ValueMeta cho mỗi output field.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SASInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <accept_field>${FILENAME_FIELD}</accept_field>
    <field>
      <name>SAS_COL</name>
      <rename/>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <conversion_mask/>
      <decimal/>
      <grouping/>
      <trim_type>none</trim_type>
    </field>
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
| `<accept_field>` | Y | Tên field trong dòng đầu vào chứa đường dẫn file SAS. Step bắt buộc có input (`check()` ERROR khi trống). |
| `<field>/<name>` | Y (mỗi field) | Tên cột trong file SAS cần đọc. |
| `<field>/<rename>` | N | Tên mới cho cột output; trống = giữ nguyên. |
| `<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG TÊN CHUỖI (`String`, `Integer`, `Number`, ...). |
| `<field>/<length>` | N | Độ dài; `-1` = không giới hạn (fallback khi tag thiếu). |
| `<field>/<precision>` | N | Số lẻ; `-1` = mặc định (fallback khi tag thiếu). |
| `<field>/<conversion_mask>` | N | Mask convert (date/number). |
| `<field>/<decimal>` | N | Ký tự thập phân. |
| `<field>/<grouping>` | N | Ký tự phân nhóm nghìn. |
| `<field>/<trim_type>` | N | Code trim: `none`, `left`, `right`, `both`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SAS_INPUT` | `<type>` | `SASInput` (ID giữ nguyên hoa SAS). |
| `configuration.filename_field` | `<accept_field>` | Tham chiếu field của stream trước (cần hop). |
| `configuration.fields[].name` | `<field>/<name>` | Tên cột SAS. |
| `configuration.fields[].rename` | `<field>/<rename>` | Tên output. |
| `configuration.fields[].type` | `<field>/<type>` | Tên value-meta chuỗi. |
| `configuration.fields[].length` | `<field>/<length>` | Số; `-1` = mặc định. |
| `configuration.fields[].precision` | `<field>/<precision>` | Số; `-1` = mặc định. |
| `configuration.fields[].trim_type` | `<field>/<trim_type>` | Code trim. |

Các `<field>` lặp TRỰC TIẾP dưới `<step>`, KHÔNG có wrapper `<fields>`
→ không dùng `set_fields` với `listTag`; mỗi `<field>` được fill như một
block con độc lập (giữ đúng thứ tự con: name, rename, type, length,
precision, conversion_mask, decimal, grouping, trim_type).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 126 —
  `<step id="SASInput">` →
  `org.pentaho.di.trans.steps.sasinput.SasInputMeta` (class `SasInputMeta`,
  ID giữ `SASInput`). Registry presence không phải XML evidence, evidence
  là serializer dưới đây.
- Serialization: `SasInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/sasinput/SasInputMeta.java`
  dòng 122–133) — `<accept_field>` (string) rồi N×`<field>` lặp trực tiếp
  (const `XML_TAG_FIELD="field"`, dòng 61), KHÔNG có wrapper `<fields>`.
  Thứ tự con trong mỗi `<field>` do `SasInputField.getXML()`
  (`SasInputField.java` dòng 87–101): `name`, `rename`, `type` (tên
  chuỗi), `length` (int), `precision` (int), `conversion_mask`,
  `decimal`, `grouping`, `trim_type` (code).
- Deserialization: `loadXML()` (dòng 77–90) — `accept_field=getTagValue`
  (thiếu → null); đếm `countNodes(stepnode,"field")` rồi dựng mỗi field
  qua `new SasInputField(fieldNode)` (`SasInputField.java` dòng 129–139):
  `length/precision=Const.toInt(..., -1)`; `type` map tên → id qua
  `getIdForValueMeta`; `trimType=getTrimTypeByCode` (null → none).
- Khởi tạo: `setDefault()` (dòng 73–75) — `outputFields` = list rỗng
  (non-null).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 102–120) thêm một ValueMeta cho
  mỗi output field (`rename`+type/length/precision/symbols/mask/trim,
  origin = name). `check()` (dòng 162–174) chỉ ERROR khi `acceptingField`
  rỗng.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 field khác kiểu + filename field động):

```xml
<accept_field>SRC_SAS_PATH</accept_field>
<field>
  <name>CUSTOMER_ID</name>
  <rename>CUST_ID</rename>
  <type>Integer</type>
  <length>10</length>
  <precision>0</precision>
  <conversion_mask/>
  <decimal>.</decimal>
  <grouping>,</grouping>
  <trim_type>none</trim_type>
</field>
<field>
  <name>ORDER_DATE</name>
  <rename/>
  <type>Date</type>
  <length>-1</length>
  <precision>-1</precision>
  <conversion_mask>yyyy-MM-dd</conversion_mask>
  <decimal/>
  <grouping/>
  <trim_type>none</trim_type>
</field>
```

## 5. Lưu ý / bẫy — CRITICAL

- **KHÔNG có wrapper `<fields>`**: các `<field>` nằm trực tiếp dưới
  `<step>` — không được bọc trong `<fields>` (sai schema, load bỏ qua).
  Vì vậy `setFields()` (đòi `listTag` block) KHÔNG dùng được cho step
  này; thêm field bằng cách chèn block `<field>` đầy đủ thứ tự con.
- **`<type>` là tên chuỗi, không phải số**: `String`, `Integer`, ... —
  ghi id số sẽ bị `getIdForValueMeta` map sai.
- **Bắt buộc có input stream**: tên file đến từ field của dòng trước —
  step đứng một mình không chạy được (`accept_field` rỗng → ERROR).
- **Thứ tự con trong `<field>` cố định**: name, rename, type, length,
  precision, conversion_mask, decimal, grouping, trim_type — giữ đúng
  thứ tự emit.
- Template mặc định là khung cấu hình — người dùng phải điền field tên
  file tồn tại trong stream trước và cột SAS có thật trong file.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
