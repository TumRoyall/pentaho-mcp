# RssInput — Step đọc RSS feed

Đọc một hoặc nhiều RSS feed (URL tĩnh trong `<urls>` hoặc URL động từ
field `<url_field_name>` khi `url_in_field=Y`) và phát mỗi item thành một
dòng. Cột output do người dùng khai báo qua list `<fields>/<field>`,
mỗi field trích một thành phần RSS (`<column>` code: title, link,
descriptiontext, ...). Có cột URL nguồn và rownum tùy chọn.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RssInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <url_in_field>N</url_in_field>
    <url_field_name/>
    <rownum>N</rownum>
    <rownum_field/>
    <include_url>N</include_url>
    <url_Field/>
    <read_from>0</read_from>
    <urls>
      <url>${RSS_URL}</url>
    </urls>
    <fields>
      <field>
        <name>TITLE</name>
        <column>title</column>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>Y</repeat>
      </field>
    </fields>
    <limit>0</limit>
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
| `<url_in_field>` | N | `Y` = lấy URL từ field `<url_field_name>` của stream trước; `N` (mặc định) = dùng list `<urls>` tĩnh. |
| `<url_field_name>` | Y khi `url_in_field=Y` | Tên field chứa URL trong dòng đầu vào. |
| `<rownum>` | N | `Y` = thêm cột số thứ tự tên `<rownum_field>`. |
| `<rownum_field>` | Y khi `rownum=Y` | Tên cột số thứ tự. |
| `<include_url>` | N | `Y` = thêm cột URL nguồn tên `<url_Field>` (giữ đúng chữ F hoa!). |
| `<url_Field>` | Y khi `include_url=Y` | Tên cột URL nguồn — tag có chữ `F` hoa, không phải `url_field`. |
| `<urls>/<url>` | Y khi `url_in_field=N` | Mỗi `<url>` là một feed tĩnh; cho phép `${VAR}`. |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên cột output. |
| `<fields>/<field>/<column>` | Y | Code thành phần RSS: `title`, `link`, `descriptiontext`, `descriptionhtml`, `comments`, `guid`, `pubdate`. Lạ/null → `title`. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG TÊN CHUỖI. |
| `<fields>/<field>/<repeat>` | N | `Y` (mặc định) = lặp giá trị; `N` = không lặp. |
| `<limit>` | N | Giới hạn số dòng (long); `0` (mặc định) = không giới hạn. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RSS_INPUT` | `<type>` | `RssInput`. |
| `configuration.url_in_field` | `<url_in_field>` | Boolean → Y/N. |
| `configuration.url_field` | `<url_field_name>` | Tham chiếu field khi động. |
| `configuration.include_url` | `<include_url>` | Boolean → Y/N. |
| `configuration.url_output_field` | `<url_Field>` | Giữ đúng case `url_Field`. |
| `configuration.urls[]` | `<urls>/<url>` | Mỗi URL một tag `<url>`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Tên cột. |
| `configuration.fields[].column` | `<fields>/<field>/<column>` | Code thành phần RSS. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |
| `configuration.row_limit` | `<limit>` | Số; `0` = ALL. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`). List `<urls>/<url>` là
các text items — set từng URL bằng `setFieldPath`, không dùng
`set_fields` cho list này.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="RssInput", ...)`
  (`plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssinput/RssInputMeta.java`
  dòng 55–60). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `RssInputMeta.getXML()` (dòng 263–286) — đúng thứ tự
  `url_in_field` (Y/N), `url_field_name`, `rownum` (Y/N), `rownum_field`,
  `include_url` (Y/N), `url_Field` (giữ chữ F hoa!), `read_from`,
  `<urls>`/N×`<url>`, `<fields>`/N×`<field>`, `limit` (long). Thứ tự con
  mỗi `<field>` do `RssInputField.getXML()` (`RssInputField.java` dòng
  105–124): `name`, `column` (code), `type` (tên), `format`, `currency`,
  `decimal`, `group`, `length` (int), `precision` (int), `trim_type`
  (code), `repeat` (Y/N).
- Deserialization: `loadXML()` (dòng 242–244) gọi `readData()` (dòng
  288–319) — 3 boolean `"Y".equalsIgnoreCase` (thiếu → false);
  `rowLimit=Const.toLong(..., 0L)` (thiếu → 0, dòng 315); **BẪY**:
  `repeat` parse NGƯỢC — `!"N".equalsIgnoreCase(...)` nên thiếu/rỗng =
  **true** (không phải false như các boolean khác).
- Khởi tạo: `setDefault()` (dòng 326–350) — mọi flag false, strings
  `""`, `allocate(0,0)`, `rowLimit=0`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 352–387) — mỗi input field
  (`TYPE_NONE` → STRING), rồi append String(100) `urlField` (khi
  `includeUrl`) và Integer `rowNumberField` (khi `includeRowNumber`).
  `check()` (dòng 479–510): `urlInField` → đòi `urlFieldname`, ngược lại
  đòi `url.length>0`.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (URL động + 2 cột + giới hạn):

```xml
<url_in_field>Y</url_in_field>
<url_field_name>FEED_URL</url_field_name>
<include_url>Y</include_url>
<url_Field>SRC_URL</url_Field>
<fields>
  <field>
    <name>ITEM_TITLE</name>
    <column>title</column>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>255</length>
    <precision>-1</precision>
    <trim_type>both</trim_type>
    <repeat>Y</repeat>
  </field>
  <field>
    <name>PUB_DATE</name>
    <column>pubdate</column>
    <type>Date</type>
    <format>yyyy-MM-dd</format>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
<limit>100</limit>
```

Fill fields bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<url_Field>` chữ F hoa**: tag output URL viết `url_Field`, khác
  `url_field_name` — nhầm case là mất cấu hình lặng lẽ.
- **`<repeat>` thiếu = true**: ngược với mọi boolean khác (thiếu = false)
  — luôn emit `<repeat>` tường minh, đừng lược.
- **`<column>` lạ → `title`**: code không khớp lặng lẽ thành `title`
  (`getColumnByCode`), không báo lỗi — kiểm tra chính tả code.
- **`<type>` là tên chuỗi**, `<limit>` là long (`0` = không giới hạn).
- **Chế độ URL động cần hop**: `url_in_field=Y` đòi field tồn tại trong
  stream trước.
- Template mặc định là khung cấu hình — người dùng phải điền URL feed có
  thật; cần network lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
