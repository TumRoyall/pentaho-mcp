# MailInput — Step đọc mail thành dòng

Step input (KHÔNG nhận input — `check()` ERROR nếu có hop vào): kết nối
mail server (POP3/IMAP/MBOX), liệt kê mail theo bộ lọc, mỗi mail phát ra
MỘT dòng với các cột chọn trong `<fields>` (`<field>/<name>` + `<column>`
mã cột). Hỗ trợ đọc theo batch (`useBatch`/`batchSize`, mặc định 500) và
giới hạn dòng (`rowlimit`, mặc định `"0"`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MailInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <servername>${MAIL_HOST}</servername>
    <username>${MAIL_USER}</username>
    <password>${MAIL_PASSWORD}</password>
    <usessl>N</usessl>
    <sslport/>
    <retrievemails>0</retrievemails>
    <firstmails/>
    <delete>N</delete>
    <protocol>POP3</protocol>
    <valueimaplist>imaplistall</valueimaplist>
    <imapfirstmails>0</imapfirstmails>
    <imapfolder/>
    <sendersearch/>
    <nottermsendersearch>N</nottermsendersearch>
    <recipientsearch/>
    <notTermRecipientSearch>N</notTermRecipientSearch>
    <subjectsearch/>
    <nottermsubjectsearch>N</nottermsubjectsearch>
    <conditionreceiveddate>ignore</conditionreceiveddate>
    <nottermreceiveddatesearch>N</nottermreceiveddatesearch>
    <receiveddate1/>
    <receiveddate2/>
    <includesubfolders>N</includesubfolders>
    <useproxy>N</useproxy>
    <proxyusername/>
    <usedynamicfolder>N</usedynamicfolder>
    <folderfield/>
    <rowlimit>0</rowlimit>
    <useBatch>N</useBatch>
    <batchSize>500</batchSize>
    <startMsg/>
    <endMsg/>
    <stopOnError>Y</stopOnError>
    <fields>
      <field>
        <name>{{FIELD_1}}</name>
        <column>subject</column>
      </field>
      <field>
        <name>{{FIELD_2}}</name>
        <column>sender</column>
      </field>
    </fields>
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
| `<servername>` / `<username>` / `<password>` | Y | Mail server + credential (`${VAR}`; password mã hóa khi lưu qua Spoon trừ khi dùng biến). |
| `<usessl>` / `<sslport>` | N | SSL + port. |
| `<retrievemails>` | N | Số mail lấy; `setDefault=0` nhưng load-thiếu-tag → `-1` (xem bẫy). |
| `<firstmails>` / `<delete>` / `<protocol>` | N | N mail đầu / xóa sau khi lấy / `POP3` (thiếu → POP3). |
| `<valueimaplist>` | N (IMAP) | 11 mã `imaplist*` như job GET_POP; lạ → `all`. |
| `<imapfirstmails>` / `<imapfolder>` | N | Mặc định `"0"` + null (`INBOX` khi chạy IMAP). |
| `<sendersearch>` + `<nottermsendersearch>`, `<recipientsearch>` + `<notTermRecipientSearch>`, `<subjectsearch>` + `<nottermsubjectsearch>` | N | Lọc + phủ định. Chú ý: step này dùng `recipientsearch` (đúng chính tả), KHÁC job GET_POP (`receipientsearch` gõ sai). |
| `<conditionreceiveddate>` / `<nottermreceiveddatesearch>` / `<receiveddate1>` / `<receiveddate2>` | N | `ignore`/`equal`/`smaller`/`greater`/`between` + khoảng ngày. |
| `<includesubfolders>` / `<useproxy>` / `<proxyusername>` / `<usedynamicfolder>` / `<folderfield>` | N | Subfolder IMAP / proxy / folder động lấy từ field. |
| `<rowlimit>` | N | Giới hạn dòng ra; mặc định `"0"` (chuỗi). |
| `<useBatch>` / `<batchSize>` | N | `Y` = đọc theo lô; size mặc định `500`, parse lỗi → `500`. Tag camelCase (`useBatch`, `batchSize`). |
| `<startMsg>` / `<endMsg>` | N | Khoảng message khi batch. Tag camelCase. |
| `<stopOnError>` | N | Mặc định `Y` (setDefault `true`). Tag camelCase. |
| `<fields>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Tên cột output. |
| `<fields>/<field>/<column>` | Y | Mã cột mail: `messagenumber`, `subject`, `sender`, `replyto`, `recipients`, `description`, `body`, `receiveddate`, `sendeddate` (gõ sai gốc — giữ nguyên), `contenttype`, `folder`, `size`, `flag_new`, `flag_read`, `flag_flagged`, `flag_draft`, `flag_deleted`, `attached_files_count`, `header`, `body_contenttype`; lạ → `messagenumber`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAIL_INPUT` | `<type>` | `MailInput`. |
| `configuration.host` / `username` / `password` | `<servername>` / `<username>` / `<password>` | `${VAR}`. |
| `configuration.protocol` | `<protocol>` | `POP3`/`IMAP`/`MBOX`. |
| `configuration.row_limit` | `<rowlimit>` | Chuỗi số. |
| `configuration.batch_size` | `<batchSize>` | Số; parse lỗi → 500. |
| `configuration.output_fields[].name` | `<fields>/<field>/<name>` | Tên cột. |
| `configuration.output_fields[].column` | `<fields>/<field>/<column>` | Mã cột (chuỗi, không phải số). |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 98 —
  `<step id="MailInput">` →
  `org.pentaho.di.trans.steps.mailinput.MailInputMeta`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `MailInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/mailinput/MailInputMeta.java`
  dòng 376–432) — 33 tag scalar đúng thứ tự template (từ `servername`
  dòng 379 đến `stopOnError` dòng 418; batch tags qua hằng `Tags`: 
  `useBatch`/`batchSize`/`startMsg`/`endMsg`/`stopOnError`, dòng 367–373),
  rồi block `<fields>` LUÔN emit (dòng 423–430), mỗi `<field>` có `<name>`
  + `<column>` mã chuỗi (dòng 426–427). `<password>` mã hóa (dòng 381–382).
- Deserialization: `loadXML()` (dòng 113–115) gọi `readData()` (dòng
  135–191) — `retrievemails` qua `Const.toInt(..., -1)` (thiếu → `-1`,
  dòng 141); `protocol` thiếu → `POP3` (dòng 145); `batchSize` parse lỗi
  → `DEFAULT_BATCH_SIZE = 500` (dòng 63, 171–175); `stopOnError` Y/N
  (dòng 178); list `<fields>/<field>` đọc `name` + `column` → int qua
  `MailInputField.getColumnByCode` (dòng 181–190, null/lạ → 0 =
  messagenumber, dòng 122–133).
- Mã cột: `MailInputField.java` dòng 57–60 — 20 mã, chú ý `sendeddate`
  (gõ sai "sended" — giữ nguyên khi điền).
- Khởi tạo: `setDefault()` (dòng 194–237) — `protocol=POP3`,
  `retrievemails=0`, `imapfirstmails="0"`, `rowlimit="0"`,
  `batchSize=500`, `useBatch=false`, `stopOnError=true`, 0 field.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: step input — `check()` (dòng 435–451) ERROR
  `NoInputExpected` nếu có hop vào; output schema = các `<field>` khai
  báo. Không chạy network khi test template.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (IMAP unread + batch 100 + 2 cột):

```xml
<protocol>IMAP</protocol>
<valueimaplist>imaplistunread</valueimaplist>
<useBatch>Y</useBatch>
<batchSize>100</batchSize>
<rowlimit>1000</rowlimit>
<fields>
  <field>
    <name>MAIL_SUBJECT</name>
    <column>subject</column>
  </field>
  <field>
    <name>MAIL_BODY</name>
    <column>body</column>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`retrievemails` 2 default khác nhau**: step mới `setDefault=0`, nhưng
  file thiếu tag load thành `-1` (`Const.toInt`, dòng 141). Template ghi
  `0` rõ ràng.
- **`recipientsearch` vs `receipientsearch`**: step này đánh vần đúng
  `recipientsearch` (dòng 397), còn job GET_POP giữ typo
  `receipientsearch` — copy tag giữa hai component sẽ sai.
- **`sendeddate` giữ nguyên typo**: mã cột ngày gửi là `sendeddate`
  (dòng 59) — sửa thành `sentdate` sẽ rơi về `messagenumber` lặng lẽ.
- **Batch tags camelCase**: `useBatch`, `batchSize`, `startMsg`, `endMsg`,
  `stopOnError` — viết thường hết sẽ vẫn load (case-insensitive) nhưng
  lệch serializer.
- **Step input không nhận hop vào**: `check()` ERROR khi có input —
  template/test không nối hop tới step này.
- Template mặc định là khung cấu hình — người dùng phải điền host,
  credential, cột output; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` + `MailInputField` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/mail thật) — không tuyên bố hai mức này.
