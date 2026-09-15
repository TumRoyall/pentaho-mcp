# CheckSum — Step tính checksum trên các field đã chọn

Với MỖI dòng đầu vào, nối các field đã chọn rồi tính checksum theo thuật
toán đã cấu hình (`CRC32`, `ADLER32`, `MD5`, `SHA-1`, `SHA-256`) và gắn
kết quả vào một cột mới (`<resultfieldName>`). Kiểu cột output phụ thuộc
cả thuật toán lẫn `<resultType>`: hai họ CRC cho ra `Integer`, còn lại
cho ra `String` (hex) hoặc `Binary`. Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CheckSum</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <checksumtype>CRC32</checksumtype>
    <resultfieldName>{{RESULT_FIELD}}</resultfieldName>
    <resultType>hexadecimal</resultType>
    <compatibilityMode>N</compatibilityMode>
    <oldChecksumBehaviour>N</oldChecksumBehaviour>
    <evaluationMethod>BYTES</evaluationMethod>
    <fields>
      <field>
        <name>{{INPUT_FIELD_1}}</name>
      </field>
      <field>
        <name>{{INPUT_FIELD_2}}</name>
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
| `<checksumtype>` | Y | Một trong `CRC32`, `ADLER32`, `MD5`, `SHA-1`, `SHA-256` (ghi ĐÚNG chuỗi, chú ý `SHA-1`/`SHA-256` có gạch ngang). `getFields()` gọi `checksumtype.equals(...)` — thiếu tag (null) NÉM NPE. |
| `<resultfieldName>` | Y | Tên cột checksum gắn thêm vào mỗi dòng. `check()` báo ERROR khi rỗng; `getFields()` bỏ qua (không thêm cột) khi rỗng. |
| `<resultType>` | N | Mã CHUỖI thường: `string`, `hexadecimal`, `binary`. Mặc định step mới: `hexadecimal`. Giá trị lạ/thiếu → `string`. |
| `<compatibilityMode>` | N | `Y`/`N` (cờ tương thích cũ, deprecated). Mặc định step MỚI: false (`N`) — nhưng load thiếu tag → **true** (bẫy, xem mục 5). |
| `<oldChecksumBehaviour>` | N | `Y`/`N` (deprecated, giữ tương thích). Mặc định step mới: false (`N`); load thiếu tag → **true**. |
| `<evaluationMethod>` | N | Mã: `BYTES`, `PENTAHO_STRINGS`, `NATIVE_STRINGS`. Mặc định: `BYTES` (hoặc biến môi trường `KETTLE_DEFAULT_CHECKSUM_EVALUATION_METHOD`). Mã lạ → `BYTES`. |
| `<fieldSeparatorString>` | N | Chuỗi phân tách khi nối field; chỉ được EMIT khi non-null. Mặc định step mới: null (tag vắng mặt). |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field đầu vào tham gia tính checksum. List LUÔN paired kể cả 0 field. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CHECK_SUM` | `<type>` | `CheckSum`. |
| `configuration.checksum_type` | `<checksumtype>` | Một trong 5 mã chuỗi. |
| `configuration.result_field` | `<resultfieldName>` | Chú ý N hoa. |
| `configuration.result_type` | `<resultType>` | `string` / `hexadecimal` / `binary` (thường). |
| `configuration.compatibility_mode` | `<compatibilityMode>` | Boolean → Y/N. |
| `configuration.evaluation_method` | `<evaluationMethod>` | `BYTES` / `PENTAHO_STRINGS` / `NATIVE_STRINGS`. |
| `configuration.separator` | `<fieldSeparatorString>` | Chỉ emit khi non-null. |
| `configuration.fields[]` | `<fields>/<field>/<name>` | Tên field input. |

`<fields>` chứa list `<field>` đồng nhất (mỗi item chỉ có `<name>`) →
fill bằng MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step` (dòng 63–65 trong
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/checksum/CheckSumMeta.java`)
  — `id = "CheckSum"`, category Transform. Step này KHÔNG có trong
  `engine/src/main/resources/kettle-steps.xml` (registry ở đây là
  evidence annotation, không phải XML evidence; evidence là serializer
  dưới đây).
- Tên tag là hằng `XML_TAG_*` (dòng 74–84): `checksumtype`,
  `fieldSeparatorString`, `resultfieldName`, `resultType`,
  `compatibilityMode`, `oldChecksumBehaviour`, `evaluationMethod`,
  `fields`/`field`/`name`.
- Serialization: `CheckSumMeta.getXML()` (dòng 488–509) — thứ tự
  `checksumtype`, `resultfieldName`, `resultType` (mã code thường qua
  `getResultTypeCode`, dòng 480–485), `compatibilityMode` (Y/N),
  `oldChecksumBehaviour` (Y/N), `evaluationMethod` (mã code),
  `fieldSeparatorString` CHỈ khi non-null (dòng 496–498), rồi wrapper
  `<fields>` LUÔN emit kể cả 0 field (dòng 500/506) chứa các `<field>`
  mỗi item một `<name>` (dòng 501–505). Không có tag nào khác.
- Mã checksum: `checksumtypeCodes` (dòng 96) = `CRC32`, `ADLER32`,
  `MD5`, `SHA-1`, `SHA-256`. Mã result: `resultTypeCode` (dòng 108) =
  `string`, `hexadecimal`, `binary` (viết thường — khác tên hằng Java).
  Mã evaluation: `BYTES`, `PENTAHO_STRINGS`, `NATIVE_STRINGS`
  (`core/src/main/java/org/pentaho/di/core/Const.java` dòng 1554–1587),
  default `BYTES`.
- Deserialization: `loadXML()` (dòng 392–394) gọi `readData()` (dòng
  434–462) — `checksumtype`/`resultfieldName` đọc nguyên văn (thiếu →
  null); `resultType` qua `getResultTypeByCode` (lạ/thiếu → 0 =
  `string`, dòng 438 + 233–244); `compatibilityMode`/
  `oldChecksumBehaviour` null → **true** ("It was previously not saved",
  dòng 464–478); `evaluationMethod` thiếu tag → biến môi trường
  `KETTLE_DEFAULT_CHECKSUM_EVALUATION_METHOD` rồi về default `BYTES`
  (dòng 442–447 + 364–374); list đọc từ sub-node `<fields>`.
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 512–520) đặt
  `resultfieldName=null`, `checksumtype=CRC32`, `resultType=HEXADECIMAL`,
  `fieldSeparatorString=null`, `evaluationMethod=BYTES`, 0 field.
  `compatibilityMode`/`oldChecksumBehaviour` KHÔNG được set (false mặc
  định Java) — ngược với fallback load-missing (true). Template pin cả
  hai về `N` theo `setDefault()`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 576–596) chỉ thêm cột khi
  `resultfieldName` non-empty — `CRC32`/`ADLER32` → `ValueMetaInteger`,
  còn lại `result_TYPE_BINARY` → `ValueMetaBinary`, ngược lại →
  `ValueMetaString` (kể cả `hexadecimal`). Output = input rows + 1 cột.
  `check()` (dòng 599–680) ERROR khi thiếu result field, WARNING khi 0
  field, WARNING ở compatibility mode và ERROR khi compat + `SHA-256`.
- Không có `<connection>`: step không tham chiếu DB — template không
  mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (MD5 + binary + separator + 2 field):

```xml
<checksumtype>MD5</checksumtype>
<resultfieldName>ROW_HASH</resultfieldName>
<resultType>binary</resultType>
<compatibilityMode>N</compatibilityMode>
<oldChecksumBehaviour>N</oldChecksumBehaviour>
<evaluationMethod>BYTES</evaluationMethod>
<fieldSeparatorString>|</fieldSeparatorString>
<fields>
  <field>
    <name>CUST_CODE</name>
  </field>
  <field>
    <name>CUST_NAME</name>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<resultType>` là mã thường, không phải số**: `string`,
  `hexadecimal`, `binary`. Ghi `1` hay `HEXADECIMAL` đều rơi về
  `string` lặng lẽ (`getResultTypeByCode`).
- **`<checksumtype>` bắt buộc có mặt**: thiếu tag → null →
  `getFields()` NPE ở `checksumtype.equals(...)` (dòng 581). Không bao
  giờ lược tag này.
- **Compat flags đảo default khi load**: step mới là false, nhưng file
  thiếu tag load thành true. Template LUÔN pin cả hai về `N` (trừ khi
  cần đọc file checksum cũ — khi đó bật `compatibilityMode=Y` có chủ ý
  và KHÔNG dùng `SHA-256` vì `check()` báo ERROR tổ hợp này).
- **`<fieldSeparatorString>` vắng mặt khi null**: `getXML()` bỏ qua tag
  khi null (dòng 496) — file không có tag này là bình thường, loader
  đọc về null. Đừng bịa tag rỗng để "cho đủ".
- **Kiểu cột output do cả thuật toán lẫn resultType quyết định**:
  CRC32/ADLER32 luôn `Integer` (bỏ qua `resultType`); MD5/SHA mới xét
  `binary` vs chuỗi. Đừng quảng cáo MD5 + `hexadecimal` cho ra Binary.
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field — template
  giữ `<fields></fields>` paired, không viết self-closing
  `<fields/>` (`setFields` từ chối list self-closing).
- Template mặc định là khung cấu hình — người dùng phải điền result
  field và các field input tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
