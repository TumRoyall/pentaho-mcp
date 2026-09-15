# ReplaceString — Step tìm-thay chuỗi (literal hoặc regex) trên field

Với MỖI dòng đầu vào, tìm-thay trên mỗi field đã khai báo: thay chuỗi
`<replace_string>` bằng `<replace_by_string>` (hoặc bằng giá trị field khác
`<replace_field_by_string>`, hoặc bằng chuỗi rỗng khi
`<set_empty_string>Y</set_empty_string>`), khớp literal hoặc regex
(`<use_regex>`), toàn từ (`<whole_word>`), phân biệt hoa thường
(`<case_sensitive>`), unicode (`<is_unicode>`). Ghi vào field MỚI
(`<out_stream_name>`) hoặc thay TẠI CHỖ khi để trống. Step không cần DB
connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ReplaceString</type>
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
        <in_stream_name>{{INPUT_FIELD}}</in_stream_name>
        <out_stream_name>{{OUTPUT_FIELD}}</out_stream_name>
        <use_regex>no</use_regex>
        <replace_string>{{SEARCH}}</replace_string>
        <replace_by_string>{{REPLACEMENT}}</replace_by_string>
        <set_empty_string>N</set_empty_string>
        <replace_field_by_string/>
        <whole_word>no</whole_word>
        <case_sensitive>no</case_sensitive>
        <is_unicode>no</is_unicode>
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
| `<fields>/<field>/<in_stream_name>` | Y (mỗi field) | Field nguồn (phải tồn tại, kiểu String). `check()` ERROR khi rỗng/trùng/không phải String. |
| `<fields>/<field>/<out_stream_name>` | N | Field đích (String mới). RỖNG = thay tại chỗ trên field nguồn. |
| `<fields>/<field>/<use_regex>` | N | `yes` = `<replace_string>` là regex; `no` (mặc định) = literal. **Chuỗi `yes`/`no`, KHÔNG phải `Y`/`N`.** |
| `<fields>/<field>/<replace_string>` | N | Chuỗi/regex cần tìm. |
| `<fields>/<field>/<replace_by_string>` | N | Chuỗi thay thế (bị override bởi field hoặc empty-string khi hai cờ kia bật). |
| `<fields>/<field>/<set_empty_string>` | N | `Y` = thay bằng chuỗi rỗng; `N` (mặc định). **Chuẩn `Y`/`N`.** |
| `<fields>/<field>/<replace_field_by_string>` | N | Field khác lấy giá trị thay thế; rỗng = dùng `<replace_by_string>`. |
| `<fields>/<field>/<whole_word>` | N | `yes` = chỉ khớp cả từ; `no` (mặc định). **`yes`/`no`.** |
| `<fields>/<field>/<case_sensitive>` | N | `yes` = phân biệt hoa thường; `no` (mặc định). **`yes`/`no`.** |
| `<fields>/<field>/<is_unicode>` | N | `yes` = regex unicode-aware; `no` (mặc định). **`yes`/`no`.** |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: REPLACE_STRING` | `<type>` | `ReplaceString`. |
| `configuration.fields[].in` | `<fields>/<field>/<in_stream_name>` | Field nguồn String. |
| `configuration.fields[].out` | `<fields>/<field>/<out_stream_name>` | Rỗng = tại chỗ. |
| `configuration.fields[].use_regex` | `<fields>/<field>/<use_regex>` | Boolean → `yes`/`no`. |
| `configuration.fields[].search` | `<fields>/<field>/<replace_string>` | Literal hoặc regex. |
| `configuration.fields[].replacement` | `<fields>/<field>/<replace_by_string>` |  |
| `configuration.fields[].set_empty` | `<fields>/<field>/<set_empty_string>` | Boolean → `Y`/`N`. |
| `configuration.fields[].replacement_field` | `<fields>/<field>/<replace_field_by_string>` |  |
| `configuration.fields[].whole_word` | `<fields>/<field>/<whole_word>` | Boolean → `yes`/`no`. |
| `configuration.fields[].case_sensitive` | `<fields>/<field>/<case_sensitive>` | Boolean → `yes`/`no`. |
| `configuration.fields[].is_unicode` | `<fields>/<field>/<is_unicode>` | Boolean → `yes`/`no`. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 83 —
  `<step id="ReplaceString">` →
  `org.pentaho.di.trans.steps.replacestring.ReplaceStringMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `ReplaceStringMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/replacestring/ReplaceStringMeta.java`
  dòng 284–310) — emit DUY NHẤT wrapper `<fields>` paired (dòng 287/307);
  mỗi `<field>` có đúng 10 tag theo thứ tự `in_stream_name`,
  `out_stream_name`, `use_regex`, `replace_string`, `replace_by_string`,
  `set_empty_string`, `replace_field_by_string`, `whole_word`,
  `case_sensitive`, `is_unicode` (dòng 291–303).
- Deserialization: `loadXML()` (dòng 202–204) gọi `readData()` (dòng
  238–270) — string tags qua `Const.NVL(..., "")` (thiếu → `""`, dòng
  250–254, 258); 4 cờ match qua `getFlagFromString` (chấp nhận
  `Y`/`yes`/`true` case-insensitive, dòng 272–274); `set_empty_string` qua
  non-empty + `"Y".equalsIgnoreCase` (thiếu → false, dòng 255–257).
- Khởi tạo: `setDefault()` (dòng 276–282) — null stream + 0 field
  (`allocate(0)`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 367–391) —
  `out_stream_name` non-empty thì THÊM field String mới (copy string
  encoding từ nguồn, PDI-11839, dòng 373–382), rỗng thì sửa tại chỗ (dòng
  383–389). `check()` (dòng 393–487) đòi input field tồn tại (dòng
  408–429), kiểu String (dòng 434–458), tên non-empty (dòng 460–472) và
  không trùng (dòng 475–484). `supportsErrorHandling()` = true (dòng
  498–500).

Cấu hình không mặc định (regex tách số điện thoại ra field mới + thay
literal tại chỗ):

```xml
<fields>
  <field>
    <in_stream_name>PHONE_RAW</in_stream_name>
    <out_stream_name>PHONE</out_stream_name>
    <use_regex>yes</use_regex>
    <replace_string>[^0-9]</replace_string>
    <replace_by_string></replace_by_string>
    <set_empty_string>N</set_empty_string>
    <replace_field_by_string></replace_field_by_string>
    <whole_word>no</whole_word>
    <case_sensitive>no</case_sensitive>
    <is_unicode>no</is_unicode>
  </field>
  <field>
    <in_stream_name>STATUS</in_stream_name>
    <out_stream_name></out_stream_name>
    <use_regex>no</use_regex>
    <replace_string>n/a</replace_string>
    <replace_by_string>UNKNOWN</replace_by_string>
    <set_empty_string>N</set_empty_string>
    <replace_field_by_string></replace_field_by_string>
    <whole_word>yes</whole_word>
    <case_sensitive>no</case_sensitive>
    <is_unicode>no</is_unicode>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **4 cờ match là `yes`/`no`, KHÔNG phải `Y`/`N`**: `use_regex`,
  `whole_word`, `case_sensitive`, `is_unicode` serialize qua
  `getFlagTagValue` (dòng 312–315, BACKLOG-27839). Ghi `Y` vẫn load đúng
  nhưng file ghi lại ra `yes` → diff giả và vỡ test đối chiếu chuẩn.
- **`set_empty_string` ngược lại là `Y`/`N` chuẩn** (dòng 296 dùng
  `addTagValue(String, boolean)`): hai họ cờ trong CÙNG một `<field>` —
  đừng đồng nhất chúng.
- **`<out_stream_name>` rỗng = thay tại chỗ**: không phải "bỏ qua field".
  Muốn giữ gốc + ra field mới thì điền tên đích khác nguồn.
- **Ưu tiên nguồn thay thế**: field thay thế (`replace_field_by_string`)
  và empty-string (`set_empty_string=Y`) override
  `<replace_by_string>` ở runtime — điền đồng thời mà không hiểu thứ tự sẽ
  ra kết quả bất ngờ.
- **`in_stream_name` phải là String**: `check()` ERROR khi field nguồn
  không phải kiểu String (dòng 434–458) — không dùng step này để sửa số/
  ngày trực tiếp (convert sang String trước).
- Template mặc định là khung cấu hình — người dùng phải điền field nguồn
  String tồn tại trong stream trước và (với regex) test pattern ngoài trước
  khi chạy luồng lớn.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
