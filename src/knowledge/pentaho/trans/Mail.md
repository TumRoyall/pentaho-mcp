# Mail — Step gửi email

Step gửi email qua SMTP cho MỖI dòng đầu vào (hoặc một lần khi không có
input): địa chỉ nhận có thể tĩnh (`destination`/`destinationCc`/
`destinationBCc`) hoặc lấy từ field (`dynamicFieldname`), file đính kèm từ
thư mục (`sourcefilefoldername` + `sourcewildcard`) hoặc từ nội dung field
(`attachContentField`). Không thêm/bớt cột theo nghĩa input — step này là
điểm cuối gửi mail (output rỗng khi `only_comment=N`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Mail</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <server>${SMTP_HOST}</server>
    <port>25</port>
    <destination>${MAIL_TO}</destination>
    <destinationCc/>
    <destinationBCc/>
    <replyToAddresses/>
    <replyto/>
    <replytoname/>
    <subject>{{SUBJECT}}</subject>
    <include_date>N</include_date>
    <include_subfolders>N</include_subfolders>
    <zipFilenameDynamic>N</zipFilenameDynamic>
    <isFilenameDynamic>N</isFilenameDynamic>
    <attachContentFromField>N</attachContentFromField>
    <attachContentField/>
    <attachContentFileNameField/>
    <dynamicFieldname/>
    <dynamicWildcard/>
    <dynamicZipFilename/>
    <sourcefilefoldername/>
    <sourcewildcard/>
    <contact_person/>
    <contact_phone/>
    <comment/>
    <include_files>N</include_files>
    <zip_files>N</zip_files>
    <zip_name/>
    <zip_limit_size/>
    <use_auth>N</use_auth>
    <use_secure_auth>N</use_secure_auth>
    <auth_user>${SMTP_USER}</auth_user>
    <auth_password>${SMTP_PASSWORD}</auth_password>
    <only_comment>N</only_comment>
    <use_HTML>N</use_HTML>
    <use_Priority>N</use_Priority>
    <encoding>UTF-8</encoding>
    <priority>normal</priority>
    <importance>normal</importance>
    <sensitivity>normal</sensitivity>
    <secureconnectiontype>SSL</secureconnectiontype>
    <embeddedimages>
    </embeddedimages>
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
| `<server>` / `<port>` | Y | SMTP host (`${SMTP_HOST}`) + port. |
| `<destination>` / `<destinationCc>` / `<destinationBCc>` | Y (một trong các nguồn nhận) | Địa chỉ tĩnh, phân tách `;`. Hoặc dùng `<dynamicFieldname>` lấy từ field. |
| `<replyto>` / `<replytoname>` / `<replyToAddresses>` | N | Hồi đáp. Chú ý 3 tên tag khác nhau (`replyto` thường hết, `replyToAddresses` camel). |
| `<subject>` | Y | Tiêu đề mail. |
| `<dynamicFieldname>` / `<dynamicWildcard>` | N | Field chứa địa chỉ nhận động + wildcard lọc. |
| `<sourcefilefoldername>` / `<sourcewildcard>` | N | Thư mục + wildcard file đính kèm (kèm `include_subfolders`). |
| `<attachContentFromField>` / `<attachContentField>` / `<attachContentFileNameField>` | N | `Y` = đính kèm lấy từ nội dung field + tên file từ field. |
| `<zip_files>` / `<zip_name>` / `<zip_limit_size>` / `<zipFilenameDynamic>` / `<dynamicZipFilename>` / `<isFilenameDynamic>` | N | Nén attachment thành zip. |
| `<use_auth>` / `<auth_user>` / `<auth_password>` | N | SMTP auth; password mã hóa khi lưu qua Spoon trừ khi dùng biến — luôn `${SMTP_PASSWORD}`. |
| `<use_secure_auth>` / `<secureconnectiontype>` | N | Auth bảo mật + loại kết nối (`SSL`/`TLS`). |
| `<use_HTML>` / `<encoding>` | N | Gửi HTML + charset. Chữ HOA (`use_HTML`). |
| `<use_Priority>` / `<priority>` / `<importance>` | N | Ưu tiên mail. Chữ P hoa (`use_Priority`). |
| `<only_comment>` / `<comment>` | N | Chỉ gửi comment. |
| `<sensitivity>` / `<contact_person>` / `<contact_phone>` / `<include_date>` / `<include_files>` | N | Metadata bổ sung. |
| `<embeddedimages>/<embeddedimage>` (`<image_name>`, `<content_id>`) | N | Ảnh nhúng HTML — list paired, LUÔN emit wrapper kể cả rỗng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAIL` | `<type>` | `Mail`. |
| `configuration.smtp_host` / `configuration.smtp_port` | `<server>` / `<port>` | `${VAR}`. |
| `configuration.to` / `cc` / `bcc` | `<destination>` / `<destinationCc>` / `<destinationBCc>` | Tĩnh `;`-separated. |
| `configuration.dynamic_address_field` | `<dynamicFieldname>` | Field động. |
| `configuration.subject` | `<subject>` | Tiêu đề. |
| `configuration.auth_user` / `configuration.auth_password` | `<auth_user>` / `<auth_password>` | `${VAR}`. |
| `configuration.embedded_images[]` | `<embeddedimages>/<embeddedimage>` | `set_fields` (`listTag=embeddedimages`, `itemTag=embeddedimage`; mỗi item `image_name` + `content_id`). |

`<embeddedimages>` chứa list `<embeddedimage>` đồng nhất → fill bằng MỘT
lần `set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 72 —
  `<step id="Mail">` → `org.pentaho.di.trans.steps.mail.MailMeta`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `MailMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/mail/MailMeta.java`
  dòng 253–316) — thứ tự 40 tag scalar từ `server` (dòng 258) đến
  `secureconnectiontype` (dòng 302) rồi wrapper `<embeddedimages>` LUÔN
  emit kể cả null/rỗng (dòng 304–313), mỗi `<embeddedimage>` có
  `<image_name>` + `<content_id>` (dòng 308–309). `<auth_password>` mã hóa
  qua `Encr.encryptPasswordIfNotUsingVariables` (dòng 292–294).
- Deserialization: `loadXML()` (dòng 158–160) gọi `readData()` (dòng
  173–230) — đọc thẳng từng tag; boolean `"Y".equalsIgnoreCase(...)`
  (thiếu → false); `auth_password` giải mã (dòng 203–204); list đếm
  `<embeddedimage>` trong `<embeddedimages>` (dòng 217–221), mỗi item đọc
  `image_name` + `content_id` (dòng 227–228).
- Khởi tạo: `setDefault()` RỖNG (dòng 249–250) — step mới toàn null/false;
  không có default nào (kể cả port/encoding).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`, `GUI`.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (auth + attachment từ folder + HTML):

```xml
<server>${SMTP_HOST}</server>
<port>587</port>
<use_auth>Y</use_auth>
<auth_user>${SMTP_USER}</auth_user>
<auth_password>${SMTP_PASSWORD}</auth_password>
<secureconnectiontype>TLS</secureconnectiontype>
<sourcefilefoldername>${ATTACH_DIR}</sourcefilefoldername>
<sourcewildcard>.*\.pdf</sourcewildcard>
<use_HTML>Y</use_HTML>
<encoding>UTF-8</encoding>
```

Fill list ảnh nhúng bằng `set_fields`
(`listTag=embeddedimages`, `itemTag=embeddedimage`).

## 5. Lưu ý / bẫy — CRITICAL

- **`setDefault()` rỗng**: step mới KHÔNG có default nào — template phải
  ghi đủ tag cần thiết, đừng trông chờ port/encoding tự có.
- **Chính tả tag hỗn hợp**: `replyto` (thường) vs `replyToAddresses`
  (camel) vs `replytoname`; `use_HTML`/`use_Priority` (hoa) vs
  `use_auth`/`only_comment` (thường). Sai một chữ vẫn load được (khớp
  case-insensitive) nhưng lệch serializer — test order sẽ bắt.
- **`<embeddedimages>` luôn paired**: `getXML()` emit wrapper kể cả null
  nên template giữ `<embeddedimages></embeddedimages>` paired, không viết
  self-closing — `setFields` từ chối list self-closing.
- **`<auth_password>` mã hóa**: luôn dùng `${SMTP_PASSWORD}`, không embed
  thật.
- Template mặc định là khung cấu hình — người dùng phải điền SMTP host,
  người nhận, credential có thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/mail thật) — không tuyên bố hai mức này.
