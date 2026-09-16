# TableCompare — Step so sánh 2 bảng qua 2 connection

So sánh bảng reference với bảng compare (mỗi bên: connection + schema
field + table field ĐỘNG từ stream) theo key (`key_fields_field`) trừ
exclude (`exclude_fields_field`), rồi append đúng 6 cột Integer(len 9)
theo thứ tự: `nrErrors` (`nr_errors_field`), `nrRecordsReferenceTable`
(`nr_records_reference_field`), `nrRecordsCompareTable`
(`nr_records_compare_field`), `nrErrorsLeftJoin`,
`nrErrorsInnerJoin`, `nrErrorsRightJoin`. `getFields()` NÉM
`KettleStepException` khi bất kỳ cột nào trong 6 rỗng. Có HAI
`<connection>` tham chiếu (`reference_connection`,
`compare_connection`) — fixture PHẢI khai báo cả hai.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TableCompare</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <reference_connection>${REF_CONN}</reference_connection>
    <reference_schema_field>REF_SCHEMA</reference_schema_field>
    <reference_table_field>REF_TABLE</reference_table_field>
    <compare_connection>${CMP_CONN}</compare_connection>
    <compare_schema_field>CMP_SCHEMA</compare_schema_field>
    <compare_table_field>CMP_TABLE</compare_table_field>
    <key_fields_field>KEY_FIELDS</key_fields_field>
    <exclude_fields_field>EXCLUDE_FIELDS</exclude_fields_field>
    <nr_errors_field>nrErrors</nr_errors_field>
    <nr_records_reference_field>nrRecordsReferenceTable</nr_records_reference_field>
    <nr_records_compare_field>nrRecordsCompareTable</nr_records_compare_field>
    <nr_errors_left_join_field>nrErrorsLeftJoin</nr_errors_left_join_field>
    <nr_errors_inner_join_field>nrErrorsInnerJoin</nr_errors_inner_join_field>
    <nr_errors_right_join_field>nrErrorsRightJoin</nr_errors_right_join_field>
    <key_description_field>KEY_DESC</key_description_field>
    <value_reference_field>VALUE_REF</value_reference_field>
    <value_compare_field>VALUE_CMP</value_compare_field>
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
| `<reference_connection>` | Y | Tên connection phía reference (THAM CHIẾU — phải khai báo trong artifact). Emit tên (`getName()`), không phải object. |
| `<reference_schema_field>` | N | Tên FIELD chứa schema reference (động). |
| `<reference_table_field>` | N | Tên FIELD chứa tên bảng reference (động). |
| `<compare_connection>` | Y | Tên connection phía compare (THAM CHIẾU — phải khai báo). |
| `<compare_schema_field>` | N | Tên FIELD chứa schema compare. |
| `<compare_table_field>` | N | Tên FIELD chứa tên bảng compare. |
| `<key_fields_field>` | N | Tên FIELD chứa danh sách key (phân cách). |
| `<exclude_fields_field>` | N | Tên FIELD chứa danh sách cột loại. |
| `<nr_errors_field>` ... `<nr_errors_right_join_field>` | Y (cả 6) | Tên 6 cột Integer output; mặc định `nrErrors`, `nrRecordsReferenceTable`, `nrRecordsCompareTable`, `nrErrorsLeftJoin`, `nrErrorsInnerJoin`, `nrErrorsRightJoin`. Rỗng bất kỳ → `getFields()` NÉM. |
| `<key_description_field>` | N | Tên FIELD mô tả key (không vào output). |
| `<value_reference_field>` | N | Tên FIELD giá trị reference (không vào output). |
| `<value_compare_field>` | N | Tên FIELD giá trị compare (không vào output). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TABLE_COMPARE` | `<type>` | `TableCompare`. |
| `configuration.reference_connection` | `<reference_connection>` | Tham chiếu tên connection. |
| `configuration.compare_connection` | `<compare_connection>` | Tham chiếu tên connection. |
| `configuration.reference_schema_field` | `<reference_schema_field>` | Tên field động. |
| `configuration.reference_table_field` | `<reference_table_field>` | Tên field động. |
| `configuration.compare_schema_field` | `<compare_schema_field>` | Tên field động. |
| `configuration.compare_table_field` | `<compare_table_field>` | Tên field động. |
| `configuration.key_fields_field` | `<key_fields_field>` | Tên field động. |
| `configuration.exclude_fields_field` | `<exclude_fields_field>` | Tên field động. |
| `configuration.nr_errors_field` | `<nr_errors_field>` | Tên cột Integer. |
| (+ 5 cột nr còn lại) | (+ 5 tag tương ứng) | Tên cột Integer. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 127 —
  `<step id="TableCompare">` →
  `org.pentaho.di.trans.steps.tablecompare.TableCompareMeta` (annotation
  `@Step` bị comment, dòng 54–61). Registry presence không phải XML
  evidence, evidence là serializer dưới đây.
- Serialization: `TableCompareMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/tablecompare/TableCompareMeta.java`
  dòng 469–503) — đúng 17 tag theo thứ tự mẫu trên; connection emit
  **tên** (`ref==null?null:getName()`), không phải object. Không
  boolean/int.
- Deserialization: `loadXML()` (dòng 365–367) gọi `readData()` (dòng
  437–466) — `DatabaseMeta.findDatabase(databases, getTagValue(...))` →
  null khi thiếu/không khớp tên (không throw); còn lại null khi thiếu.
- Khởi tạo: `setDefault()` (dòng 506–513) — chỉ 6 field `nrErrors=
  "nrErrors"`, `nrRecordsReferenceField="nrRecordsReferenceTable"`,
  `nrRecordsCompareField="nrRecordsCompareTable"`,
  `nrErrorsLeftJoinField="nrErrorsLeftJoin"`,
  `nrErrorsInnerJoinField="nrErrorsInnerJoin"`,
  `nrErrorsRightJoinField="nrErrorsRightJoin"`; connections +
  schema/table/key/exclude/keyDescription/value* = null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 377–435) throw
  `KettleStepException` nếu bất kỳ trong 6 `nr*` rỗng; rồi append 6
  Integer(len 9) đúng thứ tự `nrErrors`, `nrRecordsReference`,
  `nrRecordsCompare`, `nrErrorsLeft`, `nrErrorsInner`, `nrErrorsRight`.
  `keyDescription/valueReference/valueCompare` KHÔNG vào output.
  `getUsedDatabaseConnections()` (dòng 197–212) add compare trước,
  reference sau. Repo dùng `reference_connection_id/
  compare_connection_id` (dòng 519/523/548/553).
- Có HAI `<connection>` tham chiếu theo tên — fixture test PHẢI khai báo
  cả `<connection><name>${REF_CONN}</name></connection>` và
  `<connection><name>${CMP_CONN}</name></connection>`, nếu không
  validator báo "undefined connection".

Cấu hình không mặc định (so sánh theo ngày load):

```xml
<reference_connection>${REF_CONN}</reference_connection>
<reference_schema_field>REF_SCHEMA</reference_schema_field>
<reference_table_field>REF_TABLE</reference_table_field>
<compare_connection>${CMP_CONN}</compare_connection>
<compare_schema_field>CMP_SCHEMA</compare_schema_field>
<compare_table_field>CMP_TABLE</compare_table_field>
<key_fields_field>ID</key_fields_field>
<exclude_fields_field>LOAD_DATE</exclude_fields_field>
<nr_errors_field>ERR_CNT</nr_errors_field>
<nr_records_reference_field>REF_CNT</nr_records_reference_field>
<nr_records_compare_field>CMP_CNT</nr_records_compare_field>
<nr_errors_left_join_field>LEFT_ERR</nr_errors_left_join_field>
<nr_errors_inner_join_field>INNER_ERR</nr_errors_inner_join_field>
<nr_errors_right_join_field>RIGHT_ERR</nr_errors_right_join_field>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Fixture PHẢI khai báo CẢ HAI connection** (bẫy B2 mở rộng): thiếu một
  là test 0-error FAIL.
- **Schema/table/key là TÊN FIELD động**, không phải tên tĩnh — giá trị
  đến từ dòng đầu vào; đừng điền tên bảng tĩnh vào đây.
- **Cả 6 cột `nr*` bắt buộc non-empty** — rỗng một là `getFields()` NÉM.
- **`key_description`/`value_*` không vào output** — chỉ dùng nội bộ lúc
  so sánh.
- Template mặc định là khung cấu hình — người dùng phải điền 2 connection
  có thật và fields động tồn tại trong stream trước; cần DB lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
