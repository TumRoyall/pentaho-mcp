# XSLT — Step biến đổi XML bằng stylesheet XSL

Với MỖI dòng vào, áp stylesheet XSL (từ file `<xslfilename>` hoặc từ trường
khi `<xslfilefielduse>=Y`) lên tài liệu XML trong trường vào (`<fieldname>`),
truyền tham số stylesheet từ các trường dòng (`<parameters>/<parameter>` với
`<field>` = trường dòng, `<name>` = tên tham số), và ghi kết quả vào trường
String mới (`<resultfieldname>`). Thuộc tính output (`<outputproperties>`)
điều khiển serializer (ví dụ `indent`, `encoding`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XSLT</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <xslfilename>${XSL_FILE}</xslfilename>
    <fieldname>{{XML_FIELD}}</fieldname>
    <resultfieldname>result</resultfieldname>
    <xslfilefield/>
    <xslfilefielduse>N</xslfilefielduse>
    <xslfieldisafile>Y</xslfieldisafile>
    <xslfactory>JAXP</xslfactory>
    <parameters>
      <parameter>
        <field>{{PARAM_FIELD}}</field>
        <name>{{PARAM_NAME}}</name>
      </parameter>
    </parameters>
    <outputproperties>
      <outputproperty>
        <name>indent</name>
        <value>yes</value>
      </outputproperty>
    </outputproperties>
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
| `<xslfilename>` | Điều kiện | Path file XSL (dùng `${VAR}`) — dùng khi `<xslfilefielduse>=N`. |
| `<fieldname>` | Y | Tên trường vào chứa tài liệu XML cần biến đổi. |
| `<resultfieldname>` | Y | Trường String mới chứa kết quả; mặc định step mới là `result`. |
| `<xslfilefield>` | Điều kiện | Tên trường chứa XSL — dùng khi `<xslfilefielduse>=Y`. |
| `<xslfilefielduse>` | N | `Y` = lấy XSL từ trường; `N` (mặc định) = từ file. |
| `<xslfieldisafile>` | N | `Y` (mặc định) = trường XSL chứa PATH file; `N` = chứa TRỰC TIẾP nội dung XSL. |
| `<xslfactory>` | N | Factory XSLT; mặc định step mới là `JAXP`. |
| `<parameters>/<parameter>/<field>` | Y (mỗi param) | Tên TRƯỜNG DÒNG cung cấp giá trị tham số. CHÚ Ý: `<field>` đứng TRƯỚC `<name>`. |
| `<parameters>/<parameter>/<name>` | Y (mỗi param) | Tên THAM SỐ trong stylesheet. |
| `<outputproperties>/<outputproperty>/<name>` | N | Một trong 9 thuộc tính cố định (mục 4). |
| `<outputproperties>/<value>` | N | Giá trị thuộc tính (ví dụ `yes`, `UTF-8`). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XSLT` | `<type>` | `XSLT`. |
| `configuration.xsl_file` | `<xslfilename>` | Dùng `${VAR}`. |
| `configuration.xml_field` | `<fieldname>` | Trường XML vào. |
| `configuration.result_field` | `<resultfieldname>` | Mặc định `result`. |
| `configuration.parameters[].field` | `<parameters>/<parameter>/<field>` | Trường dòng (đứng trước). |
| `configuration.parameters[].name` | `<parameters>/<parameter>/<name>` | Tên tham số stylesheet. |
| `configuration.output_properties[].name/value` | `<outputproperty>/<name>`/`<value>` | Thuộc tính serializer. |

`<parameters>` và `<outputproperties>` là hai list KHÁC item tag
(`<parameter>` vs `<outputproperty>`) → fill bằng HAI lần `set_fields`
riêng.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "XSLT", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xslt/XsltMeta.java`
  dòng 59–61, category `XSLT.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin XML) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `XsltMeta.getXML()`
  (`.../xslt/XsltMeta.java` dòng 318–350) — thứ tự `xslfilename`,
  `fieldname`, `resultfieldname`, `xslfilefield`, `xslfilefielduse`,
  `xslfieldisafile`, `xslfactory` (dòng 321–328), rồi wrapper
  `<parameters>` LUÔN emit (dòng 329/338) chứa các `<parameter>` với
  `<field>` TRƯỚC `<name>` (dòng 333–334), rồi wrapper `<outputproperties>`
  LUÔN emit (dòng 339/348) chứa các `<outputproperty>` với `<name>` rồi
  `<value>` (dòng 343–344). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 202–204) gọi `readData()` (dòng
  248–285) — đếm `<parameter>` trong `<parameters>` (dòng 264–265),
  `<outputproperty>` trong `<outputproperties>` (dòng 267–268); 2 cờ Y/N
  thiếu → false; **backward-compat** `xslfieldisafile` (dòng 256–260):
  `xslfilefielduse=Y` + thiếu tag → `xslFieldIsAFile = true`.
- Khởi tạo: `setDefault()` (dòng 287–308) — `resultfieldname = "result"`,
  `xslFactory = "JAXP"`, `xslFieldIsAFile = true`, 0 param/0 prop.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 310–316) thêm MỘT trường
  `String` tên `resultfieldname` — output = input + kết quả biến đổi.
  Tên thuộc tính output hợp lệ là 9 hằng `outputProperties` (dòng 65–66):
  `method`, `version`, `encoding`, `standalone`, `indent`,
  `omit-xml-declaration`, `doctype-public`, `doctype-system`, `media-type`.
  `supportsErrorHandling()` = true (dòng 513–515).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 tham số + 2 thuộc tính output):

```xml
<xslfilename>${XSL_DIR}/order.xsl</xslfilename>
<fieldname>ORDER_DOC</fieldname>
<resultfieldname>ORDER_HTML</resultfieldname>
<xslfilefield/>
<xslfilefielduse>N</xslfilefielduse>
<xslfieldisafile>Y</xslfieldisafile>
<xslfactory>JAXP</xslfactory>
<parameters>
  <parameter>
    <field>TITLE</field>
    <name>title</name>
  </parameter>
  <parameter>
    <field>SHOW_PRICES</field>
    <name>showPrices</name>
  </parameter>
</parameters>
<outputproperties>
  <outputproperty>
    <name>method</name>
    <value>html</value>
  </outputproperty>
  <outputproperty>
    <name>indent</name>
    <value>yes</value>
  </outputproperty>
</outputproperties>
```

Fill bằng `set_field_path` cho scalar + HAI lần `set_fields`
(`parameters`/`parameter`, rồi `outputproperties`/`outputproperty`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<field>` TRƯỚC `<name>` trong `<parameter>`**: ngược trực giác
  (`getXML()` dòng 333–334) — `<field>` là trường dòng, `<name>` là tên
  tham số stylesheet; đừng đảo.
- **Hai list luôn paired**: cả `<parameters>` và `<outputproperties>` luôn
  emit kể cả rỗng — giữ paired, không viết self-closing (`setFields` từ
  chối list self-closing).
- **Hai `<parameter>`/`<outputproperty>` khác item tag**: cùng là list con
  nhưng tên item khác nhau — fill bằng hai lần `set_fields` riêng.
- **Thuộc tính output ngoài 9 hằng bị bỏ qua**: chỉ 9 tên ở dòng 65–66 có
  tác dụng — sai chính tả (ví dụ `indentation`) lặng lẽ không hiệu lực.
- **Y/N cho 2 cờ** — ghi `true` load thành false; `xslfieldisafile` thiếu
  tag + `use=Y` mặc định true (dòng 256–260).
- Template mặc định là khung cấu hình — người dùng phải điền XSL (`${VAR}`,
  không embed path thật), trường XML và trường tham số có thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
