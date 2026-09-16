# PGPEncryptStream — Step mã hóa dòng bằng PGP/GPG

Với MỖI dòng đầu vào, mã hóa nội dung cột `<streamfield>` bằng khóa PGP
(`<keyname>`, hoặc tên khóa lấy động từ cột `<keynameFieldName>` khi
`<keynameInField>=Y`) qua GPG (`<gpglocation>`) và append kết quả vào cột
mới `<resultfieldname>` (String). Output = input row + 1 cột.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PGPEncryptStream</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <gpglocation>${GPG_PATH}</gpglocation>
    <keyname>${PGP_KEY_NAME}</keyname>
    <keynameInField>N</keynameInField>
    <keynameFieldName/>
    <streamfield>{{INPUT_FIELD}}</streamfield>
    <resultfieldname>result</resultfieldname>
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
| `<gpglocation>` | Y | Đường dẫn GPG executable. Dùng `${GPG_PATH}`, không embed path thật. |
| `<keyname>` | Y (khi keynameInField=N) | Tên khóa PGP mã hóa. Dùng `${PGP_KEY_NAME}`. |
| `<keynameInField>` | N | Y = lấy tên khóa động từ cột `<keynameFieldName>`; N (mặc định) = dùng `<keyname>` tĩnh. |
| `<keynameFieldName>` | N (Y khi keynameInField=Y) | Cột dòng chứa tên khóa. |
| `<streamfield>` | Y | Cột dòng chứa nội dung cần mã hóa. |
| `<resultfieldname>` | N | Tên cột kết quả; mặc định `"result"`. Rỗng → không thêm cột. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PGP_ENCRYPT_STREAM` | `<type>` | `PGPEncryptStream`. |
| `configuration.gpg_location` | `<gpglocation>` | `${GPG_PATH}`. |
| `configuration.key_name` | `<keyname>` | `${PGP_KEY_NAME}`. |
| `configuration.key_name_in_field` | `<keynameInField>` | Boolean → Y/N. |
| `configuration.key_name_field` | `<keynameFieldName>` | Cột tên khóa. |
| `configuration.stream_field` | `<streamfield>` | Cột nội dung. |
| `configuration.result_field` | `<resultfieldname>` | `"result"`. |

Không có list lặp — không dùng `set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 129 —
  `<step id="PGPEncryptStream">` →
  `org.pentaho.di.trans.steps.pgpencryptstream.PGPEncryptStreamMeta`
  (category Cryptography).
- Serialization: `PGPEncryptStreamMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/pgpencryptstream/PGPEncryptStreamMeta.java`
  dòng 217–226) — đúng thứ tự `gpglocation` (219), `keyname` (220),
  `keynameInField` Y/N (221), `keynameFieldName` (222), `streamfield`
  (223), `resultfieldname` (224). Không có tag nào khác.
- Deserialization: `readData()` (dòng 228–241) — `keynameInField` parse
  `"Y"` (233, thiếu → false); còn lại đọc nguyên văn, không fallback.
- Khởi tạo: `setDefault()` (dòng 195–202) — `resultfieldname "result"`
  (196), `streamfield`/`keyname`/`gpglocation`/`keynameFieldName` null,
  `keynameInField` false. Step mới phải điền GPG + khóa + cột nguồn.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 205–214) append MỘT cột String
  tên `resultfieldname` (bỏ qua khi rỗng). Worker `PGPEncryptStream`
  mã hóa từng dòng; cần GPG cài sẵn (không chạy I/O trong scope này).
- Không có `<connection>` — fixture không cần khai báo connection.

Cấu hình không mặc định (khóa động theo dòng):

```xml
<gpglocation>${GPG_PATH}</gpglocation>
<keyname/>
<keynameInField>Y</keynameInField>
<keynameFieldName>RECIPIENT_KEY</keynameFieldName>
<streamfield>MESSAGE</streamfield>
<resultfieldname>ENCRYPTED_MSG</resultfieldname>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Phân biệt với Decrypt**: Encrypt dùng `keyname` (+`keynameInField`
  kiểu Y/N `keynameInField`, chữ I hoa), Decrypt dùng `passhrase`
  (thiếu chữ p — đúng typo source) + `passphraseFromField`. Không lẫn
  tag hai step.
- **Tên tag case-sensitive**: `keynameInField`, `keynameFieldName`,
  `resultfieldname` (viết thường f) — đúng như getXML.
- Key/passphrase dùng `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
