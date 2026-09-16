# XMLInputSax — Step đọc file XML streaming SAX (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category Deprecated (dòng 65–68 — chú ý dùng chuỗi
> category của job, nhưng đây vẫn là trans step). Replacement có nguồn:
> **`getXMLData`** (step `GetXmlDataMeta`, id `getXMLData` tại
> `plugins/xml/core/.../getxmldata/GetXmlDataMeta.java` dòng 65).
> (Plugin `xml-input-stream` ở 9.4 chỉ chứa step SAX này — không có step
> `XMLInputStream` nào trong source để thay thế.)
> `status=observed`, `generator_eligible=false`.

Biến thể SAX/streaming của `XMLInput`: đọc file XML (`<file>` — cặp
`<name>`/`<filemask>` theo index), định vị vòng lặp qua
`<positions>/<position>` (kiểu `XMLInputSaxFieldPosition`), trích các
cột trong `<fields>/<field>`, cộng thêm block `<def_attributes>`
(cặp `def_element`+`def_attribute` khai báo attribute định danh).
KHÁC `XMLInput`: KHÔNG có `file_base_uri`/`ignore_entities`/
`namespace_aware`/`skip`, và `<trim_type>` của field là DESC (i18n)
thay vì CODE.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XMLInputSax</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownum_field/>
    <file>
      <name>${XML_FILE}</name>
      <filemask/>
    </file>
    <def_attributes>
      <def_element>{{ELEMENT}}</def_element>
      <def_attribute>{{ATTRIBUTE}}</def_attribute>
    </def_attributes>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
        <positions>
          <position>{{XML_PATH}}</position>
        </positions>
      </field>
    </fields>
    <positions>
      <position>{{LOOP_PATH}}</position>
    </positions>
    <limit>0</limit>
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
| `<include>` / `<include_field>` | N | Như `XMLInput` (cột tên file). Mặc định `N`/`""`. |
| `<rownum>` / `<rownum_field>` | N | Như `XMLInput` (cột số dòng). Mặc định `N`/`""`. |
| `<file>/<name>` + `<filemask>` | Y (ít nhất 1 cặp khi chạy) | Theo INDEX CHUNG (dòng 319–324). Step mới 0 file. |
| `<def_attributes>` (cặp `def_element`+`def_attribute`) | N | Khai báo element/attribute định danh cho parser SAX (đếm theo `def_element`, dòng 313). Step mới rỗng. |
| `<fields>/<field>/...` | Y (ít nhất 1 khi chạy) | Như `XMLInput`, NGOẠI TRỪ `<trim_type>` là **DESC i18n** (không phải code) — load qua `getTrimType(desc)`. |
| `<positions>/<position>` | Y (ít nhất 1 khi chạy) | Vòng lặp document, kiểu `XMLInputSaxFieldPosition` (parse từ chuỗi encoded, dòng 341–345). |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định) = không giới hạn. KHÔNG có `<skip>`. |

`<file>`/`<def_attributes>`/`<fields>`/`<positions>` LUÔN emit (kể cả
rỗng, dòng 266/273/280/287) → giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XML_INPUT_SAX` | `<type>` | `XMLInputSax`. Pipeline mới dùng `getXMLData`. |
| `configuration.include_filename` | `<include>` | Boolean → Y/N. |
| `configuration.filename_field` | `<include_field>` | Tên cột tên file. |
| `configuration.include_row_number` | `<rownum>` | Boolean → Y/N. |
| `configuration.row_number_field` | `<rownum_field>` | Tên cột số dòng. |
| `configuration.files[]` | `<file>` (name+filemask theo index) | Không dùng `set_fields`. |
| `configuration.def_attributes[]` | `<def_attributes>` (def_element+def_attribute) | Điền thủ công từng cặp. |
| `configuration.fields[]` | `<fields>/<field>/...` | MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`) cho các tag PHẲNG — nhưng mỗi `<field>` còn nested `<positions>` riêng: `set_fields` flattens nested markup thành escaped text (đã kiểm chứng ở step anh em `XMLInput`). Muốn giữ `<positions>` thật thì cấu hình từng field bằng `set_field_path`. |
| `configuration.loop_path` | `<positions>/<position>` | Vòng lặp document. |
| `configuration.limit` | `<limit>` | Số; `0` = ALL. Không có `skip`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="XMLInputSax", ...,
  categoryDescription = "i18n:org.pentaho.di.job:JobCategory.Category.Deprecated")`
  (`plugins/xml-input-stream/core/src/main/java/org/pentaho/di/trans/steps/xmlinputsax/XMLInputSaxMeta.java`
  dòng 65–68). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 258–297) — thứ tự `include` (261),
  `include_field` (262), `rownum` (263), `rownum_field` (264),
  `<file>` LUÔN emit (266–271), **`<def_attributes>` LUÔN emit
  (273–278; cặp `def_element` 275 + `def_attribute` 276)**,
  `<fields>` LUÔN emit (280–285; qua `XMLInputSaxField.getXML()`,
  `XMLInputSaxField.java` dòng 86–99: `trim_type` = **desc** dòng 94),
  `<positions>` LUÔN emit (287–292), `limit` (294). **Không có**
  `file_base_uri`/`ignore_entities`/`namespace_aware`/`skip`.
- Deserialization: `loadXML()` (dòng 227–229) gọi `readData()` (dòng
  299–353) — cờ `"Y".equalsIgnoreCase` (303–306); file theo index
  (319–324); def attributes clear rồi nạp từng cặp (326–333);
  `trim_type` load qua `getTrimType(desc)` (dòng 117
  `XMLInputSaxField.java` — ngược với `getTrimTypeByCode` của
  `XMLInput`); position parse qua `new
  XMLInputSaxFieldPosition(encoded)` (344); `limit` qua
  `Const.toLong` default 0 (348–349).
- Khởi tạo: `setDefault()` (dòng 366–397) — cờ false, chuỗi rỗng,
  0 file/field/position, `rowLimit = 0L` (396).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 399+) append các cột
  `inputFields` (cùng pattern `XMLInput`). Step không tham chiếu DB
  connection — template không mang `<connection>`.
- Replacement: step `getXMLData`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXmlDataMeta.java`
  dòng 65: `@Step(id = "getXMLData", ...)`).

Cấu hình không mặc định (def attribute + 2 field):

```xml
<def_attributes>
  <def_element>order</def_element>
  <def_attribute>id</def_attribute>
</def_attributes>
<fields>
  <field>
    <name>ORDER_ID</name>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
    <positions>
      <position>order/id</position>
    </positions>
  </field>
  <field>
    <name>CUSTOMER_NAME</name>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
    <positions>
      <position>order/customer</position>
    </positions>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED — pipeline mới dùng `getXMLData`**: reference này chỉ
  để đọc/bảo trì `.ktr` cũ.
- **`<trim_type>` là DESC i18n, KHÁC CODE của `XMLInput`**: đừng copy
  nguyên field block giữa hai step (write: Sax dòng 94
  `getTrimTypeDesc()` vs XMLInput dòng 103 `getTrimTypeCode()`; read:
  `getTrimType()` vs `getTrimTypeByCode()`).
- **Có `<def_attributes>`, không có `file_base_uri`/`ignore_entities`/
  `namespace_aware`/`skip`**: đừng bê nguyên template `XMLInput` sang
  (thừa tag vô hại khi load nhưng sai sự thật source).
- **Hai `<positions>` khác nhau** (nested của field vs top-level loop)
  — giữ cả hai.
- **Cẩn thận `set_fields` với nested `<positions>`**: giống
  `XMLInput` — nested markup bị escape thành text. Cấu hình field bằng
  `set_field_path` từng tag để giữ markup.
- Không có `<connection>` — đừng thêm.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
