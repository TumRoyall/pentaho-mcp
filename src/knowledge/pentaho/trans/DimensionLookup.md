# DimensionLookup — Step tra cứu / cập nhật dimension SCD

Tra cứu khóa tự nhiên trong bảng dimension theo khoảng ngày hiệu lực
(`date_from` → `date_to`) rồi trả về technical key (surrogate key). Ở chế
độ update (`<update>Y</update>`) step còn ghi SCD vào dimension: mỗi field
khai báo một kiểu update riêng (`Insert` = mở version mới kiểu Kimball
Type II, `Update` = ghi đè, `Punch through`, các kiểu ngày,
`LastVersion`). Ở chế độ lookup (`<update>N</update>`) step chỉ đọc, và
`<field>/<update>` lúc này là TÊN kiểu value-meta (`String`, `Integer`,
...) chứ không phải mã update.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DimensionLookup</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <schema>${SCHEMA}</schema>
    <table>${TABLE}</table>
    <connection>${CONN}</connection>
    <commit>100</commit>
    <update>Y</update>
    <fields>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <lookup>{{KEY_DIM_FIELD}}</lookup>
      </key>
      <date>
        <name>{{DATE_STREAM_FIELD}}</name>
        <from>date_from</from>
        <to>date_to</to>
      </date>
      <field>
        <name>{{ATTR_STREAM_FIELD}}</name>
        <lookup>{{ATTR_DIM_FIELD}}</lookup>
        <update>Insert</update>
      </field>
      <return>
        <name>{{TK_FIELD}}</name>
        <rename>{{TK_RENAME}}</rename>
        <creation_method>tablemax</creation_method>
        <use_autoinc>N</use_autoinc>
        <version>version</version>
      </return>
    </fields>
    <sequence/>
    <min_year>1900</min_year>
    <max_year>2199</max_year>
    <cache_size>5000</cache_size>
    <preload_cache>N</preload_cache>
    <use_start_date_alternative>N</use_start_date_alternative>
    <start_date_alternative>none</start_date_alternative>
    <start_date_field_name/>
    <useBatch>N</useBatch>
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
| `<schema>` | N | Schema chứa bảng dimension (tên tag là `schema`, KHÔNG phải `schemaname`). |
| `<table>` | Y | Tên bảng dimension (tên tag là `table`, KHÔNG phải `tablename`). |
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `check()` báo ERROR khi null; `getUsedDatabaseConnections()` trả connection này. |
| `<commit>` | N | Số dòng giữa các commit khi update; mặc định step mới: `100`. Load thiếu tag → `0` (`Const.toInt`, KHÔNG phải 100). |
| `<update>` | Y — LUÔN phải có | `Y` = cập nhật dimension (SCD write); `N` = chỉ lookup. `readData()` gọi `upd.equalsIgnoreCase("Y")` KHÔNG null-guard — thiếu tag NÉM NPE. |
| `<fields>/<key>/<name>` | Y (mỗi key) | Tên field KHÓA TỰ NHIÊN trong stream đầu vào. |
| `<fields>/<key>/<lookup>` | Y (mỗi key) | Tên cột tương ứng trong bảng dimension. |
| `<fields>/<date>/<name>` | N | Field ngày trong stream dùng tra cứu theo khoảng hiệu lực; để trống = dùng system date. |
| `<fields>/<date>/<from>` + `<to>` | Y | Cột biên khoảng hiệu lực trong dimension (mặc định step mới: `date_from` / `date_to`). |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field thuộc tính trong stream. |
| `<fields>/<field>/<lookup>` | Y (mỗi field) | Tên cột thuộc tính trong dimension. |
| `<fields>/<field>/<update>` | Y (mỗi field) | Chế độ update=Y: một trong `Insert`, `Update`, `Punch through`, `DateInsertedOrUpdated`, `DateInserted`, `DateUpdated`, `LastVersion`. Chế độ update=N: TÊN kiểu value-meta (`String`, `Integer`, ...). KHÔNG phải Y/N, KHÔNG phải số. |
| `<fields>/<return>/<name>` | Y | Tên cột technical key (surrogate key) trong dimension. `getFields()` NÉM lỗi khi rỗng. |
| `<fields>/<return>/<rename>` | N | Tên mới của technical key trên stream ra; để trống = giữ tên gốc. |
| `<fields>/<return>/<creation_method>` | N | Cách sinh technical key: `autoinc`, `sequence`, `tablemax`. Rỗng = table-max + 1. `check()` ERROR khi có giá trị lạ. |
| `<fields>/<return>/<use_autoinc>` | N | `Y` = dùng auto-increment của DB. Mặc định step mới: `N`. BẪY: load thiếu tag → **true** (`!"N".equalsIgnoreCase(...)`, không phải false) — template LUÔN pin tag này. |
| `<fields>/<return>/<version>` | N | Cột version SCD (mặc định step mới: `version`). |
| `<sequence>` | N (chỉ khi update=Y + creation_method=sequence) | Tên sequence sinh key. Chỉ được ĐỌC khi update=Y; chế độ lookup bỏ qua lặng lẽ. |
| `<min_year>` / `<max_year>` | N | Biên khoảng ngày vô cực (mặc định step mới: `1900` / `2199` = `Const.MIN_YEAR` / `Const.MAX_YEAR`). Load thiếu tag → cùng giá trị này. |
| `<cache_size>` | N | Số dòng cache (`0` = cache all, `-1` = không set). Mặc định step mới: `5000`. Load thiếu tag → `-1`. |
| `<preload_cache>` | N | `Y` = preload cache; mặc định `N` (thiếu tag → false). |
| `<use_start_date_alternative>` | N | `Y` = dùng ngày bắt đầu thay thế; mặc định `N`. |
| `<start_date_alternative>` | N | Mã chuỗi: `none`, `sysdate`, `trans_start`, `null`, `column_value`. Giá trị lạ/thiếu → `none`. |
| `<start_date_field_name>` | N (chỉ khi alternative=`column_value`) | Tên field chứa ngày bắt đầu thay thế. |
| `<useBatch>` | N | `Y` = batch update; mặc định `N` (thiếu tag → false). Chú ý chữ B hoa. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DIMENSION_LOOKUP` | `<type>` | `DimensionLookup`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` | `<schema>` | Tag `schema`, không phải `schemaname`. |
| `configuration.table` | `<table>` | Tag `table`, không phải `tablename`. |
| `configuration.commit` | `<commit>` | Số; mặc định mới `100`. |
| `configuration.update_dimension` | `<update>` | Boolean → Y/N. BẮT BUỘC có mặt. |
| `configuration.keys[].stream` | `<fields>/<key>/<name>` | Khóa tự nhiên phía stream. |
| `configuration.keys[].lookup` | `<fields>/<key>/<lookup>` | Cột dimension. |
| `configuration.date_field` | `<fields>/<date>/<name>` | Trống = system date. |
| `configuration.date_from` / `date_to` | `<fields>/<date>/<from>` / `<to>` | Biên khoảng hiệu lực. |
| `configuration.fields[].stream` | `<fields>/<field>/<name>` | Thuộc tính phía stream. |
| `configuration.fields[].lookup` | `<fields>/<field>/<lookup>` | Cột dimension. |
| `configuration.fields[].update_type` | `<fields>/<field>/<update>` | Mã update (chế độ update) hoặc tên kiểu value-meta (chế độ lookup). |
| `configuration.technical_key` | `<fields>/<return>/<name>` | Bắt buộc (runtime ném lỗi khi rỗng). |
| `configuration.technical_key_rename` | `<fields>/<return>/<rename>` |  |
| `configuration.key_creation` | `<fields>/<return>/<creation_method>` | `autoinc` / `sequence` / `tablemax` / rỗng. |
| `configuration.sequence` | `<sequence>` | Chỉ đọc khi update=Y. |

`<fields>` chứa HAI list lặp (`<key>`, `<field>`) cộng hai block đơn
(`<date>`, `<return>`) → fill mỗi list bằng MỘT lần `set_fields`
riêng (`listTag=fields`, `itemTag=key` / `field`); block đơn sửa bằng
`set_field_path` (`fields/return/name`, `fields/date/from`, ...).
`<fields>` LUÔN paired kể cả 0 key/0 field — self-closing
`<fields/>` làm `setFields` từ chối và loader NPE.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 25 —
  `<step id="DimensionLookup">` →
  `org.pentaho.di.trans.steps.dimensionlookup.DimensionLookupMeta`
  (category DataWarehouse). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `DimensionLookupMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/dimensionlookup/DimensionLookupMeta.java`
  dòng 832–893) — thứ tự `schema`, `table`, `connection` (tên
  `DatabaseMeta`, `""` khi null), `commit` (int), `update` (Y/N), rồi
  wrapper `<fields>` LUÔN emit (dòng 843/876) chứa các `<key>` (`name` +
  `lookup`, dòng 844–849), đúng MỘT `<date>` (`name`/`from`/`to`, dòng
  851–855), các `<field>` (`name` + `lookup` + `update` qua
  `getUpdateTypeCode`, dòng 857–866), MỘT `<return>` (`name`, `rename`,
  `creation_method`, `use_autoinc`, `version`, dòng 868–874); sau
  `</fields>` là `sequence`, `min_year`, `max_year`, `cache_size`,
  `preload_cache`, `use_start_date_alternative`,
  `start_date_alternative` (mã code), `start_date_field_name`,
  `useBatch`. Không có tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 580–582) gọi `readData()` (dòng
  896–974) — `commit` qua `Const.toInt(..., 0)` (thiếu tag → 0, dòng
  907); `update` parse bằng `upd.equalsIgnoreCase("Y")` KHÔNG
  null-guard (thiếu tag → NPE bọc thành `KettleXMLException`, dòng
  909–914); list đếm từ sub-node `<fields>` (dòng 916–919);
  `<sequence>` chỉ đọc khi update=Y (dòng 947–950);
  `min_year`/`max_year` fallback `Const.MIN_YEAR`/`MAX_YEAR`
  (1900/2199, dòng 952–953); `use_autoinc` parse đảo
  `!"N".equalsIgnoreCase(...)` (thiếu tag → true, dòng 957); 3 cờ
  `preload_cache`/`useBatch`/`use_start_date_alternative` parse bằng
  `"Y".equalsIgnoreCase` (thiếu tag → false, dòng 963–967);
  `start_date_alternative` lạ/thiếu → `none` (dòng 657–669);
  `cache_size` thiếu → `-1` (dòng 962).
- Mã update: `getUpdateType(boolean, String)` (dòng 614–639) — chế độ
  update khớp `typeCodes` (`Insert`, `Update`, `Punch through`,
  `DateInsertedOrUpdated`, `DateInserted`, `DateUpdated`,
  `LastVersion`, dòng 104–105), tương thích ngược `typeDesc` (dòng
  621–626), `"Y"` → punch-through (dòng 627–629), còn lại về `Insert`
  (dòng 631); chế độ lookup map về value-meta id, `NONE` → `STRING`
  (dòng 633–637). Vì vậy `<field>/<update>` là CHUỖI, không bao giờ là
  số hay Y/N.
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 704–746) đặt
  `schema=""`, `commitSize=100`, `update=true`, 0 key/0 field,
  `dateField=""`, `dateFrom="date_from"`, `dateTo="date_to"`,
  `minYear=1900`, `maxYear=2199`, `keyField=""`, `keyRename=""`,
  `autoIncrement=false`, `versionField="version"`, `cacheSize=5000`,
  `preloadingCache=false`. `sequenceName`/`techKeyCreation`/
  `startDateFieldName` không set (null); `useBatchUpdate`/
  `usingStartDateAlternative` false; `startDateAlternative` 0 (`none`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 749–829) chuẩn hóa
  storage/trim, NÉM `KettleStepException` khi `keyField` rỗng (dòng
  766–772), thêm đúng MỘT cột `ValueMetaInteger` technical key (length
  9, đổi tên theo `keyRename`, dòng 774–782); chế độ lookup append thêm
  các return field đọc kiểu từ bảng DB thật (dòng 786–828).
  `getUsedDatabaseConnections()` (dòng 1794–1800) trả connection đã
  chọn — lineage thấy step này dùng DB. `check()` đòi technical key,
  version field, biên date và có input (dòng 1124–1157).
- Chưa đọc runtime `DimensionLookup.java` ở mức statement — mô tả thứ
  tự version/date-range ở đây dựa trên Meta + tên field, giữ mức
  `source_reviewed`.

Cấu hình không mặc định (SCD Type II: 1 key + 2 field Insert/Update +
return tablemax):

```xml
<fields>
  <key>
    <name>CUST_CODE</name>
    <lookup>cust_code</lookup>
  </key>
  <date>
    <name>ORDER_DATE</name>
    <from>date_from</from>
    <to>date_to</to>
  </date>
  <field>
    <name>CUST_NAME</name>
    <lookup>cust_name</lookup>
    <update>Insert</update>
  </field>
  <field>
    <name>CUST_SEGMENT</name>
    <lookup>cust_segment</lookup>
    <update>Update</update>
  </field>
  <return>
    <name>customer_sk</name>
    <rename>CUSTOMER_SK</rename>
    <creation_method>tablemax</creation_method>
    <use_autoinc>N</use_autoinc>
    <version>version</version>
  </return>
</fields>
```

Fill list bằng `set_fields` (`listTag=fields`, `itemTag=key` /
`field`); block `<date>`/`<return>` sửa bằng `set_field_path`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<update>` (cấp step) bắt buộc**: thiếu tag → NPE khi load (dòng
  910). Không bao giờ lược `<update>` dù các tag khác có default.
- **`<schema>`/`<table>`, KHÔNG phải `<schemaname>`/`<tablename>`**:
  bịa hai tag sau sẽ bị loader bỏ qua lặng lẽ (không đọc trong
  `readData()`).
- **`<field>/<update>` là mã chuỗi theo chế độ**: update=Y thì
  `Insert`/`Update`/`Punch through`/…; update=N thì tên kiểu value-meta
  (`String`, `Integer`). Ghi Y/N hay số id kiểu đều sai — loader map
  sai lặng lẽ (về `Insert` hoặc `STRING`).
- **`<use_autoinc>` đảo default khi load**: step mới là `N`
  (`setDefault`), nhưng file thiếu tag load thành true — template LUÔN
  pin `<use_autoinc>N</use_autoinc>` (hoặc `Y` có chủ ý).
- **`<sequence>` chỉ có nghĩa khi update=Y**: chế độ lookup đọc bỏ qua
  tag này — đặt sequence mà để update=N thì sequence không được dùng.
- **`<start_date_alternative>` là mã code** (`none`, `sysdate`,
  `trans_start`, `null`, `column_value`), không phải nhãn hiển thị —
  ghi nhãn i18n sẽ rơi về `none`.
- **`<useBatch>` chữ B hoa**: sai thành `<usebatch>`/`<use_batch>` sẽ
  bị loader bỏ qua (luôn false).
- **Technical key rỗng = fail runtime**: `getFields()` ném lỗi khi
  `<return>/<name>` rỗng — template phải có tên cột key cụ thể.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  có thật, bảng dimension tồn tại, key/field stream khớp hop đầu vào và
  chọn `creation_method` phù hợp DB (sequence chỉ khi DB hỗ trợ);
  credential không bao giờ nằm trong XML này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
