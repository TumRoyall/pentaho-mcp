# SyslogMessage — Step gửi message Syslog (UDP)

Gửi nội dung field `<messagefieldname>` tới server syslog (`servername`
+ `port` chuỗi thuần — không phải `<connection>` DB) qua UDP, kèm
`facility`/`priority` (strings), timestamp (`addTimestamp` + `datePattern`
camelCase) và hostname (`addHostName`). Không override `getFields`
(pass-through); `check()` ERROR khi thiếu message field hoặc không có
input. Chú ý `readRep`/`saveRep` lẫn job-entry API cho các tag server.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SyslogMessage</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <messagefieldname>LOG_MESSAGE</messagefieldname>
    <port>${SYSLOG_PORT}</port>
    <servername>${SYSLOG_HOST}</servername>
    <facility>user</facility>
    <priority>info</priority>
    <addTimestamp>Y</addTimestamp>
    <datePattern>yyyy-MM-dd HH:mm:ss</datePattern>
    <addHostName>Y</addHostName>
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
| `<messagefieldname>` | Y | Tên field chứa message gửi (`check()` ERROR khi rỗng). |
| `<port>` | N | Port syslog (chuỗi); mặc định `String.valueOf(SyslogDefs.DEFAULT_PORT)`. Luôn `${VAR}`. |
| `<servername>` | N | Host syslog (thường, khác field `serverName`); luôn `${VAR}`. |
| `<facility>` | N | Facility syslog (string); mặc định `FACILITYS[0]`. |
| `<priority>` | N | Priority syslog (string); mặc định `PRIORITYS[0]`. |
| `<addTimestamp>` | N | `Y` (mặc định mới) = thêm timestamp theo `<datePattern>`. |
| `<datePattern>` | N | Pattern ngày (camelCase); mặc định `DEFAULT_DATE_FORMAT`. |
| `<addHostName>` | N | `Y` (mặc định mới) = thêm hostname. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SYSLOG_MESSAGE` | `<type>` | `SyslogMessage`. |
| `configuration.message_field` | `<messagefieldname>` | Tham chiếu field input. |
| `configuration.port` | `<port>` | Chuỗi, `${VAR}`. |
| `configuration.hostname` | `<servername>` | Giữ đúng thường. |
| `configuration.facility` | `<facility>` | String. |
| `configuration.priority` | `<priority>` | String. |
| `configuration.add_timestamp` | `<addTimestamp>` | Boolean → Y/N. |
| `configuration.date_pattern` | `<datePattern>` | Giữ đúng camelCase. |
| `configuration.add_hostname` | `<addHostName>` | Boolean → Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 108 —
  `<step id="SyslogMessage">` →
  `org.pentaho.di.trans.steps.syslog.SyslogMessageMeta` (category
  Utility). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SyslogMessageMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/syslog/SyslogMessageMeta.java`
  dòng 219–232) — đúng thứ tự `messagefieldname`, `port`, `servername`
  (thường — khác field Java `serverName`), `facility`, `priority`
  (strings), `addTimestamp`, `datePattern` (camelCase), `addHostName`
  (2 booleans → Y/N).
- Deserialization: `loadXML()` (dòng 68–70) gọi `readData()` (dòng
  234–249) — strings null khi thiếu; `addTimestamp`/`addHostName` chỉ
  `Y` mới true (thiếu → false). Chú ý `readRep` (dòng 251–267) đọc
  `servername/port/...` qua `getJobEntryAttribute*` (lẫn job-entry API)
  trong khi `saveRep` (dòng 269–284) save `messagefieldname` bằng
  `saveStepAttribute`, còn lại bằng `saveJobEntryAttribute` — repository
  round-trip khác XML round-trip; tin XML ở đây.
- Khởi tạo: `setDefault()` (dòng 78–87) — `messagefieldname=null`,
  `port=String.valueOf(SyslogDefs.DEFAULT_PORT)`, `serverName=null`,
  `facility=FACILITYS[0]`, `priority=PRIORITYS[0]`,
  `datePattern=DEFAULT_DATE_FORMAT`, `addTimestamp=true`,
  `addHostName=true`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: không override `getFields` (pass-through). `check()`
  (dòng 286–316) ERROR khi `messagefieldname` rỗng hoặc
  `input.length==0`.
- Không có `<connection>`: `serverName`/`port` là strings thuần —
  template không mang `<connection>`, fixture test không cần khai báo
  connection.

Cấu hình không mặc định (authpriv/crit, không hostname):

```xml
<messagefieldname>ALERT_MSG</messagefieldname>
<port>${SYSLOG_PORT}</port>
<servername>${SYSLOG_HOST}</servername>
<facility>authpriv</facility>
<priority>crit</priority>
<addTimestamp>Y</addTimestamp>
<datePattern>yyyy-MM-dd'T'HH:mm:ssZ</datePattern>
<addHostName>N</addHostName>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Giữ đúng 2 case**: `servername` (thường) và `datePattern` (camel) —
  nhầm case là mất cấu hình lặng lẽ.
- **`port`/`facility`/`priority` là strings** — `${VAR}` substitute lúc
  runtime; đừng validate số ở tầng template.
- **Bắt buộc có input + message field** — message đến từ stream trước.
- **Host/port luôn `${VAR}`** — không embed host thật.
- Template mặc định là khung cấu hình — cần server syslog (UDP) lúc
  runtime; không gửi syslog trong test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
