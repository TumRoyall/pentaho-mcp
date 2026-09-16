# SEND_NAGIOS_PASSIVE_CHECK — Job entry gửi passive check tới Nagios

Entry gửi một passive check (NSCA) tới Nagios server với trạng thái
`level` (`unknown`/`ok`/`warning`/`critical`) cho cặp host/service
(`senderServerName`/`senderServiceName`). Mã hóa NSCA (`encryptionMode`:
`none`/`tripledes`/`xor`). Entry điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>SEND_NAGIOS_PASSIVE_CHECK</type>
      <attributes/>
      <port>5667</port>
      <servername>${NAGIOS_HOST}</servername>
      <password>${NAGIOS_PASSWORD}</password>
      <responseTimeOut>10000</responseTimeOut>
      <connectionTimeOut>5000</connectionTimeOut>
      <senderServerName>${NAGIOS_SENDER_HOST}</senderServerName>
      <senderServiceName>{{SERVICE_NAME}}</senderServiceName>
      <message>{{MESSAGE}}</message>
      <encryptionMode>none</encryptionMode>
      <level>unknown</level>
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
| `<port>` | N | Cổng NSCA; mặc định `5667`. |
| `<servername>` | Y | Host Nagios (`${NAGIOS_HOST}`). |
| `<password>` | N | Password NSCA (`${VAR}`) — LƯU PLAIN, không mã hóa (xem bẫy). |
| `<responseTimeOut>` | N | Timeout đọc response ms; mặc định `10000`. Chữ T hoa giữa. |
| `<connectionTimeOut>` | N | Timeout kết nối ms; mặc định `5000`. |
| `<senderServerName>` | Y | Tên host báo cáo (phía Nagios). |
| `<senderServiceName>` | Y | Tên service báo cáo. |
| `<message>` | Y | Plugin output/message. |
| `<encryptionMode>` | N | `none` (mặc định), `tripledes`, `xor`; mã lạ → `none`. |
| `<level>` | N | `unknown` (mặc định), `ok`, `warning`, `critical`; mã lạ → `unknown`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SEND_NAGIOS_PASSIVE_CHECK` | `<type>` | `SEND_NAGIOS_PASSIVE_CHECK`. |
| `configuration.host` | `<servername>` | `${VAR}`. |
| `configuration.password` | `<password>` | `${VAR}` — plain text. |
| `configuration.response_timeout_ms` | `<responseTimeOut>` | Chữ T hoa. |
| `configuration.connection_timeout_ms` | `<connectionTimeOut>` | Chữ T hoa. |
| `configuration.sender_host` / `configuration.sender_service` | `<senderServerName>` / `<senderServiceName>` | Tên trong Nagios. |
| `configuration.encryption` | `<encryptionMode>` | `none`/`tripledes`/`xor`. |
| `configuration.level` | `<level>` | `unknown`/`ok`/`warning`/`critical`. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 65 —
  `<job-entry id="SEND_NAGIOS_PASSIVE_CHECK">` →
  `org.pentaho.di.job.entries.sendnagiospassivecheck.JobEntrySendNagiosPassiveCheck`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntrySendNagiosPassiveCheck.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/sendnagiospassivecheck/JobEntrySendNagiosPassiveCheck.java`
  dòng 203–221) — `super.getXML()` rồi đúng thứ tự `port`, `servername`,
  `password` (ghi THẲNG, không `Encr`, dòng 209), `responseTimeOut`,
  `connectionTimeOut`, `senderServerName`, `senderServiceName`, `message`,
  `encryptionMode` (code qua `getEncryptionModeCode`, dòng 216–217),
  `level` (code qua `getLevelCode`, dòng 218).
- Deserialization: `loadXML()` (dòng 249–269) — đọc thẳng; 2 mã parse qua
  `getEncryptionModeByCode`/`getLevelByCode`, null/lạ → 0 (dòng 223–247).
- Mã: `encryption_mode_Code = {none, tripledes, xor}` (dòng 104);
  `level_type_Code = {unknown, ok, warning, critical}` (dòng 115).
- Khởi tạo: constructor (dòng 122–134) — `port="5667"`
  (`DEFAULT_PORT`, dòng 98), `responseTimeOut="10000"` (dòng 88),
  `connectionTimeOut="5000"` (dòng 93), `encryptionMode=NONE(0)`,
  `level=UNKNOWN(0)`, còn lại null.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 452+), `evaluates()` = true (dòng
  551). Không chạy network khi test template.

Cấu hình không mặc định (báo CRITICAL + mã hóa TripleDES):

```xml
<senderServerName>etl-prod-01</senderServerName>
<senderServiceName>nightly-load</senderServiceName>
<message>CRITICAL: nightly load failed at step 12</message>
<encryptionMode>tripledes</encryptionMode>
<level>critical</level>
<password>${NAGIOS_PASSWORD}</password>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<password>` LƯU PLAIN TEXT**: `getXML()` ghi thẳng `password` không
  qua `Encr` (dòng 209 — khác GET_POP/SNMP_TRAP). BẮT BUỘC dùng
  `${NAGIOS_PASSWORD}`, không bao giờ embed password thật vào `.kjb`.
- **Chữ hoa giữa tag timeout**: `responseTimeOut`, `connectionTimeOut`
  (T hoa, còn lại thường) — `loadXML()` đọc đúng hai tên này (dòng
  255–256).
- **Mã enum lạ lặng lẽ về mặc định**: `getEncryptionModeByCode`/
  `getLevelByCode` trả 0 khi mã lạ — gõ sai `critical` thành `crit` thì
  level thành `unknown` mà không báo lỗi.
- Template mặc định là khung cấu hình — người dùng phải điền host Nagios,
  sender host/service, password biến; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
