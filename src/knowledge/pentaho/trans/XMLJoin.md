# XMLJoin — Step trộn фрагмент XML từ 2 luồng

Trộn (join) các фрагмент XML của luồng nguồn vào tài liệu XML của luồng
đích tại vị trí `<targetXPath>`: đọc trường XML của 2 step đầu vào
(`<targetXMLstep>`/`<targetXMLfield>`, `<sourceXMLstep>`/`<sourceXMLfield>`)
và phát tài liệu đã trộn vào trường mới (`<valueXMLfield>`). Step yêu cầu
CẢ 2 step nguồn nối hop vào (`check()` ERROR khi thiếu bên nào) — đây là
step 2-input, tham chiếu step theo tên.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XMLJoin</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <valueXMLField>{{OUTPUT_FIELD}}</valueXMLField>
    <targetXMLstep>{{TARGET_STEP}}</targetXMLstep>
    <targetXMLfield>{{TARGET_FIELD}}</targetXMLfield>
    <sourceXMLstep>{{SOURCE_STEP}}</sourceXMLstep>
    <sourceXMLfield>{{SOURCE_FIELD}}</sourceXMLfield>
    <complexJoin>N</complexJoin>
    <joinCompareField/>
    <targetXPath>{{TARGET_XPATH}}</targetXPath>
    <encoding>UTF-8</encoding>
    <omitXMLHeader>Y</omitXMLHeader>
    <omitNullValues>N</omitNullValues>
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
| `<valueXMLField>` | Y | Tên trường mới chứa tài liệu XML đã trộn (`check()` ERROR khi rỗng). |
| `<targetXMLstep>` | Y | Tên STEP cung cấp tài liệu XML đích — phải nối hop vào. |
| `<targetXMLfield>` | Y | Tên trường trong step đích chứa XML đích. |
| `<sourceXMLstep>` | Y | Tên STEP cung cấp фрагмент XML nguồn — phải nối hop vào. |
| `<sourceXMLfield>` | Y | Tên trường trong step nguồn chứa фрагмент cần trộn. |
| `<complexJoin>` | N | `Y` = join phức hợp (dùng `<joinCompareField>` so sánh); `N` (mặc định). |
| `<joinCompareField>` | Điều kiện | Trường so sánh khi `complexJoin=Y`. |
| `<targetXPath>` | Y | XPath trong tài liệu đích nơi chèn фрагмент nguồn (`check()` ERROR khi rỗng). |
| `<encoding>` | N | Encoding; mặc định step mới là `UTF-8`. |
| `<omitXMLHeader>` | N | `Y` = bỏ `<?xml?>`; `N` (mặc định). |
| `<omitNullValues>` | N | `Y` = bỏ giá trị null; `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XML_JOIN` | `<type>` | `XMLJoin`. |
| `configuration.output_field` | `<valueXMLField>` | Trường kết quả (chú ý F hoa). |
| `configuration.target_step/target_field` | `<targetXMLstep>`/`<targetXMLfield>` | Tham chiếu step — cần hop. |
| `configuration.source_step/source_field` | `<sourceXMLstep>`/`<sourceXMLfield>` | Tham chiếu step — cần hop. |
| `configuration.complex_join` | `<complexJoin>` | Boolean → Y/N. |
| `configuration.target_xpath` | `<targetXPath>` | Vị trí chèn. |

Toàn scalar, không có list — mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "XMLJoin", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmljoin/XMLJoinMeta.java`
  dòng 63–65, category `XMLJoin.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin XML) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `XMLJoinMeta.getXML()`
  (`.../xmljoin/XMLJoinMeta.java` dòng 185–201) — 11 scalar theo thứ tự:
  `valueXMLField` (F hoa, dòng 188), `targetXMLstep`, `targetXMLfield`,
  `sourceXMLstep`, `sourceXMLfield`, `complexJoin` (Y/N), `joinCompareField`,
  `targetXPath`, `encoding`, `omitXMLHeader`, `omitNullValues`. Không có
  list, không có tag nào khác.
- Deserialization: `loadXML()` (dòng 120–122) gọi `readData()` (dòng
  129–146) — đọc `valueXMLfield` (f thường, dòng 131) trong khi `getXML()`
  ghi `valueXMLField` (F hoa): VÔ HẠI vì `XMLHandler.getTagValue()` so
  sánh tên tag bằng `equalsIgnoreCase`
  (`core/.../xml/XMLHandler.java` dòng 153). Mọi cờ Y/N thiếu tag → false.
- Khởi tạo: `setDefault()` (dòng 148–151) — CHỈ đặt
  `encoding = "UTF-8"`; mọi tham chiếu step/field giữ null, cờ giữ false.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 153–183) thêm MỘT trường
  `String` tên `valueXMLfield` và LOẠI các trường chỉ thuộc luồng nguồn
  (dòng 171–177) — output = trường đích + kết quả trộn. `check()` (dòng
  242–354) ERROR khi thiếu bất kỳ tham chiếu nào và khi `targetXMLstep` /
  `sourceXMLstep` không có trong input (dòng 316–353) — CẢ 2 step phải nối
  hop vào.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (complex join theo mã đơn):

```xml
<valueXMLField>ORDER_FULL</valueXMLField>
<targetXMLstep>Orders XML</targetXMLstep>
<targetXMLfield>ORDER_DOC</targetXMLfield>
<sourceXMLstep>Lines XML</sourceXMLstep>
<sourceXMLfield>LINE_FRAG</sourceXMLfield>
<complexJoin>Y</complexJoin>
<joinCompareField>ORDER_ID</joinCompareField>
<targetXPath>/order/lines</targetXPath>
<encoding>UTF-8</encoding>
<omitXMLHeader>Y</omitXMLHeader>
<omitNullValues>N</omitNullValues>
```

Đổi bằng `set_field_path` từng scalar.

## 5. Lưu ý / bẫy — CRITICAL

- **Cần 2 hop vào**: `targetXMLstep` và `sourceXMLstep` đều phải là step có
  hop tới XMLJoin (`check()` dòng 316–353) — template chỉ khai báo TÊN;
  người dùng phải vẽ đủ 2 hop và điền tên step khớp tuyệt đối.
- **Case tag `valueXMLField`**: `getXML()` ghi F hoa (dòng 188),
  `readData()` đọc f thường (dòng 131) — nhờ match case-insensitive nên
  round-trip an toàn; template giữ đúng spelling của `getXML()`.
- **Y/N chứ không phải true/false**: mọi cờ parse bằng
  `"Y".equalsIgnoreCase(...)` — ghi `true` load thành false lặng lẽ.
- **Tĩnh vs động**: `targetXPath` là XPath TĨNH trong tài liệu đích; trường
  so sánh động chỉ dùng khi `complexJoin=Y`.
- Template mặc định là khung cấu hình — step mới (`setDefault()`) để trống
  mọi tham chiếu; phải điền đủ 2 step + 2 trường + XPath mới chạy được.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
