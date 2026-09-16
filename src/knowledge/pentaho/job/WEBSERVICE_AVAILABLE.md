# WEBSERVICE_AVAILABLE — Job entry kiểm tra web service

Entry mở HTTP(S) GET tới `url` với timeout kết nối/đọc cho trước để xác minh
web service có sẵn không. Entry điều kiện (`evaluates() = true`) — nối
được → nhánh success. Timeout `0` nghĩa là không giới hạn (mặc định).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>WEBSERVICE_AVAILABLE</type>
      <attributes/>
      <url>${SERVICE_URL}</url>
      <connectTimeOut>0</connectTimeOut>
      <readTimeOut>0</readTimeOut>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<url>` | Y | URL web service (`${SERVICE_URL}`). |
| `<connectTimeOut>` | N | Timeout kết nối ms; mặc định `0` = không giới hạn. Chữ T hoa. |
| `<readTimeOut>` | N | Timeout đọc ms; mặc định `0` = không giới hạn. Chữ T hoa. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WEBSERVICE_AVAILABLE` | `<type>` | `WEBSERVICE_AVAILABLE`. |
| `configuration.url` | `<url>` | `${VAR}`. |
| `configuration.connect_timeout_ms` | `<connectTimeOut>` | Chữ T hoa; `0` = vô hạn. |
| `configuration.read_timeout_ms` | `<readTimeOut>` | Chữ T hoa; `0` = vô hạn. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 58 —
  `<job-entry id="WEBSERVICE_AVAILABLE">` →
  `org.pentaho.di.job.entries.webserviceavailable.JobEntryWebServiceAvailable`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryWebServiceAvailable.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/webserviceavailable/JobEntryWebServiceAvailable.java`
  dòng 78–86) — `super.getXML()` rồi đúng thứ tự `url`,
  `connectTimeOut`, `readTimeOut`. Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 88–99) — đọc thẳng 3 tag, thiếu →
  null (không fallback).
- Khởi tạo: constructor (dòng 62–67) — `url=null`,
  `connectTimeOut="0"`, `readTimeOut="0"`.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 148+), `evaluates()` = true (dòng
  191). Không chạy network khi test template. Khác với step trans
  `WebServiceAvailable` (kiểm tra URL theo từng dòng input) — entry này chỉ
  kiểm tra một URL tĩnh một lần trong job.

Cấu hình không mặc định (timeout 30s/60s):

```xml
<url>${SERVICE_URL}</url>
<connectTimeOut>30000</connectTimeOut>
<readTimeOut>60000</readTimeOut>
```

## 5. Lưu ý / bẫy

- **Chữ T hoa**: `connectTimeOut`, `readTimeOut` — giữ đúng chính tả này.
- **`0` = không timeout**: mặc định constructor là `"0"`, nghĩa là chờ vô
  hạn — khi dùng production nên đặt timeout cụ thể thay vì giữ mặc định.
- **Thiếu tag → null**: file thiếu 2 tag timeout sẽ load thành null (không
  fallback `"0"`); template luôn ghi đủ 3 tag.
- Template mặc định là khung cấu hình — người dùng phải điền URL có thật;
  không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
