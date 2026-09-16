# PaloDimInput — Step đọc dimension Palo (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@Step` category `BaseStep.Category.Deprecated`, icon `deprecated.svg`).
> Reference này phục vụ **đọc/bảo trì workload cũ** — `status: observed`,
> `generator_eligible: false`, KHÔNG phát sinh step mới. Không có replacement
> canonical nào được source chỉ định.

Đọc các phần tử của một Palo dimension (`<dimension>`) trên connection
Palo (`<connection>` — fixture PHẢI khai báo) thành các dòng: mỗi level
trong `<levels>/<level>` (`levelname`/`levelnumber`/`fieldname`/
`fieldtype`) thành một cột. `<baseElementsOnly>=Y` chỉ lấy phần tử gốc.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PaloDimInput</type>
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
    <baseElementsOnly>N</baseElementsOnly>
    <levels>
      <level>
        <levelname>Level0</levelname>
        <levelnumber>0</levelnumber>
        <fieldname>{{LEVEL_FIELD}}</fieldname>
        <fieldtype>String</fieldtype>
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
| `<dimension>` | Y | Tên dimension. |
| `<baseElementsOnly>` | N | Y = chỉ phần tử gốc; thiếu → false (null-guard dòng 99–101). |
| `<levels>/<level>/<levelname>` | Y | Tên level. |
| `<levels>/<level>/<levelnumber>` | Y | SỐ nguyên (parseInt, dòng 115 — thiếu/không số → load FAIL). |
| `<levels>/<level>/<fieldname>` | Y | Tên cột output. |
| `<levels>/<level>/<fieldtype>` | Y | Kiểu cột (rỗng → `check()` ERROR). |

List `<levels>`/`<level>` paired — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PALO_DIM_INPUT` | `<type>` | `PaloDimInput`. |
| `configuration.connection` | `<connection>` | Tên connection. |
| `configuration.dimension` | `<dimension>` | Dimension. |
| `configuration.base_elements_only` | `<baseElementsOnly>` | Y/N. |
| `configuration.levels[].name` | `<levels>/<level>/<levelname>` | Tên level. |
| `configuration.levels[].number` | `<levels>/<level>/<levelnumber>` | Số nguyên. |
| `configuration.levels[].field` | `<levels>/<level>/<fieldname>` | Cột output. |

`<levels>` → MỘT lần `set_fields` (`listTag=levels`, `itemTag=level`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="PaloDimInput", ...)`
  (`plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/diminput/PaloDimInputMeta.java`
  dòng 54–58, category Deprecated, icon `deprecated.svg`). Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 146–165) — `connection` (149–150),
  `dimension` (151), `baseElementsOnly` Y/N (152), `<levels>` (154–163;
  `levelname` 157, `levelnumber` 158, `fieldname` 159, `fieldtype` 160).
- Deserialization: `readData()` (dòng 94–120) qua `loadXML()` (dòng
  84–87) — `baseElementsOnly` null-guard (99–101); `<levels>` đếm
  `<level>` (105–106); `levelnumber` qua `Integer.parseInt` KHÔNG
  null-guard (115, thiếu → load FAIL bọc `KettleXMLException`).
- Khởi tạo: `setDefault()` RỖNG (dòng 122–123).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 125–144) ném lỗi khi thiếu
  connection; ngược lại build schema qua server thật.
- `getUsedDatabaseConnections()` (dòng 287–293) trả connection đã chọn.
- BẪY B2: fixture PHẢI khai báo `<connection>`.

Cấu hình không mặc định (2 level, chỉ phần tử gốc):

```xml
<dimension>Region</dimension>
<baseElementsOnly>Y</baseElementsOnly>
<levels>
  <level>
    <levelname>Country</levelname>
    <levelnumber>0</levelnumber>
    <fieldname>COUNTRY</fieldname>
    <fieldtype>String</fieldtype>
  </level>
  <level>
    <levelname>City</levelname>
    <levelnumber>1</levelnumber>
    <fieldname>CITY</fieldname>
    <fieldtype>String</fieldtype>
  </level>
</levels>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định.
- **`<levelnumber>` phải là số** (parseInt dòng 115) — thiếu hoặc chữ
  → load FAIL toàn step.
- **List là `<levels>`/`<level>`**, không phải `<fields>`/`<field>` —
  đừng copy từ CellInput.
- Fixture phải khai báo connection.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed` — không tuyên bố
  hai mức này.
