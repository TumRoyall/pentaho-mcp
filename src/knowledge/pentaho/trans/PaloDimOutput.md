# PaloDimOutput — Step ghi dimension Palo (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@Step` category `BaseStep.Category.Deprecated`, icon `deprecated.svg`).
> Reference này phục vụ **đọc/bảo trì workload cũ** — `status: observed`,
> `generator_eligible: false`, KHÔNG phát sinh step mới. Không có replacement
> canonical nào được source chỉ định.

Với MỖI dòng đầu vào, tạo/cập nhật phần tử trong một Palo dimension
(`<dimension>`) trên connection Palo (`<connection>` — fixture PHẢI khai
báo): mỗi level trong `<levels>/<level>` (`levelname`/`levelnumber`/
`fieldname`/`consolidationfieldname` — KHÔNG có `fieldtype` như DimInput)
lấy giá trị từ cột dòng. Kiểu phần tử `<elementtype>`, tạo/xóa/tái tạo
dimension và cache element qua các cờ Y/N.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PaloDimOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <dimension>{{PALO_DIMENSION}}</dimension>
    <elementtype>String</elementtype>
    <createdimension>N</createdimension>
    <cleardimension>N</cleardimension>
    <clearconsolidations>N</clearconsolidations>
    <recreatedimension>N</recreatedimension>
    <enableElementCache>Y</enableElementCache>
    <preloadElementCache>Y</preloadElementCache>
    <levels>
      <level>
        <levelname>Level0</levelname>
        <levelnumber>0</levelnumber>
        <fieldname>{{LEVEL_FIELD}}</fieldname>
        <consolidationfieldname/>
      </level>
    </levels>
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
| `<connection>` | Y | Connection Palo; fixture phải khai báo. |
| `<dimension>` | Y | Dimension đích. |
| `<elementtype>` | N | Kiểu phần tử (ví dụ `String`/`Numeric`). |
| `<createdimension>` | Y* | Y = tạo dimension khi chưa có. THIẾU → NPE (dòng 111). |
| `<cleardimension>` | Y* | Y = xóa dimension trước khi ghi. THIẾU → NPE (dòng 112). |
| `<clearconsolidations>` / `<recreatedimension>` / `<enableElementCache>` / `<preloadElementCache>` | N | Thiếu → false (null-guard dòng 113–124). Template vẫn pin tường minh. |
| `<levels>/<level>/<levelname>` | Y | Tên level. |
| `<levels>/<level>/<levelnumber>` | Y | Số nguyên (parseInt dòng 137 — thiếu → FAIL). |
| `<levels>/<level>/<fieldname>` | Y | Cột dòng chứa giá trị level. |
| `<levels>/<level>/<consolidationfieldname>` | N | Cột gom (consolidation); rỗng được. KHÔNG có `fieldtype` ở Output. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PALO_DIM_OUTPUT` | `<type>` | `PaloDimOutput`. |
| `configuration.connection` | `<connection>` | Tên connection. |
| `configuration.dimension` | `<dimension>` | Dimension đích. |
| `configuration.element_type` | `<elementtype>` | Kiểu phần tử. |
| `configuration.levels[].field` | `<levels>/<level>/<fieldname>` | Cột nguồn. |
| `configuration.levels[].consolidation_field` | `<levels>/<level>/<consolidationfieldname>` | Cột gom. |

`<levels>` → MỘT lần `set_fields` (`listTag=levels`, `itemTag=level`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="PaloDimOutput", ...)`
  (`plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/dimoutput/PaloDimOutputMeta.java`
  dòng 57–61, category Deprecated, icon `deprecated.svg`). Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 148–182) — `connection` (151–152),
  `dimension` (153), `elementtype` (155), `createdimension` (157),
  `cleardimension` (159), `clearconsolidations` (161),
  `recreatedimension` (163), `enableElementCache` (165),
  `preloadElementCache` (167), `<levels>` (169–179; KHÔNG có
  `fieldtype`, thay bằng `consolidationfieldname` 175–176).
- Deserialization: `readData()` (dòng 105–143) qua `loadXML()` (dòng
  95–98) — `createdimension` và `cleardimension` `.equals("Y")` KHÔNG
  null-guard (111–112, thiếu → NPE bọc `KettleXMLException`); 4 cờ sau
  null-guard (113–124); `levelnumber` parseInt (137).
- Khởi tạo: `setDefault()` RỖNG (dòng 145–146).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- `getUsedDatabaseConnections()` (dòng 322–328) trả connection đã chọn.
- BẪY B2: fixture PHẢI khai báo `<connection>`.

Cấu hình không mặc định (tạo mới + gom):

```xml
<dimension>Region</dimension>
<elementtype>String</elementtype>
<createdimension>Y</createdimension>
<cleardimension>N</cleardimension>
<clearconsolidations>N</clearconsolidations>
<recreatedimension>N</recreatedimension>
<enableElementCache>Y</enableElementCache>
<preloadElementCache>N</preloadElementCache>
<levels>
  <level>
    <levelname>Country</levelname>
    <levelnumber>0</levelnumber>
    <fieldname>COUNTRY</fieldname>
    <consolidationfieldname>ALL_REGIONS</consolidationfieldname>
  </level>
</levels>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định.
- **`<createdimension>` và `<cleardimension>` bắt buộc có mặt**
  (thiếu → NPE dòng 111–112) — không được lược kể cả khi N.
- **Output KHÔNG có `fieldtype`** trong `<level>` (khác DimInput) —
  thêm tag này bị bỏ qua, thiếu `consolidationfieldname` mới là thiếu thật.
- Fixture phải khai báo connection.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed` — không tuyên bố
  hai mức này.
