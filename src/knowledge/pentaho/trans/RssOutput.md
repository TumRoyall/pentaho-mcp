# RssOutput — Step ghi RSS feed ra file

Ghi các dòng đầu vào thành một file RSS (kênh + items) theo cấu hình
kênh (`channel_*`), item (`item_*`), khối `<file>` (tên file/tách
file) và custom fields/namespaces tùy chọn. Step pass-through về schema
(không override `getFields`); `check()` ERROR khi không có input.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RssOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <displayitem>Y</displayitem>
    <customrss>N</customrss>
    <channel_title>${CHANNEL_TITLE}</channel_title>
    <channel_description>${CHANNEL_DESC}</channel_description>
    <channel_link>${CHANNEL_LINK}</channel_link>
    <channel_pubdate/>
    <channel_copyright/>
    <channel_image_title/>
    <channel_image_link/>
    <channel_image_url/>
    <channel_image_description/>
    <channel_language>en-us</channel_language>
    <channel_author/>
    <version>rss_2.0</version>
    <encoding>iso-8859-1</encoding>
    <addimage>N</addimage>
    <item_title>TITLE_FIELD</item_title>
    <item_description>DESC_FIELD</item_description>
    <item_link>LINK_FIELD</item_link>
    <item_pubdate/>
    <item_author/>
    <addgeorss>N</addgeorss>
    <usegeorssgml>N</usegeorssgml>
    <geopointlat/>
    <geopointlong/>
    <file>
      <filename_field/>
      <name>${RSS_FILE}</name>
      <extention>xml</extention>
      <split>N</split>
      <haspartno>N</haspartno>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <is_filename_in_field>N</is_filename_in_field>
      <create_parent_folder>N</create_parent_folder>
      <addtoresult>N</addtoresult>
    </file>
    <fields>
      <channel_custom_fields>
        <tag>${CHANNEL_TAG}</tag>
        <field>${CHANNEL_FIELD}</field>
      </channel_custom_fields>
      <Item_custom_fields>
        <tag>${ITEM_TAG}</tag>
        <field>${ITEM_FIELD}</field>
      </Item_custom_fields>
    </fields>
    <namespaces>
      <namespace>
        <namespace_tag>${NS_TAG}</namespace_tag>
        <namespace_value>${NS_VALUE}</namespace_value>
      </namespace>
    </namespaces>
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
| `<displayitem>` | N | `Y` (mặc định) = hiển thị item; `N` = chỉ ghi kênh. |
| `<customrss>` | N | `Y` = dùng custom fields; mặc định `N`. |
| `<channel_title>` ... `<channel_author>` | N | Metadata kênh; cho phép `${VAR}`. |
| `<version>` | N | Phiên bản RSS; mặc định `rss_2.0`. |
| `<encoding>` | N | Encoding file; mặc định `iso-8859-1`. |
| `<item_title>` ... `<item_author>` | N | Tên FIELD đầu vào dùng làm thành phần item. |
| `<addgeorss>`/`<usegeorssgml>`/`<geopointlat>`/`<geopointlong>` | N | GeoRSS; `Y` mới dùng kèm field lat/long. |
| `<file>/<name>` | Y | Đường dẫn file output; cho phép `${VAR}`. |
| `<file>/<extention>` | N | Phần mở rộng (giữ đúng chính tả `extention` một `s`). |
| `<file>/<split>` | N | `Y` = tách file theo số dòng. |
| `<file>/<is_filename_in_field>` | N | `Y` = lấy tên file từ field `<filename_field>`. |
| `<file>/<create_parent_folder>` | N | `Y` = tự tạo thư mục cha. |
| `<file>/<addtoresult>` | N | `Y` = thêm file vào result (giữ đúng chữ thường `addtoresult`). |
| `<fields>/<channel_custom_fields>` | N | Cặp `tag`+`field`: tag RSS tùy chỉnh của kênh lấy từ field. |
| `<fields>/<Item_custom_fields>` | N | Cặp `tag`+`field` của item (giữ đúng chữ `I` hoa). |
| `<namespaces>/<namespace>` | N | Cặp `namespace_tag`+`namespace_value` khai báo namespace. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RSS_OUTPUT` | `<type>` | `RssOutput`. |
| `configuration.channel_title` | `<channel_title>` | Cho phép `${VAR}`. |
| `configuration.version` | `<version>` | Mặc định `rss_2.0`. |
| `configuration.encoding` | `<encoding>` | Mặc định `iso-8859-1`. |
| `configuration.item_title_field` | `<item_title>` | Tham chiếu field input. |
| `configuration.filename` | `<file>/<name>` | Cho phép `${VAR}`. |
| `configuration.channel_custom[].tag` | `<fields>/<channel_custom_fields>/<tag>` | Tag tùy chỉnh. |
| `configuration.channel_custom[].field` | `<fields>/<channel_custom_fields>/<field>` | Field nguồn. |
| `configuration.item_custom[].tag` | `<fields>/<Item_custom_fields>/<tag>` | Giữ đúng case `Item_...`. |
| `configuration.namespaces[].tag` | `<namespaces>/<namespace>/<namespace_tag>` | Prefix namespace. |

`<fields>` chứa HAI loại item khác nhau — fill mỗi loại bằng một lần
`set_fields` riêng (`listTag=fields`, `itemTag=channel_custom_fields`
rồi `itemTag=Item_custom_fields`). `<namespaces>` chứa list
`<namespace>` đồng nhất → `set_fields` (`listTag=namespaces`,
`itemTag=namespace`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="RssOutput", ...)`
  (`plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssoutput/RssOutputMeta.java`
  dòng 61–66). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `RssOutputMeta.getXML()` (dòng 757–830) — 25 tag phẳng
  (`displayitem` ... `geopointlong`, booleans Y/N), rồi khối `<file>`
  (`filename_field`, `name`, `extention` — giữ chính tả một `s`,
  `split`, `haspartno`, `add_date`, `add_time`,
  `is_filename_in_field`, `create_parent_folder`, rồi `addtoresult`
  chữ thường nằm trong block `<file>`, dòng 802), rồi `<fields>` chứa
  N×`<channel_custom_fields>` (`tag`+`field`) và
  N×`<Item_custom_fields>` (chữ `I` hoa), rồi `<namespaces>`/N×
  `<namespace>` (`namespace_tag`+`namespace_value`).
- Deserialization: `loadXML()` (dòng 156–158) gọi `readData()` (dòng
  620–701) — booleans `"Y".equalsIgnoreCase` (thiếu → false); khối file
  đọc qua `getTagValue(stepnode,"file",...)` 3 tham số (dòng 655–667);
  **BẪY case**: emit `addtoresult` thường nhưng đọc `AddToResult` hoa
  (lookup phân biệt case → round-trip có thể mất flag); emit
  `Item_custom_fields` hoa nhưng đọc `item_custom_fields` thường (items
  đã ghi có thể không đọc lại được) — template giữ đúng case EMIT.
- Khởi tạo: `setDefault()` (dòng 703–755) — `displayitem=true`,
  `customrss=false`, `version="rss_2.0"`, `encoding="iso-8859-1"`,
  `createparentfolder=false`, `isfilenameinfield=false`; 3 mảng allocate
  rỗng.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: không override `getFields` (pass-through). `check()`
  (dòng 972–1005) ERROR khi không có input hoặc input rỗng.
- Không có `<connection>`: step chỉ ghi file — template không mang tag
  này, fixture test không cần khai báo connection.

Cấu hình không mặc định (GeoRSS + namespace + add to result):

```xml
<version>rss_2.0</version>
<addgeorss>Y</addgeorss>
<usegeorssgml>Y</usegeorssgml>
<geopointlat>LAT_FIELD</geopointlat>
<geopointlong>LON_FIELD</geopointlong>
<file>
  <name>${RSS_FILE}</name>
  <extention>xml</extention>
  <create_parent_folder>Y</create_parent_folder>
  <addtoresult>Y</addtoresult>
</file>
<namespaces>
  <namespace>
    <namespace_tag>georss</namespace_tag>
    <namespace_value>http://www.georss.org/georss</namespace_value>
  </namespace>
</namespaces>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Giữ đúng 3 chính tả lạ**: `extention` (một `s`), `addtoresult`
  (thường, trong `<file>`), `Item_custom_fields` (I hoa) — sửa "đúng
  chính tả" là hỏng round-trip.
- **Case-mismatch đọc/ghi đã biết**: `AddToResult`/`item_custom_fields`
  khi đọc khác case khi ghi — sau khi Spoon lưu/mở lại, kiểm tra lại 2
  nhóm này thay vì tin mù.
- **Booleans thiếu tag → false** (trừ `displayitem` mặc định true ở
  `setDefault` cho component MỚI — khác với fallback load).
- **Bắt buộc có input**: `item_*` là tên field của stream trước — step
  đứng một mình fail `check()`.
- Template mặc định là khung cấu hình — người dùng phải điền kênh/file
  và field item tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
