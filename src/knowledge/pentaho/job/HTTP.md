# HTTP — Job entry tải/upload HTTP (job)

Entry tải nội dung URL về file (`<targetfilename>`), hoặc upload file lên
(`<uploadfilename>`), hoặc chạy theo từng dòng result trước
(`<run_every_row>=Y` với cột URL/file upload/đích). Header HTTP tùy biến
trong list `<headers>/<header>`. Khác step trans `HTTP` (cùng chuỗi `HTTP`
nhưng khác kind — xem `trans/HTTP.md`): entry này làm việc với FILE, không
gắn response vào dòng (không có dòng trong job).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>HTTP</type>
      <attributes/>
      <url>${HTTP_URL}</url>
      <targetfilename>${TARGET_FILE}</targetfilename>
      <file_appended>N</file_appended>
      <date_time_added>N</date_time_added>
      <targetfilename_extension/>
      <uploadfilename/>
      <run_every_row>N</run_every_row>
      <url_fieldname/>
      <upload_fieldname/>
      <dest_fieldname/>
      <username>${HTTP_USER}</username>
      <password>${HTTP_PASSWORD}</password>
      <proxy_host>${PROXY_HOST}</proxy_host>
      <proxy_port>${PROXY_PORT}</proxy_port>
      <non_proxy_hosts/>
      <addfilenameresult>Y</addfilenameresult>
      <headers>
        <header>
          <header_name>{{HEADER_NAME}}</header_name>
          <header_value>{{HEADER_VALUE}}</header_value>
        </header>
      </headers>
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
| `<url>` | Điều kiện | URL tải/upload (dùng `${VAR}`); bỏ qua khi `run_every_row=Y` (lấy từ cột). |
| `<targetfilename>` | Điều kiện | File đích khi tải về (dùng `${VAR}`). |
| `<file_appended>` | N | `Y` = nối vào file đích; `N` (mặc định). |
| `<date_time_added>` | N | `Y` = chèn timestamp vào tên file; `N` (mặc định). |
| `<targetfilename_extension>` | N | Đuôi thêm vào file đích. Load fallback tag typo `targetfilename_extention` khi thiếu. |
| `<uploadfilename>` | Điều kiện | File cần upload (dùng `${VAR}`); rỗng = chỉ tải. |
| `<run_every_row>` | N | `Y` = chạy mỗi dòng result trước (URL/file/đích từ 3 cột); `N` (mặc định). |
| `<url_fieldname>` / `<upload_fieldname>` / `<dest_fieldname>` | Điều kiện | 3 tên CỘT result khi `run_every_row=Y`. |
| `<username>` / `<password>` | N | Basic-auth (dùng `${VAR}`). Password mã hoá trừ khi là biến. |
| `<proxy_host>` / `<proxy_port>` / `<non_proxy_hosts>` | N | Proxy (dùng `${VAR}`); `non_proxy_hosts` kiểu `*.intranet\|localhost`. |
| `<addfilenameresult>` | N | `Y` (mặc định cả khi thiếu tag!) = đưa file tải về vào result filenames. |
| `<headers>/<header>/<header_name>` | N | Tên header HTTP. |
| `<headers>/<header>/<header_value>` | N | Giá trị header (hỗ trợ biến). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: HTTP` | `<type>` | `HTTP` (kind job — khác step trans `HTTP`). |
| `configuration.url/target_file` | `<url>`/`<targetfilename>` | Dùng `${VAR}`. |
| `configuration.headers[].name/value` | `<headers>/<header>/<header_name>`/`<header_value>` | List header. |

`<headers>` chứa list `<header>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=headers`, `itemTag=header`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 19 —
  `<job-entry id="HTTP">` →
  `org.pentaho.di.job.entries.http.JobEntryHTTP` (category FileManagement).
  Chuỗi `HTTP` trùng step trans nhưng KHÁC KIND — hợp lệ (tiền lệ
  `TABLE_EXISTS` ở B2a).
- Serialization: `JobEntryHTTP.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/http/JobEntryHTTP.java`
  dòng 178–216) — `super.getXML()` rồi `url`, `targetfilename`,
  `file_appended`, `date_time_added`, `targetfilename_extension`,
  `uploadfilename`, `run_every_row`, 3 fieldname, `username`, `password`
  (mã hoá trừ biến, dòng 197–198), `proxy_host`, `proxy_port`,
  `non_proxy_hosts`, `addfilenameresult`, rồi wrapper `<headers>` LUÔN emit
  (dòng 204/213) chứa các `<header>` với `header_name` + `header_value`
  (dòng 207–210).
- Deserialization: `loadXML()` (dòng 219–258) — `super.loadXML()` rồi đọc
  cùng thứ tự; `targetfilename_extension` fallback tag typo
  `targetfilename_extention` khi thiếu (dòng 227–228);
  **`addfilenameresult` thiếu tag → TRUE** (`NVL(..., "Y")`, dòng 243–244).
- Khởi tạo: constructor (dòng 150–154) chỉ đặt `url` null và
  `addfilenameresult = true`; các cờ khác giữ false mặc định Java.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 707–709) — entry điều kiện.
  Không có `<connection>` — entry không tham chiếu DB.

Cấu hình không mặc định (upload + header auth):

```xml
<url>${HTTP_URL}/upload</url>
<uploadfilename>${LOCAL_FILE}</uploadfilename>
<headers>
  <header>
    <header_name>Authorization</header_name>
    <header_value>Bearer ${API_TOKEN}</header_value>
  </header>
</headers>
```

## 5. Lưu ý / bẫy

- **`<headers>` luôn paired** — giữ paired kể cả rỗng, không self-closing.
- **`addfilenameresult` thiếu = TRUE** — muốn không đưa file vào result phải
  ghi tường minh `N`.
- **Typo compat `targetfilename_extention`**: file .kjb cũ có thể mang tag
  thiếu `s` — load vẫn nhận (fallback); template mới viết đúng
  `targetfilename_extension`.
- **Trùng chuỗi với step trans**: `findByXmlType` tách theo kind — đừng gộp
  2 reference làm một; alias `HTTP` dùng chung 2 kind là hợp lệ.
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`,
  không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
