# GPBulkLoader — Step bulk-load Greenplum (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category `Deprecated` (icon `deprecated.svg`, dòng 65–70)
> và mang `suggestion` trỏ step thay thế. Replacement có nguồn:
> **`GPLoad`** (step `GPLoadMeta`, id `GPLoad` tại
> `plugins/gpload/core/.../gpload/GPLoadMeta.java` dòng 61).
> `status=observed`, `generator_eligible=false`.

Bulk-load các dòng đầu vào vào bảng Greenplum (`<schema>`.`<table>`)
qua connection (`<connection>` — THAM CHIẾU tên DatabaseMeta, fixture
PHẢI khai báo) bằng tiện ích `psql` ngoài (`<PsqlPath>`) cùng các file
control/data/log. Phương thức load (`<load_method>`: `AUTO_END`/
`MANUAL`) và hành động (`<load_action>`:
`APPEND`/`INSERT`/`REPLACE`/`TRUNCATE`) là chuỗi cố định. Ánh xạ cột
dòng → cột bảng nằm trong các `<mapping>` lặp TRỰC TIẾP dưới `<step>`
(KHÔNG bọc wrapper — `countNodes(stepnode, "mapping")`, dòng 274).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GPBulkLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <errors>50</errors>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <load_method>AUTO_END</load_method>
    <load_action>APPEND</load_action>
    <PsqlPath>{{PSQL_PATH}}</PsqlPath>
    <control_file>control${Internal.Step.CopyNr}.cfg</control_file>
    <data_file>load${Internal.Step.CopyNr}.dat</data_file>
    <log_file/>
    <erase_files>Y</erase_files>
    <encoding/>
    <dbname_override/>
    <mapping>
      <stream_name>{{STREAM_FIELD}}</stream_name>
      <field_name>{{TABLE_COLUMN}}</field_name>
      <date_mask/>
    </mapping>
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
| `<connection>` | Y | Tên DatabaseMeta Greenplum (THAM CHIẾU). Chỉ `${VAR}`. |
| `<errors>` | N | Số lỗi tối đa cho phép; thiếu tag → `50` (`Const.toInt` default 50, dòng 259). |
| `<schema>` | N | Schema bảng đích (`${SCHEMA}`). |
| `<table>` | Y | Bảng đích. Mặc định step mới từ i18n `DefaultTableName`. |
| `<load_method>` | N | `AUTO_END` (mặc định) / `MANUAL`. Chuỗi cố định, đừng dịch. |
| `<load_action>` | N | `APPEND` (mặc định) / `INSERT` / `REPLACE` / `TRUNCATE`. Chuỗi cố định. |
| `<PsqlPath>` | Y (runtime) | Đường dẫn tiện ích psql (giữ nguyên chữ hoa `PsqlPath`). |
| `<control_file>` / `<data_file>` / `<log_file>` | N | File trung gian; mặc định chứa `${Internal.Step.CopyNr}` (giữ nguyên, không escape `$`). |
| `<erase_files>` | N | `Y` (mặc định step mới true) = xóa file trung gian sau load; `N` = giữ. Thiếu tag → false. |
| `<encoding>` | N | Encoding file data. Mặc định `""`. |
| `<dbname_override>` | N | Ghi đè tên DB. Mặc định `""`. |
| `<mapping>/<stream_name>` | Y (mỗi mapping) | BẪY TÊN: `stream_name` ở đây là CỘT BẢNG (`fieldTable[i]`, dòng 280) — ngược trực giác. |
| `<mapping>/<field_name>` | N | Cột dòng (`fieldStream[i]`, dòng 281); thiếu/null → mặc định trùng tên cột bảng (282–284). |
| `<mapping>/<date_mask>` | N | Chỉ nhận `DATE`/`DATETIME`; giá trị khác → `""` (dòng 289–294). |

`<mapping>` là con TRỰC TIẾP của `<step>`, không có wrapper
`<mappings>` — đừng bịa wrapper (load đếm `countNodes(stepnode,
"mapping")`).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GP_BULK_LOADER` | `<type>` | `GPBulkLoader`. Pipeline mới dùng `GPLoad`. |
| `configuration.connection` | `<connection>` | Tên connection Greenplum. |
| `configuration.max_errors` | `<errors>` | Int; default 50. |
| `configuration.schema` | `<schema>` | `${SCHEMA}`. |
| `configuration.table` | `<table>` | Bảng đích. |
| `configuration.load_method` | `<load_method>` | `AUTO_END`/`MANUAL`. |
| `configuration.load_action` | `<load_action>` | `APPEND`/`INSERT`/`REPLACE`/`TRUNCATE`. |
| `configuration.psql_path` | `<PsqlPath>` | Giữ chữ hoa. |
| `configuration.control_file` / `.data_file` / `.log_file` | `<control_file>` / `<data_file>` / `<log_file>` | Giữ `${Internal.Step.CopyNr}`. |
| `configuration.erase_files` | `<erase_files>` | Boolean → Y/N; default Y. |
| `configuration.encoding` | `<encoding>` | Encoding. |
| `configuration.dbname_override` | `<dbname_override>` | Ghi đè DB. |
| `configuration.mappings[]` | `<mapping>/stream_name+field_name+date_mask` | Trực tiếp dưới step, KHÔNG wrapper → điền thủ công, không dùng `set_fields` với listTag. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="GPBulkLoader", image =
  "ui/images/deprecated.svg", ...,
  categoryDescription = "...BaseStep.Category.Deprecated",
  suggestion = "GPBulkLoaderMeta.SuggestedStep")`
  (`plugins/gp-bulk-loader/core/src/main/java/org/pentaho/di/trans/steps/gpbulkloader/GPBulkLoaderMeta.java`
  dòng 65–70). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 326–354) — thứ tự `connection`
  (330–331), `errors` (332), `schema` (333), `table` (334),
  `load_method` (335), `load_action` (336), `PsqlPath` (337, giữ chữ
  hoa), `control_file` (338), `data_file` (339), `log_file` (340),
  `erase_files` Y/N (341), `encoding` (342), `dbname_override` (343),
  rồi các `<mapping>` TRỰC TIẾP không wrapper (345–351; mỗi mapping có
  `stream_name` 347, `field_name` 348, `date_mask` 349).
- Hằng chuỗi cố định (dòng 127–143): `ACTION_APPEND`/`ACTION_INSERT`/
  `ACTION_REPLACE`/`ACTION_TRUNCATE` (127–130),
  `METHOD_AUTO_END`/`METHOD_MANUAL` (136–137),
  `DATE_MASK_DATE`/`DATE_MASK_DATETIME` (142–143) — "Do not translate".
- Deserialization: `loadXML()` (dòng 228–230) gọi `readData()` (dòng
  253–301) — `errors` qua `Const.toInt(..., 50)` (259, thiếu → 50);
  `erase_files` qua `"Y".equalsIgnoreCase` (270, thiếu → false);
  mappings đếm TRỰC TIẾP `countNodes(stepnode, "mapping")` (274);
  `field_name` null → trùng `stream_name` (282–284); `date_mask` chỉ
  giữ `DATE`/`DATETIME`, còn lại → `""` (289–294).
- Khởi tạo: `setDefault()` (dòng 304–323) — `maxErrors = 50` (307),
  `tableName` từ i18n default (309), `loadMethod = AUTO_END` (310),
  `loadAction = APPEND` (311), `PsqlPath = "PsqlPath"` (312),
  `controlFile/dataFile` mang `${Internal.Step.CopyNr}` (313–314),
  `eraseFiles = true` (319), 0 mapping (`allocate(0)`, 321–322).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: step gọi tiện ích psql ngoài với file trung gian
  — cần Greenplum + psql thật nên không test runtime ở đây.
- Replacement: step `GPLoad`
  (`plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java`
  dòng 61: `@Step(id = "GPLoad", ...)`).
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (TRUNCATE + 2 mapping + giữ file):

```xml
<errors>0</errors>
<load_method>MANUAL</load_method>
<load_action>TRUNCATE</load_action>
<erase_files>N</erase_files>
<mapping>
  <stream_name>cust_id</stream_name>
  <field_name>CUST_ID</field_name>
  <date_mask/>
</mapping>
<mapping>
  <stream_name>order_date</stream_name>
  <field_name>ORDER_DATE</field_name>
  <date_mask>DATE</date_mask>
</mapping>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED — pipeline mới dùng `GPLoad`**: reference này chỉ để
  đọc/bảo trì `.ktr` cũ.
- **`<mapping>` KHÔNG có wrapper**: con trực tiếp của `<step>` —
  đừng bịa `<mappings>`.
- **`<stream_name>` là CỘT BẢNG, `<field_name>` là cột dòng** — ngược
  trực giác, đúng theo dòng 280–281 source.
- **`<PsqlPath>` giữ chữ hoa**; `control/data_file` giữ nguyên
  `${Internal.Step.CopyNr}`.
- **`<date_mask>` chỉ `DATE`/`DATETIME`** — giá trị khác bị load chuẩn
  hóa thành `""`.
- **`<erase_files>` mặc định step mới Y nhưng load-thiếu-tag →
  false**: template pin rõ `Y`/`N`.
- **Fixture phải khai báo connection**; table/schema dùng `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
