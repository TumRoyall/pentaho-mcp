# SetValueField — Step gán field bằng giá trị field khác

Với MỖI dòng đầu vào, GHI ĐÈ mỗi field đã khai báo (`<field>/<name>`) bằng
giá trị của MỘT FIELD KHÁC trên cùng dòng (`<field>/<replaceby>`). Khác
`SetValueConstant` (B3a, gán hằng) và khác `IfNull` (B3a, chỉ thay khi
null) — step này copy field-to-field unconditional. Schema không đổi (sửa
tại chỗ). Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SetValueField</type>
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
        <name>{{TARGET_FIELD}}</name>
        <replaceby>{{SOURCE_FIELD}}</replaceby>
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
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field BỊ GHI ĐÈ (target). |
| `<fields>/<field>/<replaceby>` | Y (mỗi field) | Tên field NGUỒN lấy giá trị (source). `check()` ERROR khi rỗng. Chú ý viết liền, không gạch dưới. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SET_VALUE_FIELD` | `<type>` | `SetValueField`. |
| `configuration.fields[].target` | `<fields>/<field>/<name>` | Field bị ghi đè. |
| `configuration.fields[].source` | `<fields>/<field>/<replaceby>` | Field nguồn. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 93 —
  `<step id="SetValueField">` →
  `org.pentaho.di.trans.steps.setvaluefield.SetValueFieldMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SetValueFieldMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/setvaluefield/SetValueFieldMeta.java`
  dòng 148–162) — emit DUY NHẤT wrapper `<fields>` paired (dòng 151/159);
  mỗi `<field>` có `<name>` (dòng 155) + `<replaceby>` (dòng 156). Không có
  tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 97–99) gọi `readData()` (dòng
  118–135) — đếm field từ sub-node `<fields>` (dòng 120–121); mỗi `<field>`
  đọc `name` + `replaceby` (dòng 128–129), thiếu tag → null.
- Khởi tạo: `setDefault()` (dòng 137–146) — 0 field (`allocate(0)`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: gán mỗi target field bằng giá trị source field trên
  cùng dòng (copy field-to-field, unconditional). `check()` (dòng 194–236)
  đòi có input (dòng 210–219) và MỖI field phải có `replaceByFieldValue`
  non-empty (dòng 227–234) — thiếu là ERROR. `supportsErrorHandling()` =
  true (dòng 247–249).

Cấu hình không mặc định (copy địa chỉ thanh toán sang địa chỉ giao hàng):

```xml
<fields>
  <field>
    <name>SHIP_ADDR</name>
    <replaceby>BILL_ADDR</replaceby>
  </field>
  <field>
    <name>SHIP_CITY</name>
    <replaceby>BILL_CITY</replaceby>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Tag nguồn là `<replaceby>` viết liền**: viết `<replace_by>` hay
  `<replaceBy>` sẽ bị loader bỏ qua lặng lẽ (null → `check()` ERROR
  `ReplaceByValueMissing`). Khác quy ước snake_case của đa số step.
- **Source là FIELD, không phải hằng**: cần gán hằng thì dùng
  `SetValueConstant` (B3a); cần thay khi null thì dùng `IfNull` (B3a).
  Nhầm ba step này là lỗi phổ biến nhất khi đọc tên.
- **`<replaceby>` rỗng = ERROR, không phải bỏ qua**: `check()` dòng
  227–234 báo ERROR cho mọi field thiếu source — template LUÔN giữ tag này
  (kể cả khi chưa biết tên field, điền placeholder rồi sửa sau).
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field, nên template
  giữ paired, không viết self-closing `<fields/>` — `setFields` từ chối
  list self-closing.
- Template mặc định là khung cấu hình — người dùng phải điền target/source
  field tồn tại trong stream trước (cả hai phía đều phải có mặt khi chạy).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
