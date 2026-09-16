# LucidDBStreamingLoader — Step streaming-load LucidDB (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category `Deprecated` (icon `deprecated.svg`, dòng 64–68)
> và mang `suggestion` trỏ step thay thế, nhưng không xác định được
> replacement cụ thể trong source 9.4 (không nêu tên ở đây để tránh bịa).
> `status=observed`, `generator_eligible=false`.

Streaming-load các dòng đầu vào vào bảng LucidDB
(`<schema>`.`<table>`) qua connection (`<connection>` — THAM CHIẾU tên
DatabaseMeta, fixture PHẢI khai báo) cộng endpoint streaming riêng
(`<host>`/`<port>` — chỉ `${VAR}`, không host/cổng thật). Thao tác
(`<operation>`: `MERGE`/`INSERT`/`UPDATE`/`CUSTOM`) kèm SQL tự do
(`<custom_sql>`) cho mode CUSTOM. Ánh xạ khóa nằm trong các
`<keys_mapping>` lặp TRỰC TIẾP dưới `<step>` (con: `key_field_name` =
cột bảng, `key_stream_name` = cột dòng); ánh xạ field trong các
`<fields_mapping>` trực tiếp (con: `field_field_name`,
`field_stream_name`, `insert_or_update_flag` Y/N); cờ tab trong các
`<tab_is_enable_mapping>` trực tiếp (con: `tab_is_enable` Y/N).
KHÔNG có wrapper list nào — `countNodes(stepnode, ...)` trực tiếp
(dòng 220–222).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>LucidDBStreamingLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <host>${LUCID_HOST}</host>
    <port>${LUCID_PORT}</port>
    <operation>MERGE</operation>
    <custom_sql/>
    <keys_mapping>
      <key_field_name>{{KEY_COLUMN}}</key_field_name>
      <key_stream_name>{{KEY_FIELD}}</key_stream_name>
    </keys_mapping>
    <fields_mapping>
      <field_field_name>{{TABLE_COLUMN}}</field_field_name>
      <field_stream_name>{{STREAM_FIELD}}</field_stream_name>
      <insert_or_update_flag>Y</insert_or_update_flag>
    </fields_mapping>
    <tab_is_enable_mapping>
      <tab_is_enable>Y</tab_is_enable>
    </tab_is_enable_mapping>
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
| `<connection>` | Y | Tên DatabaseMeta LucidDB (THAM CHIẾU). Chỉ `${VAR}`. |
| `<schema>` | N | Schema bảng đích (`${SCHEMA}`). |
| `<table>` | Y | Bảng đích. Mặc định step mới từ i18n `DefaultTableName`. |
| `<host>` | Y (runtime) | Host endpoint streaming (`${LUCID_HOST}`); mặc định step mới `localhost` — KHÔNG ghi host thật. |
| `<port>` | Y (runtime) | Cổng (`${LUCID_PORT}`); mặc định step mới `9034`. |
| `<operation>` | N | `MERGE` (mặc định) / `INSERT` / `UPDATE` / `CUSTOM`. Chuỗi cố định. |
| `<custom_sql>` | Y khi operation=CUSTOM | SQL tự do cho mode CUSTOM. XML-escape `<`/`&`. |
| `<keys_mapping>/<key_field_name>` | Y (mỗi keys_mapping) | Cột BẢNG dùng làm khóa. |
| `<keys_mapping>/<key_stream_name>` | N | Cột dòng; thiếu/null → trùng tên cột bảng (dòng 230–234). |
| `<fields_mapping>/<field_field_name>` | Y (mỗi fields_mapping) | Cột BẢNG nhận giá trị. |
| `<fields_mapping>/<field_stream_name>` | N | Cột dòng; thiếu/null → trùng tên cột bảng (242–244). |
| `<fields_mapping>/<insert_or_update_flag>` | N | `Y` = insert / `N` = update cho field đó (`"Y".equalsIgnoreCase`, thiếu → false). |
| `<tab_is_enable_mapping>/<tab_is_enable>` | N | Cờ enable tab (Y/N, thiếu → false). |

Ba list đều là con TRỰC TIẾP của `<step>`, không wrapper — đừng bịa
`<keys_mappings>`/`<fields_mappings>` (số ít/mẫu sai đều load về 0).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: LUCID_DB_STREAMING_LOADER` | `<type>` | `LucidDBStreamingLoader`. |
| `configuration.connection` | `<connection>` | Tên connection LucidDB. |
| `configuration.schema` | `<schema>` | `${SCHEMA}`. |
| `configuration.table` | `<table>` | Bảng đích. |
| `configuration.host` | `<host>` | Chỉ `${VAR}`; default source `localhost`. |
| `configuration.port` | `<port>` | Chỉ `${VAR}`; default source `9034`. |
| `configuration.operation` | `<operation>` | `MERGE`/`INSERT`/`UPDATE`/`CUSTOM`. |
| `configuration.custom_sql` | `<custom_sql>` | Escape XML. |
| `configuration.keys[]` | `<keys_mapping>/key_field_name+key_stream_name` | Trực tiếp, không wrapper. |
| `configuration.fields[]` | `<fields_mapping>/field_field_name+field_stream_name+insert_or_update_flag` | Trực tiếp, không wrapper. |
| `configuration.tab_flags[]` | `<tab_is_enable_mapping>/tab_is_enable` | Trực tiếp, không wrapper. |

Các list trực tiếp dưới step → điền thủ công từng block, không dùng
`set_fields` với listTag (không có list cha).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="LucidDBStreamingLoader", image =
  "ui/images/deprecated.svg", ...,
  categoryDescription = "...BaseStep.Category.Deprecated",
  suggestion = "LucidDBStreamingLoaderMeta.SuggestedStep")`
  (`plugins/lucid-db-streaming-loader/core/src/main/java/org/pentaho/di/trans/steps/luciddbstreamingloader/LucidDBStreamingLoaderMeta.java`
  dòng 64–68). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Hằng thao tác (dòng 78–81): `OPERATION_MERGE`/`OPERATION_INSERT`/
  `OPERATION_UPDATE`/`OPERATION_CUSTOM` = `MERGE`/`INSERT`/`UPDATE`/
  `CUSTOM`.
- Serialization: `getXML()` (dòng 274–309) — thứ tự `connection`
  (277–279), `schema` (280), `table` (281), `host` (282), `port`
  (283), `operation` (284), `custom_sql` (285), rồi các
  `<keys_mapping>` TRỰC TIẾP (287–292; `key_field_name` 289,
  `key_stream_name` 290), các `<fields_mapping>` TRỰC TIẾP (294–300;
  `field_field_name` 296, `field_stream_name` 297,
  `insert_or_update_flag` Y/N 298), các `<tab_is_enable_mapping>`
  TRỰC TIẾP (302–306; `tab_is_enable` Y/N 304).
- Deserialization: `loadXML()` (dòng 168–170) gọi `readData()` (dòng
  210–262) — 3 list đếm TRỰC TIẾP `countNodes(stepnode,
  "keys_mapping"/"fields_mapping"/"tab_is_enable_mapping")`
  (220–222); `key_stream_name`/`field_stream_name` null → trùng tên
  cột bảng (230–234/242–244); 2 cờ qua `"Y".equalsIgnoreCase`
  (248/254, thiếu → false).
- Khởi tạo: `setDefault()` (dòng 264–272) — `schemaName = ""` (266),
  `tableName` từ i18n default (267), `host = "localhost"` (268),
  `port = "9034"` (269), `operation = "MERGE"` (270), 0 mapping
  (`allocate(0,0,0)`, 271).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: step đẩy dòng qua endpoint streaming LucidDB —
  cần server + connection thật nên không test runtime ở đây.
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (INSERT + 2 field + update flag N):

```xml
<operation>INSERT</operation>
<keys_mapping>
  <key_field_name>cust_id</key_field_name>
  <key_stream_name>CUST_ID</key_stream_name>
</keys_mapping>
<fields_mapping>
  <field_field_name>cust_name</field_field_name>
  <field_stream_name>CUST_NAME</field_stream_name>
  <insert_or_update_flag>Y</insert_or_update_flag>
</fields_mapping>
<fields_mapping>
  <field_field_name>updated_at</field_field_name>
  <field_stream_name>UPDATED_AT</field_stream_name>
  <insert_or_update_flag>N</insert_or_update_flag>
</fields_mapping>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED**: chỉ đọc/bảo trì workload cũ; không dùng cho pipeline
  mới. Không ghi replacement bịa — source không nêu tên cụ thể.
- **Ba list KHÔNG có wrapper** (số ít, con trực tiếp của step): sai
  tên/wrapper là load về 0 lặng lẽ, không báo lỗi.
- **Tên tag field dễ nhầm**: `key_field_name` vs `key_stream_name`,
  `field_field_name` vs `field_stream_name` — copy-paste sai là ánh xạ
  ngược (cột bảng ↔ cột dòng).
- **Stream-name thiếu → trùng tên cột bảng** (fallback lặng lẽ, không
  báo) — luôn ghi rõ cả hai.
- **Host/port mặc định là `localhost`/`9034`**: template dùng
  `${LUCID_HOST}`/`${LUCID_PORT}`, không bao giờ ghi endpoint thật.
- **Fixture phải khai báo connection**; table/schema dùng `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
