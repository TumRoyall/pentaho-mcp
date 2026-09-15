# IfNull — Step thay giá trị null bằng giá trị khác

Với MỖI dòng đầu vào, thay các field đang null bằng giá trị thay thế:
theo từng field cụ thể (bảng `<fields>`) và/hoặc theo mọi field của một
kiểu dữ liệu (bảng `<valuetypes>`), kèm giá trị dùng chung cho tất cả
(`<replaceAllByValue>`) và mask chuyển kiểu. Step sửa TẠI CHỖ trên row
— schema output = input schema (không thêm/bớt cột). Step không cần DB
connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>IfNull</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <replaceAllByValue/>
    <replaceAllMask/>
    <selectFields>Y</selectFields>
    <selectValuesType>N</selectValuesType>
    <setEmptyStringAll>N</setEmptyStringAll>
    <valuetypes>
      <valuetype>
        <name>String</name>
        <value/>
        <mask/>
        <set_type_empty_string>N</set_type_empty_string>
      </valuetype>
    </valuetypes>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <value>{{REPLACE_VALUE}}</value>
        <mask/>
        <set_empty_string>N</set_empty_string>
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
| `<replaceAllByValue>` | N | Giá trị thay thế dùng chung cho mọi null (chuỗi; convert theo kiểu field + mask). |
| `<replaceAllMask>` | N | Mask chuyển kiểu cho giá trị dùng chung (vd mask ngày/số). |
| `<selectFields>` | N | `Y` = áp dụng bảng thay thế theo field. Mặc định `N` (thiếu tag → false). |
| `<selectValuesType>` | N | `Y` = áp dụng bảng thay thế theo kiểu dữ liệu. Mặc định `N`. |
| `<setEmptyStringAll>` | N | `Y` = thay null bằng chuỗi rỗng cho tất cả (thay vì giá trị cấu hình). Mặc định `N`. |
| `<valuetypes>/<valuetype>/<name>` | Y (mỗi valuetype) | Tên kiểu dữ liệu áp dụng (vd `String`). |
| `<valuetypes>/<valuetype>/<value>` | N | Giá trị thay thế cho kiểu này. |
| `<valuetypes>/<valuetype>/<mask>` | N | Mask chuyển kiểu cho giá trị trên. |
| `<valuetypes>/<valuetype>/<set_type_empty_string>` | N | `Y` = thay bằng chuỗi rỗng cho kiểu này (thay vì `<value>`). Chú ý tiền tố `set_type_`. |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field cần thay null. |
| `<fields>/<field>/<value>` | N | Giá trị thay thế cho field này. |
| `<fields>/<field>/<mask>` | N | Mask chuyển kiểu cho giá trị trên. |
| `<fields>/<field>/<set_empty_string>` | N | `Y` = thay bằng chuỗi rỗng cho field này. KHÔNG có tiền tố `type_`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: IF_NULL` | `<type>` | `IfNull`. |
| `configuration.replace_all_by_value` | `<replaceAllByValue>` |  |
| `configuration.replace_all_mask` | `<replaceAllMask>` |  |
| `configuration.select_fields` | `<selectFields>` | Boolean → Y/N. |
| `configuration.select_values_type` | `<selectValuesType>` | Boolean → Y/N. |
| `configuration.set_empty_string_all` | `<setEmptyStringAll>` | Boolean → Y/N. |
| `configuration.value_types[].type` | `<valuetypes>/<valuetype>/<name>` | Tên kiểu dữ liệu. |
| `configuration.value_types[].value` | `<valuetypes>/<valuetype>/<value>` |  |
| `configuration.value_types[].mask` | `<valuetypes>/<valuetype>/<mask>` |  |
| `configuration.value_types[].empty_string` | `<valuetypes>/<valuetype>/<set_type_empty_string>` | Có tiền tố `set_type_`. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Tên field. |
| `configuration.fields[].value` | `<fields>/<field>/<value>` |  |
| `configuration.fields[].mask` | `<fields>/<field>/<mask>` |  |
| `configuration.fields[].empty_string` | `<fields>/<field>/<set_empty_string>` | Không có `type_`. |

HAI list lặp độc lập (`<valuetypes>`/`<valuetype>` và
`<fields>`/`<field>`) → fill mỗi list bằng MỘT lần `set_fields`
riêng. Cả hai wrapper LUÔN paired kể cả rỗng — self-closing làm
`setFields` từ chối.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 85 —
  `<step id="IfNull">` →
  `org.pentaho.di.trans.steps.ifnull.IfNullMeta` (category Utility).
  Registry presence không phải XML evidence, evidence là serializer
  dưới đây.
- Serialization: `IfNullMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/ifnull/IfNullMeta.java`
  dòng 334–367) — thứ tự `replaceAllByValue`, `replaceAllMask`,
  `selectFields` (Y/N), `selectValuesType` (Y/N),
  `setEmptyStringAll` (Y/N), rồi wrapper `<valuetypes>` LUÔN emit
  (dòng 343/353) chứa các `<valuetype>` (`name` + `value` + `mask` +
  `set_type_empty_string` Y/N, dòng 344–352), rồi wrapper `<fields>`
  LUÔN emit (dòng 355/364) chứa các `<field>` (`name` + `value` +
  `mask` + `set_empty_string` Y/N, dòng 356–363). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 215–217) gọi `readData()` (dòng
  296–332) — 2 cờ select parse bằng `"Y".equalsIgnoreCase` (thiếu tag
  → false, dòng 298–299); `replaceAll*` đọc nguyên văn (dòng
  300–301); `setEmptyStringAll` và cả hai cờ empty-string trong list
  parse bằng `!isEmpty && "Y"` (dòng 302–303, 317–319, 326–327 —
  thiếu/rỗng tag → false); counts từ sub-node `valuetypes`/`fields`
  (dòng 305–308).
- Khởi tạo: `setDefault()` (dòng 369–398) đặt 2 giá trị chung null, 3
  cờ false, 0 valuetype + 0 field (block `for` seed chỉ là comment —
  step mới luôn rỗng).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: class KHÔNG override `getFields(RowMetaInterface,
  ...)` — chỉ có accessor `getFields()` TRẢ VỀ mảng cấu hình
  (dòng 280–282). Schema không đổi: thay null tại chỗ trên row, output
  = input schema. `check()` (dòng 456–515) đòi tên field cấu hình tồn
  tại trong stream trước, WARNING khi 0 field, ERROR khi không có input.
- Không có `<connection>`: step không tham chiếu DB — template không
  mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (1 field + 1 kiểu String về chuỗi rỗng):

```xml
<replaceAllByValue/>
<replaceAllMask/>
<selectFields>Y</selectFields>
<selectValuesType>Y</selectValuesType>
<setEmptyStringAll>N</setEmptyStringAll>
<valuetypes>
  <valuetype>
    <name>String</name>
    <value/>
    <mask/>
    <set_type_empty_string>Y</set_type_empty_string>
  </valuetype>
</valuetypes>
<fields>
  <field>
    <name>NICKNAME</name>
    <value>N/A</value>
    <mask/>
    <set_empty_string>N</set_empty_string>
  </field>
  <field>
    <name>NOTES</name>
    <value/>
    <mask/>
    <set_empty_string>Y</set_empty_string>
  </field>
</fields>
```

Fill mỗi list bằng `set_fields` riêng (`listTag=valuetypes`/
`itemTag=valuetype`; `listTag=fields`/`itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Hai cờ empty-string KHÁC TÊN nhau**: trong `<valuetype>` là
  `<set_type_empty_string>`, trong `<field>` là `<set_empty_string>`.
  Đặt nhầm tên (kể cả nhầm vị trí) sẽ bị loader bỏ qua lặng lẽ (luôn
  false).
- **Cờ select gate cả bảng**: `selectFields=N` thì bảng `<fields>` bị
  bỏ qua ở runtime dù vẫn load/save đầy đủ — cấu hình field mà quên bật
  cờ là lỗi phổ biến nhất.
- **`getFields()` ở class này là accessor cấu hình**: đừng đọc
  `Fields[] getFields()` (dòng 280) như khai báo schema — step không
  thêm cột nào.
- **Đừng nhầm với `SetValueConstant`**: shape `<fields>/<field>`
  (`name`/`value`/`mask`/`set_empty_string`) GIỐNG HỆT nhau, nhưng top
  flag khác (`select*/replaceAll*` vs `usevar`) và IfNull có thêm bảng
  `<valuetypes>`. Sai `<type>` step là sai semantics (thay null vs gán
  hằng).
- **`<mask>` rỗng là hợp lệ**: mask chỉ cần khi giá trị thay thế phải
  convert kiểu (số/ngày); chuỗi thay cho field String để mask trống.
- Template mặc định là khung cấu hình — người dùng phải điền field tồn
  tại trong stream trước và bật đúng cờ select.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
