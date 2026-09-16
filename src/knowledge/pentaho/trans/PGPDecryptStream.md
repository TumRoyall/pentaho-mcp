# PGPDecryptStream — Step giải mã dòng bằng PGP/GPG

Với MỖI dòng đầu vào, giải mã nội dung cột `<streamfield>` bằng passphrase
(`<passhrase>` — ĐÚNG typo thiếu chữ p của source, hoặc lấy động từ cột
`<passphraseFieldName>` khi `<passphraseFromField>=Y`) qua GPG
(`<gpglocation>`) và append kết quả vào `<resultfieldname>` (String).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PGPDecryptStream</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <gpglocation>${GPG_PATH}</gpglocation>
    <passhrase>${PGP_PASSPHRASE}</passhrase>
    <streamfield>{{INPUT_FIELD}}</streamfield>
    <resultfieldname>result</resultfieldname>
    <passphraseFromField>N</passphraseFromField>
    <passphraseFieldName/>
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
| `<gpglocation>` | Y | Đường dẫn GPG. Dùng `${GPG_PATH}`. |
| `<passhrase>` | Y (khi passphraseFromField=N) | Passphrase — ĐÚNG chính tả typo `passhrase` (thiếu p). Lưu mã hóa khi không phải biến; dùng `${PGP_PASSPHRASE}`. |
| `<streamfield>` | Y | Cột chứa nội dung mã hóa. |
| `<resultfieldname>` | N | Cột kết quả; mặc định `"result"`. Rỗng → không thêm cột. |
| `<passphraseFromField>` | N | Y = lấy passphrase động từ `<passphraseFieldName>`; N mặc định. |
| `<passphraseFieldName>` | N (Y khi passphraseFromField=Y) | Cột chứa passphrase. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PGP_DECRYPT_STREAM` | `<type>` | `PGPDecryptStream`. |
| `configuration.gpg_location` | `<gpglocation>` | `${GPG_PATH}`. |
| `configuration.passphrase` | `<passhrase>` | Typo source, `${VAR}`. |
| `configuration.stream_field` | `<streamfield>` | Cột nguồn. |
| `configuration.result_field` | `<resultfieldname>` | `"result"`. |
| `configuration.passphrase_from_field` | `<passphraseFromField>` | Y/N. |
| `configuration.passphrase_field` | `<passphraseFieldName>` | Cột passphrase. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 130 —
  `<step id="PGPDecryptStream">` →
  `org.pentaho.di.trans.steps.pgpdecryptstream.PGPDecryptStreamMeta`
  (category Cryptography).
- Serialization: `PGPDecryptStreamMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/pgpdecryptstream/PGPDecryptStreamMeta.java`
  dòng 220–230) — `gpglocation` (222), `passhrase` TYPO mã hóa qua
  `Encr.encryptPasswordIfNotUsingVariables` (223–224), `streamfield`
  (225), `resultfieldname` (226), `passphraseFromField` Y/N (227),
  `passphraseFieldName` (228).
- Deserialization: `readData()` (dòng 232–244) — `passhrase` giải mã qua
  `Encr.decryptPasswordOptionallyEncrypted` (235); `passphraseFromField`
  parse `"Y"` (238).
- Khởi tạo: `setDefault()` (dòng 200–205) — result `"result"`, còn lại
  null (boolean `passphraseFromField` mặc định false của Java).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 208–217) append 1 cột String.
- Không có `<connection>`.

Cấu hình không mặc định (passphrase động):

```xml
<gpglocation>${GPG_PATH}</gpglocation>
<passhrase/>
<streamfield>ENCRYPTED_MSG</streamfield>
<resultfieldname>MESSAGE</resultfieldname>
<passphraseFromField>Y</passphraseFromField>
<passphraseFieldName>ROW_PASSPHRASE</passphraseFieldName>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag passphrase viết `passhrase`** (một s): sửa thành `passphrase`
  đúng chính tả sẽ load thành null — giữ NGUYÊN typo.
- **Đừng lẫn với Encrypt**: Encrypt có `keyname`/`keynameInField`,
  Decrypt có `passhrase`/`passphraseFromField` — hai bộ tag khác nhau.
- Passphrase luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
