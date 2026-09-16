# GET_POP — Job entry nhận mail (POP3/IMAP/MBOX)

Entry lấy mail từ server về thư mục local (lưu `.mail` + attachment tách
riêng tùy chọn). Hỗ trợ `POP3`, `IMAP` và `MBOX`; chế độ IMAP có thêm lọc
danh sách (`valueimaplist`), điều kiện ngày nhận (`conditionreceiveddate`),
tìm kiếm sender/subject/body và hành động sau khi lấy (`aftergetimap`:
`nothing`/`delete`/`move`). Entry điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>GET_POP</type>
      <attributes/>
      <servername>${MAIL_HOST}</servername>
      <username>${MAIL_USER}</username>
      <password>${MAIL_PASSWORD}</password>
      <usessl>N</usessl>
      <sslport/>
      <outputdirectory>${MAIL_OUTPUT_DIR}</outputdirectory>
      <filenamepattern>name_{SYS|hhmmss_MMddyyyy|}_#IdFile#.mail</filenamepattern>
      <retrievemails>0</retrievemails>
      <firstmails/>
      <delete>N</delete>
      <savemessage>Y</savemessage>
      <saveattachment>Y</saveattachment>
      <usedifferentfolderforattachment>N</usedifferentfolderforattachment>
      <protocol>POP3</protocol>
      <attachmentfolder/>
      <attachmentwildcard/>
      <valueimaplist>imaplistall</valueimaplist>
      <imapfirstmails>0</imapfirstmails>
      <imapfolder/>
      <sendersearch/>
      <nottermsendersearch>N</nottermsendersearch>
      <receipientsearch/>
      <nottermreceipientsearch>N</nottermreceipientsearch>
      <subjectsearch/>
      <nottermsubjectsearch>N</nottermsubjectsearch>
      <bodysearch/>
      <nottermbodysearch>N</nottermbodysearch>
      <conditionreceiveddate>ignore</conditionreceiveddate>
      <nottermreceiveddatesearch>N</nottermreceiveddatesearch>
      <receiveddate1/>
      <receiveddate2/>
      <actiontype>get</actiontype>
      <movetoimapfolder/>
      <createmovetofolder>N</createmovetofolder>
      <createlocalfolder>N</createlocalfolder>
      <aftergetimap>nothing</aftergetimap>
      <includesubfolders>N</includesubfolders>
      <useproxy>N</useproxy>
      <proxyusername/>
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
| `<servername>` | Y | Host mail server (`${MAIL_HOST}`). |
| `<username>` / `<password>` | Y | Credential (`${VAR}` — không embed thật; `<password>` được mã hóa khi lưu qua Spoon trừ khi dùng biến). |
| `<usessl>` / `<sslport>` | N | `Y` = SSL; port mặc định 110 (thường) / 995 POP3 SSL / 993 IMAP SSL. |
| `<outputdirectory>` | Y | Thư mục lưu mail. |
| `<filenamepattern>` | N | Mẫu tên file; mặc định `name_{SYS|hhmmss_MMddyyyy|}_#IdFile#.mail` (load rỗng → fallback đúng mẫu này). |
| `<retrievemails>` | N | Số mail lấy (POP3); thiếu tag → `-1`. |
| `<firstmails>` | N | Chỉ lấy N mail đầu (POP3). |
| `<delete>` | N | `Y` = xóa mail trên server sau khi lấy (POP3). |
| `<savemessage>` / `<saveattachment>` | N | Mặc định `Y` cả hai (load thiếu/rỗng → `true`). |
| `<usedifferentfolderforattachment>` / `<attachmentfolder>` / `<attachmentwildcard>` | N | `Y` + folder + wildcard khi tách attachment ra thư mục riêng. |
| `<protocol>` | N | `POP3` (mặc định khi thiếu), `IMAP`, `MBOX`. |
| `<valueimaplist>` | N (IMAP) | Mã lọc IMAP: `imaplistall` (mặc định), `imaplistnew/old/read/unread/flagged/notflagged/draft/notdraft/answered/notanswered`; mã lạ → `all`. |
| `<imapfirstmails>` / `<imapfolder>` | N (IMAP) | Số mail IMAP đầu + folder IMAP (mặc định `INBOX`). |
| `<sendersearch>` + `<nottermsendersearch>`, `<receipientsearch>` + `<nottermreceipientsearch>`, `<subjectsearch>` + `<nottermsubjectsearch>`, `<bodysearch>` + `<nottermbodysearch>` | N | Chuỗi tìm kiếm + cờ phủ định (`notterm…=Y` đảo điều kiện). |
| `<conditionreceiveddate>` | N (IMAP) | `ignore` (mặc định), `equal`, `smaller`, `greater`, `between`; mã lạ → `ignore`. |
| `<nottermreceiveddatesearch>`, `<receiveddate1>`, `<receiveddate2>` | N | Phủ định + khoảng ngày (`yyyy-MM-dd HH:mm:ss`, `between` dùng cả hai). |
| `<actiontype>` | N | `get` (mặc định), `move`, `delete`; mã lạ → `get`. |
| `<movetoimapfolder>` / `<createmovetofolder>` | N | Folder đích khi move + tự tạo folder. |
| `<createlocalfolder>` / `<includesubfolders>` | N | Tự tạo thư mục local / duyệt subfolder. |
| `<aftergetimap>` | N (IMAP) | `nothing` (mặc định), `delete`, `move`; mã lạ → `nothing`. |
| `<useproxy>` / `<proxyusername>` | N | Dùng proxy + user proxy. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_POP` | `<type>` | `GET_POP`. |
| `configuration.host` | `<servername>` | `${VAR}`. |
| `configuration.username` / `configuration.password` | `<username>` / `<password>` | `${VAR}`, không embed thật. |
| `configuration.protocol` | `<protocol>` | `POP3`/`IMAP`/`MBOX`. |
| `configuration.action` | `<actiontype>` | `get`/`move`/`delete`. |
| `configuration.imap_filter` | `<valueimaplist>` | Mã `imaplist*`. |
| `configuration.date_condition` | `<conditionreceiveddate>` | `ignore`/`equal`/`smaller`/`greater`/`between`. |
| `configuration.after_get` | `<aftergetimap>` | `nothing`/`delete`/`move`. |
| Boolean khác | tag Y/N tương ứng | `usessl`, `delete`, `savemessage`, … |

Không có list lặp — toàn bộ là tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 29 —
  `<job-entry id="GET_POP">` →
  `org.pentaho.di.job.entries.getpop.JobEntryGetPOP`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryGetPOP.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/getpop/JobEntryGetPOP.java`
  dòng 187–242) — `super.getXML()` rồi 40 tag đúng thứ tự trong template
  (từ `servername` dòng 190 đến `proxyusername` dòng 240); `<password>` mã
  hóa qua `Encr.encryptPasswordIfNotUsingVariables` (dòng 192–193); 4 mã
  enum ghi bằng code (`valueimaplist` dòng 208–209, `conditionreceiveddate`
  dòng 223–225, `actiontype` dòng 230–231, `aftergetimap` dòng 236–237).
- Deserialization: `loadXML()` (dòng 244–320) — `super.loadXML()` rồi đọc
  từng tag; boolean parse `"Y".equalsIgnoreCase(...)` (thiếu → false,
  ngoại trừ `savemessage`/`saveattachment` thiếu/rỗng → `true`, dòng
  265–277); `filenamepattern` rỗng → fallback mẫu mặc định (dòng 255–257);
  `retrievemails` qua `Const.toInt(..., -1)` (thiếu → `-1`, dòng 258);
  `protocol` thiếu → `POP3` (dòng 262–263); 4 mã enum parse case-insensitive,
  mã lạ/null → index 0 (`MailConnectionMeta.get*ByCode`, dòng 133–183).
- Mã enum: `MailConnectionMeta.java` — `actionTypeCode = {get, move,
  delete}` (dòng 61); `conditionDateCode = {ignore, equal, smaller,
  greater, between}` (dòng 74–75); `valueIMAPListCode = {imaplistall,
  imaplistnew, …, imaplistnotanswered}` 11 mã (dòng 96–98);
  `afterGetIMAPCode = {nothing, delete, move}` (dòng 117);
  `protocolCodes = {POP3, IMAP, MBOX}` (dòng 47).
- Khởi tạo: constructor (dòng 135–176) — `protocol=POP3`,
  `filenamepattern` = mẫu mặc định, `retrievemails=0`,
  `savemessage/saveattachment=true`, `imapfirstmails="0"`,
  `valueimaplist=ALL`, `actiontype=GET`, `aftergetimap=NOTHING`, còn lại
  null/false.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime: `execute()` (dòng 845+), `evaluates()` = true (dòng
  1236) — entry điều kiện, rẽ nhánh theo `result`. Không chạy network khi
  test template.

Cấu hình không mặc định (IMAP + lọc unread + xóa sau khi lấy):

```xml
<protocol>IMAP</protocol>
<valueimaplist>imaplistunread</valueimaplist>
<imapfolder>INBOX</imapfolder>
<conditionreceiveddate>greater</conditionreceiveddate>
<receiveddate1>2026-01-01 00:00:00</receiveddate1>
<aftergetimap>delete</aftergetimap>
<usessl>Y</usessl>
<sslport>993</sslport>
```

## 5. Lưu ý / bẫy

- **Tag đọc case-insensitive**: `getXML()` ghi `receiveddate1/2` thường
  (dòng 230) nhưng `loadXML()` đọc `receivedDate1/2` (dòng 303–304) —
  `XMLHandler` so khớp `equalsIgnoreCase` nên vẫn load được; template giữ
  đúng chữ thường như `getXML()` emit.
- **Mã enum lạ lặng lẽ về mặc định**: mọi `get*ByCode` trả index 0 khi mã
  lạ — gõ sai `imaplistunread` thành `unread` thì lọc thành `all` mà không
  báo lỗi.
- **`savemessage`/`saveattachment` ngược với boolean thường**: thiếu tag →
  `true`, trong khi các cờ khác thiếu → `false`. Đừng lược hai tag này
  khỏi template.
- **`<password>` mã hóa, nhưng `${VAR}` thì không**: Spoon mã hóa khi gõ
  trực tiếp; dùng biến thì giữ nguyên — luôn dùng `${MAIL_PASSWORD}`.
- Template mặc định là khung cấu hình — người dùng phải điền host,
  credential, thư mục output có thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
