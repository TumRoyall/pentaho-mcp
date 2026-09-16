# RandomCCNumberGenerator — Step sinh số thẻ ngẫu nhiên (test data)

Step nguồn sinh dữ liệu kiểm thử: mỗi dòng ra gồm số thẻ ngẫu nhiên
(`cardNumberFieldName`, String — LUÔN add kể cả null/rỗng), loại thẻ
(`cardTypeFieldName`, String — chỉ khi non-empty) và độ dài
(`cardLengthFieldName`, Integer — chỉ khi non-empty). Mỗi cấu hình sinh
trong list `<fields>/<field>` gồm `cctype`/`cclen`/`ccsize` (3 string);
`check()` validate `cclen`/`ccsize` là số >= 0 (`Const.toInt(..., -1)<0`
→ ERROR). Output-only (`StepIOMeta(false,true,...)`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RandomCCNumberGenerator</type>
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
        <cctype>Visa</cctype>
        <cclen>16</cclen>
        <ccsize>10</ccsize>
      </field>
    </fields>
    <cardNumberFieldName>cardNumber</cardNumberFieldName>
    <cardLengthFieldName>cardLength</cardLengthFieldName>
    <cardTypeFieldName>cardType</cardTypeFieldName>
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
| `<fields>/<field>/<cctype>` | Y (mỗi field) | Loại thẻ sinh (ví dụ `Visa`, `MasterCard`). |
| `<fields>/<field>/<cclen>` | Y | Độ dài số thẻ (chuỗi số, >= 0 sau substitute; lỗi → `check()` ERROR `WrongLen`). |
| `<fields>/<field>/<ccsize>` | Y | Số lượng sinh (chuỗi số, >= 0; lỗi → ERROR `WrongSize`). |
| `<cardNumberFieldName>` | Y | Tên cột số thẻ (String, luôn add; `check()` ERROR khi rỗng). |
| `<cardLengthFieldName>` | N | Tên cột độ dài (Integer, chỉ khi non-empty). |
| `<cardTypeFieldName>` | N | Tên cột loại thẻ (String, chỉ khi non-empty). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RANDOM_CC_NUMBER_GENERATOR` | `<type>` | `RandomCCNumberGenerator`. |
| `configuration.rules[].card_type` | `<fields>/<field>/<cctype>` | Loại thẻ. |
| `configuration.rules[].length` | `<fields>/<field>/<cclen>` | Chuỗi số. |
| `configuration.rules[].size` | `<fields>/<field>/<ccsize>` | Chuỗi số. |
| `configuration.number_field` | `<cardNumberFieldName>` | Giữ đúng camelCase. |
| `configuration.length_field` | `<cardLengthFieldName>` | Giữ đúng camelCase. |
| `configuration.type_field` | `<cardTypeFieldName>` | Giữ đúng camelCase. |

`<fields>` chứa list `<field>` đồng nhất (`cctype`/`cclen`/`ccsize`) →
fill bằng MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).
3 tag tên cột là camelCase (khác convention snake_case) — giữ đúng.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 114 —
  `<step id="RandomCCNumberGenerator">` →
  `org.pentaho.di.trans.steps.randomccnumber.RandomCCNumberGeneratorMeta`
  (category Input). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `RandomCCNumberGeneratorMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/randomccnumber/RandomCCNumberGeneratorMeta.java`
  dòng 250–268) — wrapper `<fields>` + lặp `<field>` (`cctype`, `cclen`,
  `ccsize` — 3 string, thứ tự cố định), rồi 3 tag camelCase
  `cardNumberFieldName`, `cardLengthFieldName`, `cardTypeFieldName`.
- Deserialization: `loadXML()` (dòng 167–169) gọi `readData()` (dòng
  190–211) — `getSubNode(stepnode,"fields")` +
  `countNodes(fields,"field")` → `allocate(count)` (dòng 171–175); mỗi
  item `cctype/cclen/ccsize` null khi thiếu; 3 `card*FieldName` null khi
  thiếu. **BẪY**: `clone()` (dòng 177–188) deref `fieldCCType.length` →
  NPE nếu chưa `allocate` (XML thiếu `<fields>` mà không qua
  `readData`/`setDefault`) — template luôn giữ `<fields>` paired.
- Khởi tạo: `setDefault()` (dòng 213–226) — `allocate(0)` (vòng for
  chết); 3 tên cột = i18n `RandomCCNumberGeneratorMeta.CardNumberField/
  CardLengthField/CardTypeField`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 228–248) luôn add
  `cardNumberFieldName`:String (kể cả null/rỗng), + `cardTypeFieldName`:
  String khi non-empty, + `cardLengthFieldName`:Integer khi non-empty.
  `check()` (dòng 306–340): `Const.toInt(env(cclen),-1)<0` → ERROR
  `WrongLen`; `Const.toInt(env(ccsize),-1)<0` → ERROR `WrongSize`;
  `cardNumberFieldName` rỗng → ERROR. `getStepIOMeta()` (dòng 354–356)
  output-only (`new StepIOMeta(false,true,false,false,false,false)`).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 loại thẻ):

```xml
<fields>
  <field>
    <cctype>Visa</cctype>
    <cclen>16</cclen>
    <ccsize>100</ccsize>
  </field>
  <field>
    <cctype>MasterCard</cctype>
    <cclen>16</cclen>
    <ccsize>50</ccsize>
  </field>
</fields>
<cardNumberFieldName>PAN</cardNumberFieldName>
<cardLengthFieldName>PAN_LEN</cardLengthFieldName>
<cardTypeFieldName>BRAND</cardTypeFieldName>
```

Fill fields bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Chỉ dùng cho test data**: số sinh ra trông như thật nhưng không phải
  thẻ thật — không bao giờ đưa vào hệ thống thanh toán thật.
- **`cclen`/`ccsize` phải là số >= 0** sau substitute — chữ/lỗi substitute
  → `check()` ERROR (fallback `-1`).
- **3 tag tên cột camelCase** — viết snake (`card_number_field_name`) là
  sai tag.
- **`<fields>` luôn paired** — thiếu wrapper có thể NPE ở `clone()`.
- **Output-only** — nối hop vào là sai thiết kế (step nguồn).
- Template mặc định là khung cấu hình — tên cột i18n mặc định nên đổi
  thành tên nghiệp vụ.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
