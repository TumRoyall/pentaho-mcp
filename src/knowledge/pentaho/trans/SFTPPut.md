# SFTPPut — Step upload file qua SFTP

Upload file lên server SFTP (`servername` + `serverport` chuỗi + user/
pass hoặc key file). File nguồn/tên remote lấy từ FIELD (`sourceFileFieldName`,
`remoteDirectoryFieldName`, `remoteFilenameFieldName`) hoặc stream
(`inputIsStream`). Sau upload có action (`aftersftpput` code: rỗng =
nothing, `delete` = xóa nguồn) với backward-compat tag legacy `<remove>`.
Mọi credential/host đều `${VAR}`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SFTPPut</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <servername>${SFTP_HOST}</servername>
    <serverport>22</serverport>
    <username>${SFTP_USER}</username>
    <password>Encrypted ${SFTP_PASS}</password>
    <sourceFileFieldName>SRC_PATH</sourceFileFieldName>
    <remoteDirectoryFieldName>REMOTE_DIR</remoteDirectoryFieldName>
    <inputIsStream>N</inputIsStream>
    <addFilenameResut>N</addFilenameResut>
    <usekeyfilename>N</usekeyfilename>
    <keyfilename/>
    <keyfilepass>Encrypted</keyfilepass>
    <compression>none</compression>
    <proxyType/>
    <proxyHost/>
    <proxyPort/>
    <proxyUsername/>
    <proxyPassword>Encrypted</proxyPassword>
    <createRemoteFolder>N</createRemoteFolder>
    <aftersftpput/>
    <destinationfolderFieldName/>
    <createdestinationfolder>N</createdestinationfolder>
    <remoteFilenameFieldName>REMOTE_NAME</remoteFilenameFieldName>
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
| `<servername>` | Y | Host SFTP; luôn `${VAR}`. |
| `<serverport>` | N | Port (chuỗi); mặc định `"22"`. |
| `<username>`/`<password>` | Y | User/pass (mã hóa); luôn `${VAR}`. |
| `<sourceFileFieldName>` | Y (khi không stream) | Tên field chứa đường dẫn file nguồn. |
| `<remoteDirectoryFieldName>` | N | Tên field chứa thư mục remote. |
| `<inputIsStream>` | N | `Y` = upload nội dung stream thay vì file. |
| `<addFilenameResut>` | N | `Y` = thêm tên file vào result (giữ đúng chính tả thiếu `l`: `Resut`). |
| `<usekeyfilename>` | N | `Y` = auth bằng key file. |
| `<keyfilename>`/`<keyfilepass>` | Y khi dùng key | Key file + passphrase (mã hóa); `${VAR}`. |
| `<compression>` | N | Kiểu nén; mặc định `"none"`. |
| `<proxyType>`/`<proxyHost>`/`<proxyPort>`/`<proxyUsername>`/`<proxyPassword>` | N | Proxy tùy chọn; password mã hóa. |
| `<createRemoteFolder>` | N | `Y` = tự tạo thư mục remote. |
| `<aftersftpput>` | N | Code action sau upload (`""` = nothing, `delete` = xóa nguồn); legacy `<remove>Y` nâng thành delete. |
| `<destinationfolderFieldName>` | N | Tên field chứa thư mục đích. |
| `<createdestinationfolder>` | N | `Y` = tạo thư mục đích (giữ đúng thường `d` đầu). |
| `<remoteFilenameFieldName>` | N | Tên field chứa tên file remote. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SFTP_PUT` | `<type>` | `SFTPPut`. |
| `configuration.hostname` | `<servername>` | `${VAR}`. |
| `configuration.port` | `<serverport>` | Chuỗi. |
| `configuration.username` | `<username>` | `${VAR}`. |
| `configuration.password` | `<password>` | `${VAR}` (mã hóa). |
| `configuration.source_field` | `<sourceFileFieldName>` | Tham chiếu field. |
| `configuration.remote_dir_field` | `<remoteDirectoryFieldName>` | Tham chiếu field. |
| `configuration.use_key` | `<usekeyfilename>` | Boolean → Y/N. |
| `configuration.after_upload` | `<aftersftpput>` | Code (`""`/`delete`). |
| `configuration.create_remote_folder` | `<createRemoteFolder>` | Boolean → Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 128 —
  `<step id="SFTPPut">` →
  `org.pentaho.di.trans.steps.sftpput.SFTPPutMeta` (category
  Experimental). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SFTPPutMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/sftpput/SFTPPutMeta.java`
  dòng 161–196) — đúng thứ tự `servername`, `serverport`, `username`,
  `password` (mã hóa, dòng 167–168), `sourceFileFieldName`,
  `remoteDirectoryFieldName`, `inputIsStream` (Y/N),
  `addFilenameResut` (Y/N — giữ typo thiếu `l`), `usekeyfilename` (Y/N),
  `keyfilename`, `keyfilepass` (mã hóa), `compression`, `proxyType`,
  `proxyHost`, `proxyPort`, `proxyUsername`, `proxyPassword` (mã hóa),
  `createRemoteFolder` (Y/N), `aftersftpput` (code qua
  `JobEntrySFTPPUT.getAfterSFTPPutCode`, dòng 186–187),
  `destinationfolderFieldName`, `createdestinationfolder` (thường `d`),
  `remoteFilenameFieldName`. Tất cả vô điều kiện.
- Deserialization: `readData()` (dòng 100–138, qua `loadXML` dòng 91–93)
  — booleans `"Y".equalsIgnoreCase` (thiếu → false); passwords
  `decryptPasswordOptionallyEncrypted`; `aftersftpput=Const.NVL(...) →
  getAfterSFTPPutByCode` (dòng 126–127); backward-compat legacy
  `<remove>Y</remove>` nâng `NOTHING→DELETE` (dòng 125, 128–130, lặp lại
  ở `readRep` dòng 223–228). Tag `createdestinationfolder` phải đúng
  thường (dòng 132–133). Catch-all → `KettleXMLException` (dòng 135–137).
- Khởi tạo: `setDefault()` (dòng 140–159) — `serverPort="22"`,
  `inputIsStream/addFilenameResut/usekeyfilename=false`,
  `compression="none"`, proxy null, `createRemoteFolder=false`,
  `afterFTPS=AFTER_FTPSPUT_NOTHING`, `createDestinationFolder=false`;
  user/pass/source/remote null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 273–276) là no-op. `check()`
  (dòng 278–306) chỉ WARNING khi `prev` rỗng + ERROR khi
  `input.length==0` — không validate server.
- Không có `<connection>`: server/port/auth là strings thuần — template
  không mang `<connection>`, fixture test không cần khai báo connection.

Cấu hình không mặc định (key auth + xóa nguồn + tạo thư mục):

```xml
<servername>${SFTP_HOST}</servername>
<serverport>2222</serverport>
<username>${SFTP_USER}</username>
<usekeyfilename>Y</usekeyfilename>
<keyfilename>${SFTP_KEY}</keyfilename>
<keyfilepass>Encrypted ${SFTP_KEYPASS}</keyfilepass>
<compression>none</compression>
<createRemoteFolder>Y</createRemoteFolder>
<aftersftpput>delete</aftersftpput>
<createdestinationfolder>Y</createdestinationfolder>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Giữ đúng 2 typo**: `addFilenameResut` (thiếu `l`) và
  `createdestinationfolder` (thường `d`) — sửa "đúng chính tả" là hỏng
  load.
- **Đừng nhầm job `SFTPPUT`**: đây là step trans `SFTPPut` (field-based),
  khác job entry `SFTPPUT` — khác kind, khác XML.
- **Legacy `<remove>Y` vẫn có hiệu lực** (nâng thành delete) — file cũ có
  tag này sẽ xóa file nguồn sau upload; kiểm tra trước khi chạy lại.
- **Booleans thiếu tag → false**.
- **Credential/host luôn `${VAR}`** — không embed host/user/pass/key thật.
- Template mặc định là khung cấu hình — cần server SFTP + field nguồn
  tồn tại trong stream trước; không chạy SFTP trong test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
