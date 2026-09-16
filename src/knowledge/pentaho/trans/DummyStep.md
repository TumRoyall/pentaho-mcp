# DummyStep — Step giữ chỗ tương thích ngược (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`.

Step giữ chỗ của plugin tương thích ngược (`be.ibridge`): giữ một hằng
giá trị duy nhất trong `<values>/<value>` và cộng thêm đúng MỘT cột vào
stream (`getFields()` thêm `valueMeta`, không xóa gì). KHÁC trans `Dummy`
(đã có trong catalog, alias `DUMMY`, step pass-through không config) —
đây là step ID `DummyStep` với class `DummyPluginMeta` riêng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DummyStep</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <values>
      <value>
        <name>valuename</name>
        <type>Number</type>
        <text>123.456</text>
        <length>12</length>
        <precision>4</precision>
        <isnull>N</isnull>
        <mask/>
      </value>
    </values>
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
| `<values>/<value>/<name>` | Y | Tên cột hằng được thêm vào stream (`getFields()` thêm `valueMeta` với origin là step). |
| `<values>/<value>/<type>` | Y | Kiểu value-meta dạng chuỗi (`Number`, `String`, ...; load qua `ValueMetaBase.getType()`). |
| `<values>/<value>/<text>` | Y | Giá trị hằng dạng chuỗi (convert sang kiểu `<type>` khi load). |
| `<values>/<value>/<length>` / `<precision>` | N | Thiếu → `-1` (`Const.toInt(..., -1)` khi load). |
| `<values>/<value>/<isnull>` | N | `Y` = null (so khớp `equalsIgnoreCase`; thiếu → false). |
| `<values>/<value>/<mask>` | N | Conversion mask (có thể rỗng). |

`<values>` luôn được emit (kể cả khi value null — khi đó rỗng); khi có
value thì bọc đúng MỘT `<value>`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DUMMY_STEP` | `<type>` | `DummyStep` (khác `Dummy`). |
| `configuration.value_name` | `<values>/<value>/<name>` | Cột hằng. |
| `configuration.value_type` | `<values>/<value>/<type>` | Kiểu chuỗi. |
| `configuration.value_text` | `<values>/<value>/<text>` | Giá trị chuỗi. |

Các tag con của `<value>` là flat — fill bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "DummyStep", ...)`
  (`plugins/dummy/core/src/main/java/org/pentaho/di/be/ibridge/kettle/dummy/DummyPluginMeta.java`
  dòng 47–53, image `deprecated.svg`, category Deprecated, suggestion
  `DummyPlugin.Step.SuggestedStep`). KHÁC trans `Dummy` trong catalog
  (class/registry khác). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 76–86) — luôn emit block `<values>`
  (dòng 79/83); khi `value != null` thì chèn `value.getXML()` (dòng
  80–82). Nội dung `<value>` do `ValueMetaAndData.getXML()`
  (`core/src/main/java/org/pentaho/di/core/row/ValueMetaAndData.java`
  dòng 116–139): tag `<value>` (dòng 123/136, hằng `XML_TAG = "value"`
  dòng 43), thứ tự `name` (124), `type` (125), `text` (127/130),
  `length` (132), `precision` (133), `isnull` (134), `mask` (135).
- Deserialization: `loadXML()` (dòng 105–117) — đọc sub-node
  `values/value` (dòng 109, null-guard dòng 110: thiếu → giữ
  `ValueMetaAndData` rỗng); `ValueMetaAndData.loadXML()` (dòng 159–174)
  đọc `name`/`type`/`text`/`isnull` (case-insensitive `Y`)/`length`/
  `precision` (thiếu → `-1`)/`mask`.
- Khởi tạo: `setDefault()` (dòng 120–124) — hằng `Number` tên
  `valuename` = `123.456`, `length = 12`, `precision = 4` (đúng giá trị
  template mặc định ở mục 1).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 89–96) — chỉ THÊM `valueMeta`
  (khi non-null), không xóa/sửa cột nào; `check()` (dòng 172–190) WARNING
  khi không có input trước, ERROR khi không có hop vào.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (cờ chuỗi):

```xml
<values>
  <value>
    <name>MIGRATION_FLAG</name>
    <type>String</type>
    <text>MIGRATED</text>
    <length>20</length>
    <precision>-1</precision>
    <isnull>N</isnull>
    <mask/>
  </value>
</values>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (image deprecated + category Deprecated, dòng 47–53):
  chỉ đọc/bảo trì.
- **Đừng nhầm với trans `Dummy`**: `Dummy` (alias `DUMMY`) là step
  pass-through không config; `DummyStep` (alias `DUMMY_STEP`) mang một
  hằng `<value>` và thêm một cột. Hai XML type khác nhau.
- **`<values>` bọc ngoài, `<value>` đơn bên trong** — thứ tự con:
  `name`, `type`, `text`, `length`, `precision`, `isnull`, `mask`
  (theo `ValueMetaAndData.getXML()`).
- Template mặc định là khung cấu hình — giá trị `valuename = 123.456`
  là default của `setDefault()`, người dùng workload cũ giữ nguyên khi đọc.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
