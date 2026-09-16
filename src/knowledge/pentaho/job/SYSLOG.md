# SYSLOG — Job entry gửi message tới syslog server

Entry gửi một message UDP tới syslog server (`servername:port`) với
`facility`/`priority` cho trước, kèm timestamp và hostname tùy chọn. Entry
điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>SYSLOG</type>
      <attributes/>
      <port>514</port>
      <servername>${SYSLOG_HOST}</servername>
      <facility>KERNEL</facility>
      <priority>EMERGENCY</priority>
      <message>{{MESSAGE}}</message>
      <datePattern>MMM dd HH:mm:ss</datePattern>
      <addTimestamp>Y</addTimestamp>
      <addHostname>Y</addHostname>
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
| `<port>` | N | Cổng syslog; mặc định `514` (ghi TRƯỚC `servername`). |
| `<servername>` | Y | Host syslog server (`${SYSLOG_HOST}`). |
| `<facility>` | N | Một trong 18 facility (`KERNEL`…`LOCAL7`); mặc định `KERNEL`. |
| `<priority>` | N | Một trong 8 priority (`EMERGENCY`…`DEBUG`); mặc định `EMERGENCY`. |
| `<message>` | Y | Nội dung message. |
| `<datePattern>` | N | Format timestamp; mặc định `MMM dd HH:mm:ss`. Chữ P hoa (`datePattern`). |
| `<addTimestamp>` / `<addHostname>` | N | Mặc định `Y` cả hai (thiếu tag → false khi load — xem bẫy). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SYSLOG` | `<type>` | `SYSLOG`. |
| `configuration.host` | `<servername>` | `${VAR}`. |
| `configuration.port` | `<port>` | Ghi trước `<servername>`. |
| `configuration.facility` | `<facility>` | Chuỗi hoa trong `SyslogDefs.FACILITYS`. |
| `configuration.priority` | `<priority>` | Chuỗi hoa trong `SyslogDefs.PRIORITYS`. |
| `configuration.message` | `<message>` | Văn bản thuần. |
| `configuration.date_pattern` | `<datePattern>` | Chữ P hoa. |
| `configuration.add_timestamp` / `configuration.add_hostname` | `<addTimestamp>` / `<addHostname>` | Boolean → Y/N. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 55 —
  `<job-entry id="SYSLOG">` →
  `org.pentaho.di.job.entries.syslog.JobEntrySyslog`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntrySyslog.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/syslog/JobEntrySyslog.java`
  dòng 89–103) — `super.getXML()` rồi đúng thứ tự `port`, `servername`,
  `facility`, `priority`, `message`, `datePattern`, `addTimestamp`,
  `addHostname`. Chú ý `port` đứng TRƯỚC `servername`.
- Deserialization: `loadXML()` (dòng 105–121) — đọc thẳng 8 tag; 2 cờ
  parse `"Y".equalsIgnoreCase(...)` (thiếu → false).
- Khởi tạo: constructor (dòng 68–78) — `port="514"`
  (`SyslogDefs.DEFAULT_PORT`, dòng 48), `facility=FACILITYS[0]="KERNEL"`,
  `priority=PRIORITYS[0]="EMERGENCY"`, `datePattern="MMM dd HH:mm:ss"`
  (dòng 49), `addTimestamp/addHostname=true`.
- Hằng số: `SyslogDefs.java` dòng 48–58 — `FACILITYS` 18 giá trị
  (`KERNEL`, `USER`, `MAIL`, `DAEMON`, `AUTH`, `SYSLOG`, `LPR`, `NEWS`,
  `UUCP`, `CRON`, `LOCAL0`…`LOCAL7`); `PRIORITYS` 8 giá trị
  (`EMERGENCY`, `ALERT`, `CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFO`,
  `DEBUG`).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 269+), `evaluates()` = true (dòng
  328). Không chạy network khi test template.

Cấu hình không mặc định (facility LOCAL0, priority WARNING, không gắn hostname):

```xml
<port>514</port>
<servername>${SYSLOG_HOST}</servername>
<facility>LOCAL0</facility>
<priority>WARNING</priority>
<message>ETL job finished with warnings</message>
<datePattern>MMM dd HH:mm:ss</datePattern>
<addTimestamp>Y</addTimestamp>
<addHostname>N</addHostname>
```

## 5. Lưu ý / bẫy

- **Thứ tự `port` trước `servername`**: ngược với SNMP_TRAP/Nagios (cũng
  `port` trước) nhưng khác trực giác host-trước-port — giữ đúng thứ tự
  `getXML()`.
- **Constructor `Y` nhưng load-thiếu-tag → `N`**: entry mới có
  `addTimestamp/addHostname=true`, nhưng file thiếu 2 tag sẽ load thành
  false. Template luôn ghi đủ cả hai.
- **`<datePattern>` chữ P hoa**: `loadXML()` đọc đúng `datePattern`
  (dòng 114) — nhưng `XMLHandler` so khớp case-insensitive nên `datepattern`
  thường vẫn load được; template giữ chữ hoa như `getXML()` emit.
- Template mặc định là khung cấu hình — người dùng phải điền host/message
  có thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor + `SyslogDefs` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
