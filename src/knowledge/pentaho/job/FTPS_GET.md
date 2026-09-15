# FTPS_GET — Job entry tải file qua FTPS

Entry tải các file khớp `<wildcard>` từ thư mục FTPS (`<FTPSdirectory>`)
về thư mục local (`<targetdirectory>`), có thể xoá nguồn (`<remove>`), chỉ
lấy file mới (`<only_new>`), di chuyển sau tải (`<movefiles>`), chèn
ngày/giờ vào tên file, và xử lý file đích tồn tại (`<ifFileExists>`).
Kiểu mã hoá kênh qua `<connection_type>` (7 code). Thành công theo
`<success_condition>` + `<nr_limit>`.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FTPS_GET</type>
      <attributes/>
      <port>21</port>
      <servername>${FTPS_HOST}</servername>
      <username>${FTPS_USER}</username>
      <password>${FTPS_PASSWORD}</password>
      <FTPSdirectory>${FTPS_DIR}</FTPSdirectory>
      <targetdirectory>${LOCAL_DIR}</targetdirectory>
      <wildcard>.*</wildcard>
      <binary>Y</binary>
      <timeout>10000</timeout>
      <remove>N</remove>
      <only_new>N</only_new>
      <active>N</active>
      <movefiles>N</movefiles>
      <movetodirectory/>
      <adddate>N</adddate>
      <addtime>N</addtime>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <AddDateBeforeExtension>N</AddDateBeforeExtension>
      <isaddresult>Y</isaddresult>
      <createmovefolder>N</createmovefolder>
      <proxy_host/>
      <proxy_port/>
      <proxy_username/>
      <proxy_password/>
      <ifFileExists>ifFileExistsSkip</ifFileExists>
      <nr_limit>10</nr_limit>
      <success_condition>success_if_no_errors</success_condition>
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
| `<port>` | N | Port chuỗi, ĐỨNG ĐẦU sau super; mặc định `"21"`. CHÚ Ý thứ tự (port trước servername). |
| `<servername>` / `<username>` / `<password>` | Y | Credential (`${VAR}`, mã hoá trừ biến). |
| `<FTPSdirectory>` | Y | Thư mục nguồn trên server (`${VAR}`). CHÚ Ý case. |
| `<targetdirectory>` | Y | Thư mục đích local (`${VAR}`). |
| `<wildcard>` / `<binary>` / `<timeout>` | N | Lọc file / mode / int thiếu → 10000. |
| `<remove>` / `<only_new>` / `<active>` | N | Xoá nguồn / chỉ file mới / active — Y/N, thiếu → false. |
| `<movefiles>` / `<movetodirectory>` / `<createmovefolder>` | Điều kiện | Di chuyển file đã tải + tạo thư mục. |
| `<adddate>` / `<addtime>` / `<SpecifyFormat>` / `<date_time_format>` / `<AddDateBeforeExtension>` | N | Chèn ngày/giờ vào tên file (giữ case `SpecifyFormat`). |
| `<isaddresult>` | N | `Y` = đưa file tải về vào result; **thiếu tag → TRUE**. |
| `<proxy_host>` … `<proxy_password>` | N | Proxy (`${VAR}`); rỗng = không proxy. |
| `<ifFileExists>` | N | `ifFileExistsSkip` (mặc định, lạ → 0), `ifFileExistsCreateUniq`, `ifFileExistsFail`. |
| `<nr_limit>` | N | Ngưỡng X chuỗi; mặc định `"10"`. |
| `<success_condition>` | Y | `success_if_no_errors` (mặc định cả khi thiếu), `success_when_at_least`, `success_if_errors_less`. |
| `<connection_type>` | N | 1 trong 7 code `*_FTP_CONNECTION` (mặc định `FTP_CONNECTION`); lạ → 0. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FTPS_GET` | `<type>` | `FTPS_GET`. |
| `configuration.host/user` | `<servername>`/`<username>` | `${VAR}`. |
| `configuration.source_dir/target_dir` | `<FTPSdirectory>`/`<targetdirectory>` | Chú ý case `FTPSdirectory`. |

Toàn scalar — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 10 —
  `<job-entry id="FTPS_GET">` →
  `org.pentaho.di.job.entries.ftpsget.JobEntryFTPSGet` (category
  FileTransfer).
- Serialization: `JobEntryFTPSGet.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/ftpsget/JobEntryFTPSGet.java`
  dòng 161–205) — `super.getXML()` rồi **`port` TRƯỚC `servername`**
  (dòng 165–166), `username`, `password`, `FTPSdirectory`,
  `targetdirectory`, `wildcard`, `binary`, `timeout`, `remove`, `only_new`,
  `active`, `movefiles`, `movetodirectory`, khối ngày/giờ (`adddate`,
  `addtime`, `SpecifyFormat`, `date_time_format`, `AddDateBeforeExtension`,
  `isaddresult`, `createmovefolder`), 4 `proxy_*`, `ifFileExists` (chuỗi
  action, dòng 195), `nr_limit`, `success_condition`, `connection_type`
  (code, dòng 199–200). Không có list.
- Deserialization: `loadXML()` (dòng 207–259) — cùng thứ tự; `timeout`
  `Const.toInt(..., 10000)` (dòng 219); **`isaddresult` thiếu/rỗng →
  TRUE** (dòng 234–240); `success_condition` thiếu → `success_if_no_errors`
  (dòng 252–253); connection by code lạ → 0 (dòng 254–256).
- Khởi tạo: constructor (dòng 133–150) — `port = "21"`, `nr_limit = "10"`,
  `success_condition = "success_if_no_errors"`, `ifFileExists = 0`,
  `isaddresult = true`, `connectionType = CONNECTION_TYPE_FTP`.
- Enum: `FILE_EXISTS_ACTIONS = { ifFileExistsSkip, ifFileExistsCreateUniq,
  ifFileExistsFail }` (dòng 108–112; lạ → 0, dòng 705–711). Success:
  `success_when_at_least` / `success_if_errors_less` / `success_if_no_errors`
  (dòng 116–118). Connection: 7 code `*_FTP_CONNECTION`
  (`FTPSConnection.java` dòng 79–82).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 1065–1067). Không có
  `<connection>` DB.

Cấu hình không mặc định (fail khi trùng + TLS):

```xml
<FTPSdirectory>${FTPS_DIR}/inbox</FTPSdirectory>
<targetdirectory>${LOCAL_DIR}/inbox</targetdirectory>
<wildcard>.*\.xml</wildcard>
<ifFileExists>ifFileExistsFail</ifFileExists>
<connection_type>AUTH_TLS_FTP_CONNECTION</connection_type>
```

## 5. Lưu ý / bẫy

- **`<port>` đứng trước `<servername>`** — ngược mọi entry FTP khác; giữ
  đúng order của `getXML()` khi viết tay.
- **`isaddresult` thiếu = TRUE** — muốn không đưa file vào result phải ghi
  tường minh `N`.
- **Case tag**: `FTPSdirectory`, `SpecifyFormat`, `AddDateBeforeExtension`
  giữ nguyên — viết thường hoá là tag lạ bị bỏ qua.
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
