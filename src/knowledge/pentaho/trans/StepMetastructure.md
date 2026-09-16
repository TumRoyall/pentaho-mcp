# StepMetastructure — Step xuất cấu trúc field của luồng

Đọc metadata của luồng đầu vào và phát MỖI FIELD thành MỘT DÒNG mô tả
(7 cột cố định: position Integer, fieldName/comments/type/length/
precision/origin + length/precision Integer). `getFields()` XÓA row cũ
(`r.clear()`), reset display-names qua `setDefault()`, rồi dựng lại 7
cột + cột rowcount Integer tùy chọn (`outputRowcount=Y` +
`<rowcountField>`). Chỉ có 2 tag cấu hình được serialize — 7 display
name KHÔNG có trong XML (đừng bịa).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>StepMetastructure</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <outputRowcount>N</outputRowcount>
    <rowcountField/>
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
| `<outputRowcount>` | N | `Y` = thêm cột đếm dòng tên `<rowcountField>`; `N` (mặc định). |
| `<rowcountField>` | Y khi `outputRowcount=Y` | Tên cột rowcount (Integer). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: STEP_METASTRUCTURE` | `<type>` | `StepMetastructure`. |
| `configuration.output_row_count` | `<outputRowcount>` | Boolean → Y/N (giữ đúng camelCase `R` hoa). |
| `configuration.row_count_field` | `<rowcountField>` | Tên cột rowcount. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 66 —
  `<step id="StepMetastructure">` →
  `org.pentaho.di.trans.steps.stepmeta.StepMetastructureMeta` (category
  Utility). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `StepMetastructureMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/stepmeta/StepMetastructureMeta.java`
  dòng 78–86) — CHỈ 2 tag `outputRowcount` (Y/N) và `rowcountField`
  (string). 7 display-name fields KHÔNG serialize — template không bịa
  chúng.
- Deserialization: `readData()` (dòng 88–95) — `outputRowcount` Y-parse
  (thiếu → false); `rowcountField=getTagValue` (thiếu → null).
- Khởi tạo: `setDefault()` (dòng 188–197) — chỉ set 7 i18n display names
  (`PositionName/FieldName/Comments/TypeName/LengthName/PrecisionName/
  OriginName`); `outputRowcount`/`rowcountField` giữ Java default
  (false/null) — component mới KHÔNG có rowcount.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 142–185) — `r.clear()` + gọi
  `setDefault()` MỖI lần (reset names) rồi add 7 cột (position:Integer,
  fieldName:String, comments:String, type:String, length:Integer,
  precision:Integer, origin:String) + Integer `rowcountField` khi
  `outputRowcount`. `check()` (dòng 131–139) luôn OK ("Not implemented").
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (kèm cột rowcount):

```xml
<outputRowcount>Y</outputRowcount>
<rowcountField>FIELD_COUNT</rowcountField>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Chỉ 2 tag serialize** — mọi tag mô tả cột (fieldName, typeName, ...)
  trong file lạ đều không phải của step này (display names là i18n trong
  code).
- **`getFields()` nuốt input**: output CHỈ có 7 (+1) cột mô tả — mọi cột
  gốc biến mất. Đừng đặt step này giữa luồng nghiệp vụ mong giữ dữ liệu.
- **Component mới không có rowcount** (`setDefault` không set) — muốn
  đếm field phải bật `outputRowcount` + đặt tên cột.
- Template mặc định là khung cấu hình — cần input stream có fields lúc
  runtime mới phát được dòng mô tả.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
