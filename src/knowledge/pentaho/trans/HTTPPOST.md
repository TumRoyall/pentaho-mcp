# HTTPPOST — Step gọi HTTP POST theo từng dòng (trans)

Với MỖI dòng vào, gọi HTTP POST tới URL (tĩnh hoặc từ trường), gửi thân
request (`<requestEntity>` hoặc file khi `<postafile>=Y`), kèm tham số form
(`<lookup>/<arg>`, mỗi arg có thêm cờ `<header>` đánh dấu gửi dưới dạng
header) và tham số query URL (`<lookup>/<query>`), rồi gắn body + (tùy chọn)
mã/thời gian/header trả về vào các trường mới (`<result>`). Bản POST của
step `HTTP` (GET).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>HTTPPOST</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <postafile>N</postafile>
    <encoding>UTF-8</encoding>
    <url>${HTTP_URL}</url>
    <urlInField>N</urlInField>
    <urlField/>
    <requestEntity>{{REQUEST_BODY}}</requestEntity>
    <httpLogin>${HTTP_USER}</httpLogin>
    <httpPassword>${HTTP_PASSWORD}</httpPassword>
    <proxyHost>${PROXY_HOST}</proxyHost>
    <proxyPort>${PROXY_PORT}</proxyPort>
    <socketTimeout>10000</socketTimeout>
    <connectionTimeout>10000</connectionTimeout>
    <closeIdleConnectionsTime>-1</closeIdleConnectionsTime>
    <lookup>
      <arg>
        <name>{{FORM_PARAM}}</name>
        <parameter>{{SOURCE_FIELD}}</parameter>
        <header>N</header>
      </arg>
      <query>
        <name>{{QUERY_PARAM}}</name>
        <parameter>{{QUERY_VALUE}}</parameter>
      </query>
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
| `<postafile>` | N | `Y` = gửi `<requestEntity>` như FILE; `N` (mặc định) = gửi trực tiếp nội dung. |
| `<url>` / `<urlInField>` / `<urlField>` | Điều kiện | Như step `HTTP` (URL tĩnh `${VAR}` hoặc từ trường). |
| `<requestEntity>` | Điều kiện | Nội dung/file thân POST. |
| `<httpLogin>` / `<httpPassword>` / proxy / timeout | N | Như step `HTTP` (biến `${VAR}`, không embed thật). |
| `<lookup>/<arg>/<name>` | N | Tên tham số form. |
| `<lookup>/<arg>/<parameter>` | N | Tên trường dòng cung cấp giá trị. |
| `<lookup>/<arg>/<header>` | N | `Y` = gửi arg này dưới dạng HTTP header; `N` (mặc định). Y/N (ghi không xuống dòng nhưng vẫn Y/N). |
| `<lookup>/<query>/<name>` | N | Tên tham số query gắn lên URL. |
| `<lookup>/<query>/<parameter>` | N | Giá trị query (tĩnh). |
| `<result>/...` | Xem step `HTTP` | `name` mặc định `result`, 3 trường phụ tùy chọn. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: HTTP_POST` | `<type>` | `HTTPPOST`. |
| `configuration.request_body` | `<requestEntity>` | Thân POST. |
| `configuration.form_params[].param/field` | `<lookup>/<arg>/<name>`/`<parameter>` | Tham số form từ trường dòng. |
| `configuration.form_params[].as_header` | `<lookup>/<arg>/<header>` | Boolean → Y/N. |
| `configuration.query_params[].param/value` | `<lookup>/<query>/<name>`/`<parameter>` | Param query tĩnh. |

`<lookup>` chứa HAI list khác item (`<arg>` 3 tag, `<query>` 2 tag) → fill
bằng HAI lần `set_fields` riêng.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 91 —
  `<step id="HTTPPOST">` →
  `org.pentaho.di.trans.steps.httppost.HTTPPOSTMeta` (category Lookup).
- Serialization: `HTTPPOSTMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/httppost/HTTPPOSTMeta.java`
  dòng 410–454) — `postafile`, `encoding`, `url`, `urlInField`,
  `urlField`, `requestEntity`, `httpLogin`, `httpPassword` (mã hoá trừ biến),
  proxy, 3 timeout (dòng 413–426), rồi `<lookup>` (dòng 428/444) chứa các
  `<arg>` với `name`, `parameter`, **`header` Y/N** (dòng 431–436; ghi bằng
  `addTagValue(tag, bool, false)` — số false là "không xuống dòng", giá trị
  vẫn Y/N) rồi các `<query>` với `name`, `parameter` (dòng 437–442), rồi
  `<result>` 4 tag như `HTTP` (dòng 446–451).
- Deserialization: `loadXML()` (dòng 320–322) gọi `readData()` (dòng
  456–502) — `header` parse bằng `YES.equalsIgnoreCase` (dòng 481, thiếu →
  false); `result/*` lồng trong `result` (dòng 493–497).
- Khởi tạo: `setDefault()` (dòng 353–382) — `fieldName = "result"`,
  `encoding = "UTF-8"` (`DEFAULT_ENCODING`, dòng 73), `postafile = false`,
  timeout `"10000"`/`"10000"`/`"-1"`, 0 arg/query.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 384–408) như `HTTP` (body
  String + code/time Integer + header String tùy chọn). Mỗi dòng = một POST.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (form login + query version):

```xml
<postafile>N</postafile>
<url>${HTTP_URL}/login</url>
<lookup>
  <arg>
    <name>username</name>
    <parameter>LOGIN_NAME</parameter>
    <header>N</header>
  </arg>
  <arg>
    <name>X-Token</name>
    <parameter>TOKEN_VALUE</parameter>
    <header>Y</header>
  </arg>
  <query>
    <name>v</name>
    <parameter>2</parameter>
  </query>
</lookup>
<result>
  <name>LOGIN_RESPONSE</name>
  <code>STATUS_CODE</code>
  <response_time/>
  <response_header/>
</result>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<arg>` có 3 tag, `<query>` có 2 tag**: `header` chỉ tồn tại trong
  `<arg>` — đừng thêm `<header>` vào `<query>` (tag lạ bị bỏ qua, arg mất
  tính header lặng lẽ ở chiều ngược lại nếu thiếu).
- **`<header>` trong `<arg>` vẫn là Y/N** dù serialize không xuống dòng —
  đừng ghi `true`/`false`.
- **`<query>/<parameter>` là giá trị tĩnh** (giống header của GET), còn
  `<arg>/<parameter>` là tên trường dòng — đừng đảo.
- **Mỗi dòng = một POST** — như `HTTP`, không batching nội tại.
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
