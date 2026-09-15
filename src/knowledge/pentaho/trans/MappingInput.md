# MappingInput — Step khai báo input của sub-transformation

Nằm BÊN TRONG sub-transformation được gọi bởi step `Mapping`. Khai báo
schema mà transformation cha truyền vào: danh sách field tĩnh
(`name`/`type`/`length`/`precision`) và cờ `select_unspecified` quyết
định cách sắp xếp các field trong row trả về khi có metadata từ cha:
`Y` đưa field đã khai báo lên trước rồi thêm các field còn lại đã sort
theo tên; `N` giữ nguyên toàn bộ row cha truyền vào (chỉ kiểm tra các
field khai báo tồn tại) — `N` KHÔNG loại cột thừa. Không có input
stream — step này là cổng vào của mapping.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MappingInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <length>-1</length>
        <precision>-1</precision>
      </field>
      <select_unspecified>N</select_unspecified>
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
| `<fields>/<field>/<name>` | Y | Tên field input. Item có `name` rỗng bị `getXML()` bỏ qua khi lưu. |
| `<fields>/<field>/<type>` | Y | Tên kiểu ValueMeta (`String`, `Integer`, ... qua `ValueMetaFactory.getValueMetaName()`). |
| `<fields>/<field>/<length>` | Y | Độ dài; `setDefault` không sinh item nào, load thiếu tag → `-1`. |
| `<fields>/<field>/<precision>` | Y | Độ chính xác; load thiếu tag → `-1`. |
| `<fields>/<select_unspecified>` | Y | `Y` = đưa field đã khai báo lên trước, các field còn lại sort theo tên đặt sau. `N` = giữ nguyên toàn bộ row cha truyền vào (merge `inputRowMeta`, chỉ validate field khai báo tồn tại) — KHÔNG dùng `N` để loại cột. Nằm BÊN TRONG `<fields>`, không phải con trực tiếp của `<step>`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAPPING_INPUT` | `<type>` | `MappingInput`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Bỏ item `name` rỗng (source không serialize). |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên kiểu ValueMeta. |
| `configuration.fields[].length` | `<fields>/<field>/<length>` | Số nguyên. |
| `configuration.fields[].precision` | `<fields>/<field>/<precision>` | Số nguyên. |
| `configuration.select_unspecified` | `<fields>/<select_unspecified>` | true→Y, false→N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (`<step
  id="MappingInput">`,
  `classname=org.pentaho.di.trans.steps.mappinginput.MappingInputMeta`,
  category Mapping). Class không mang annotation `@Step`.
- Serialization:
  `engine/src/main/java/org/pentaho/di/trans/steps/mappinginput/MappingInputMeta.java
  :: getXML()` (dòng 195–218) — mở `<fields>`, lặp các field có `name`
  khác rỗng, mỗi item đúng thứ tự `name`, `type` (qua
  `ValueMetaFactory.getValueMetaName`), `length`, `precision`; sau vòng
  lặp ghi `select_unspecified` (boolean qua
  `XMLHandler.addTagValue(tag, bool)` → `Y`/`N`, xem
  `core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java` dòng
  869–870) RỒI mới đóng `</fields>`.
- Deserialization: `loadXML()` (dòng 143–145) gọi `readData()` (dòng
  168–193) — đọc `field` dưới node `<fields>`; `length`/`precision` qua
  `Const.toInt(tag, -1)` (KHÁC default `-2` của `RowsFromResult`);
  `selectingAndSortingUnspecifiedFields =
  "Y".equalsIgnoreCase(getTagValue(fields, "select_unspecified"))` —
  parser boolean phân biệt duy nhất `Y` (không phân biệt hoa/thường),
  mọi giá trị khác kể cả `true` đều thành false.
- Khởi tạo: `setDefault()` (dòng 220–233) đặt
  `selectingAndSortingUnspecifiedFields = false` và `allocate(0)` —
  step mới RỖNG field và `select_unspecified=N`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment `<fields>` bằng `name`/`type`/`description`/
  `distribute`/`copies`/`partitioning` + `attributes`/`cluster_schema`/
  `remotesteps`/`GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 235–341) — khi transformation
  cha đã truyền `inputRowMeta` (kèm `valueRenames` do step `Mapping`
  điều khiển): nhánh `selectingAndSortingUnspecifiedFields=true` dựng
  row mới gồm field đã khai báo theo đúng thứ tự khai báo, rồi thêm các
  field còn lại đã sort theo tên; nhánh `false` merge NGUYÊN VẸN
  `inputRowMeta` (giữ thứ tự gốc, không loại cột) rồi chỉ kiểm tra mọi
  field khai báo tồn tại — thiếu thì ném `KettleStepException`
  (`UnknownField`). Ví dụ (chưa có rename): cha truyền `[b,a,c]`, khai
  báo `[a]` → `N` giữ `[b,a,c]`; `Y` sắp thành `[a,b,c]`.
  Khi chưa có `inputRowMeta` và row rỗng, dựng ValueMeta tĩnh từ khai
  báo (`TYPE_NONE` → `TYPE_STRING`). `check()` (dòng 385–413) coi việc
  nhận input stream là ERROR — cổng mapping không có input.

Cấu hình 2 field khác kiểu + `select_unspecified` (đúng thứ tự source):

```xml
<fields>
  <field>
    <name>customer_id</name>
    <type>Integer</type>
    <length>10</length>
    <precision>0</precision>
  </field>
  <field>
    <name>customer_name</name>
    <type>String</type>
    <length>50</length>
    <precision>-1</precision>
  </field>
  <select_unspecified>Y</select_unspecified>
</fields>
```

## 5. Lưu ý / bẫy

- `<select_unspecified>` nằm TRONG `<fields>` — đừng đặt thành con trực
  tiếp của `<step>`; `readData()` đọc nó từ node `fields`
  (`XMLHandler.getTagValue(fields, "select_unspecified")`).
- Chỉ `Y` (mọi kiểu hoa/thường) bật cờ; `true`/`1`/`yes` đều thành false
  khi load lại. Generator luôn ghi `Y`/`N`.
- Field `name` rỗng không được serialize — template sinh ra từ `setFields`
  phải có tên thật, không để placeholder rỗng khi lưu production.
- `length`/`precision` default khi load thiếu tag là `-1`, KHÁC `-2` của
  `RowsFromResult` — đừng copy default giữa hai step này.
- Tên field khai báo ở đây phải khớp `<child>` (target) của
  `<connector>` trong input-mapping bên step `Mapping` phía gọi — tức
  tên sau rename, phía sub nhìn thấy (`MappingMeta.java` dòng 459–465:
  tìm `sourceValueName` trong row cha rồi đổi thành `targetValueName`
  trước khi giao cho MappingInput). Còn `output_step` của input-mapping
  là TÊN STEP `MappingInput` trong sub (`Mapping.java` dòng 376–393,
  `MappingMeta.java` dòng 489) — đừng điền tên field vào đó.
- Đừng dùng `select_unspecified=N` để loại cột thừa: nhánh `false`
  merge toàn bộ row cha. Muốn downstream chỉ thấy field khai báo, đặt
  `Y` (field khai báo lên trước, còn lại sort sau) rồi dùng step chọn
  cột phía sau, hoặc khai báo đầy đủ.
- Template mặc định là khung cấu hình — người dùng phải điền field khớp
  với mapping phía gọi trước khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed` — không tuyên bố
  hai mức này.
