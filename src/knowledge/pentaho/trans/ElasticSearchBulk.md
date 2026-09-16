# ElasticSearchBulk — Step bulk-insert Elasticsearch (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`.

Ghi hàng loạt document vào Elasticsearch qua transport client cũ (port
`9300`): khối `<general>` (index/type/batch/timeout/flags), ánh xạ cột →
JSON trong `<fields>/<field>` (`columnName`/`targetName`), danh sách node
trong `<servers>/<server>` (`address`/`port`), setting client trong
`<settings>/<setting>` (`name`/`value`). Hai chế độ: field-mapping
(`isJson = N`) hoặc JSON nguyên cột (`isJson = Y` + `jsonField`).
`getFields()` chỉ thêm cột `<idOutputField>` (String) khi có — không sửa
schema khác. Địa chỉ/port trong template luôn dùng `${VAR}`, không embed
host thật.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ElasticSearchBulk</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <general>
      <index>{{ES_INDEX}}</index>
      <type>{{ES_TYPE}}</type>
      <batchSize>50000</batchSize>
      <timeout/>
      <timeoutUnit>SECONDS</timeoutUnit>
      <isJson>N</isJson>
      <overwriteIfExists>N</overwriteIfExists>
      <useOutput>N</useOutput>
      <stopOnError>Y</stopOnError>
    </general>
    <fields>
      <field>
        <columnName>{{SOURCE_FIELD}}</columnName>
        <targetName>{{JSON_FIELD}}</targetName>
      </field>
    </fields>
    <servers>
      <server>
        <address>${ES_HOST}</address>
        <port>9300</port>
      </server>
    </servers>
    <settings>
      <setting>
        <name>cluster.name</name>
        <value>${ES_CLUSTER}</value>
      </setting>
    </settings>
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
| `<general>/<index>` / `<type>` | Y | Index và type ES (`check()` ERROR khi trống; default mới `twitter`/`tweet`). |
| `<general>/<batchSize>` | Y | Số document mỗi batch dạng CHUỖI (default `"50000"`; runtime `Const.toInt(..., 50000)`). |
| `<general>/<timeout>` / `<timeoutUnit>` | N | Timeout dạng chuỗi (default null → self-closing); unit là tên enum `TimeUnit` (`SECONDS` default; sai/thiếu → `SECONDS` lặng lẽ). |
| `<general>/<isJson>` | Y | `Y` = lấy JSON nguyên từ `<jsonField>`; `N` = map từng cột. So khớp `"Y".equals` PHÂN BIỆT HOA/thường (`y` → false). |
| `<general>/<jsonField>` | Khi `isJson = Y` | Cột chứa JSON (`check()` ERROR khi `isJson = Y` mà thiếu/không có trong input). Chỉ được emit khi non-null. |
| `<general>/<idField>` | N | Cột làm document ID (chỉ emit khi non-null). |
| `<general>/<overwriteIfExists>` | Y | `Y` = ghi đè khi trùng ID. |
| `<general>/<idOutputField>` | N | Cột output nhận ID đã insert (chỉ emit khi non-null; `getFields()` thêm cột String này). |
| `<general>/<useOutput>` / `<stopOnError>` | Y | Trả output / dừng khi lỗi (default `N`/`Y`). |
| `<fields>/<field>/<columnName>` / `<targetName>` | Y (khi `isJson = N`) | Cột input → tên trong JSON (`check()` ERROR khi cột không có trong input). Target rỗng → dùng tên cột (`addField`, dòng 260–265). |
| `<servers>/<server>/<address>` / `<port>` | Y | Node ES — `${VAR}`, không host thật. Port KHÔNG số/thiếu → `9300` lặng lẽ (dòng 444–450). |
| `<settings>/<setting>/<name>` / `<value>` | N | Setting client (property rỗng bị bỏ khi load qua `addSetting`, dòng 306–313). |

`<general>`, `<fields>`, `<servers>`, `<settings>` luôn emit (paired) —
giữ paired; các tag con điều kiện (`jsonField`, `idOutputField`,
`idField`) vắng khi null.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ELASTIC_SEARCH_BULK` | `<type>` | `ElasticSearchBulk`. |
| `configuration.index/type` | `<general>/<index>`/`/<type>` | Index/type. |
| `configuration.batch_size` | `<general>/<batchSize>` | Chuỗi số. |
| `configuration.json_mode` | `<general>/<isJson>` | Boolean → Y/N (hoa). |
| `configuration.mappings[].column/target` | `<fields>/<field>/<columnName>`/`/<targetName>` | Map cột. |
| `configuration.servers[].address/port` | `<servers>/<server>/<address>`/`/<port>` | Node (`${VAR}`). |

Ba list đồng nhất — fill riêng từng `set_fields` (`fields`/`field`,
`servers`/`server`, `settings`/`setting`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "ElasticSearchBulk", ...)`
  (`plugins/elasticsearch-bulk-insert/core/src/main/java/org/pentaho/di/trans/steps/elasticsearchbulk/ElasticSearchBulkMeta.java`
  dòng 62–66, `categoryDescription = ...Category.Deprecated`,
  `documentationUrl = "Products/ElasticSearch_Bulk_Insert_(deprecated)"`).
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 475–555) — thứ tự: `<general>` (dòng
  482–510: `index`, `type`, `batchSize`, `timeout`, `timeoutUnit`,
  `isJson`, rồi `jsonField`/`idOutputField`/`idField` CHỈ khi non-null
  (dòng 493–502), `overwriteIfExists`, `useOutput`, `stopOnError`),
  `<fields>` (513–524: `columnName`/`targetName`), `<servers>` (527–538:
  `address`/`port`), `<settings>` (541–552: `name`/`value`). Boolean qua
  `addTagValue` → Y/N.
- Deserialization: `loadXML()` (dòng 395–469) — boolean qua `parseBool`
  `"Y".equals` PHÂN BIỆT hoa/thường (dòng 471–473); `timeoutUnit` sai →
  `SECONDS` (dòng 403–407); `port` không số → `9300` (dòng 444–450);
  target rỗng → tên cột (dòng 260–265, qua `addField` dòng 431);
  setting property rỗng bị bỏ (dòng 306–313, qua `addSetting` dòng 463).
- Khởi tạo: `setDefault()` (dòng 369–380) — `batchSize "50000"`,
  `timeoutUnit SECONDS`, `index "twitter"`, `type "tweet"`,
  `isJsonInsert` false, `jsonField`/`idOutField` null, `useOutput` false,
  `stopOnError` true (`timeout` giữ null → `<timeout/>` self-closing).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 383–393) — chỉ thêm cột String
  `<idOutputField>` khi non-blank (và chưa tồn tại); `check()` (dòng
  709–766) ERROR khi `index`/`type`/`batchSize` trống, khi không có input,
  khi `isJson = Y` mà thiếu `jsonField`, khi cột mapping không có trong
  input. Hỗ trợ error handling (`supportsErrorHandling()` true, dòng 777).
- Không có `<connection>`: step không tham chiếu DatabaseMeta — template
  không mang tag này, fixture test không cần khai báo connection (node ES
  là `<servers>`, không phải connection).
- Không có replacement pointer trong source; transport client đã cũ —
  workload mới không dùng step này (nhận xét biên tập).

Cấu hình không mặc định (JSON mode, 2 node, ghi đè + output ID):

```xml
<general>
  <index>orders</index>
  <type>_doc</type>
  <batchSize>10000</batchSize>
  <timeout>30</timeout>
  <timeoutUnit>SECONDS</timeoutUnit>
  <isJson>Y</isJson>
  <jsonField>DOC_JSON</jsonField>
  <idField>ORDER_ID</idField>
  <overwriteIfExists>Y</overwriteIfExists>
  <idOutputField>ES_DOC_ID</idOutputField>
  <useOutput>Y</useOutput>
  <stopOnError>Y</stopOnError>
</general>
<fields>
  <field>
    <columnName>ORDER_ID</columnName>
    <targetName>order_id</targetName>
  </field>
</fields>
<servers>
  <server>
    <address>${ES_HOST_1}</address>
    <port>9300</port>
  </server>
  <server>
    <address>${ES_HOST_2}</address>
    <port>9300</port>
  </server>
</servers>
<settings>
  <setting>
    <name>cluster.name</name>
    <value>${ES_CLUSTER}</value>
  </setting>
</settings>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category + doc URL deprecated, dòng 62–66): chỉ
  đọc/bảo trì.
- **Boolean Y/N PHÂN BIỆT hoa/thường khi load** (`"Y".equals`, dòng
  471–473) — `y`/`true` load thành false. Template phải dùng `Y`/`N` hoa.
- **`<timeoutUnit>` sai/thiếu → `SECONDS` lặng lẽ** (dòng 403–407);
  `<port>` không số → `9300` lặng lẽ (dòng 444–450) — đừng tin giá trị
  đọc được mà không kiểm tra file gốc.
- **Ba tag điều kiện vắng khi null** (`jsonField`, `idOutputField`,
  `idField`, dòng 493–502) — template default không mang chúng; thêm
  rỗng `<jsonField/>` vẫn load null (không sao) nhưng sai thứ tự emit.
- **Không embed host/port thật** — `<address>` luôn `${VAR}`.
- Template mặc định là khung cấu hình — người dùng phải điền index/node
  và mapping cột tồn tại trong stream trước; không chạy I/O nghiệp vụ để test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
