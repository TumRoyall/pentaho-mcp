# Denormaliser — Step xoay dòng thành cột (pivot)

Gom các dòng theo trường nhóm (`<group>`) và xoay cặp
(khoá `<key_field>`, giá trị) thành các cột đích: mỗi `<fields>/<field>`
khai báo cột nguồn (`<field_name>`), giá trị khoá (`<key_value>`) kích hoạt
nó, và đặc tả cột đích (`<target_name>` + kiểu/định dạng/độ dài/độ chính
xác/ký hiệu + chuỗi null + kiểu gộp khi trùng khoá). Đây là chiều NGƯỢC của
`Normaliser`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Denormaliser</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <key_field>{{KEY_FIELD}}</key_field>
    <group>
      <field>
        <name>{{GROUP_FIELD}}</name>
      </field>
    </group>
    <fields>
      <field>
        <field_name>{{SOURCE_FIELD}}</field_name>
        <key_value>{{KEY_VALUE}}</key_value>
        <target_name>{{TARGET_FIELD}}</target_name>
        <target_type>String</target_type>
        <target_format/>
        <target_length>-1</target_length>
        <target_precision>-1</target_precision>
        <target_decimal_symbol/>
        <target_grouping_symbol/>
        <target_currency_symbol/>
        <target_null_string/>
        <target_aggregation_type>-</target_aggregation_type>
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
| `<key_field>` | Y | Cột khoá chứa giá trị phân biệt (`keyValue`) — `getFields()` ném lỗi khi rỗng hoặc không có trong row vào. |
| `<group>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Trường nhóm — các dòng cùng nhóm gộp thành một dòng ra. |
| `<field_name>` | Y | Cột nguồn chứa giá trị cần xoay. |
| `<key_value>` | Y | Giá trị của `<key_field>` kích hoạt dòng khai báo này. |
| `<target_name>` | Y | Tên cột đích trong dòng ra. |
| `<target_type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Integer`, `Number`, `Date`, …) — không phải số id. |
| `<target_format>` | N | Conversion mask (ví dụ `yyyy-MM-dd`); rỗng = mặc định. |
| `<target_length>` / `<target_precision>` | N | Số; thiếu tag load thành `-1` (không giới hạn). |
| `<target_decimal_symbol>` / `<target_grouping_symbol>` / `<target_currency_symbol>` | N | Ký hiệu số/tiền tệ; rỗng = mặc định locale. |
| `<target_null_string>` | N | Chuỗi thay giá trị null. |
| `<target_aggregation_type>` | N | Một trong `-`, `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT_ALL`, `CONCAT_COMMA` (`-` = không gộp); chuỗi lạ load thành `-`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DENORMALISER` | `<type>` | `Denormaliser`. |
| `configuration.key_field` | `<key_field>` | Cột khoá. |
| `configuration.group_fields[].field` | `<group>/<field>/<name>` | Trường nhóm theo thứ tự. |
| `configuration.targets[].source_field` | `<fields>/<field>/<field_name>` | Cột nguồn. |
| `configuration.targets[].key_value` | `<fields>/<field>/<key_value>` | Giá trị khoá kích hoạt. |
| `configuration.targets[].target_field` | `<fields>/<field>/<target_name>` | Cột đích. |
| `configuration.targets[].target_type` | `<fields>/<field>/<target_type>` | Tên value-meta chuỗi. |
| `configuration.targets[].format/length/precision/symbols/null_string` | các tag `target_*` tương ứng | Giữ thứ tự `getXML()`. |
| `configuration.targets[].aggregation` | `<fields>/<field>/<target_aggregation_type>` | Enum gộp, mặc định `-`. |

`<group>` và `<fields>` là hai list `<field>` KHÁC NHAU → fill bằng HAI lần
`set_fields` riêng (`listTag=group`, rồi `listTag=fields`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 52 —
  `<step id="Denormaliser">` →
  `org.pentaho.di.trans.steps.denormaliser.DenormaliserMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `DenormaliserMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/denormaliser/DenormaliserMeta.java`
  dòng 257–296) — thứ tự `key_field` (dòng 260), `<group>` (dòng 262–268,
  mỗi `<field>` chỉ có `<name>`, dòng 265), `<fields>` (dòng 270–293, mỗi
  `<field>` có đúng 12 tag theo thứ tự: `field_name`, `key_value`,
  `target_name`, `target_type` (mô tả chuỗi qua `getTargetTypeDesc()`,
  dòng 278), `target_format`, `target_length`, `target_precision`,
  `target_decimal_symbol`, `target_grouping_symbol`,
  `target_currency_symbol`, `target_null_string`,
  `target_aggregation_type` (mô tả qua
  `getTargetAggregationTypeDesc()`, dòng 289–290)). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 140–142) gọi `readData()` (dòng
  212–255) — `key_field` (dòng 214); nhóm từ `<group>/<field>/<name>`
  (dòng 224–227); mỗi target đọc đủ 12 tag (dòng 232–249), trong đó
  `target_length`/`target_precision` qua `Const.toInt(..., -1)` (dòng
  237–240, thiếu tag → `-1`), `target_type` map chuỗi→id qua
  `setTargetType(String)` (dòng 235), kiểu gộp qua `getAggregationType`
  (chuỗi lạ → 0 = `-`,
  `DenormaliserTargetField.java` dòng 275–287).
- Khởi tạo: `setDefault()` (dòng 154–159) — 0 nhóm + 0 target.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 162–210) XOÁ `<key_field>`
  (ném `KettleStepException` khi rỗng, dòng 174–176, hoặc không có trong
  row, dòng 169–172), xoá các cột nguồn, rồi THÊM LẠI mỗi target với
  kiểu/format/length/precision/symbols đã khai báo (dòng 193–209) —
  output = nhóm + cột đích.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (xoay 2 quý thành 2 cột số gộp SUM):

```xml
<key_field>QUARTER</key_field>
<group>
  <field>
    <name>REGION</name>
  </field>
</group>
<fields>
  <field>
    <field_name>SALES</field_name>
    <key_value>Q1</key_value>
    <target_name>SALES_Q1</target_name>
    <target_type>Number</target_type>
    <target_format/>
    <target_length>-1</target_length>
    <target_precision>-1</target_precision>
    <target_decimal_symbol/>
    <target_grouping_symbol/>
    <target_currency_symbol/>
    <target_null_string/>
    <target_aggregation_type>SUM</target_aggregation_type>
  </field>
  <field>
    <field_name>SALES</field_name>
    <key_value>Q2</key_value>
    <target_name>SALES_Q2</target_name>
    <target_type>Number</target_type>
    <target_format/>
    <target_length>-1</target_length>
    <target_precision>-1</target_precision>
    <target_decimal_symbol/>
    <target_grouping_symbol/>
    <target_currency_symbol/>
    <target_null_string/>
    <target_aggregation_type>SUM</target_aggregation_type>
  </field>
</fields>
```

Fill bằng `set_field_path` cho `key_field` + HAI lần `set_fields`
(`group`/`field`, rồi `fields`/`field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<target_type>` là tên chuỗi, không phải số**: `String`, `Integer`,
  `Number`, `Date`, … (qua `ValueMetaFactory`) — ghi số id kiểu sẽ bị
  `getIdForValueMeta` map sai.
- **`<target_aggregation_type>` chỉ có 7 giá trị**: `-`, `SUM`,
  `AVERAGE`, `MIN`, `MAX`, `COUNT_ALL`, `CONCAT_COMMA`
  (`DenormaliserTargetField.java` dòng 58–60) — chuỗi khác lặng lẽ load
  thành `-` (dòng 275–287), không báo lỗi.
- **`<group>/<field>` và `<fields>/<field>` là hai list khác nhau**: cùng
  tên item `<field>` nhưng cha khác nhau — fill bằng hai lần `set_fields`
  riêng; đừng gộp.
- **Hai list luôn paired**: `getXML()` emit cả khi rỗng — giữ
  `<group></group>` và `<fields></fields>` paired, không viết self-closing
  (`setFields` từ chối list self-closing).
- **`<key_field>` rỗng = fail**: `getFields()` ném lỗi khi rỗng hoặc không
  có trong row — template phải pin tên cột khoá có thật.
- Template mặc định là khung cấu hình — người dùng phải điền cột khoá,
  trường nhóm và target tồn tại/khớp stream trước; step 0 nhóm/0 target
  (mặc định `setDefault()`) không chạy được.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
