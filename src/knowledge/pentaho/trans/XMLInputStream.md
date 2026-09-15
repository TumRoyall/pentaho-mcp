# XMLInputStream — Step đọc sự kiện XML dạng streaming (StAX)

Đọc file XML phần tử-theo-phần tử bằng StAX (nhẹ bộ nhớ, hợp file lớn) và
phát MỖI SỰ KIỆN (start element, attribute, text, …) thành một dòng với các
cột metadata tùy chọn: tên/path XML, id/level element, vị trí dòng/cột, kiểu
dữ liệu, tên file, số dòng. Cột nào phát do 12 cặp cờ
`<include…>` + tên trường quyết định. Toàn scalar, không có list lặp.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XMLInputStream</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <sourceFromInput>N</sourceFromInput>
    <sourceFieldName/>
    <filename>${XML_FILE}</filename>
    <addResultFile>N</addResultFile>
    <nrRowsToSkip>0</nrRowsToSkip>
    <rowLimit>0</rowLimit>
    <defaultStringLen>1024</defaultStringLen>
    <encoding>UTF-8</encoding>
    <enableNamespaces>N</enableNamespaces>
    <enableTrim>Y</enableTrim>
    <includeFilenameField>N</includeFilenameField>
    <filenameField>xml_filename</filenameField>
    <includeRowNumberField>N</includeRowNumberField>
    <rowNumberField>xml_row_number</rowNumberField>
    <includeDataTypeNumericField>N</includeDataTypeNumericField>
    <dataTypeNumericField>xml_data_type_numeric</dataTypeNumericField>
    <includeDataTypeDescriptionField>Y</includeDataTypeDescriptionField>
    <dataTypeDescriptionField>xml_data_type_description</dataTypeDescriptionField>
    <includeXmlLocationLineField>N</includeXmlLocationLineField>
    <xmlLocationLineField>xml_location_line</xmlLocationLineField>
    <includeXmlLocationColumnField>N</includeXmlLocationColumnField>
    <xmlLocationColumnField>xml_location_column</xmlLocationColumnField>
    <includeXmlElementIDField>Y</includeXmlElementIDField>
    <xmlElementIDField>xml_element_id</xmlElementIDField>
    <includeXmlParentElementIDField>Y</includeXmlParentElementIDField>
    <xmlParentElementIDField>xml_parent_element_id</xmlParentElementIDField>
    <includeXmlElementLevelField>Y</includeXmlElementLevelField>
    <xmlElementLevelField>xml_element_level</xmlElementLevelField>
    <includeXmlPathField>Y</includeXmlPathField>
    <xmlPathField>xml_path</xmlPathField>
    <includeXmlParentPathField>Y</includeXmlParentPathField>
    <xmlParentPathField>xml_parent_path</xmlParentPathField>
    <includeXmlDataNameField>Y</includeXmlDataNameField>
    <xmlDataNameField>xml_data_name</xmlDataNameField>
    <includeXmlDataValueField>Y</includeXmlDataValueField>
    <xmlDataValueField>xml_data_value</xmlDataValueField>
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
| `<filename>` | Điều kiện | Path file XML (dùng `${VAR}`); bỏ qua khi `sourceFromInput=Y`. |
| `<sourceFromInput>` | N | `Y` = nhận tên file/XML từ trường vào (`<sourceFieldName>`); `N` (mặc định) = đọc `<filename>`. |
| `<addResultFile>` | N | `Y` = đăng ký file vào result; `N` (mặc định). |
| `<nrRowsToSkip>` | N | Số sự kiện bỏ qua đầu stream, DẠNG CHUỖI (cho phép `${VAR}`); mặc định `"0"`. |
| `<rowLimit>` | N | Số dòng tối đa, DẠNG CHUỖI; `"0"` (mặc định) = không giới hạn. |
| `<defaultStringLen>` | N | Độ dài String cho cột tên/giá trị; mặc định `"1024"`. |
| `<encoding>` | N | Encoding; mặc định `UTF-8`. |
| `<enableNamespaces>` | N | `Y` = xuất namespace (chậm hơn); `N` (mặc định). |
| `<enableTrim>` | N | `Y` (mặc định step mới!) = trim tên/giá trị; `N` = giữ nguyên. |
| `<includeFilenameField>`/`<filenameField>` … | N | 12 cặp cờ Y/N + tên trường (mặc định tên/cờ ở mục 4). Chỉ cột được bật mới phát. |

12 cặp cột (cờ → tên trường mặc định, cờ mặc định): filename (`xml_filename`,
N), row_number (`xml_row_number`, N), datatype_numeric
(`xml_data_type_numeric`, N), datatype_description
(`xml_data_type_description`, **Y**), location_line (`xml_location_line`,
N), location_column (`xml_location_column`, N), element_id
(`xml_element_id`, **Y**), parent_element_id (`xml_parent_element_id`,
**Y**), element_level (`xml_element_level`, **Y**), path (`xml_path`,
**Y**), parent_path (`xml_parent_path`, **Y**), data_name
(`xml_data_name`, **Y**), data_value (`xml_data_value`, **Y**).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XML_INPUT_STREAM` | `<type>` | `XMLInputStream`. |
| `configuration.file` | `<filename>` | Dùng `${VAR}`. |
| `configuration.row_limit/skip` | `<rowLimit>`/`<nrRowsToSkip>` | Chuỗi số (cho phép `${VAR}`). |
| `configuration.encoding` | `<encoding>` | Mặc định `UTF-8`. |
| `configuration.columns.<key>` | cặp `<include…>` + tên trường | Chỉ bật cột cần dùng. |

Toàn scalar, không có list — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "XMLInputStream", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmlinputstream/XMLInputStreamMeta.java`
  dòng 54–57). KHÔNG nằm trong `engine/.../kettle-steps.xml` (plugin XML)
  — annotation là evidence đăng ký, serializer dưới đây mới là XML evidence.
- Serialization: `XMLInputStreamMeta.getXML()`
  (`.../xmlinputstream/XMLInputStreamMeta.java` dòng 321–377) — 34 scalar
  theo thứ tự: `sourceFromInput`, `sourceFieldName`, `filename`,
  `addResultFile`, `nrRowsToSkip`, `rowLimit`, `defaultStringLen`,
  `encoding`, `enableNamespaces`, `enableTrim`, rồi 12 cặp
  include+tên-trường (dòng 336–374). Không có list.
- Deserialization: `loadXML()` inline (dòng 238–310, không qua `readData`)
  — chuỗi dùng `Const.NVL(..., default)` (thiếu tag → default an toàn:
  `filename ""`, `nrRowsToSkip`/`rowLimit` `"0"`, `defaultStringLen`
  `"1024"`, `encoding` `"UTF-8"`); mọi cờ Y/N thiếu → false.
- Khởi tạo: `setDefault()` (dòng 380–431) — `encoding = "UTF-8"`,
  `defaultStringLen = "1024"`, **`enableTrim = true`**,
  7 cột bật sẵn: datatype_description, element_id, parent_element_id,
  element_level, path, parent_path, data_name, data_value (dòng 401–429);
  filename/row_number/location tắt.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 137–235) thêm đúng các cột
  được bật. **BẪY**: 7 cột sau dùng TÊN CỨNG, bỏ qua tên custom —
  `xml_element_id` (dòng 187), `xml_parent_element_id` (dòng 194),
  `xml_element_level` (dòng 201), `xml_path` (dòng 208),
  `xml_parent_path` (dòng 215), `xml_data_name` (dòng 222),
  `xml_data_value` (dòng 229) — đổi `xmlPathField` không đổi tên cột ra.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (bật thêm tên file + số dòng, giới hạn 1000):

```xml
<filename>${XML_DIR}/orders.xml</filename>
<addResultFile>N</addResultFile>
<nrRowsToSkip>0</nrRowsToSkip>
<rowLimit>1000</rowLimit>
<defaultStringLen>1024</defaultStringLen>
<encoding>UTF-8</encoding>
<enableNamespaces>N</enableNamespaces>
<enableTrim>Y</enableTrim>
<includeFilenameField>Y</includeFilenameField>
<filenameField>xml_filename</filenameField>
<includeRowNumberField>Y</includeRowNumberField>
<rowNumberField>xml_row_number</rowNumberField>
```

Đổi bằng `set_field_path` từng scalar.

## 5. Lưu ý / bẫy — CRITICAL

- **Tên tag include KHÔNG đồng nhất**: cặp datatype dùng
  `includeDataTypeNumericField`/`dataTypeNumericField` (thiếu `Xml`,
  dòng 342–343/261–264) trong khi các cặp khác là `includeXml…` — copy
  tên theo quán tính sẽ tạo tag lạ bị bỏ qua, cờ thật giữ false.
- **7 cột tên cứng**: đổi các `xml…Field` của element_id/parent_id/level/
  path/parent_path/data_name/data_value KHÔNG đổi tên cột ra
  (`getFields()` dòng 186–233) — đừng quảng cáo rename cho 7 cột này.
- **`nrRowsToSkip`/`rowLimit` là CHUỖI** (cho phép `${VAR}` phân trang
  chunk) — không phải số int như `limit` của getXMLData.
- **`enableTrim` mặc định `Y`** (`setDefault()` dòng 389) — ngược trực
  giác; muốn giữ whitespace đầu/cuối đặt `N` tường minh.
- **Y/N chứ không phải true/false** cho mọi cờ — ghi `true` load thành
  false (template thiếu tag cũng false, trừ các chuỗi có NVL fallback).
- Template mặc định là khung cấu hình — người dùng phải điền file
  (`${VAR}`, không embed path thật) và chỉ bật cột cần để tránh dòng phình.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
