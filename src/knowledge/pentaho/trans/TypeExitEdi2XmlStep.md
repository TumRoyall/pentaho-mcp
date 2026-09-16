# TypeExitEdi2XmlStep — Step chuyển EDIFACT sang XML

Đọc field chứa bản tin EDIFACT (`<inputfield>`, lowercase) và append cột
XML (`<outputfield>`, lowercase, String, `STORAGE_TYPE_NORMAL`) — chỉ
append khi `outputField` non-empty (else chỉ lookup `inputField`, không
add). Chỉ 2 tag cấu hình lowercase; không Y/N, không list lặp, không
connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TypeExitEdi2XmlStep</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <inputfield>EDI_MESSAGE</inputfield>
    <outputfield>edi_xml</outputfield>
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
| `<inputfield>` | Y | Tên field chứa bản tin EDIFACT (lowercase toàn bộ); mặc định mới `""`. |
| `<outputfield>` | Y | Tên cột XML output (lowercase toàn bộ); mặc định mới `edi_xml`. Rỗng = không append cột. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EDI_2_XML` | `<type>` | `TypeExitEdi2XmlStep` (giữ nguyên ID dài). |
| `configuration.input_field` | `<inputfield>` | Giữ đúng thường toàn bộ. |
| `configuration.output_field` | `<outputfield>` | Giữ đúng thường toàn bộ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="TypeExitEdi2XmlStep", ...)`
  (`plugins/edi2xml/impl/src/main/java/org/pentaho/di/trans/steps/edi2xml/Edi2XmlMeta.java`
  dòng 53; name `BaseStep.TypeLongDesc.Edi2Xml`, category Utility, image
  `EDI2XML.svg`). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `Edi2XmlMeta.getXML()` (dòng 87–94) — đúng thứ tự
  `inputfield`, `outputfield` (lowercase, strings, luôn emit kể cả rỗng
  qua `addTagValue` xử lý null/empty). Không Y/N, không `<fields>` lặp.
- Deserialization: `loadXML()` (dòng 97–106) —
  `getNodeValue(getSubNode(stepnode,"inputfield"/"outputfield"))`
  (thiếu → null). `readRep`/`saveRep` (dòng 109–129) cùng keys.
- Khởi tạo: `setDefault()` (dòng 201–204) — `outputField="edi_xml"`,
  `inputField=""`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 132–151) — `outputField`
  non-empty → `addValueMeta(ValueMetaString(outputField))`, else chỉ
  lookup `inputField` (không add); luôn `STORAGE_TYPE_NORMAL`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (tên nghiệp vụ):

```xml
<inputfield>DESADV_EDI</inputfield>
<outputfield>DESADV_XML</outputfield>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag lowercase toàn bộ**: `inputfield`, `outputfield` — viết camel
  (`inputField`) là sai tag, load → null.
- **`outputfield` rỗng = không append cột** — output giữ nguyên input;
  đừng mong có cột XML khi để trống.
- **Bắt buộc có input**: bản tin đến từ field của stream trước.
- Template mặc định là khung cấu hình — người dùng phải điền field EDIFACT
  tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
