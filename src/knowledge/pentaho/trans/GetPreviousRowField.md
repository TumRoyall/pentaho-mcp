# GetPreviousRowField — Step lấy giá trị dòng trước (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`.

Sao chép giá trị của một field từ DÒNG TRƯỚC sang dòng hiện tại: mỗi
`<field>` ánh xạ `<in_stream_name>` (cột input đọc) sang
`<out_stream_name>` (cột mới ghi). `getFields()` THÊM một cột mới cho
mỗi mapping (giữ nguyên kiểu/length/precision/mask của cột gốc), không
xóa cột nào. Field `schema` trong class KHÔNG được serialize ra XML
(chỉ lưu repository) — template không mang tag schema.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetPreviousRowField</type>
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
        <in_stream_name>{{SOURCE_FIELD}}</in_stream_name>
        <out_stream_name>{{PREV_VALUE_FIELD}}</out_stream_name>
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
| `<fields>/<field>/<in_stream_name>` | Y | Cột input đọc giá trị dòng trước — phải tồn tại trong stream trước (`check()` ERROR `MissingInStreamFields` khi thiếu; ERROR `FieldInputError` khi trùng lặp giữa các mapping). |
| `<fields>/<field>/<out_stream_name>` | Y | Tên cột mới chứa giá trị dòng trước (`check()` ERROR khi rỗng). Cột mới cùng kiểu với cột gốc (`getFields()` clone type/length/precision/mask). |

`<fields>` paired list — giữ paired (self-closing làm `setFields` ném lỗi).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_PREVIOUS_ROW_FIELD` | `<type>` | `GetPreviousRowField`. |
| `configuration.mappings[].input` | `<fields>/<field>/<in_stream_name>` | Cột đọc. |
| `configuration.mappings[].output` | `<fields>/<field>/<out_stream_name>` | Cột mới. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="GetPreviousRowField", ...)`
  (`plugins/get-previous-row-field/core/src/main/java/org/pentaho/di/trans/steps/getpreviousrowfield/GetPreviousRowFieldMeta.java`
  dòng 61–64, `categoryDescription = ...JobCategory.Category.Deprecated`).
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 171–186) — chỉ emit DUY NHẤT một block
  `<fields>`; mỗi `<field>` có `<in_stream_name>` (dòng 178) và
  `<out_stream_name>` (dòng 179). KHÔNG serialize `schema` (chỉ
  `readRep`/`saveRep` dòng 189–222 dùng). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 114–116) gọi `readData()` (dòng
  138–157) — đếm `<field>` trong `<fields>` (dòng 142–143),
  `allocate(nrkeys)` (dòng 145); mỗi `<field>` đọc qua `Const.NVL(..., "")`
  (dòng 150–151) nên tag thiếu/rỗng → chuỗi rỗng, không NPE.
- Khởi tạo: `setDefault()` (dòng 160–168) — `fieldInStream = null`,
  `fieldOutStream = null`, `schema = ""`, rồi `allocate(0)`: step mới có
  0 mapping (tách khỏi fallback load `""` ở trên).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 225–249) — với mỗi mapping có
  `out_stream_name` không rỗng, tìm cột input (`indexOfValue`, dòng 231)
  và THÊM một cột mới cùng type/length/precision/mask (dòng 235–242);
  mapping trỏ cột input không tồn tại thì bị bỏ qua lặng lẽ (không thêm
  cột). Hỗ trợ error handling (`supportsErrorHandling()` true, dòng 374).
  `check()` (dòng 252–345) ERROR khi không có input, khi cột input thiếu,
  khi output rỗng, khi input rỗng hoặc trùng.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.
- Không có replacement pointer trong source; chức năng tương đương có ở
  `AnalyticQuery` (hàm `LAG`) — nhận xét biên tập, không phải trích dẫn source.

Cấu hình không mặc định (2 mapping):

```xml
<fields>
  <field>
    <in_stream_name>ORDER_TOTAL</in_stream_name>
    <out_stream_name>PREV_ORDER_TOTAL</out_stream_name>
  </field>
  <field>
    <in_stream_name>ORDER_DATE</in_stream_name>
    <out_stream_name>PREV_ORDER_DATE</out_stream_name>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category Deprecated, dòng 64): chỉ đọc/bảo trì; nhu cầu
  mới dùng `AnalyticQuery` (`LAG`).
- **KHÔNG bịa `<schema>`**: field `schema` tồn tại trong class nhưng
  `getXML()` không emit — template mang `<schema>` là sai source.
- **Không bịa thêm tag**: `getXML()` chỉ emit `<fields>` — không có
  `<connection>` hay cờ nào khác.
- **Mapping trỏ cột không tồn tại bị bỏ qua lặng lẽ** ở `getFields()`
  (dòng 231–232: `index >= 0` mới thêm) — chỉ `check()` báo ERROR.
- Template mặc định là khung cấu hình — người dùng phải điền mapping trỏ
  cột tồn tại trong stream trước; dòng đầu tiên của stream không có "dòng
  trước" (runtime xử lý, xem `GetPreviousRowField` worker).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
