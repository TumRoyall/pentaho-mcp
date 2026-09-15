# HTTP — Step gọi HTTP GET theo từng dòng (trans)

Với MỖI dòng vào, gọi HTTP GET tới URL (tĩnh `<url>` hoặc từ trường khi
`<urlInField>=Y`), kèm tham số query (`<lookup>/<arg>`) và header
(`<lookup>/<header>`), rồi gắn body + (tùy chọn) mã trạng thái/thời gian/
header trả về vào các trường mới (`<result>`). Khác entry job `HTTP`
(cùng chuỗi `HTTP` nhưng khác kind — xem `job/HTTP.md`): step này chạy theo
dòng, không tải file.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>HTTP</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <url>${HTTP_URL}</url>
    <urlInField>N</urlInField>
    <urlField/>
    <encoding>UTF-8</encoding>
    <httpLogin>${HTTP_USER}</httpLogin>
    <httpPassword>${HTTP_PASSWORD}</httpPassword>
    <proxyHost>${PROXY_HOST}</proxyHost>
    <proxyPort>${PROXY_PORT}</proxyPort>
    <socketTimeout>10000</socketTimeout>
    <connectionTimeout>10000</connectionTimeout>
    <closeIdleConnectionsTime>-1</closeIdleConnectionsTime>
    <lookup>
      <arg>
        <name>{{QUERY_PARAM}}</name>
        <parameter>{{SOURCE_FIELD}}</parameter>
      </arg>
      <header>
        <name>{{HEADER_NAME}}</name>
        <parameter>{{HEADER_VALUE}}</parameter>
      </header>
    </lookup>
    <result>
      <name>result</name>
      <code/>
      <response_time/>
      <response_header/>
    </result>
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
| `<url>` | Điều kiện | URL tĩnh (dùng `${VAR}`); bỏ qua khi `urlInField=Y`. |
| `<urlInField>` | N | `Y` = lấy URL từ trường `<urlField>` theo từng dòng; `N` (mặc định). |
| `<urlField>` | Điều kiện | Tên trường chứa URL khi `urlInField=Y`. |
| `<encoding>` | N | Encoding đọc response; mặc định `UTF-8`. |
| `<httpLogin>` / `<httpPassword>` | N | Basic-auth (dùng `${VAR}` — KHÔNG embed thật). Password lưu mã hoá trừ khi là biến (`Encr.encryptPasswordIfNotUsingVariables`). |
| `<proxyHost>` / `<proxyPort>` | N | Proxy HTTP (dùng `${VAR}`); rỗng = không proxy. |
| `<socketTimeout>` / `<connectionTimeout>` | N | Chuỗi mili-giây; mặc định `"10000"`/`"10000"`. |
| `<closeIdleConnectionsTime>` | N | Chuỗi giây đóng idle connection; mặc định `"-1"` (= không đóng). |
| `<lookup>/<arg>/<name>` | N | Tên THAM SỐ query trên URL. CHÚ Ý: `<name>` là tên param. |
| `<lookup>/<arg>/<parameter>` | N | Tên TRƯỜNG DÒNG cung cấp giá trị cho param. |
| `<lookup>/<header>/<name>` | N | Tên HEADER HTTP gửi đi. |
| `<lookup>/<header>/<parameter>` | N | GIÁ TRỊ header (tĩnh, không phải tên trường). |
| `<result>/<name>` | Y | Trường mới chứa body response (String); mặc định `result`. |
| `<result>/<code>` | N | Trường mới chứa mã HTTP (Integer); rỗng = không thêm. |
| `<result>/<response_time>` | N | Trường mới chứa thời gian gọi (Integer, ms); rỗng = không thêm. |
| `<result>/<response_header>` | N | Trường mới chứa header trả về (String); rỗng = không thêm. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: HTTP` | `<type>` | `HTTP` (kind trans — khác entry job `HTTP`). |
| `configuration.url` | `<url>` | Dùng `${VAR}`. |
| `configuration.result_field` | `<result>/<name>` | Mặc định `result`. |
| `configuration.query_params[].param` | `<lookup>/<arg>/<name>` | Tên param trên URL. |
| `configuration.query_params[].field` | `<lookup>/<arg>/<parameter>` | Trường dòng. |
| `configuration.headers[].name/value` | `<lookup>/<header>/<name>`/`<parameter>` | Tên header + giá trị tĩnh. |

`<lookup>` chứa HAI list khác item (`<arg>`, `<header>`) → fill bằng HAI
lần `set_fields` riêng (`listTag=lookup`, `itemTag=arg` / `header`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 42 —
  `<step id="HTTP">` →
  `org.pentaho.di.trans.steps.http.HTTPMeta` (category Lookup). Chuỗi `HTTP`
  trùng với job entry `HTTP` nhưng KHÁC KIND — hợp lệ (catalog tách theo
  kind; tiền lệ `TABLE_EXISTS` ở B2a).
- Serialization: `HTTPMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/http/HTTPMeta.java`
  dòng 361–402) — 11 scalar (`url`, `urlInField`, `urlField`, `encoding`,
  `httpLogin`, `httpPassword` mã hoá trừ biến (dòng 369–370), `proxyHost`,
  `proxyPort`, 3 timeout), rồi `<lookup>` (dòng 377/392) chứa các `<arg>`
  (`name`+`parameter`, dòng 380–384) rồi các `<header>`
  (`name`+`parameter`, dòng 385–390), rồi `<result>` với `name`, `code`,
  `response_time`, `response_header` (dòng 394–399). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 278–280) gọi `readData()` (dòng
  404–447) — password giải mã `decryptPasswordOptionallyEncrypted` (dòng
  413); cờ Y/N thiếu → false; `<result>/*` lồng trong sub-node `result`
  (dòng 440–443).
- Khởi tạo: `setDefault()` (dòng 304–331) — timeout `"10000"`/`"10000"`/
  `"-1"` (`DEFAULT_*`, dòng 64/67/70), `fieldName = "result"`, 3 trường phụ
  rỗng, `encoding = "UTF-8"`, 0 arg/header.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 333–359) thêm trường body
  String (khi `fieldName` non-empty) + Integer code/time + String header —
  mỗi trường phụ rỗng là không thêm. Step gọi 1 request MỖI DÒNG — stream
  lớn + API chậm = tắc nghẽn; cân nhắc batch ở nguồn.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (URL theo dòng + mã trạng thái):

```xml
<url/>
<urlInField>Y</urlInField>
<urlField>API_URL</urlField>
<lookup>
  <arg>
    <name>id</name>
    <parameter>CUSTOMER_ID</parameter>
  </arg>
</lookup>
<result>
  <name>RESPONSE</name>
  <code>STATUS_CODE</code>
  <response_time/>
  <response_header/>
</result>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<arg>/<parameter>` là TRƯỜNG DÒNG, `<header>/<parameter>` là GIÁ TRỊ
  TĨNH**: cùng tên tag, ngữ nghĩa khác nhau — đừng điền tên trường vào
  header parameter (nó gửi nguyên văn).
- **`<arg>` và `<header>` là hai list khác nhau trong `<lookup>`** — fill
  bằng hai lần `set_fields` riêng; đừng gộp.
- **Mỗi dòng = một request**: không có batching trong step — piston gọi API
  theo dòng có thể bị rate-limit; giới hạn stream trước khi gọi.
- **Password `${VAR}` giữ nguyên văn**: `encryptPasswordIfNotUsingVariables`
  không mã hoá biến — template LUÔN dùng `${HTTP_PASSWORD}`, không embed
  mật khẩu thật (kể cả đã mã hoá).
- Template mặc định là khung cấu hình — người dùng phải điền URL/trường có
  thật; step 0 arg (mặc định) gọi URL trần.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
