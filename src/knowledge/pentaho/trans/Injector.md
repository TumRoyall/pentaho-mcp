# Injector — Step chèn schema/field tay (không input)

Step nguồn KHÔNG nhận input (`check()` ERROR khi có input): người dùng
khai báo thủ công list `<fields>/<field>` (`name`, `type` tên chuỗi,
`length`, `precision`), `getFields()` append một ValueMeta cho mỗi khai
báo. Dùng để định nghĩa schema cho các step đọc metadata hoặc làm
khung row khi không có nguồn dữ liệu.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Injector</type>
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
        <name>FIELD1</name>
        <type>String</type>
        <length>-1</length>
        <precision>-1</precision>
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
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field chèn vào row. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG TÊN CHUỖI (`String`, `Integer`, ...) qua `ValueMetaFactory.getValueMetaName`. |
| `<fields>/<field>/<length>` | N | Độ dài; `-2` = fallback khi tag thiếu/non-numeric. |
| `<fields>/<field>/<precision>` | N | Số lẻ; `-2` = fallback khi tag thiếu/non-numeric. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: INJECTOR` | `<type>` | `Injector`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Tên field. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |
| `configuration.fields[].length` | `<fields>/<field>/<length>` | Số. |
| `configuration.fields[].precision` | `<fields>/<field>/<precision>` | Số. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 15 —
  `<step id="Injector">` →
  `org.pentaho.di.trans.steps.injector.InjectorMeta` (category Inline).
  Registry presence không phải XML evidence, evidence là serializer dưới
  đây.
- Serialization: `InjectorMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/injector/InjectorMeta.java`
  dòng 151–166) — wrapper `<fields>` vô điều kiện, mỗi `<field>` có
  `name` (string), `type` (tên chuỗi qua
  `ValueMetaFactory.getValueMetaName`), `length` (int), `precision`
  (int), đúng thứ tự này.
- Deserialization: `loadXML()` (dòng 135–137) gọi `readData()` (dòng
  168–182) — `fieldname=null` khi `<name>` thiếu; `type` map tên → id
  qua `getIdForValueMeta`; `length/precision=Const.toInt(tag, -2)`
  (thiếu/rỗng/non-numeric → `-2`). Node `<fields>` thiếu →
  `countNodes(null)` = 0 → `allocate(0)`, không crash.
- Khởi tạo: `setDefault()` (dòng 184–186) — `allocate(0)` (rỗng).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 222–233) append
  `createValueMeta(fieldname[i], type[i], length[i], precision[i])` cho
  mỗi khai báo. `check()` (dòng 242–257) ERROR khi `input.length>0`
  (không nhận input).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (3 field khác kiểu):

```xml
<fields>
  <field>
    <name>CUSTOMER_ID</name>
    <type>Integer</type>
    <length>10</length>
    <precision>0</precision>
  </field>
  <field>
    <name>ORDER_TOTAL</name>
    <type>Number</type>
    <length>12</length>
    <precision>2</precision>
  </field>
  <field>
    <name>ORDER_DATE</name>
    <type>Date</type>
    <length>-1</length>
    <precision>-1</precision>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Không nhận input**: nối hop vào là `check()` ERROR — step này đứng
  đầu luồng, không phải bộ lọc giữa chừng.
- **`<type>` là tên chuỗi** (`String`, `Integer`, ...) — không ghi id số.
- **`length/precision` fallback `-2`** (không phải `-1`) khi tag
  thiếu/non-numeric — khác với đa số input step.
- **List `<fields>/<field>` paired** — giữ paired, self-closing làm
  `setFields` ném lỗi.
- Template mặc định là khung cấu hình — người dùng phải điền fields có
  nghĩa cho luồng downstream.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
