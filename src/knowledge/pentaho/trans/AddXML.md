# AddXML — Step gom trường thành фрагмент XML

Với MỖI dòng vào, dựng một фрагмент XML (một phần tử lặp
`<xml_repeat_element>` chứa các trường đã chọn dưới dạng phần tử con hoặc
attribute) và gắn vào một trường String mới (`<valueName>`). `getFields()`
CHỈ thêm đúng một trường String — schema ra = schema vào + trường XML.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AddXML</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <encoding>UTF-8</encoding>
    <valueName>{{OUTPUT_FIELD}}</valueName>
    <xml_repeat_element>{{ROOT_NODE}}</xml_repeat_element>
    <file>
      <omitXMLheader>Y</omitXMLheader>
      <omitNullValues>N</omitNullValues>
    </file>
    <fields>
      <field>
        <name>{{SOURCE_FIELD}}</name>
        <element>{{ELEMENT_NAME}}</element>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <length>-1</length>
        <precision>-1</precision>
        <attribute>N</attribute>
        <attributeParentName/>
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
| `<encoding>` | N | Encoding của фрагмент XML; mặc định step mới là `UTF-8` (`Const.XML_ENCODING`). |
| `<valueName>` | Y | Tên trường String mới chứa фрагмент XML (`getFields()` thêm đúng trường này). |
| `<xml_repeat_element>` | Y | Tên phần tử lặp bao mỗi dòng (ví dụ `Row`); mặc định step mới là `Row`. |
| `<file>/<omitXMLheader>` | N | `Y` (mặc định) = bỏ `<?xml ...?>`; `N` = giữ header. Y/N, thiếu tag → false. |
| `<file>/<omitNullValues>` | N | `Y` = bỏ phần tử null khỏi kết quả; `N` (mặc định). Y/N, thiếu tag → false. |
| `<fields>/<field>/<name>` | Y | Tên trường NGUỒN trong stream vào — phải tồn tại (`check()` ERROR nếu thiếu). |
| `<fields>/<field>/<element>` | Y | Tên phần tử/attribute trong XML ra. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Number`, …) — không phải số id. |
| `<format>` / `<currency>` / `<decimal>` / `<group>` / `<nullif>` | N | Mask và ký hiệu định dạng giá trị. |
| `<length>` / `<precision>` | N | Số; thiếu tag load thành `-1`. |
| `<attribute>` | N | `Y` = xuất trường này thành attribute của `<attributeParentName>`; `N` (mặc định). |
| `<attributeParentName>` | Điều kiện | Tên phần tử cha khi `<attribute>=Y`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ADD_XML` | `<type>` | `AddXML`. |
| `configuration.encoding` | `<encoding>` | Mặc định `UTF-8`. |
| `configuration.output_field` | `<valueName>` | Trường String mới. |
| `configuration.root_node` | `<xml_repeat_element>` | Phần tử lặp, mặc định `Row`. |
| `configuration.omit_xml_header` | `<file>/<omitXMLheader>` | Boolean → Y/N, mặc định Y. |
| `configuration.omit_null_values` | `<file>/<omitNullValues>` | Boolean → Y/N, mặc định N. |
| `configuration.fields[].source_field` | `<fields>/<field>/<name>` | Trường nguồn. |
| `configuration.fields[].element` | `<fields>/<field>/<element>` | Tên phần tử XML. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "AddXML", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/addxml/AddXMLMeta.java`
  dòng 63–65, category `AddXML.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin XML) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `AddXMLMeta.getXML()`
  (`.../addxml/AddXMLMeta.java` dòng 239–275) — thứ tự `encoding`
  (dòng 242), `valueName` (dòng 243), `xml_repeat_element` (dòng 244),
  wrapper `<file>` với `omitXMLheader` rồi `omitNullValues` (dòng 246–249),
  rồi `<fields>` LUÔN emit paired (dòng 250/272) chứa các `<field>` với
  `name`, `element`, `type` (mô tả chuỗi qua `getTypeDesc()`, dòng 258),
  `format`, `currency`, `decimal`, `group`, `nullif`, `length`,
  `precision`, `attribute` (Y/N), `attributeParentName` (dòng 256–268).
  Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 144–146) gọi `readData()` (dòng
  165–199) — 2 cờ đọc lồng trong sub-node `<file>`
  (`getTagValue(stepnode, "file", ...)` dòng 171–172); `length`/`precision`
  qua `Const.toInt(..., -1)` (thiếu → `-1`, dòng 191–192); `attribute` Y/N
  thiếu → false (dòng 193).
- Khởi tạo: `setDefault()` (dòng 201–229) — `omitXMLheader = true`,
  `omitNullValues = false`, `encoding = "UTF-8"` (`Const.XML_ENCODING`),
  `valueName = "xmlvaluename"`, `rootNode = "Row"`, 0 field.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 231–237) thêm ĐÚNG MỘT
  trường `String` tên `valueName` — output = input + trường XML.
  `check()` (dòng 342–396) yêu cầu có input và mọi `<name>` tồn tại trong
  row trước đó.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 trường, một attribute):

```xml
<encoding>UTF-8</encoding>
<valueName>CUSTOMER_XML</valueName>
<xml_repeat_element>Customer</xml_repeat_element>
<file>
  <omitXMLheader>Y</omitXMLheader>
  <omitNullValues>Y</omitNullValues>
</file>
<fields>
  <field>
    <name>CUSTOMER_ID</name>
    <element>id</element>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <nullif/>
    <length>-1</length>
    <precision>-1</precision>
    <attribute>Y</attribute>
    <attributeParentName>Customer</attributeParentName>
  </field>
  <field>
    <name>CUSTOMER_NAME</name>
    <element>name</element>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <nullif/>
    <length>-1</length>
    <precision>-1</precision>
    <attribute>N</attribute>
    <attributeParentName/>
  </field>
</fields>
```

Fill bằng `set_field_path` cho scalar + `set_fields`
(`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Field rỗng tên bị LẶNG LẼ BỎ**: `getXML()` chỉ emit field có
  `fieldName` non-empty (dòng 254) — field thiếu `<name>` biến mất khi
  save mà không báo lỗi.
- **`<type>` là tên chuỗi, không phải số**: `String`, `Integer`,
  `Number`, … (qua `ValueMeta.getTypeDesc()`, `XMLField.java` dòng
  133–134) — ghi số id kiểu sẽ bị `setType(String)` map sai.
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field — giữ
  `<fields></fields>` paired, không viết self-closing (`setFields` từ chối
  list self-closing).
- **2 cờ nằm TRONG `<file>`**: `omitXMLheader`/`omitNullValues` là con của
  `<file>`, không phải con trực tiếp của `<step>` — đặt sai chỗ load
  thành false.
- **Mặc định `omitXMLheader=Y`**: ngược trực giác — template giữ `Y` theo
  `setDefault()`; muốn giữ `<?xml?>` phải đặt `N` tường minh.
- Template mặc định là khung cấu hình — người dùng phải điền trường nguồn
  có thật trong stream trước; `valueName` rỗng thêm trường tên rỗng.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
