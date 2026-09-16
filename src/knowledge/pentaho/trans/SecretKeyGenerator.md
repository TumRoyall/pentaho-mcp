# SecretKeyGenerator — Step sinh khóa bí mật

Sinh khóa bí mật cho các thuật toán đối xứng (`DES`/`DESede`/`AES`) theo
từng dòng cấu hình trong `<fields>/<field>` (`algorithm`, `scheme`,
`secretKeyLen`, `secretKeyCount`), rồi phát thêm cột khóa
(`<secretKeyFieldName>`, String hoặc Binary khi `<outputKeyInBinary>=Y`)
cùng cột phụ thuật toán (`<algorithmFieldName>`, String) và độ dài khóa
(`<secretKeyLengthFieldName>`, Integer) khi tên không rỗng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SecretKeyGenerator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <algorithm>AES</algorithm>
        <scheme>AES</scheme>
        <secretKeyLen>128</secretKeyLen>
        <secretKeyCount>1</secretKeyCount>
      </field>
    </fields>
    <secretKeyFieldName>SECRET_KEY</secretKeyFieldName>
    <secretKeyLengthFieldName>SECRET_KEY_LEN</secretKeyLengthFieldName>
    <algorithmFieldName>ALGORITHM</algorithmFieldName>
    <outputKeyInBinary>N</outputKeyInBinary>
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
| `<fields>/<field>/<algorithm>` | Y | `DES` / `DESede` / `AES`. |
| `<fields>/<field>/<scheme>` | N | Scheme (mặc định theo thuật toán, ví dụ `AES`). |
| `<fields>/<field>/<secretKeyLen>` | Y | Độ dài khóa dạng chuỗi (ví dụ `128`). Chú ý tag là `secretKeyLen`, không phải `secretKeyLength`. |
| `<fields>/<field>/<secretKeyCount>` | N | Số khóa sinh cho dòng cấu hình này. |
| `<secretKeyFieldName>` | Y | Tên cột khóa output (luôn phát). |
| `<secretKeyLengthFieldName>` | N | Cột độ dài khóa (Integer); rỗng → không phát. |
| `<algorithmFieldName>` | N | Cột tên thuật toán (String); rỗng → không phát. |
| `<outputKeyInBinary>` | N | Y = cột khóa kiểu Binary; N (mặc định) = String. |

`<fields>` là paired list — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SECRET_KEY_GENERATOR` | `<type>` | `SecretKeyGenerator`. |
| `configuration.keys[].algorithm` | `<fields>/<field>/<algorithm>` | `DES`/`DESede`/`AES`. |
| `configuration.keys[].scheme` | `<fields>/<field>/<scheme>` | Scheme. |
| `configuration.keys[].length` | `<fields>/<field>/<secretKeyLen>` | Tag rút gọn `secretKeyLen`. |
| `configuration.keys[].count` | `<fields>/<field>/<secretKeyCount>` | Số khóa. |
| `configuration.key_field` | `<secretKeyFieldName>` | Cột khóa. |
| `configuration.output_binary` | `<outputKeyInBinary>` | Y/N. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 123 —
  `<step id="SecretKeyGenerator">` → `...secretkeygenerator.SecretKeyGeneratorMeta`
  (category Cryptography).
- Serialization: `getXML()` (dòng 308–329) — block `<fields>` TRƯỚC
  (311–321; mỗi `<field>`: `algorithm` 315, `scheme` 316, `secretKeyLen`
  317, `secretKeyCount` 318), rồi `secretKeyFieldName` (323),
  `secretKeyLengthFieldName` (324), `algorithmFieldName` (325–326),
  `outputKeyInBinary` (327).
- QUIRK SOURCE: `getXML()` emit `<algorithmFieldName>` HAI LẦN LIÊN
  TIẾP (dòng 325 và 326 — copy-paste trong source). Load (`readData`
  qua `getTagValue`) chỉ đọc occurrence đầu; template chuẩn CHỈ mang
  một `<algorithmFieldName>` (bản save Spoon thực tế sẽ có 2 do serializer).
- Deserialization: `readData()` (dòng 233–258) — đếm `<field>`
  (235–236), `allocate(count)` (238); 4 tag field đọc nguyên văn;
  `outputKeyInBinary` parse `"Y"` (253).
- Khởi tạo: `setDefault()` (dòng 261–277) — `allocate(0)`, tên 3 cột
  output từ i18n (`SecretKeyGeneratorMeta.secretKeyField`...), binary
  false.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 280–305) — cột khóa LUÔN phát
  (String/Binary theo cờ), 2 cột phụ chỉ khi tên không rỗng (algorithm
  String; key-length Integer).
- Không có `<connection>`.

Cấu hình không mặc định (2 thuật toán, output binary):

```xml
<fields>
  <field>
    <algorithm>DES</algorithm>
    <scheme>DES</scheme>
    <secretKeyLen>56</secretKeyLen>
    <secretKeyCount>1</secretKeyCount>
  </field>
  <field>
    <algorithm>AES</algorithm>
    <scheme>AES</scheme>
    <secretKeyLen>256</secretKeyLen>
    <secretKeyCount>2</secretKeyCount>
  </field>
</fields>
<secretKeyFieldName>SECRET_KEY</secretKeyFieldName>
<secretKeyLengthFieldName>SECRET_KEY_LEN</secretKeyLengthFieldName>
<algorithmFieldName>ALGORITHM</algorithmFieldName>
<outputKeyInBinary>Y</outputKeyInBinary>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag độ dài là `secretKeyLen`** (dòng 317), không phải
  `secretKeyLength` — sai tên load thành null.
- **Source emit trùng `<algorithmFieldName>`** (dòng 325–326): template
  giữ 1 occurrence chuẩn; khi round-trip qua serializer thật sẽ thấy 2.
- **Thứ tự ngược thường lệ**: `<fields>` đứng TRƯỚC các tag tên cột
  (dòng 311 vs 323+) — giữ đúng order khi viết tay.
- Không embed khóa thật trong ví dụ (step này SINH khóa, không nhận).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
