# CombinationLookup — Step tra cứu / sinh surrogate key (junk/combination dimension)

Với MỖI dòng đầu vào, tra tổ hợp các key field trong bảng dimension
(`<key>/<name>` stream ↔ `<key>/<lookup>` cột bảng); tìm thấy thì trả
technical key, chưa có thì INSERT một dòng dimension mới rồi trả key vừa
sinh. Khác `DimensionLookup`, step này KHÔNG có version/date-range:
một tổ hợp key ↔ một surrogate key duy nhất (phù hợp junk dimension,
combination/box dimension). Tùy chọn băm CRC (`<crc>Y</crc>`) để lookup
trên một cột hash thay vì toàn bộ key, và field cập nhật lần cuối
(`<last_update_field>`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CombinationLookup</type>
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
    <cache_size>9999</cache_size>
    <replace>N</replace>
    <preloadCache>N</preloadCache>
    <crc>N</crc>
    <crcfield>hashcode</crcfield>
    <fields>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <lookup>{{KEY_DIM_FIELD}}</lookup>
      </key>
      <return>
        <name>{{TK_FIELD}}</name>
        <creation_method>tablemax</creation_method>
        <use_autoinc>N</use_autoinc>
      </return>
    </fields>
    <sequence/>
    <last_update_field/>
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
| `<schema>` | N | Schema chứa bảng dimension. |
| `<table>` | Y | Tên bảng dimension (tag `table`, không phải `tablename`). |
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `check()` báo ERROR khi null; `getUsedDatabaseConnections()` trả connection này. |
| `<commit>` | N | Số dòng giữa các commit insert; mặc định step mới: `100`. Load thiếu tag → `0` (`Const.toInt`, KHÔNG phải 100). |
| `<cache_size>` | N | Giới hạn cache; mặc định step mới: `9999` (`DEFAULT_CACHE_SIZE`). Load thiếu tag → `0`. |
| `<replace>` | N | `Y` = thay các key field bằng technical key trên stream ra (xóa key gốc khỏi row). Mặc định `N` (thiếu tag → false). |
| `<preloadCache>` | N | `Y` = preload cache; mặc định `N`. Chú ý camelCase `preloadCache`. |
| `<crc>` | N | `Y` = dùng checksum/hash để giới hạn kích thước index, lookup trên cột hash. Mặc định `N`. |
| `<crcfield>` | N (bắt buộc khi crc=Y) | Tên cột hash trong dimension (mặc định step mới: `hashcode`). crc=Y mà thiếu/để trống → `getSQLStatements()` báo lỗi `NotHashFieldSpecified`. |
| `<fields>/<key>/<name>` | Y (mỗi key) | Tên key field trong stream đầu vào. |
| `<fields>/<key>/<lookup>` | Y (mỗi key) | Tên cột tương ứng trong bảng dimension. |
| `<fields>/<return>/<name>` | Y | Tên cột technical key trong dimension. `check()` ERROR khi cột này không có trong bảng. |
| `<fields>/<return>/<creation_method>` | N | `autoinc` / `sequence` / `tablemax`. Rỗng = table-max + 1. `check()` ERROR khi có giá trị lạ. |
| `<fields>/<return>/<use_autoinc>` | N | `Y` = dùng auto-increment của DB. Mặc định step mới: `N`. BẪY: load thiếu tag → **true** (`!"N".equalsIgnoreCase(...)`) — template LUÔN pin tag này. |
| `<sequence>` | N (chỉ khi creation_method=sequence) | Tên sequence sinh key. |
| `<last_update_field>` | N | Cột ngày giờ cập nhật lần cuối (kiểu Date, optional). Nằm TRỰC TIẾP dưới `<step>`, KHÔNG nằm trong `<fields>/<return>`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: COMBINATION_LOOKUP` | `<type>` | `CombinationLookup`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` | `<schema>` |  |
| `configuration.table` | `<table>` | Tag `table`. |
| `configuration.commit` | `<commit>` | Số; mặc định mới `100`. |
| `configuration.cache_size` | `<cache_size>` | Số; mặc định mới `9999`. |
| `configuration.replace_fields` | `<replace>` | Boolean → Y/N. |
| `configuration.preload_cache` | `<preloadCache>` | Boolean → Y/N, giữ camelCase. |
| `configuration.use_hash` | `<crc>` | Boolean → Y/N. |
| `configuration.hash_field` | `<crcfield>` | Bắt buộc khi dùng hash. |
| `configuration.keys[].stream` | `<fields>/<key>/<name>` | Key phía stream. |
| `configuration.keys[].lookup` | `<fields>/<key>/<lookup>` | Cột dimension. |
| `configuration.technical_key` | `<fields>/<return>/<name>` |  |
| `configuration.key_creation` | `<fields>/<return>/<creation_method>` | `autoinc` / `sequence` / `tablemax` / rỗng. |
| `configuration.sequence` | `<sequence>` |  |
| `configuration.last_update_field` | `<last_update_field>` | Direct-child của `<step>`. |

`<fields>` chứa MỘT list lặp (`<key>`) + block đơn (`<return>`) →
fill list bằng MỘT lần `set_fields` (`listTag=fields`,
`itemTag=key`); `<return>` sửa bằng `set_field_path`
(`fields/return/name`, `fields/return/creation_method`, ...).
`<fields>` LUÔN paired kể cả 0 key — self-closing `<fields/>` làm
`setFields` từ chối và loader NPE.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step` (dòng 73–75 trong
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/combinationlookup/CombinationLookupMeta.java`)
  — `id = "CombinationLookup"`, category DataWarehouse. Step này
  KHÔNG có trong `engine/src/main/resources/kettle-steps.xml`
  (registry ở đây là evidence annotation, không phải XML evidence;
  evidence là serializer dưới đây).
- Serialization: `CombinationLookupMeta.getXML()` (dòng 509–544) —
  thứ tự `schema`, `table`, `connection` (tên `DatabaseMeta`, `""`
  khi null), `commit` (int), `cache_size` (int), `replace` (Y/N),
  `preloadCache` (Y/N), `crc` (Y/N), `crcfield`, rồi wrapper
  `<fields>` LUÔN emit (dòng 523/537) chứa các `<key>` (`name` +
  `lookup`, dòng 524–529) và đúng MỘT `<return>` (`name`,
  `creation_method`, `use_autoinc` — KHÔNG có `version`/`rename`,
  dòng 531–535); sau `</fields>` là `sequence` rồi
  `last_update_field`. Không có tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 394–396) gọi `readData()` (dòng
  416–462) — `commit`/`cache_size` qua `Const.toInt(..., 0)` (thiếu
  tag → 0, dòng 425–428); 3 cờ `replace`/`preloadCache`/`crc` parse
  bằng `"Y".equalsIgnoreCase` (thiếu tag → false, dòng 430–432); list
  key đếm từ sub-node `<fields>` (dòng 436–437); `use_autoinc` parse
  đảo `!"N".equalsIgnoreCase(...)` (thiếu tag → true, dòng 454);
  `last_update_field` đọc TRỰC TIẾP từ stepnode (dòng 455), không phải
  từ block `<return>`; `sequence` đọc từ stepnode (dòng 449).
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 465–487) đặt
  `schemaName=""`, `commitSize=100`, `cacheSize=9999`
  (`DEFAULT_CACHE_SIZE`, dòng 84), `replaceFields=false`,
  `preloadCache=false`, `useHash=false`, `hashField="hashcode"`, 0
  key, `technicalKeyField="technical/surrogate key field"`,
  `useAutoinc=false`. `techKeyCreation`/`sequenceFrom`/
  `lastUpdateField` không set (null) — template giữ `<sequence/>` và
  `<last_update_field/>` self-closing cho các giá trị null này.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 490–506) thêm đúng MỘT
  cột `ValueMetaInteger` technical key (length 10, dòng 492–496); khi
  `replaceFields` thì XÓA các key field gốc khỏi row (dòng 498–505) —
  output = input − keys + TK, ngược với `DimensionLookup` luôn giữ
  nguyên row. `getUsedDatabaseConnections()` (dòng 1050–1056) trả
  connection đã chọn. `check()` đòi key stream tồn tại, key lookup có
  trong bảng, technical key có trong bảng và có input (dòng 622–787).
- Chưa đọc runtime `CombinationLookup.java` ở mức statement — mô tả
  lookup/insert ở đây dựa trên Meta (`check()`/`getSQLStatements()`/
  `analyseImpact`), giữ mức `source_reviewed`.

Cấu hình không mặc định (2 key + hash + replace + sequence):

```xml
<commit>100</commit>
<cache_size>9999</cache_size>
<replace>Y</replace>
<preloadCache>N</preloadCache>
<crc>Y</crc>
<crcfield>combo_hash</crcfield>
<fields>
  <key>
    <name>BRAND</name>
    <lookup>brand</lookup>
  </key>
  <key>
    <name>COLOR</name>
    <lookup>color</lookup>
  </key>
  <return>
    <name>product_sk</name>
    <creation_method>sequence</creation_method>
    <use_autoinc>N</use_autoinc>
  </return>
</fields>
<sequence>${SEQ_PRODUCT_SK}</sequence>
<last_update_field>last_update</last_update_field>
```

Fill list bằng `set_fields` (`listTag=fields`, `itemTag=key`).

## 5. Lưu ý / bẫy — CRITICAL

- **KHÔNG có version/date-range**: cần SCD Type II (lịch sử theo thời
  gian) thì dùng `DimensionLookup`, không phải step này. Mỗi tổ hợp
  key ở đây ↔ đúng một surrogate key.
- **`<use_autoinc>` đảo default khi load** (giống DimensionLookup):
  step mới là `N` nhưng file thiếu tag load thành true — template LUÔN
  pin tag này.
- **`<last_update_field>` nằm ngoài `<fields>`**: đọc/ghi trực tiếp
  dưới `<step>` (dòng 455/541). Đặt nhầm vào trong `<return>` sẽ bị
  loader bỏ qua lặng lẽ.
- **`<return>` KHÔNG có `<version>`/`<rename>`**: khác DimensionLookup
  — bịa hai tag này sẽ bị loader bỏ qua lặng lẽ.
- **`<preloadCache>` camelCase, `<crc>`/`<crcfield>` viết thường**:
  sai case (`<preload_cache>`, `<CRC>`) sẽ bị loader bỏ qua (luôn
  false/null).
- **crc=Y đòi `<crcfield>` có giá trị**: thiếu → lỗi build SQL
  (`NotHashFieldSpecified`); không hash thì giữ `<crc>N</crc>`.
- **`replace=Y` XÓA key gốc khỏi stream**: downstream chỉ còn technical
  key (+ các cột khác) — bật nhầm sẽ mất field mà step sau cần.
- **Load thiếu `<commit>`/`<cache_size>` → 0, không phải 100/9999**:
  `100`/`9999` chỉ là default của step MỚI (`setDefault()`); file tay
  sửa bị mất tag sẽ chạy commit từng dòng / cache 0.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  có thật, bảng dimension tồn tại, key stream khớp hop đầu vào;
  credential không bao giờ nằm trong XML này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
