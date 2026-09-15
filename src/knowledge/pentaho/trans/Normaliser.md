# Normaliser — Step chuẩn hoá dòng (columns → rows)

Biến các cột lặp (ví dụ `PRODUCT1_NR`, `PRODUCT1_SL`, …) thành các dòng: với
mỗi nhóm giá trị của trường loại (`<typefield>`), step phát một dòng mang
giá trị loại đó cộng các trường đã chuẩn hoá (`<norm>`). Ánh xạ cột→(giá trị
loại, trường đích) khai báo trong list `<fields>/<field>` với 3 tag
`<name>` (cột nguồn), `<value>` (giá trị loại) và `<norm>` (trường đích).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Normaliser</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <typefield>{{TYPE_FIELD}}</typefield>
    <fields>
      <field>
        <name>{{SOURCE_COLUMN_1}}</name>
        <value>{{TYPE_VALUE_1}}</value>
        <norm>{{TARGET_FIELD_1}}</norm>
      </field>
      <field>
        <name>{{SOURCE_COLUMN_2}}</name>
        <value>{{TYPE_VALUE_1}}</value>
        <norm>{{TARGET_FIELD_2}}</norm>
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
| `<typefield>` | Y | Tên trường loại mới được thêm vào mỗi dòng ra (kiểu `String`, độ dài = độ dài lớn nhất của các `<value>`). |
| `<fields>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Tên cột NGUỒN trong stream vào — phải tồn tại (`check()` ERROR `FieldsNotFound` nếu thiếu). |
| `<fields>/<field>/<value>` | Y | Giá trị loại của cột này (ví dụ `PRODUCT1`); các dòng ra nhóm theo giá trị này. |
| `<fields>/<field>/<norm>` | Y | Tên trường ĐÍCH sau chuẩn hoá (ví dụ `Sales`, `Number`) — mỗi giá trị distinct sinh một trường đích. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: NORMALISER` | `<type>` | `Normaliser`. |
| `configuration.type_field` | `<typefield>` | Tên trường loại mới. |
| `configuration.fields[].source_column` | `<fields>/<field>/<name>` | Cột nguồn, theo thứ tự khai báo. |
| `configuration.fields[].type_value` | `<fields>/<field>/<value>` | Giá trị loại của cột. |
| `configuration.fields[].target_field` | `<fields>/<field>/<norm>` | Trường đích sau chuẩn hoá. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 53 —
  `<step id="Normaliser">` →
  `org.pentaho.di.trans.steps.normaliser.NormaliserMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `NormaliserMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/normaliser/NormaliserMeta.java`
  dòng 255–271) — emit `<typefield>` (dòng 258) TRƯỚC, rồi wrapper
  `<fields>` LUÔN emit kể cả 0 field (dòng 260/268) chứa các `<field>`
  với `<name>` (dòng 263), `<value>` (dòng 264), `<norm>` (dòng 265).
  Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 136–138) gọi `readData()` (dòng
  162–182) — `typefield` từ tag `typefield` (dòng 164); đếm `<field>`
  trong sub-node `<fields>` (dòng 166–167), `allocate(nrfields)` (dòng
  169), mỗi `<field>` đọc `name`/`value`/`norm` (dòng 174–176). Tag thiếu
  load thành `null` (không crash khi load).
- Khởi tạo: `setDefault()` (dòng 185–197) — `typeField = "typefield"`,
  0 field (vòng lặp dòng 192–196 không chạy). Step mới chưa có ánh xạ
  nào — phải cấu hình mới chạy được.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 200–252) THÊM trường loại
  kiểu `String` (độ dài = max độ dài các `<value>`, dòng 214/221–224),
  clone mỗi trường đích distinct GIỮ NGUYÊN kiểu của cột nguồn đầu tiên
  (dòng 230–242), rồi XOÁ mọi cột nguồn đã chuẩn hoá khỏi row (dòng
  246–251) — output = input − cột nguồn + typefield + trường đích.
  `check()` (dòng 312–371) yêu cầu có input và mọi `<name>` tồn tại
  trong row trước đó.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (chuẩn hoá 2 cột sản phẩm):

```xml
<typefield>PRODUCT</typefield>
<fields>
  <field>
    <name>PRODUCT1_SL</name>
    <value>PRODUCT1</value>
    <norm>Sales</norm>
  </field>
  <field>
    <name>PRODUCT1_NR</name>
    <value>PRODUCT1</value>
    <norm>Number</norm>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`) +
`set_field_path` cho `typefield`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<value>` là GIÁ TRỊ LOẠI, `<norm>` là TRƯỜNG ĐÍCH**: đừng đảo —
  `PRODUCT1_SL` mang `<value>PRODUCT1</value>` (nhóm) và
  `<norm>Sales</norm>` (cột mới trong dòng ra). Nhầm hai tag cho kết quả
  sai lặng lẽ.
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field, nên template
  giữ `<fields></fields>` (paired), không viết self-closing `<fields/>`
  — `setFields` từ chối list self-closing.
- **Mọi `<name>` phải tồn tại trong stream vào**: thiếu → `check()` ERROR,
  nặng hơn là `getFields()` ném `KettleStepException`
  (`UnableToFindField`, dòng 237).
- **`<value>` null → NPE ở `getFields()`**: dòng 214 gọi
  `getValue().length()` không null-guard — mọi `<field>` phải có đủ 3 tag.
- **Kiểu trường đích = kiểu cột nguồn**: step clone value meta của cột
  nguồn đầu tiên cho mỗi `<norm>` distinct — cột nguồn khác kiểu nhau mà
  chung một `<norm>` cho kiểu khó đoán; giữ kiểu đồng nhất cho mỗi nhóm.
- Template mặc định là khung cấu hình — người dùng phải điền cột nguồn có
  thật trong stream trước; step 0 field (mặc định `setDefault()`) không
  chạy được.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
