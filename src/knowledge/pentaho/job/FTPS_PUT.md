# FTPS_PUT — Job entry upload file qua FTPS

Entry upload các file local (`<localDirectory>` + `<wildcard>`) lên thư mục
FTPS (`<remoteDirectory>`), gọn hơn `FTPS_GET`: không có khối ngày/giờ,
move-file, `ifFileExists` hay success-condition — chỉ còn kết nối
(`<connection_type>` 7 code), proxy thường và các cờ upload cơ bản.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FTPS_PUT</type>
      <attributes/>
      <servername>${FTPS_HOST}</servername>
      <serverport>21</serverport>
      <username>${FTPS_USER}</username>
      <password>${FTPS_PASSWORD}</password>
      <remoteDirectory>${FTPS_DIR}</remoteDirectory>
      <localDirectory>${LOCAL_DIR}</localDirectory>
      <wildcard>.*</wildcard>
      <binary>Y</binary>
      <timeout>10000</timeout>
      <remove>N</remove>
      <only_new>N</only_new>
      <active>N</active>
      <proxy_host/>
      <proxy_port/>
      <proxy_username/>
      <proxy_password/>
      <connection_type>FTP_CONNECTION</connection_type>
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
| `<servername>` | Y | Host (dùng `${VAR}`). CHÚ Ý: entry này `servername` đứng ĐẦU (khác FTPS_GET để `port` trước). |
| `<serverport>` | N | Port chuỗi; mặc định `"21"`. CHÚ Ý tên `serverport` (khác `port` của FTPS_GET/FTP_DELETE). |
| `<username>` / `<password>` | Y | Credential (`${VAR}`, mã hoá trừ biến). |
| `<remoteDirectory>` / `<localDirectory>` | Y | Thư mục đích/nguồn (`${VAR}`). |
| `<wildcard>` / `<binary>` / `<timeout>` | N | Lọc file / mode / int thiếu → 10000. |
| `<remove>` / `<only_new>` / `<active>` | N | Xoá nguồn / chỉ file mới / active — Y/N. |
| `<proxy_host>` … `<proxy_password>` | N | Proxy (`${VAR}`); **`proxy_password` lưu NGUYÊN VĂN** (không mã hoá — dòng 132). |
| `<connection_type>` | N | 1 trong 7 code `*_FTP_CONNECTION` (mặc định `FTP_CONNECTION`); lạ → 0. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FTPS_PUT` | `<type>` | `FTPS_PUT`. |
| `configuration.host/port/user` | `<servername>`/`<serverport>`/`<username>` | `${VAR}`; tên tag khác FTPS_GET. |
| `configuration.remote_dir/local_dir` | `<remoteDirectory>`/`<localDirectory>` | `${VAR}`. |

Toàn scalar — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 11 —
  `<job-entry id="FTPS_PUT">` →
  `org.pentaho.di.job.entries.ftpsput.JobEntryFTPSPUT` (category
  FileTransfer).
- Serialization: `JobEntryFTPSPUT.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/ftpsput/JobEntryFTPSPUT.java`
  dòng 110–137) — `super.getXML()` rồi `servername`, `serverport`,
  `username`, `password`, `remoteDirectory`, `localDirectory`, `wildcard`,
  `binary`, `timeout`, `remove`, `only_new`, `active`, 4 `proxy_*`
  (**`proxy_password` NGUYÊN VĂN không qua `Encr`, dòng 132** — khác
  FTP_PUT dòng 160–161), `connection_type` (code, dòng 133–134). Không có
  list, không có khối ngày/giờ hay success-condition.
- Deserialization: `loadXML()` (dòng 139–166) — cùng thứ tự; `timeout`
  `Const.toInt(..., 10000)` (dòng 151); connection by code lạ → 0 (dòng
  160–162).
- Khởi tạo: constructor (dòng 92–99) — `serverPort = "21"`,
  `connectionType = CONNECTION_TYPE_FTP`; còn lại null/false.
- Connection code: 7 hằng `*_FTP_CONNECTION`
  (`.../ftpsget/FTPSConnection.java` dòng 79–82).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 612–614). Không có
  `<connection>` DB.

Cấu hình không mặc định (TLS + chỉ file mới):

```xml
<servername>${FTPS_HOST}</servername>
<wildcard>.*\.csv</wildcard>
<only_new>Y</only_new>
<connection_type>AUTH_TLS_FTP_CONNECTION</connection_type>
```

## 5. Lưu ý / bẫy

- **Tên tag khác họ FTPS_GET**: `servername`/`serverport` (PUT) vs
  `servername`+`port` (GET), `remoteDirectory`/`localDirectory` (PUT) vs
  `FTPSdirectory`/`targetdirectory` (GET) — đừng copy tag chéo 2 entry.
- **`proxy_password` KHÔNG mã hoá** ở entry này (dòng 132) — template dùng
  `${VAR}` nên không lộ gì, nhưng đừng mong file .kjb che giấu nó như
  FTP_PUT.
- **Không có success-condition** — khác FTPS_GET/FTP_DELETE; thành công =
  không exception (xem `execute()` khi review runtime).
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
