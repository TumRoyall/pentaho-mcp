# OpenERPObjectInput — Step đọc object OpenERP (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category `Deprecated` (icon `deprecated.svg`). Không có
> replacement trong source 9.4 — OpenERP/Odoo integration đã ngừng phát
> triển. `status=observed`, `generator_eligible=false`.

Đọc các bản ghi của một OpenERP model (`<modelName>`) qua connection
OpenERP (`<connection>` — THAM CHIẾU tên DatabaseMeta loại OpenERP,
fixture PHẢI khai báo), theo từng batch `<readBatchSize>` dòng.
Điều kiện lọc nằm trong `<filters>/<filter>`; ánh xạ cột output nằm
trong `<mappings>/<mapping>`. Output schema = các `target_field`/
`target_field_type` của mappings (`getRowMeta()`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OpenERPObjectInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <modelName>{{MODEL}}</modelName>
    <readBatchSize>1000</readBatchSize>
    <mappings>
      <mapping>
        <source_model>{{MODEL}}</source_model>
        <source_field>name</source_field>
        <source_index>0</source_index>
        <target_model>{{MODEL}}</target_model>
        <target_field>NAME</target_field>
        <target_field_label>Name</target_field_label>
        <target_field_type>2</target_field_type>
      </mapping>
    </mappings>
    <filters>
      <filter>
        <operator>{{OPERATOR}}</operator>
        <field_name>name</field_name>
        <comparator>{{COMPARATOR}}</comparator>
        <value>{{VALUE}}</value>
      </filter>
    </filters>
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
| `<connection>` | Y | Tên DatabaseMeta OpenERP (THAM CHIẾU — phải tồn tại trong artifact/shared). `getFields()` ném lỗi khi null; validator báo undefined khi fixture thiếu. Chỉ `${VAR}`, không credential thật. |
| `<modelName>` | Y | Tên model OpenERP (ví dụ `res.partner`). |
| `<readBatchSize>` | Y (parse) | Số dòng đọc mỗi batch; mặc định step mới `1000` (khởi tạo field dòng 60). Thiếu tag → `Integer.parseInt(null)` ném (bọc `KettleXMLException`). |
| `<mappings>/<mapping>/<source_model>` | N | Model nguồn của field. |
| `<mappings>/<mapping>/<source_field>` | Y | Tên field trên OpenERP. |
| `<mappings>/<mapping>/<source_index>` | Y (parse) | Chỉ số nguồn (int). Thiếu → ném như `readBatchSize`. |
| `<mappings>/<mapping>/<target_model>` | N | Model đích. |
| `<mappings>/<mapping>/<target_field>` | Y | Tên cột output — quyết định schema ra (`getRowMeta()`). |
| `<mappings>/<mapping>/<target_field_label>` | N | Nhãn hiển thị. |
| `<mappings>/<mapping>/<target_field_type>` | Y (parse) | Id kiểu value-meta DẠNG SỐ (int, ví dụ `2` = String). Thiếu → ném. |
| `<filters>/<filter>/<operator>` | N | Toán tử nối (`AND`/`OR`). |
| `<filters>/<filter>/<field_name>` | Y (mỗi filter) | Field lọc. |
| `<filters>/<filter>/<comparator>` | Y (mỗi filter) | Phép so sánh (`=`, `ilike`, ...). |
| `<filters>/<filter>/<value>` | N | Giá trị so sánh. |

`<mappings>` và `<filters>` LUÔN emit (kể cả rỗng, dòng 113/125–127/136)
→ template giữ paired, không viết self-closing (setFields từ chối
list self-closing).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: OPENERP_OBJECT_INPUT` | `<type>` | `OpenERPObjectInput`. |
| `configuration.connection` | `<connection>` | Tên connection OpenERP. |
| `configuration.model` | `<modelName>` | Model đọc. Chú ý chữ `N` hoa. |
| `configuration.batch_size` | `<readBatchSize>` | Int; mặc định 1000. |
| `configuration.mappings[].source_field` | `<mappings>/<mapping>/<source_field>` | Field OpenERP. |
| `configuration.mappings[].target_field` | `<mappings>/<mapping>/<target_field>` | Cột output. |
| `configuration.mappings[].target_field_type` | `<mappings>/<mapping>/<target_field_type>` | Id kiểu SỐ. |
| `configuration.filters[]` | `<filters>/<filter>/...` | operator/field_name/comparator/value. |

`<mappings>` → MỘT lần `set_fields` (`listTag=mappings`,
`itemTag=mapping`); `<filters>` → MỘT lần `set_fields`
(`listTag=filters`, `itemTag=filter`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="OpenERPObjectInput", image =
  "ui/images/deprecated.svg", ...,
  categoryDescription = "...BaseStep.Category.Deprecated")`
  (`plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectinput/OpenERPObjectInputMeta.java`
  dòng 52–55). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 105–139) — thứ tự `connection`
  (tên DatabaseMeta, rỗng khi null, dòng 108–109), `modelName` (110),
  `readBatchSize` (111), rồi wrapper `<mappings>` LUÔN emit (113–125;
  mỗi `<mapping>` có `source_model` 116, `source_field` 117,
  `source_index` 118, `target_model` 119, `target_field` 120,
  `target_field_label` 121, `target_field_type` 122) và `<filters>`
  LUÔN emit (127–136; mỗi `<filter>` có `operator` 130, `field_name`
  131, `comparator` 132, `value` 133).
- Deserialization: `loadXML()` (dòng 142–144) gọi `readData()` (dòng
  225–272) — connection qua `DatabaseMeta.findDatabase` (228);
  `readBatchSize` qua `Integer.parseInt` KHÔNG null-guard (230, thiếu
  tag → ném, bọc `KettleXMLException` dòng 269–271); mappings reset
  list mới (232) rồi đếm `<mapping>` trong sub-node `<mappings>`
  (234–235); `source_index`/`target_field_type` parseInt (244/248);
  filters đếm `<filter>` trong sub-node `<filters>` (253–254).
- Khởi tạo: `setDefault()` RỖNG (dòng 220–223) — step mới giữ nguyên
  giá trị khởi tạo field: `readBatchSize = 1000` (dòng 60),
  `mappings`/`filterList` là list rỗng (dòng 61–62). Không có default
  nào khác.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 64–80) NÉM
  `KettleStepException` khi `databaseMeta == null` (68–70); ngược lại
  mở session qua `OpenERPHelper` và gắn rowMeta từ `getRowMeta()`
  (dòng 82–88) — mỗi mapping thành một value-meta
  (`target_field`, `target_field_type`). Output schema HOÀN TOÀN do
  mappings quyết định.
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (thêm mapping + filter thứ hai):

```xml
<mappings>
  <mapping>
    <source_model>res.partner</source_model>
    <source_field>name</source_field>
    <source_index>0</source_index>
    <target_model>res.partner</target_model>
    <target_field>PARTNER_NAME</target_field>
    <target_field_label>Name</target_field_label>
    <target_field_type>2</target_field_type>
  </mapping>
  <mapping>
    <source_model>res.partner</source_model>
    <source_field>email</source_field>
    <source_index>0</source_index>
    <target_model>res.partner</target_model>
    <target_field>PARTNER_EMAIL</target_field>
    <target_field_label>Email</target_field_label>
    <target_field_type>2</target_field_type>
  </mapping>
</mappings>
```

Fill bằng `set_fields` (`listTag=mappings`, `itemTag=mapping`).

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (icon deprecated, category Deprecated): chỉ đọc/bảo
  trì workload cũ; không dùng cho pipeline mới, không có replacement
  trong source 9.4.
- **`<target_field_type>` và `<source_index>` là SỐ parseInt, không
  phải tên kiểu**: ghi `String` thay vì id số → `NumberFormatException`
  khi load. (Ngược với DBJoin dùng tên chuỗi.)
- **Thiếu `<readBatchSize>`/`<source_index>`/`<target_field_type>`
  là load FAIL** (parseInt không null-guard) — không bao giờ lược các
  tag này.
- **`<mappings>`/`<filters>` luôn paired**: `getXML()` emit cả khi
  rỗng — template giữ paired để `setFields` chèn được.
- **Fixture phải khai báo connection** — thiếu là validator báo
  undefined connection, test 0-error FAIL. Host/db/login OpenERP nằm
  trong DatabaseMeta, KHÔNG bao giờ embed vào template (chỉ `${CONN}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
