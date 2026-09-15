# FTP_DELETE — Job entry xoá file qua FTP/FTPS/SFTP/SSH

Entry xoá các file khớp `<wildcard>` trong thư mục FTP (`<ftpdirectory>`).
Đa-protocol qua `<protocol>`: `FTP`, `FTPS`, `SFTP`, `SSH` (mặc định `FTP`).
Thành công theo `<success_condition>` kết hợp `<nr_limit_success>`; hỗ trợ
key-file (`<keyfilename>`), proxy thường + SOCKS, và kiểu kết nối FTPS
(`<ftps_connection_type>`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FTP_DELETE</type>
      <attributes/>
      <protocol>FTP</protocol>
      <servername>${FTP_HOST}</servername>
      <port>21</port>
      <username>${FTP_USER}</username>
      <password>${FTP_PASSWORD}</password>
      <ftpdirectory>${FTP_DIR}</ftpdirectory>
      <wildcard>.*</wildcard>
      <timeout>10000</timeout>
      <active>N</active>
      <useproxy>N</useproxy>
      <proxy_host/>
      <proxy_port/>
      <proxy_username/>
      <proxy_password/>
      <publicpublickey>N</publicpublickey>
      <keyfilename/>
      <keyfilepass/>
      <nr_limit_success>10</nr_limit_success>
      <success_condition>success_is_all_files_downloaded</success_condition>
      <copyprevious>N</copyprevious>
      <ftps_connection_type>FTP_CONNECTION</ftps_connection_type>
      <socksproxy_host/>
      <socksproxy_port>1080</socksproxy_port>
      <socksproxy_username/>
      <socksproxy_password/>
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
| `<protocol>` | Y | Một trong `FTP` (mặc định), `FTPS`, `SFTP`, `SSH`. |
| `<servername>` | Y | Host (dùng `${VAR}`). |
| `<port>` | N | Port chuỗi; mặc định `"21"`. |
| `<username>` / `<password>` | Y | Credential (dùng `${VAR}`, mã hoá trừ biến). |
| `<ftpdirectory>` | Y | Thư mục chứa file cần xoá (dùng `${VAR}`). CHÚ Ý tên tag. |
| `<wildcard>` | N | Regex lọc file. |
| `<timeout>` | N | Số int; thiếu → 10000. |
| `<active>` | N | `Y` = active; `N` (mặc định) = passive. |
| `<useproxy>` + 4 tag `proxy_*` | N | Bật proxy (`useproxy=Y`) + host/port/user/pass (`${VAR}`). |
| `<publicpublickey>` / `<keyfilename>` / `<keyfilepass>` | Điều kiện | `Y` + path key + passphrase khi auth bằng key (SFTP/SSH). CHÚ Ý tag lặp `public`. |
| `<nr_limit_success>` | N | Ngưỡng X dạng chuỗi; mặc định `"10"`. |
| `<success_condition>` | Y | `success_is_all_files_downloaded` (mặc định), `success_when_at_least`, `success_if_errors_less`. |
| `<copyprevious>` | N | `Y` = lấy danh sách file từ result trước; `N` (mặc định). |
| `<ftps_connection_type>` | N | Một trong 7 code `*_FTP_CONNECTION` (mặc định `FTP_CONNECTION`); lạ → 0. |
| `<socksproxy_*>` | N | SOCKS proxy; port mặc định `"1080"`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FTP_DELETE` | `<type>` | `FTP_DELETE`. |
| `configuration.protocol` | `<protocol>` | `FTP`/`FTPS`/`SFTP`/`SSH`. |
| `configuration.host/port/user` | `<servername>`/`<port>`/`<username>` | `${VAR}`. |
| `configuration.directory/wildcard` | `<ftpdirectory>`/`<wildcard>` | Chú ý tên tag directory. |

Toàn scalar — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 14 —
  `<job-entry id="FTP_DELETE">` →
  `org.pentaho.di.job.entries.ftpdelete.JobEntryFTPDelete` (category
  FileTransfer).
- Serialization: `JobEntryFTPDelete.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/ftpdelete/JobEntryFTPDelete.java`
  dòng 188–229) — `super.getXML()` rồi `protocol`, `servername`, `port`,
  `username`, `password`, `ftpdirectory`, `wildcard`, `timeout`, `active`,
  `useproxy`, 4 `proxy_*`, `publicpublickey`, `keyfilename`, `keyfilepass`,
  `nr_limit_success`, `success_condition`, `copyprevious`,
  `ftps_connection_type` (code qua `FTPSConnection.getConnectionTypeCode`,
  dòng 217–219), 4 `socksproxy_*`. Không có list.
- Deserialization: `loadXML()` (dòng 231–272) — cùng thứ tự; `timeout`
  `Const.toInt(..., 10000)` (dòng 243); connection type by code, lạ → 0
  (dòng 260–262).
- Khởi tạo: constructor (dòng 164–177) — `protocol = "FTP"`
  (`PROTOCOL_FTP`, dòng 124), `port = "21"`, `socksProxyPort = "1080"`,
  `nr_limit_success = "10"`, `success_condition =
  "success_is_all_files_downloaded"`, `FTPSConnectionType =
  CONNECTION_TYPE_FTP`.
- Protocol: `PROTOCOL_FTP/FTPS/SFTP/SSH` (dòng 124–130). Success:
  `success_when_at_least` / `success_if_errors_less` /
  `success_is_all_files_downloaded` (dòng 132–136). Connection code: 7 hằng
  `*_FTP_CONNECTION` (`FTPSConnection.java` dòng 79–82, lạ → index 0, dòng
  269–280).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 1140–1142). Không có
  `<connection>` DB.

Cấu hình không mặc định (SFTP + ngưỡng 5):

```xml
<protocol>SFTP</protocol>
<ftpdirectory>${FTP_DIR}/archive</ftpdirectory>
<wildcard>.*\.tmp</wildcard>
<nr_limit_success>5</nr_limit_success>
<success_condition>success_when_at_least</success_condition>
```

## 5. Lưu ý / bẫy

- **Tag `publicpublickey` lặp chữ `public`** (dòng 210) — viết
  `publickey` là tag lạ bị bỏ qua, auth key lặng lẽ tắt.
- **Tag thư mục là `ftpdirectory`** — không phải `remoteDirectory`
  (FTP_PUT) hay `FTPSdirectory` (FTPS_GET); mỗi entry một tên.
- **Typo compat ở job HTTP, không ở đây**: entry này không có fallback
  extention — chỉ job `HTTP` có.
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
