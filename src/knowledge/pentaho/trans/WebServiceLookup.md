# WebServiceLookup — Step gọi SOAP web service theo dòng

Với MỖI dòng đầu vào, gọi operation SOAP (`wsURL` + `wsOperation`) với
tham số ghép từ field (`<fieldsIn>`: `name` field → `wsName` param), rồi
gắn kết quả (`<fieldsOut>`: `wsName` output → `name` field) vào sau dòng
gốc khi `passingInputData=Y` (mặc định). Tiền tố `ws` = WebService —
đừng nhầm với step HTTP/REST.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>WebServiceLookup</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <wsURL>${WS_URL}</wsURL>
    <wsOperation>{{OPERATION}}</wsOperation>
    <wsOperationRequest/>
    <wsOperationNamespace/>
    <wsInFieldContainer/>
    <wsInFieldArgument/>
    <wsOutFieldContainer/>
    <wsOutFieldArgument/>
    <proxyHost/>
    <proxyPort/>
    <httpLogin>${WS_USER}</httpLogin>
    <httpPassword>${WS_PASSWORD}</httpPassword>
    <callStep>1000</callStep>
    <passingInputData>Y</passingInputData>
    <compatible>Y</compatible>
    <repeating_element/>
    <reply_as_string>N</reply_as_string>
    <fieldsIn>
      <field>
        <name>{{INPUT_FIELD}}</name>
        <wsName>{{PARAM_NAME}}</wsName>
        <xsdType>string</xsdType>
      </field>
    </fieldsIn>
    <fieldsOut>
      <field>
        <name>{{OUTPUT_FIELD}}</name>
        <wsName>{{RESULT_NAME}}</wsName>
        <xsdType>string</xsdType>
      </field>
    </fieldsOut>
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
| `<wsURL>` | Y | Endpoint SOAP WSDL/URL (`${WS_URL}`). Chữ ws thường + URL hoa. |
| `<wsOperation>` / `<wsOperationRequest>` / `<wsOperationNamespace>` | Y (operation) | Tên operation + request wrapper + namespace. |
| `<wsInFieldContainer>` / `<wsInFieldArgument>` | N | Container/argument bọc tham số vào. |
| `<wsOutFieldContainer>` / `<wsOutFieldArgument>` | N | Container/argument bọc kết quả ra. |
| `<proxyHost>` / `<proxyPort>` | N | Proxy (host + port chuỗi). |
| `<httpLogin>` / `<httpPassword>` | N | HTTP basic auth (`${VAR}` cho password). |
| `<callStep>` | N | Số dòng gọi một lần (batch); mặc định `1000` (`DEFAULT_STEP`), thiếu → 1000. Int. |
| `<passingInputData>` | N | `Y` (mặc định setDefault `true`) = giữ field đầu vào trong output. |
| `<compatible>` | N | Mặc định `Y`; load-thiếu/rỗng → `true` (ngược cờ thường — xem bẫy). |
| `<repeating_element>` | N | Phần tử lặp khi response là mảng (gạch dưới). |
| `<reply_as_string>` | N | `Y` = trả raw XML String; mặc định `N`. |
| `<fieldsIn>/<field>` (`name`, `wsName`, `xsdType`) | Y (ít nhất 1 khi gọi có tham số) | `name` = FIELD đầu vào, `wsName` = TÊN PARAM SOAP, `xsdType` = kiểu XSD. |
| `<fieldsOut>/<field>` (`name`, `wsName`, `xsdType`) | Y (ít nhất 1 khi đọc kết quả) | `wsName` = TÊN OUTPUT SOAP, `name` = FIELD output. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WEB_SERVICE_LOOKUP` | `<type>` | `WebServiceLookup`. |
| `configuration.url` / `operation` | `<wsURL>` / `<wsOperation>` | `${VAR}` cho URL. |
| `configuration.auth_user` / `auth_password` | `<httpLogin>` / `<httpPassword>` | `${VAR}`. |
| `configuration.call_step` | `<callStep>` | Số; thiếu → 1000. |
| `configuration.fields_in[].field` / `param` / `xsd_type` | `<fieldsIn>/<field>/name` / `wsName` / `xsdType` | `set_fields` (`listTag=fieldsIn`, `itemTag=field`). |
| `configuration.fields_out[].result` / `field` / `xsd_type` | `<fieldsOut>/<field>/wsName` / `name` / `xsdType` | `set_fields` (`listTag=fieldsOut`, `itemTag=field`). |

`<fieldsIn>` và `<fieldsOut>` là 2 list ĐỘC LẬP → fill bằng HAI lần
`set_fields` riêng.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 95 —
  `<step id="WebServiceLookup">` →
  `org.pentaho.di.trans.steps.webservices.WebServiceMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `WebServiceMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/webservices/WebServiceMeta.java`
  dòng 201–257) — thứ tự 17 tag scalar từ `wsURL` (dòng 206) đến
  `reply_as_string` (dòng 226), rồi `<fieldsIn>` (dòng 232–241) và
  `<fieldsOut>` (dòng 245–254), mỗi `<field>` có `name`, `wsName`,
  `xsdType` (dòng 236–238).
- Deserialization: `loadXML()` (dòng 259–300+) — `callStep` qua
  `Const.toInt(..., DEFAULT_STEP=1000)` (dòng 57, 277);
  `passingInputData` Y/N; **`compatible`: thiếu/rỗng → `true`** (dòng
  279–280: `Utils.isEmpty(compat) || "Y"...`) — ngược với cờ thường.
- Khởi tạo: `setDefault()` (dòng 171–173) — chỉ `passingInputData=true`;
  còn lại null/Java-default (`callStep=1000` từ khởi tạo field, dòng 101).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `check()` (dòng 175–199) WARNING khi không có field
  đầu vào, ERROR khi không có hop mà vẫn cần input field. Cần SOAP thật
  nên không test runtime ở đây.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (2 tham số vào + auth + batch 100):

```xml
<httpLogin>${WS_USER}</httpLogin>
<httpPassword>${WS_PASSWORD}</httpPassword>
<callStep>100</callStep>
<fieldsIn>
  <field>
    <name>CUSTOMER_ID</name>
    <wsName>customerId</wsName>
    <xsdType>int</xsdType>
  </field>
  <field>
    <name>COUNTRY</name>
    <wsName>countryCode</wsName>
    <xsdType>string</xsdType>
  </field>
</fieldsIn>
```

Fill mỗi list bằng `set_fields` riêng (`fieldsIn`/`fieldsOut`).

## 5. Lưu ý / bẫy — CRITICAL

- **`compatible` thiếu → `true`**: ngược mọi cờ Y/N khác (dòng 279–280)
  — template luôn ghi `Y`/`N` rõ ràng, đừng lược.
- **Chiều `name`/`wsName` NGƯỢC NHAU giữa In và Out**: `fieldsIn`: field
  → param (`name` là input field); `fieldsOut`: param → field (`name` là
  output field). Đừng đảo.
- **`<httpPassword>` plain**: `getXML()` ghi thẳng (dòng 220), không
  `Encr` — luôn dùng `${WS_PASSWORD}`.
- **2 list độc lập**: `fieldsIn` và `fieldsOut` fill bằng 2 lần
  `set_fields` riêng, không gộp.
- Template mặc định là khung cấu hình — người dùng phải nối hop có field
  tham số và điền endpoint/operation; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/SOAP thật) — không tuyên bố hai mức này.
