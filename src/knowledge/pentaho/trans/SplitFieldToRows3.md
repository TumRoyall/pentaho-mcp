# SplitFieldToRows3 — Step tách một field thành nhiều dòng

Với MỖI dòng đầu vào, tách field `splitfield` theo `delimiter` (literal hoặc
regex khi `delimiter_is_regex=Y`) thành NHIỀU DÒNG ra: mỗi mảnh ghi vào
field mới `newfield` (kiểu String), các cột khác copy nguyên. Tùy chọn thêm
field Integer đếm mảnh (`rownum=Y` + `rownum_field`). Step không cần DB
connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SplitFieldToRows3</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <splitfield>{{FIELD_TO_SPLIT}}</splitfield>
    <delimiter>;</delimiter>
    <newfield>{{NEW_FIELD_NAME}}</newfield>
    <rownum>N</rownum>
    <rownum_field/>
    <resetrownumber>Y</resetrownumber>
    <delimiter_is_regex>N</delimiter_is_regex>
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
| `<splitfield>` | Y | Field cần tách (phải tồn tại trong stream trước; `check()` ERROR khi thiếu). |
| `<delimiter>` | N | Chuỗi phân tách (mặc định step mới: `;`). Khi `delimiter_is_regex=Y` thì là regex. |
| `<newfield>` | Y | Tên field mới chứa từng mảnh (kiểu String). `check()` ERROR khi rỗng. |
| `<rownum>` | N | `Y` = thêm field đếm mảnh; `N` (mặc định). |
| `<rownum_field>` | N (bắt buộc khi rownum=Y) | Tên field Integer đếm mảnh (substitute biến). `check()` ERROR khi `rownum=Y` mà trống. |
| `<resetrownumber>` | N | `Y` (mặc định step mới) = reset số đếm cho mỗi file; `N` = đếm liên tục. Template LUÔN pin `Y`显式 (thiếu tag load thành false, khác default). |
| `<delimiter_is_regex>` | N | `Y` = delimiter là regex; `N` (mặc định) = literal. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SPLIT_FIELD_TO_ROWS3` | `<type>` | `SplitFieldToRows3` — giữ hậu tố `3`. |
| `configuration.split_field` | `<splitfield>` | Viết liền, thường. |
| `configuration.delimiter` | `<delimiter>` | Literal hoặc regex. |
| `configuration.new_field` | `<newfield>` | Viết liền, thường. |
| `configuration.include_row_number` | `<rownum>` | Boolean → Y/N. |
| `configuration.row_number_field` | `<rownum_field>` |  |
| `configuration.reset_row_number` | `<resetrownumber>` | Boolean → Y/N (không gạch dưới). |
| `configuration.delimiter_is_regex` | `<delimiter_is_regex>` | Boolean → Y/N. |

Toàn tag đơn, không list → sửa bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 61 —
  `<step id="SplitFieldToRows3">` →
  `org.pentaho.di.trans.steps.splitfieldtorows.SplitFieldToRowsMeta`
  (category Transform). Registry presence không phải XML evidence, evidence
  là serializer dưới đây.
- Serialization: `SplitFieldToRowsMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/splitfieldtorows/SplitFieldToRowsMeta.java`
  dòng 175–187) — đúng 7 tag phẳng theo thứ tự `splitfield`, `delimiter`,
  `newfield`, `rownum` (Y/N), `rownum_field`, `resetrownumber` (Y/N),
  `delimiter_is_regex` (Y/N). Không list, không wrapper.
- Deserialization: `loadXML()` (dòng 130–132) gọi `readData()` (dòng
  134–147) — 3 cờ parse bằng `"Y".equalsIgnoreCase` (thiếu → false, dòng
  139–140, 142); 4 string đọc nguyên văn (thiếu → null, dòng 136–138,
  141).
- Khởi tạo: `setDefault()` (dòng 149–157) — `splitField=""`,
  `delimiter=";"`, `newFieldname=""`, `includeRowNumber=false`,
  `isDelimiterRegex=false`, `rowNumberField=""`, `resetRowNumber=true`
  (cờ Y duy nhất trong default).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: tách `splitfield` thành nhiều dòng, mảnh ghi vào
  `newfield` (String) qua `getFields()` (Meta dòng 159–173: thêm `newfield`
  + optional rownum Integer đã substitute); `check()` (dòng 220–287) đòi
  input chứa `splitfield` (dòng 235–247), `newfield` non-empty (dòng
  269–274), và khi `includeRowNumber` thì `rownum_field` non-empty (dòng
  275–286).

Cấu hình không mặc định (tách tag đơn hàng bằng dấu phẩy + đếm mảnh):

```xml
<splitfield>ORDER_TAGS</splitfield>
<delimiter>,</delimiter>
<newfield>ORDER_TAG</newfield>
<rownum>Y</rownum>
<rownum_field>TAG_NR</rownum_field>
```

## 5. Lưu ý / bẫy — CRITICAL

- **XML ID là `SplitFieldToRows3` (có số 3)**: tên class
  `SplitFieldToRowsMeta` không có số — đừng "sửa" `<type>` thành
  `SplitFieldToRows` (sẽ thành unknown type, catalog cảnh báo).
- **`<resetrownumber>` default Y nhưng thiếu tag load thành N**:
  constructor/setDefault `resetRowNumber=true` (dòng 156) nhưng loader
  Y-check (dòng 140) — template LUÔN pin `<resetrownumber>Y</resetrownumber>`
  显式 trừ khi chủ ý đếm liên tục.
- **XML `resetrownumber` vs repository `reset_rownumber`**: `readRep` dòng
  196 / `saveRep` dòng 210 dùng `reset_rownumber` (có gạch dưới) — XML
  template CHỈ dùng `resetrownumber` (dòng 140/183). Lẫn hai tên khi viết
  tay là lỗi phổ biến.
- **`<newfield>` rỗng = ERROR**: `check()` dòng 269–274 — template phải đặt
  tên field cụ thể, không để self-closing khi đưa vào luồng thật.
- **Output NHIỀU DÒNG cho một dòng vào**: khác FieldSplitter (1 vào → 1
  ra, tách ngang thành nhiều cột). Chọn sai step sẽ vỡ cardinality
  downstream (聚合/sum sau đó tính sai).
- Template mặc định là khung cấu hình — người dùng phải điền field cần tách
  tồn tại trong stream trước và delimiter khớp dữ liệu thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
