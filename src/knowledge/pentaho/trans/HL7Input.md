# HL7Input — Step parse bản tin HL7

Parse field chứa bản tin HL7 (`<message_field>` — tag DUY NHẤT serialize)
và phát mỗi segment/field thành dòng với 10 cột String cố định
(`ParentGroup`, `Group`, `HL7Version`, `StructureName`,
`StructureNumber`, `FieldName`, `Coordinates`, `HL7DataType`,
`FieldDescription`, `Value`). `getFields()` append 10 cột (không clear);
`check()` ERROR khi không có input.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>HL7Input</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <message_field>HL7_MESSAGE</message_field>
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
| `<message_field>` | Y | Tên field trong dòng đầu vào chứa bản tin HL7 cần parse. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: HL7_INPUT` | `<type>` | `HL7Input`. |
| `configuration.message_field` | `<message_field>` | Tham chiếu field của stream trước (cần hop). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="HL7Input", ...)`
  (`plugins/hl7/core/src/main/java/org/pentaho/di/trans/steps/hl7input/HL7InputMeta.java`
  dòng 47–50). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `HL7InputMeta.getXML()` (dòng 71–74) — DUY NHẤT
  `<message_field>` (string, vô điều kiện). Không có tag nào khác.
- Deserialization: `readData()` (dòng 76–78, qua `loadXML` dòng 60–63)
  — `messageField=getTagValue(stepnode, "message_field")` (thiếu →
  null); không boolean/int, không try/catch. `readRep` (dòng 84–88) /
  `saveRep` (dòng 90–94) cùng key `message_field`.
- Khởi tạo: `setDefault()` (dòng 80–82) rỗng — `messageField` giữ null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 96–139) append 10 cột
  `ValueMetaString` cố định (không `clear` — giữ input + thêm 10 cột).
  `check()` (dòng 141–170) WARNING khi `prev` rỗng, ERROR khi
  `input.length==0`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (field bản tin tùy tên):

```xml
<message_field>ADT_MESSAGE</message_field>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Chỉ 1 tag cấu hình**: mọi tag khác trong file lạ đều không phải của
  step này — đừng bịa thêm.
- **Thiếu tag → null lặng lẽ** (không throw, không default) — template
  luôn emit `<message_field>`.
- **Bắt buộc có input**: bản tin đến từ field của stream trước — đứng một
  mình fail `check()`.
- **Output = input + 10 cột**: khác với các input step nuốt row — cột gốc
  được giữ lại.
- Template mặc định là khung cấu hình — người dùng phải điền field chứa
  bản tin HL7 hợp lệ tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
