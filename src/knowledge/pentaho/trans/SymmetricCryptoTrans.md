# SymmetricCryptoTrans — Step mã hóa/giải mã đối xứng theo dòng

Với MỖI dòng đầu vào, mã hóa (`operation_type=encrypt`) hoặc giải mã
(`=decrypt`) nội dung cột `<messageField>` bằng thuật toán đối xứng
(`<algorithm>` trong `DES`/`DESede`/`AES`, `<schema>`) với khóa bí mật
(`<secretKey>` tĩnh mã hóa, hoặc cột `<secretKeyField>` khi
`<secretKeyInField>=Y`), append kết quả vào `<resultfieldname>` (String,
hoặc Binary khi `<outputResultAsBinary>=Y`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SymmetricCryptoTrans</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <operation_type>encrypt</operation_type>
    <algorithm>DES</algorithm>
    <schema>DES</schema>
    <secretKeyField/>
    <messageField>{{INPUT_FIELD}}</messageField>
    <resultfieldname>result</resultfieldname>
    <secretKey>${CRYPTO_SECRET_KEY}</secretKey>
    <secretKeyInField>N</secretKeyInField>
    <readKeyAsBinary>N</readKeyAsBinary>
    <outputResultAsBinary>N</outputResultAsBinary>
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
| `<operation_type>` | N | Mã chuỗi `encrypt` (0) / `decrypt` (1). Thiếu/lạ → 0 = encrypt. |
| `<algorithm>` | N | `DES` / `DESede` / `AES` (`TYPE_ALGORYTHM_CODE`); mặc định `"DES"`. |
| `<schema>` | N | Scheme thuật toán; mặc định = algorithm (`"DES"`). |
| `<secretKeyField>` | N (Y khi secretKeyInField=Y) | Cột chứa khóa. |
| `<messageField>` | Y | Cột chứa nội dung cần xử lý. |
| `<resultfieldname>` | N | Cột kết quả; mặc định `"result"`. Rỗng → không thêm cột. |
| `<secretKey>` | Y (khi secretKeyInField=N) | Khóa tĩnh, lưu mã hóa khi không phải biến. Dùng `${CRYPTO_SECRET_KEY}`. |
| `<secretKeyInField>` | N | Y = lấy khóa từ cột; N mặc định. |
| `<readKeyAsBinary>` | N | Y = đọc khóa dạng binary; N mặc định. |
| `<outputResultAsBinary>` | N | Y = cột kết quả kiểu Binary; N (mặc định) = String. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SYMMETRIC_CRYPTO` | `<type>` | `SymmetricCryptoTrans`. |
| `configuration.operation` | `<operation_type>` | `encrypt`/`decrypt`. |
| `configuration.algorithm` | `<algorithm>` | `DES`/`DESede`/`AES`. |
| `configuration.message_field` | `<messageField>` | Cột nguồn. |
| `configuration.secret_key` | `<secretKey>` | `${VAR}`. |
| `configuration.secret_key_in_field` | `<secretKeyInField>` | Y/N. |
| `configuration.result_field` | `<resultfieldname>` | `"result"`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 122 —
  `<step id="SymmetricCryptoTrans">` → `...symmetriccryptotrans.SymmetricCryptoTransMeta`
  (category Cryptography).
- Mã operation: `operationTypeCode = {"encrypt","decrypt"}` (dòng 79),
  `getOperationTypeByCode` null/lạ → 0 = encrypt (dòng 102–113).
  Mã thuật toán: `TYPE_ALGORYTHM_CODE = {"DES","DESede","AES"}`
  (`symmetricalgorithm/SymmetricCryptoMeta.java` dòng 41).
- Serialization: `getXML()` (dòng 314–328) — `operation_type` mã (316),
  `algorithm` (317), `schema` (318), `secretKeyField` (319),
  `messageField` (320), `resultfieldname` (321), `secretKey` mã hóa
  (324), `secretKeyInField` (326), `readKeyAsBinary` (327),
  `outputResultAsBinary` (328).
- Deserialization: `readData()` (dòng 262–281) — operation qua
  `getOperationTypeByCode(NVL(tag,""))` (264–265); secretKey giải mã
  (272); 3 cờ parse `"Y"` (273–275).
- Khởi tạo: `setDefault()` (dòng 283–294) — encrypt (289),
  algorithm = schema = `TYPE_ALGORYTHM_CODE[0]` = `"DES"` (290–291),
  result `"result"` (286), còn lại null/false.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 296–312) append 1 cột String,
  hoặc Binary khi `outputResultAsBinary=Y` (300–303).
- Không có `<connection>`.

Cấu hình không mặc định (AES decrypt, khóa từ cột, output binary):

```xml
<operation_type>decrypt</operation_type>
<algorithm>AES</algorithm>
<schema>AES</schema>
<secretKeyField>ROW_KEY</secretKeyField>
<messageField>CIPHER_TEXT</messageField>
<resultfieldname>PLAIN_BIN</resultfieldname>
<secretKey/>
<secretKeyInField>Y</secretKeyInField>
<readKeyAsBinary>N</readKeyAsBinary>
<outputResultAsBinary>Y</outputResultAsBinary>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<operation_type>` là mã chuỗi** `encrypt`/`decrypt`, không phải số
  0/1; tag thiếu → encrypt lặng lẽ.
- **`<secretKey>` mã hóa khi lưu** — luôn dùng `${VAR}` trong template.
- **`outputResultAsBinary=Y` đổi kiểu cột** String → Binary —
  downstream phải đọc binary.
- Không lẫn `secretKeyField` (cột khóa động) với `secretKey` (khóa tĩnh).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
