# SSH — Step chạy lệnh qua SSH

Chạy lệnh trên server SSH (`servername` + `port` chuỗi + user/pass hoặc
private key). Lệnh là tĩnh (`<command>`) hoặc động từ field
(`dynamicCommandField=Y` + `<commandfieldname>`). Output: `getFields()`
XÓA row khi lệnh tĩnh (`!isDynamicCommand → row.clear()`) rồi append cột
stdout (String) và stderr — chú ý stderr là **Boolean** (không phải
String). Mọi credential/host đều `${VAR}`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SSH</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <dynamicCommandField>N</dynamicCommandField>
    <command>${SSH_CMD}</command>
    <commandfieldname/>
    <port>22</port>
    <servername>${SSH_HOST}</servername>
    <userName>${SSH_USER}</userName>
    <password>Encrypted ${SSH_PASS}</password>
    <usePrivateKey>N</usePrivateKey>
    <keyFileName/>
    <passPhrase>Encrypted ${SSH_PASSPHRASE}</passPhrase>
    <stdOutFieldName>stdOut</stdOutFieldName>
    <stdErrFieldName>stdErr</stdErrFieldName>
    <timeOut>0</timeOut>
    <proxyHost/>
    <proxyPort/>
    <proxyUsername/>
    <proxyPassword>Encrypted</proxyPassword>
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
| `<dynamicCommandField>` | N | `Y` = lấy lệnh từ field `<commandfieldname>`; `N` (mặc định) = lệnh tĩnh `<command>`. |
| `<command>` | Y khi tĩnh | Lệnh SSH tĩnh; cho phép `${VAR}`. |
| `<commandfieldname>` | Y khi động | Tên field chứa lệnh trong dòng đầu vào. |
| `<port>` | N | Port SSH (chuỗi); mặc định `"22"`. |
| `<servername>` | Y | Host SSH (thường, không camel); luôn `${VAR}`. |
| `<userName>` | Y | User SSH (camel `N` hoa); luôn `${VAR}`. |
| `<password>` | N | Password (mã hóa); luôn `${VAR}`. |
| `<usePrivateKey>` | N | `Y` = dùng key file; mặc định MỚI là true (`Y`) ở `setDefault`. |
| `<keyFileName>` | Y khi dùng key | Đường dẫn private key; cho phép `${VAR}`. |
| `<passPhrase>` | N | Passphrase key (mã hóa); luôn `${VAR}`. |
| `<stdOutFieldName>` | N | Tên cột stdout (String); mặc định `stdOut`. |
| `<stdErrFieldName>` | N | Tên cột stderr (**Boolean**); mặc định `stdErr`. |
| `<timeOut>` | N | Timeout (chuỗi); mặc định `"0"`. |
| `<proxyHost>`/`<proxyPort>`/`<proxyUsername>`/`<proxyPassword>` | N | Proxy tùy chọn; password mã hóa, luôn `${VAR}`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SSH` | `<type>` | `SSH`. |
| `configuration.dynamic_command` | `<dynamicCommandField>` | Boolean → Y/N. |
| `configuration.command` | `<command>` | Cho phép `${VAR}`. |
| `configuration.command_field` | `<commandfieldname>` | Tham chiếu field khi động. |
| `configuration.port` | `<port>` | Chuỗi, mặc định `"22"`. |
| `configuration.hostname` | `<servername>` | Giữ đúng thường `servername`. |
| `configuration.username` | `<userName>` | Giữ đúng camel `userName`. |
| `configuration.password` | `<password>` | `${VAR}` (mã hóa). |
| `configuration.use_private_key` | `<usePrivateKey>` | Boolean → Y/N. |
| `configuration.key_file` | `<keyFileName>` | Cho phép `${VAR}`. |
| `configuration.stdout_field` | `<stdOutFieldName>` | Cột String. |
| `configuration.stderr_field` | `<stdErrFieldName>` | Cột Boolean. |
| `configuration.timeout` | `<timeOut>` | Chuỗi số. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 113 —
  `<step id="SSH">` →
  `org.pentaho.di.trans.steps.ssh.SSHMeta` (category Utility). Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `SSHMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/ssh/SSHMeta.java`
  dòng 377–402) — đúng thứ tự `dynamicCommandField` (Y/N), `command`,
  `commandfieldname`, `port` (string), `servername` (thường),
  `userName` (camel), `password` (mã hóa qua
  `Encr.encryptPasswordIfNotUsingVariables`, dòng 387–388),
  `usePrivateKey` (Y/N), `keyFileName`, `passPhrase` (mã hóa),
  `stdOutFieldName`, `stdErrFieldName`, `timeOut`, `proxyHost`,
  `proxyPort`, `proxyUsername`, `proxyPassword` (mã hóa). Tất cả vô điều
  kiện.
- Deserialization: `loadXML()` (dòng 95–98) gọi `readData()` (dòng
  404–430) — booleans `"Y".equalsIgnoreCase` (thiếu → false); strings
  `getTagValue` (thiếu → null); passwords
  `Encr.decryptPasswordOptionallyEncrypted` (chịu null/`${VAR}`).
  Không `parseInt`, không NPE số. Catch-all → `KettleXMLException`
  (dòng 427–429).
- Khởi tạo: `setDefault()` (dòng 108–125) — `dynamicCommandField=false`,
  `command/commandfieldname=null`, `port="22"`
  (`String.valueOf(DEFAULT_PORT)`, `DEFAULT_PORT=22` dòng 66),
  `serverName/userName/password=null`, `usePrivateKey=true` (!),
  `keyFileName=null`, `stdOutFieldName="stdOut"`,
  `stdErrFieldName="stdErr"`, `timeOut="0"`, proxy null
  (`passPhrase` không set → null).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 554–572) — lệnh TĨNH thì
  `row.clear()` (nuốt input); append `stdOut` String (tên qua
  `environmentSubstitute`) và `stdErr` **Boolean** khi non-empty (dòng
  566–571). `check()` (dòng 494–552) đòi `serverName` non-empty;
  `usePrivateKey` → đòi `keyFileName` non-empty + file tồn tại
  (`KettleVFS.fileExists`); đòi `input.length>0`.
- Không có `<connection>`: host/port/user/pass là strings + variables —
  template không mang `<connection>`, fixture test không cần khai báo
  connection.

Cấu hình không mặc định (lệnh động + private key + proxy):

```xml
<dynamicCommandField>Y</dynamicCommandField>
<commandfieldname>SSH_CMD</commandfieldname>
<port>2222</port>
<servername>${SSH_HOST}</servername>
<userName>${SSH_USER}</userName>
<usePrivateKey>Y</usePrivateKey>
<keyFileName>${SSH_KEY}</keyFileName>
<passPhrase>Encrypted ${SSH_PASSPHRASE}</passPhrase>
<stdOutFieldName>CMD_OUT</stdOutFieldName>
<stdErrFieldName>CMD_ERR</stdErrFieldName>
<timeOut>30</timeOut>
<proxyHost>${PROXY_HOST}</proxyHost>
<proxyPort>${PROXY_PORT}</proxyPort>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Giữ đúng 2 case**: `servername` (thường) vs `userName` (camel) —
  nhầm case là mất cấu hình lặng lẽ.
- **stderr là Boolean, không phải String** — downstream `StringCut`/`Trim`
  trên cột này sẽ fail type; convert tường minh nếu cần text.
- **Lệnh tĩnh nuốt input** (`row.clear()`) — mọi cột trước đó biến mất;
  lệnh động thì giữ.
- **`usePrivateKey` mặc định MỚI = true** (`setDefault`) nhưng load thiếu
  tag = false — file mới tạo khác file cũ thiếu tag; luôn emit tường minh.
- **Credential/host luôn `${VAR}`** — không embed host/user/pass/key thật.
- Template mặc định là khung cấu hình — cần server SSH thật lúc runtime;
  không chạy SSH trong test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
