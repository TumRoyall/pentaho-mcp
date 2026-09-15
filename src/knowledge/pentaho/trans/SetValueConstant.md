# SetValueConstant — Step gán hằng cho field

Với MỖI dòng đầu vào, GHI ĐÈ mỗi field đã khai báo bằng một hằng
(`<value>`, convert theo mask), hoặc bằng chuỗi rỗng
(`<set_empty_string>Y</set_empty_string>`). Khác `IfNull` (chỉ thay khi
null), step này gán unconditional — mọi dòng đều bị ghi đè. Tùy chọn
substitute biến trong hằng (`<usevar>Y</usevar>`). Schema không đổi
(sửa tại chỗ). Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SetValueConstant</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <usevar>N</usevar>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <value>{{CONSTANT_VALUE}}</value>
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
| `<usevar>` | N | `Y` = substitute `${VAR}` trong hằng trước khi gán. Mặc định `N` (thiếu tag → false). Chú ý toàn chữ thường. |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field bị ghi đè. |
| `<fields>/<field>/<value>` | N | Hằng gán vào field (chuỗi; convert theo kiểu field + mask, hoặc substitute biến khi `usevar=Y`). |
| `<fields>/<field>/<mask>` | N | Mask chuyển kiểu cho hằng (vd mask ngày/số). |
| `<fields>/<field>/<set_empty_string>` | N | `Y` = gán chuỗi rỗng thay vì `<value>`. Mặc định `N`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SET_VALUE_CONSTANT` | `<type>` | `SetValueConstant`. |
| `configuration.use_variables` | `<usevar>` | Boolean → Y/N, chữ thường. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Tên field. |
| `configuration.fields[].value` | `<fields>/<field>/<value>` | Hằng (có thể `${VAR}`). |
| `configuration.fields[].mask` | `<fields>/<field>/<mask>` |  |
| `configuration.fields[].empty_string` | `<fields>/<field>/<set_empty_string>` | Boolean → Y/N. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 92 —
  `<step id="SetValueConstant">` →
  `org.pentaho.di.trans.steps.setvalueconstant.SetValueConstantMeta`
  (category Transform). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `SetValueConstantMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/setvalueconstant/SetValueConstantMeta.java`
  dòng 115–130) — thứ tự `usevar` (Y/N) rồi wrapper `<fields>` LUÔN
  emit (dòng 118/127) chứa các `<field>` mỗi item `name` + `value` +
  `mask` + `set_empty_string` (Y/N, dòng 119–126). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 81–83) gọi `readData()` (dòng
  93–113) — `usevar` parse bằng `"Y".equalsIgnoreCase` (thiếu tag →
  false, dòng 95); mỗi `<field>` đọc `name`/`value`/`mask` nguyên văn
  (dòng 102–104); `set_empty_string` parse bằng `!isEmpty && "Y"`
  (dòng 105–106 — thiếu/rỗng tag → false).
- Khởi tạo: `setDefault()` (dòng 132–134) chỉ đặt `usevar=false`.
  List `fields` khởi tạo sẵn rỗng tại khai báo (dòng 60:
  `new ArrayList<>()`) — step mới có 0 field, không có null trap ở list.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: gán unconditional từng dòng (ngược với IfNull chỉ
  khi null); `check()` (dòng 170–228) đòi tên field cấu hình tồn tại
  trong stream trước, WARNING khi 0 field, ERROR khi không có input.
  Schema không đổi (ghi đè tại chỗ).
- Không có `<connection>`: step không tham chiếu DB — template không
  mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (biến + hằng + chuỗi rỗng):

```xml
<usevar>Y</usevar>
<fields>
  <field>
    <name>LOAD_DATE</name>
    <value>${LOAD_DATE}</value>
    <mask>yyyy-MM-dd</mask>
    <set_empty_string>N</set_empty_string>
  </field>
  <field>
    <name>STATUS</name>
    <value>ACTIVE</value>
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

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Ghi đè unconditional — KHÔNG phải thay-null**: cần "chỉ thay khi
  null" thì dùng   `IfNull`. Nhầm hai step sẽ:
  (a) mất dữ liệu gốc (SetValueConstant xóa mọi giá trị cũ), hoặc
  (b) null còn sót (IfNull giữ nguyên giá trị non-null).
- **Shape `<fields>/<field>` giống hệt IfNull**: `name`/`value`/
  `mask`/`set_empty_string` — nhưng top flag khác (`usevar` vs
  `select*/replaceAll*`) và KHÔNG có bảng `<valuetypes>`. Phân biệt
  bằng `<type>` step, không đoán từ tên field.
- **`<usevar>` chữ thường toàn bộ**: sai thành `<useVar>` sẽ bị loader
  bỏ qua (luôn false) — hằng `${VAR}` giữ nguyên văn không substitute.
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field — template
  giữ `<fields></fields>` paired, không viết self-closing `<fields/>`
  (`setFields` từ chối list self-closing).
- **Step mới có 0 field**: `setDefault()` không seed field nào — file
  chỉ có wrapper rỗng là hợp lệ nhưng không làm gì; `check()` WARNING
  `NoFieldsEntered`.
- Template mặc định là khung cấu hình — người dùng phải điền field tồn
  tại trong stream trước; hằng ngày/số cần mask khớp kiểu field.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
