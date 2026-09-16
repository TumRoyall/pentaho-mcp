# CreditCardValidator — Step kiểm tra số thẻ tín dụng

Kiểm tra số thẻ trong field `<fieldname>` (thuật toán Luhn + loại thẻ)
và append 3 cột (`<resultfieldname>` Boolean + `<cardtype>` String +
`<notvalidmsg>` String — mỗi cột chỉ append khi tên non-empty sau
substitute, chú ý bug dòng 177 kiểm tra `notvalidmsg` gốc thay vì giá trị
đã substitute). Cờ `<onlydigits>` (Y/N) bắt chuỗi chỉ gồm chữ số.
`check()` ERROR khi thiếu `fieldname`/`resultfieldname` hoặc không có
input.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CreditCardValidator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fieldname>CARD_NUMBER</fieldname>
    <resultfieldname>result</resultfieldname>
    <cardtype>card type</cardtype>
    <onlydigits>N</onlydigits>
    <notvalidmsg>not valid message</notvalidmsg>
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
| `<fieldname>` | Y | Tên field chứa số thẻ trong dòng đầu vào (`check()` ERROR khi rỗng). |
| `<resultfieldname>` | Y | Tên cột kết quả (Boolean); mặc định `result` (`check()` ERROR khi rỗng). |
| `<cardtype>` | N | Tên cột loại thẻ (String); mặc định `card type`. Để trống (sau substitute) = không append cột này. |
| `<onlydigits>` | N | `Y` = chỉ chấp nhận chuỗi toàn chữ số; `N` (mặc định). |
| `<notvalidmsg>` | N | Tên cột thông điệp (String); mặc định `not valid message`. Để trống = không append (chú ý bug kiểm tra biến gốc). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CREDIT_CARD_VALIDATOR` | `<type>` | `CreditCardValidator`. |
| `configuration.card_field` | `<fieldname>` | Tham chiếu field input. |
| `configuration.result_field` | `<resultfieldname>` | Mặc định `result`. |
| `configuration.card_type_field` | `<cardtype>` | Mặc định `card type`. |
| `configuration.only_digits` | `<onlydigits>` | Boolean → Y/N. |
| `configuration.message_field` | `<notvalidmsg>` | Mặc định `not valid message`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 73 —
  `<step id="CreditCardValidator">` →
  `org.pentaho.di.trans.steps.creditcardvalidator.CreditCardValidatorMeta`
  (category Validation). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `CreditCardValidatorMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/creditcardvalidator/CreditCardValidatorMeta.java`
  dòng 184–194) — đúng thứ tự `fieldname`, `resultfieldname`,
  `cardtype`, `onlydigits` (boolean → Y/N), `notvalidmsg`; 4 string + 1
  boolean, luôn emit.
- Deserialization: `loadXML()` (dòng 145–147) gọi `readData()` (dòng
  196–208) — strings null khi thiếu; `onlydigits="Y".equalsIgnoreCase(...)`
  (thiếu → false).
- Khởi tạo: `setDefault()` (dòng 155–160) — `resultfieldname="result"`,
  `onlydigits=false`, `cardtype="card type"`,
  `notvalidmsg="not valid message"`; `fieldname` không set (= null).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 162–182) append
  `resultfieldname`:Boolean + `cardtype`:String + `notvalidmsg`:String,
  mỗi cột chỉ khi `!Utils.isEmpty(...)` sau `environmentSubstitute` —
  **bug dòng 177**: kiểm tra `notvalidmsg` GỐC thay vì giá trị đã
  substitute (`realnotvalidmsg`), nên `${VAR}` rỗng lúc runtime vẫn append
  cột. `check()` (dòng 239–277) ERROR khi `resultfieldname` rỗng,
  `fieldname` rỗng, hoặc `input.length==0`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (chỉ digits + tên cột nghiệp vụ):

```xml
<fieldname>PAN</fieldname>
<resultfieldname>IS_VALID</resultfieldname>
<cardtype>CARD_BRAND</cardtype>
<onlydigits>Y</onlydigits>
<notvalidmsg>VALIDATION_MSG</notvalidmsg>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tên cột rỗng = bỏ cột đó** (trừ result bắt buộc) — muốn output gọn thì
  để trống `cardtype`/`notvalidmsg`, nhưng đừng để trống
  `resultfieldname` (`check()` ERROR).
- **Bug `${VAR}` ở `notvalidmsg`**: tên cột chứa biến rỗng lúc runtime
  vẫn bị append (kiểm tra biến gốc) — dùng tên tĩnh khi cần output ổn
  định.
- **Bắt buộc có input** — số thẻ đến từ field của stream trước.
- **Dữ liệu nhạy cảm**: số thẻ đi qua memory/log — che/mask ở downstream,
  không log cột PAN ra file.
- Template mặc định là khung cấu hình — người dùng phải điền field số
  thẻ tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
