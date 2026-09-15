# MAIL_VALIDATOR — Job entry kiểm tra địa chỉ email (job)

Entry điều kiện (`evaluates() = true`): kiểm tra cú pháp địa chỉ email
(`<emailAddress>`), tùy chọn kiểm tra SMTP (`<smtpCheck>=Y` với timeout).
Hợp lệ → `result = true` (đi nhánh success), ngược lại `result = false`.
`JobCategory.Category.Mail_VALIDATOR` là ALIAS của `MAIL_VALIDATOR`: cùng
class, cùng serializer — xem mục 4.

## 1. XML Template

```xml
<entry>
      <smtpCheck>N</smtpCheck>
      <timeout>0</timeout>
      <defaultSMTP/>
      <emailSender>noreply@domain.com</emailSender>
      <emailAddress>${EMAIL}</emailAddress>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MAIL_VALIDATOR</type>
      <attributes/>
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
| `<emailAddress>` | Y | Địa chỉ email cần kiểm tra (dùng `${VAR}`). |
| `<smtpCheck>` | N | `Y` = kiểm tra thêm SMTP (mạng); `N` (mặc định) = chỉ cú pháp. |
| `<timeout>` | N | Timeout SMTP, chuỗi; mặc định `"0"`. |
| `<defaultSMTP>` | Điều kiện | SMTP server mặc định khi check SMTP (dùng `${VAR}`). |
| `<emailSender>` | N | Địa chỉ người gửi dùng khi check SMTP; mặc định `noreply@domain.com`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAIL_VALIDATOR` | `<type>` | `MAIL_VALIDATOR` (alias `JobCategory.Category.Mail_VALIDATOR` cùng file này). |
| `configuration.email` | `<emailAddress>` | Dùng `${VAR}`. |
| `configuration.smtp_check` | `<smtpCheck>` | Boolean → Y/N. |

Toàn scalar — mọi cấu hình đổi bằng `set_field_path`. CHÚ Ý thứ tự block:
tag plugin ĐỨNG TRƯỚC `name`/`description`/`type` (ngược mọi entry khác).

## 4. Ví dụ thực tế — BẰNG CHỨNG ALIAS

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 54 —
  `<job-entry id="MAIL_VALIDATOR,JobCategory.Category.Mail_VALIDATOR">` →
  `org.pentaho.di.job.entries.mailvalidator.JobEntryMailValidator`
  (category Mail). HAI chuỗi ID trong MỘT thẻ trỏ CÙNG class — chuỗi thứ
  hai là alias dạng i18n-key, KHÔNG phải implementation riêng. Kết luận:
  **alias thật → 1 reference chung** (2 catalog row cùng file này;
  `addElement()` với alias chèn `<type>MAIL_VALIDATOR</type>` chuẩn vì
  cùng serializer).
- Serialization: `JobEntryMailValidator.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/mailvalidator/JobEntryMailValidator.java`
  dòng 146–157) — emit `smtpCheck`, `timeout`, `defaultSMTP`,
  `emailSender`, `emailAddress` (dòng 148–152) RỒI MỚI `super.getXML()`
  (dòng 154). Thứ tự NGƯỢC mọi entry khác (thường super trước) — template
  trên giữ đúng order này.
- Deserialization: `loadXML()` (dòng 159–173) — `super.loadXML()` trước
  (dòng 162) rồi đọc 5 tag; `smtpCheck` Y/N thiếu → false.
- Khởi tạo: constructor (dòng 67–74) — `emailAddress`/`defaultSMTP` null,
  `smtpCheck` false, `timeout = "0"`, `emailSender =
  "noreply@domain.com"`; không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác (nhưng ĐỨNG SAU tag plugin).
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 277–279) — entry điều kiện.
  Không có `<connection>` — entry không tham chiếu DB.

Cấu hình không mặc định (kiểm SMTP):

```xml
<smtpCheck>Y</smtpCheck>
<timeout>30</timeout>
<defaultSMTP>${SMTP_HOST}</defaultSMTP>
<emailSender>${SENDER}</emailSender>
<emailAddress>${EMAIL}</emailAddress>
```

## 5. Lưu ý / bẫy

- **Thứ tự ngược**: tag plugin trước `name`/`type` — đừng "chuẩn hoá" về
  thứ tự TABLE_EXISTS (lệch serializer; tooling đọc theo tên nên vẫn
  chạy, nhưng reference phải phản ánh source).
- **Dùng `MAIL_VALIDATOR` khi tạo mới**: alias dotted chỉ để đọc file .kjb
  cũ — mọi generation mới dùng ID chuẩn.
- **`addElement()` với alias chèn type chuẩn** (`MAIL_VALIDATOR`), không
  phải chuỗi alias — hành vi đúng vì cùng class.
- Template mặc định là khung cấu hình — email/SMTP dùng `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor + bằng chứng alias (registry dòng 54) tại commit đã ghim ở
  mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
