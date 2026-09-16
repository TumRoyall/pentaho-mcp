# TELNET — Job entry kiểm tra cổng TCP

Entry mở kết nối TCP tới `hostname:port` với timeout cho trước để xác minh
dịch vụ có lắng nghe không. Entry điều kiện (`evaluates() = true`) — nối
được → nhánh success, timeout/refused → nhánh failure.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>TELNET</type>
      <attributes/>
      <hostname>${TELNET_HOST}</hostname>
      <port>23</port>
      <timeout>3000</timeout>
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
| `<hostname>` | Y | Host cần nối (`${TELNET_HOST}`). |
| `<port>` | N | Cổng TCP; mặc định `23`. Lưu dạng chuỗi số. |
| `<timeout>` | N | Timeout ms; mặc định `3000`. Lưu dạng chuỗi số. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TELNET` | `<type>` | `TELNET`. |
| `configuration.host` | `<hostname>` | `${VAR}`. |
| `configuration.port` | `<port>` | Số cổng, ghi chuỗi số. |
| `configuration.timeout_ms` | `<timeout>` | Ms, ghi chuỗi số. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 66 —
  `<job-entry id="TELNET">` →
  `org.pentaho.di.job.entries.telnet.JobEntryTelnet`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryTelnet.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/telnet/JobEntryTelnet.java`
  dòng 88–97) — `super.getXML()` rồi đúng thứ tự `hostname`, `port`,
  `timeout`. Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 99–109) — đọc thẳng 3 tag, không
  fallback (thiếu tag → null).
- Khởi tạo: constructor (dòng 72–77) — `hostname=null`, `port="23"`
  (`DEFAULT_PORT`), `timeout="3000"` (`DEFAULT_TIME_OUT`, dòng 69–70).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 171+), `evaluates()` = true (dòng
  207). Không chạy network khi test template.

Cấu hình không mặc định (kiểm tra SSH port 22, timeout 5s):

```xml
<hostname>${TELNET_HOST}</hostname>
<port>22</port>
<timeout>5000</timeout>
```

## 5. Lưu ý / bẫy

- **Port/timeout là chuỗi số**: constructor dùng `String.valueOf(23)` /
  `String.valueOf(3000)` — ghi `22`, không ghi số có đơn vị hay Y/N.
- **Thiếu tag → null (không fallback)**: khác PING (có legacy) hay GET_POP
  (có default khi load) — file thiếu `<port>` sẽ load thành null; template
  luôn ghi đủ 3 tag.
- Template mặc định là khung cấu hình — người dùng phải điền host/port có
  thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
