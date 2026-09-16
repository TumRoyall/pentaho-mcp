# PaloCellInput — Step đọc ô cube Palo (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@Step` category `BaseStep.Category.Deprecated`, icon `deprecated.svg`).
> Reference này phục vụ **đọc/bảo trì workload cũ** — `status: observed`,
> `generator_eligible: false`, KHÔNG phát sinh step mới. Không có replacement
> canonical nào được source chỉ định.

Đọc các ô từ một Palo cube (`<cube>`) trên connection Palo
(`<connection>` — THAM CHIẾU tên DatabaseMeta loại PALO, fixture PHẢI
khai báo), cố định các chiều trong `<fields>/<field>`
(`dimensionname`/`fieldname`/`fieldtype`) và cột measure
(`cubemeasurename`/`cubemeasuretype`). Schema output do `PaloHelper`
xây dựng khi chạy (cần server thật) — `getFields()` NÉM lỗi khi chưa
chọn connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PaloCellInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <cube>{{PALO_CUBE}}</cube>
    <cubemeasurename>Sales</cubemeasurename>
    <cubemeasuretype>Number</cubemeasuretype>
    <fields>
      <field>
        <dimensionname>Region</dimensionname>
        <fieldname>{{DIM_FIELD_REGION}}</fieldname>
        <fieldtype>String</fieldtype>
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
| `<connection>` | Y | Tên connection Palo (DatabaseMeta). `getFields()` ném lỗi khi null; validator báo undefined khi fixture thiếu. |
| `<cube>` | Y | Tên cube Palo. |
| `<cubemeasurename>` / `<cubemeasuretype>` | Y | Tên + kiểu cột measure output (`check()` ERROR khi rỗng). |
| `<fields>/<field>/<dimensionname>` | Y | Tên chiều Palo. |
| `<fields>/<field>/<fieldname>` | Y | Tên cột dòng cho chiều. |
| `<fields>/<field>/<fieldtype>` | Y | Kiểu cột (`String`/`Number`; `check()` ERROR khi rỗng). |

`<fields>` paired list — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PALO_CELL_INPUT` | `<type>` | `PaloCellInput`. |
| `configuration.connection` | `<connection>` | Tên connection Palo. |
| `configuration.cube` | `<cube>` | Cube. |
| `configuration.measure` | `<cubemeasurename>` | Cột measure. |
| `configuration.dimensions[].dimension` | `<fields>/<field>/<dimensionname>` | Chiều. |
| `configuration.dimensions[].field` | `<fields>/<field>/<fieldname>` | Cột dòng. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="PaloCellInput", ...)`
  (`plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/cellinput/PaloCellInputMeta.java`
  dòng 55–59, category `...BaseStep.Category.Deprecated`, icon
  `ui/images/deprecated.svg`). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 150–169) — `connection` = tên
  DatabaseMeta (rỗng khi null, dòng 154), `cube` (155),
  `cubemeasurename` (156), `cubemeasuretype` (157), block `<fields>`
  (159–167; `dimensionname` 162, `fieldname` 163, `fieldtype` 164).
- Deserialization: `readData()` (dòng 97–122) qua `loadXML()` (dòng
  86–89) — connection qua `DatabaseMeta.findDatabase` (100); measure bọc
  thành `DimensionField("Measure", name, type)` (104); đếm `<field>`
  (108–109). Không có boolean/enum parser riêng; mọi exception bọc thành
  `KettleXMLException` (119–121).
- Khởi tạo: `setDefault()` RỖNG (dòng 125–126) — step mới giữ nguyên
  field khởi tạo (`cube ""`, measure rỗng); phải cấu hình mới chạy.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 129–147) NÉM
  `KettleStepException` khi `databaseMeta == null` (132–134); ngược
  lại nối PaloHelper qua server thật. `check()` ERROR khi
  measure/fieldtype rỗng.
- `getUsedDatabaseConnections()` (dòng 301–307) trả connection đã chọn —
  lineage thấy step này dùng DB.
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (2 chiều):

```xml
<connection>${CONN}</connection>
<cube>Sales</cube>
<cubemeasurename>Revenue</cubemeasurename>
<cubemeasuretype>Number</cubemeasuretype>
<fields>
  <field>
    <dimensionname>Region</dimensionname>
    <fieldname>REGION</fieldname>
    <fieldtype>String</fieldtype>
  </field>
  <field>
    <dimensionname>Year</dimensionname>
    <fieldname>YEAR</fieldname>
    <fieldtype>String</fieldtype>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** (icon deprecated, category Deprecated):
  chỉ dùng cho đọc/bảo trì workload cũ; Palo server đã ngừng phát triển.
  Không có replacement nào được source chỉ định — mặc định KHÔNG đề xuất
  canonical thay thế.
- **Fixture phải khai báo connection** — thiếu là validator báo
  undefined connection, test 0-error FAIL.
- Không embed tên connection thật ngoài `${CONN}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
