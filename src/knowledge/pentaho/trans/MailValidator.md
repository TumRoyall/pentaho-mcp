# MailValidator — Step kiểm tra địa chỉ email

Với MỖI dòng đầu vào, đọc địa chỉ email từ field động (`<emailfield>`),
kiểm tra cú pháp (regex) và tùy chọn kiểm tra SMTP (`<smtpCheck>`), rồi
append 1–2 cột: kết quả (`<resultfieldname>` — Boolean, hoặc String
`emailValideMsg`/`emailNotValideMsg` khi `ResultAsString=Y`) và message lỗi
(`<errorsFieldName>`, bỏ qua khi rỗng). Output = input row + cột mới.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MailValidator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <emailfield>{{EMAIL_FIELD}}</emailfield>
    <resultfieldname>result</resultfieldname>
    <ResultAsString>N</ResultAsString>
    <smtpCheck>N</smtpCheck>
    <emailValideMsg>email address is valid</emailValideMsg>
    <emailNotValideMsg>email address is not valid</emailNotValideMsg>
    <errorsFieldName>Error message</errorsFieldName>
    <timeout>0</timeout>
    <defaultSMTP/>
    <emailSender>noreply@domain.com</emailSender>
    <defaultSMTPField/>
    <isdynamicDefaultSMTP>N</isdynamicDefaultSMTP>
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
| `<emailfield>` | Y | Tên field chứa email cần kiểm tra (động). `check()` ERROR khi rỗng. |
| `<resultfieldname>` | Y | Tên cột kết quả (Boolean mặc định). `check()` ERROR khi rỗng. |
| `<ResultAsString>` | N | `Y` = cột kết quả là String (`emailValideMsg`/`emailNotValideMsg`); `N` (mặc định) = Boolean. Chữ R/A/S hoa. |
| `<smtpCheck>` | N | `Y` = kiểm tra SMTP thật (network). Mặc định `N`. |
| `<emailValideMsg>` / `<emailNotValideMsg>` | N (bắt buộc khi `ResultAsString=Y`) | Thông điệp hợp lệ/không hợp lệ. Chữ V/M hoa giữa. |
| `<errorsFieldName>` | N | Tên cột message lỗi (String); rỗng = không thêm cột. Mặc định `Error message`. |
| `<timeout>` | N | Timeout SMTP; mặc định `"0"`. Chuỗi số. |
| `<defaultSMTP>` / `<isdynamicDefaultSMTP>` / `<defaultSMTPField>` | N | SMTP mặc định tĩnh, hoặc `Y` + field động chứa SMTP. |
| `<emailSender>` | N | Địa chỉ người gửi dùng khi kiểm tra SMTP; mặc định `noreply@domain.com`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAIL_VALIDATOR` | `<type>` | `MailValidator`. |
| `configuration.email_field` | `<emailfield>` | Field động, cần hop vào. |
| `configuration.result_field` | `<resultfieldname>` | Tên cột kết quả. |
| `configuration.result_as_string` | `<ResultAsString>` | Boolean → Y/N (giữ hoa). |
| `configuration.smtp_check` | `<smtpCheck>` | Boolean → Y/N (giữ camel). |
| `configuration.valid_message` / `configuration.invalid_message` | `<emailValideMsg>` / `<emailNotValideMsg>` | Giữ hoa giữa. |
| `configuration.errors_field` | `<errorsFieldName>` | Rỗng = không thêm cột lỗi. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`. Step cần
hop vào (đọc field động) nhưng không khai báo tham chiếu step trong XML.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 71 —
  `<step id="MailValidator">` →
  `org.pentaho.di.trans.steps.mailvalidator.MailValidatorMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `MailValidatorMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/mailvalidator/MailValidatorMeta.java`
  dòng 347–366) — đúng thứ tự 12 tag trong template (`emailfield` dòng
  350 … `isdynamicDefaultSMTP` dòng 363). Không có list.
- Deserialization: `loadXML()` (dòng 298–300) gọi `readData()` (dòng
  368–389) — đọc thẳng 12 tag; 3 cờ Y/N (thiếu → false).
- Khởi tạo: `setDefault()` (dòng 308–320) —
  `resultfieldname="result"`, `emailValideMsg="email address is valid"`,
  `emailNotValideMsg="email address is not valid"`,
  `errorsFieldName="Error message"`, `timeout="0"`,
  `emailSender="noreply@domain.com"`, còn lại false/null.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 322–345) append cột kết quả
  (Boolean, hoặc String dài 100 khi `ResultAsString`) + cột lỗi String dài
  100 khi `errorsFieldName` non-rỗng; `check()` (dòng 437+) ERROR khi thiếu
  `resultfieldname`/`emailfield` (và thiếu 2 message khi ở chế độ String).
  Khác job `MAIL_VALIDATOR` (đã có reference — kiểm tra một địa chỉ tĩnh
  trong job, không theo dòng).
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (kết quả String + SMTP check):

```xml
<emailfield>CUSTOMER_EMAIL</emailfield>
<resultfieldname>EMAIL_VALID</resultfieldname>
<ResultAsString>Y</ResultAsString>
<smtpCheck>N</smtpCheck>
<emailValideMsg>valid</emailValideMsg>
<emailNotValideMsg>invalid</emailNotValideMsg>
<errorsFieldName>EMAIL_ERROR</errorsFieldName>
```

## 5. Lưu ý / bẫy

- **Chính tả tag bắt buộc giữ nguyên**: `ResultAsString` (R/A/S hoa),
  `smtpCheck` (camel c thường), `emailValideMsg`/`emailNotValideMsg`
  (`Valide` một chữ, không phải `Valid`), `isdynamicDefaultSMTP`
  (`is` thường + `SMTP` hoa). Viết sai vẫn load (case-insensitive) nhưng
  lệch serializer và test order sẽ bắt.
- **`errorsFieldName` rỗng = không thêm cột lỗi**: `getFields()` chỉ thêm
  cột lỗi khi non-rỗng (dòng 339) — muốn không có cột này thì để trống,
  không xóa tag.
- **`smtpCheck=Y` gọi network thật**: kiểm tra SMTP kết nối tới mail
  server — chỉ bật khi cần, test template giữ `N`.
- Template mặc định là khung cấu hình — người dùng phải nối hop có field
  email tồn tại; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan) — không tuyên bố hai mức này.
