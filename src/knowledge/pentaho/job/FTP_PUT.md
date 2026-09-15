# FTP_PUT — Job entry upload file qua FTP

Entry upload các file local (`<localDirectory>` + `<wildcard>`) lên thư mục
FTP (`<remoteDirectory>`) với mode nhị phân/text, có thể xoá nguồn sau upload
(`<remove>`) và chỉ gửi file mới (`<only_new>`). Toàn scalar, không có list —
kèm đầy đủ proxy thường + SOCKS proxy và encoding kênh điều khiển.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FTP_PUT</type>
      <attributes/>
      <servername>${FTP_HOST}</servername>
      <serverport>21</serverport>
      <username>${FTP_USER}</username>
      <password>${FTP_PASSWORD}</password>
      <remoteDirectory>${FTP_REMOTE_DIR}</remoteDirectory>
      <localDirectory>${FTP_LOCAL_DIR}</localDirectory>
      <wildcard>.*</wildcard>
      <binary>Y</binary>
      <timeout>10000</timeout>
      <remove>N</remove>
      <only_new>N</only_new>
      <active>N</active>
      <control_encoding>ISO-8859-1</control_encoding>
      <proxy_host/>
      <proxy_port/>
      <proxy_username/>
      <proxy_password/>
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
| `<servername>` | Y | Host FTP (dùng `${VAR}`). |
| `<serverport>` | N | Port, DẠNG CHUỖI (cho phép `${VAR}`); mặc định `"21"`. |
| `<username>` / `<password>` | Y | Credential FTP (dùng `${VAR}`). Password mã hoá trừ khi là biến. |
| `<remoteDirectory>` | Y | Thư mục ĐÍCH trên server (dùng `${VAR}`). |
| `<localDirectory>` | Y | Thư mục NGUỒN local (dùng `${VAR}`). |
| `<wildcard>` | N | Regex lọc file nguồn. |
| `<binary>` | N | `Y` = mode nhị phân; `N` = ASCII. Y/N, thiếu → false. |
| `<timeout>` | N | Timeout mili-giây, số int; thiếu → 10000. |
| `<remove>` | N | `Y` = xoá file nguồn sau upload; `N` (mặc định). |
| `<only_new>` | N | `Y` = chỉ gửi file mới (không ghi đè); `N` (mặc định). |
| `<active>` | N | `Y` = FTP active; `N` (mặc định) = passive. |
| `<control_encoding>` | N | Encoding kênh lệnh; mặc định `"ISO-8859-1"`. |
| `<proxy_host>` … `<proxy_password>` | N | HTTP proxy cho FTP (dùng `${VAR}`); rỗng = không proxy. |
| `<socksproxy_host>` … `<socksproxy_password>` | N | SOCKS proxy; port mặc định `"1080"`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FTP_PUT` | `<type>` | `FTP_PUT`. |
| `configuration.host/port/user` | `<servername>`/`<serverport>`/`<username>` | `${VAR}`, port chuỗi. |
| `configuration.remote_dir/local_dir` | `<remoteDirectory>`/`<localDirectory>` | `${VAR}`. |

Toàn scalar — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 9 —
  `<job-entry id="FTP_PUT">` →
  `org.pentaho.di.job.entries.ftpput.JobEntryFTPPUT` (category
  FileTransfer).
- Serialization: `JobEntryFTPPUT.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/ftpput/JobEntryFTPPUT.java`
  dòng 137–170) — `super.getXML()` rồi đúng thứ tự `servername`,
  `serverport`, `username`, `password` (mã hoá trừ biến, dòng 145–146),
  `remoteDirectory`, `localDirectory`, `wildcard`, `binary`, `timeout`,
  `remove`, `only_new`, `active`, `control_encoding`, 4 tag proxy, 4 tag
  socksproxy (dòng 142–167). Không có list.
- Deserialization: `loadXML()` (dòng 172–199) — `super.loadXML()` rồi đọc
  cùng thứ tự; cờ Y/N thiếu → false; `timeout` qua
  `Const.toInt(..., 10000)` (thiếu → 10000, dòng 184).
- Khởi tạo: constructor (dòng 118–126) — `serverPort = "21"`,
  `socksProxyPort = "1080"`, `controlEncoding = "ISO-8859-1"`
  (`DEFAULT_CONTROL_ENCODING`, dòng 116).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 820–822) — entry điều kiện.
  Không có `<connection>` DB — entry không tham chiếu DB (server/credential
  là field riêng, không phải shared connection).

Cấu hình không mặc định (binary + xoá nguồn):

```xml
<servername>${FTP_HOST}</servername>
<binary>Y</binary>
<remove>Y</remove>
<wildcard>.*\.csv</wildcard>
```

## 5. Lưu ý / bẫy

- **Port là CHUỖI** (`serverport`, `proxy_port`, `socksproxy_port`) để
  substitute biến — đừng assert kiểu số.
- **`timeout` thiếu → 10000** (int, `Const.toInt`), còn cờ Y/N thiếu →
  false — hai họ default khác nhau.
- **`active=N` nghĩa là PASSIVE** — mặc định passive; mạng cần active phải
  đặt `Y` tường minh.
- Template mặc định là khung cấu hình — credential/host/port luôn `${VAR}`,
  không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
