# AggregateRows — Step tổng hợp toàn bộ dòng (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`.

Gộp TOÀN BỘ dòng input thành MỘT dòng tổng hợp duy nhất (không có
group-by — khác `GroupBy`/`MemoryGroupBy`). Mỗi `<field>` khai báo một
cột input (`<name>`), tên cột output (`<rename>`) và phép tổng hợp
(`<type>` = chuỗi mô tả i18n, so khớp `equalsIgnoreCase`, không khớp →
`NONE`). `getFields()` XÓA schema cũ (`row.clear()`) — output CHỈ gồm
các cột tổng hợp; `SUM`/`AVERAGE`/`COUNT` ép kiểu `Number`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AggregateRows</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <name>{{SOURCE_FIELD}}</name>
        <rename>{{OUTPUT_FIELD}}</rename>
        <type>SUM</type>
      </field>
    </fields>
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
| `<fields>/<field>/<name>` | Y | Cột input cần tổng hợp — phải tồn tại trong stream trước (`check()` ERROR `FieldsNotFound` khi thiếu). |
| `<fields>/<field>/<rename>` | Y | Tên cột output sau tổng hợp (`getFields()` đặt `v.setName(fieldNewName[i])`). |
| `<fields>/<field>/<type>` | Y — LUÔN phải có | Mã phép tổng hợp dạng CHUỖI mô tả (tiếng Anh mặc định): `NONE(=first value)`, `SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX`, `FIRST`, `LAST`, `FIRST INCLUDING NULL`, `LAST INCLUDING NULL`. `getType()` so khớp `equalsIgnoreCase`, chuỗi lạ → `NONE` lặng lẽ (dòng 160–168). |

`<fields>` paired list — giữ paired (self-closing làm `setFields` ném lỗi).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: AGGREGATE_ROWS` | `<type>` | `AggregateRows`. |
| `configuration.aggregates[].field` | `<fields>/<field>/<name>` | Cột input. |
| `configuration.aggregates[].rename` | `<fields>/<field>/<rename>` | Cột output. |
| `configuration.aggregates[].type` | `<fields>/<field>/<type>` | Chuỗi mã (không phải số). |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="AggregateRows", ...)`
  (`plugins/aggregate-rows/core/src/main/java/org/pentaho/di/trans/steps/aggregaterows/AggregateRowsMeta.java`
  dòng 58–61, `categoryDescription = ...JobCategory.Category.Deprecated`).
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 262–276) — chỉ emit DUY NHẤT một block
  `<fields>`; mỗi `<field>` có `<name>` (dòng 268), `<rename>` (dòng 269)
  và `<type>` = `getTypeDesc()` (dòng 270). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 143–145) gọi `readData()` (dòng
  186–207) — đếm `<field>` trong `<fields>` (dòng 191–192),
  `allocate(nrfields)` (dòng 194); mỗi `<field>` đọc `name` (dòng 198),
  `rename` (dòng 199), `type` → `getType()` (dòng 200–201). Tag thiếu →
  `null` (không NPE — `aggregateTypeDesc[i].equalsIgnoreCase(null)` trả
  `false` nên type lạ/thiếu lặng lẽ thành `NONE`).
- Khởi tạo: `setDefault()` (dòng 210–222) — `nrfields = 0` rồi
  `allocate(0)`: step mới có 0 aggregate (`check()` WARNING
  `NothingSpecified` khi rỗng, dòng 364–368).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 225–259) — `SUM`/`AVERAGE`/
  `COUNT` clone sang `TYPE_NUMBER` (dòng 236–241), còn lại giữ kiểu gốc;
  rồi `row.clear()` (dòng 248): output CHỈ gồm các cột tổng hợp, mọi cột
  input không khai báo đều bị loại (`check()` COMMENT `IgnoredFields`,
  dòng 339–363). `check()` yêu cầu có input (`NoInputReceived` ERROR khi
  không có, dòng 370–380).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.
- Không có replacement pointer trong source (không có `suggestion`);
  chức năng tương đương có ở `GroupBy`/`MemoryGroupBy` (nhận xét biên tập,
  không phải trích dẫn source).

Cấu hình không mặc định (doanh thu + số đơn):

```xml
<fields>
  <field>
    <name>ORDER_TOTAL</name>
    <rename>TOTAL_REVENUE</rename>
    <type>SUM</type>
  </field>
  <field>
    <name>ORDER_ID</name>
    <rename>ORDER_COUNT</rename>
    <type>COUNT</type>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category Deprecated, dòng 61): chỉ đọc/bảo trì; step mới
  dùng `GroupBy`/`MemoryGroupBy`.
- **`<type>` là chuỗi mô tả, KHÔNG phải số** — `0`/`1` load thành `NONE`
  lặng lẽ (`getType()` chỉ khớp chuỗi, dòng 160–168). Chuỗi `FIRST`/
  `LAST INCLUDING NULL` có dấu cách — giữ nguyên.
- **`getFields()` xóa toàn bộ schema cũ** — downstream chỉ thấy các cột
  `<rename>`; đừng mong cột input còn lại.
- **Không bịa thêm tag**: `getXML()` chỉ emit `<fields>` — không có
  `<group>`, `<connection>` hay cờ nào khác.
- Template mặc định là khung cấu hình — người dùng phải điền field tồn tại
  trong stream trước; step 0 field (mặc định `setDefault()`) chỉ warning.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
