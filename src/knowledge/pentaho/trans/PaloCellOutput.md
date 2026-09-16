# PaloCellOutput — Step ghi ô cube Palo (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@Step` category `BaseStep.Category.Deprecated`, icon `deprecated.svg`).
> Reference này phục vụ **đọc/bảo trì workload cũ** — `status: observed`,
> `generator_eligible: false`, KHÔNG phát sinh step mới. Không có replacement
> canonical nào được source chỉ định.

Với MỖI dòng đầu vào, ghi một ô vào Palo cube (`<cube>`) trên connection
Palo (`<connection>` — fixture PHẢI khai báo): các chiều lấy từ cột dòng
theo `<fields>/<field>` (`dimensionname`/`fieldname`/`fieldtype`), giá trị
measure từ `<measures>/<measure>` (`measurename`/`measurefieldname`/
`measurefieldtype`). Chế độ ghi `<updateMode>` (mặc định `"SET"`),
`<splashMode>` (`"DISABLED"`), `<clearcube>`, cache và `<commitSize>`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PaloCellOutput</type>
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
    <measuretype>Number</measuretype>
    <updateMode>SET</updateMode>
    <splashMode>DISABLED</splashMode>
    <clearcube>N</clearcube>
    <enableDimensionCache>Y</enableDimensionCache>
    <preloadDimensionCache>Y</preloadDimensionCache>
    <commitSize>1000</commitSize>
    <fields>
      <field>
        <dimensionname>Region</dimensionname>
        <fieldname>{{DIM_FIELD_REGION}}</fieldname>
        <fieldtype>String</fieldtype>
      </field>
    </fields>
    <measures>
      <measure>
        <measurename>Sales</measurename>
        <measurefieldname>{{MEASURE_FIELD}}</measurefieldname>
        <measurefieldtype>Number</measurefieldtype>
      </measure>
    </measures>
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
| `<cube>` | Y | Cube đích. |
| `<measuretype>` | N | Kiểu measure. |
| `<updateMode>` | N | Mặc định `"SET"` (setDefault khi null sau load). |
| `<splashMode>` | N | Mặc định `"DISABLED"`. |
| `<clearcube>` | N | Y = xóa cube trước khi ghi. BẮT BUỘC có tag (thiếu → NPE khi load, dòng 118). |
| `<enableDimensionCache>` / `<preloadDimensionCache>` / `<commitSize>` | N | Thiếu → fallback tương thích false/false/1000 (dòng 121–131). Template vẫn pin tường minh. |
| `<fields>/<field>` | Y | `dimensionname`/`fieldname`/`fieldtype` như CellInput. |
| `<measures>/<measure>` | Y | `measurename`, `measurefieldname` (rỗng → emit `"CHOOSE FIELD"`), `measurefieldtype`. Chỉ đọc measure ĐẦU TIÊN khi load (dòng 153–160, `break`). |

Hai list paired (`<fields>`/`<field>`, `<measures>`/`<measure>`) — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PALO_CELL_OUTPUT` | `<type>` | `PaloCellOutput`. |
| `configuration.connection` | `<connection>` | Tên connection. |
| `configuration.cube` | `<cube>` | Cube đích. |
| `configuration.update_mode` | `<updateMode>` | `SET`... |
| `configuration.dimensions[].dimension` | `<fields>/<field>/<dimensionname>` | Chiều. |
| `configuration.measure` | `<measures>/<measure>/<measurename>` | Measure. |
| `configuration.measure_field` | `<measures>/<measure>/<measurefieldname>` | Cột giá trị. |

`<fields>` và `<measures>` → mỗi list MỘT lần `set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="PaloCellOutput", ...)`
  (`plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/celloutput/PaloCellOutputMeta.java`
  dòng 54–58, category Deprecated, icon `deprecated.svg`). Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Mặc định field: `updateMode "SET"` (dòng 64),
  `splashMode "DISABLED"` (65), `commitSize 1000` (69), cache true/true
  (70–71). `setDefault()` (dòng 77–84) chỉ vá null
  updateMode/splashMode.
- Serialization: `getXML()` (dòng 169–211) — `connection` (172–173),
  `cube` (174), `measuretype` (175), `updateMode` (176), `splashMode`
  (177), `clearcube` Y/N (178), `enableDimensionCache` (179),
  `preloadDimensionCache` (180), `commitSize` số (181), `<fields>`
  (183–191), `<measures>` (193–208; chỉ emit khi measure name `!= ""`
  — so sánh tham chiếu dòng 197; field rỗng → `"CHOOSE FIELD"`
  200–204).
- Deserialization: `readData()` (dòng 110–167) qua `loadXML()` (dòng
  100–103) — `clearcube` `.equals("Y")` KHÔNG null-guard (118, thiếu →
  NPE); 3 tag cache/commit trong try tương thích (121–131, thiếu →
  false/false/1000); chỉ `<measure>` đầu được đọc (153–160); cuối gọi
  `setDefault()` (162).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- `getUsedDatabaseConnections()` (dòng 368–374) trả connection đã chọn.
- BẪY B2: fixture PHẢI khai báo `<connection>`.

Cấu hình không mặc định (clear + splash):

```xml
<updateMode>ADD</updateMode>
<splashMode>DEFAULT</splashMode>
<clearcube>Y</clearcube>
<commitSize>500</commitSize>
<measures>
  <measure>
    <measurename>Revenue</measurename>
    <measurefieldname>REV</measurefieldname>
    <measurefieldtype>Number</measurefieldtype>
  </measure>
</measures>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định.
- **`<clearcube>` bắt buộc có mặt** (thiếu → NPE dòng 118); 3 tag
  cache/commit thiếu an toàn nhưng luôn pin tường minh.
- **Chỉ 1 measure**: load `break` sau measure đầu — khai báo 2 measure
  thì cái thứ hai bị lặng lẽ bỏ.
- Fixture phải khai báo connection.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed` — không tuyên bố
  hai mức này.
