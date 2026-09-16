# OpenERPObjectOutputImport — Step ghi object OpenERP (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category `Deprecated` (icon `deprecated.svg`). Không có
> replacement trong source 9.4. `status=observed`,
> `generator_eligible=false`.
>
> **Chú ý ID:** XML `<type>` là `OpenERPObjectOutputImport` (khác tên
> class `OpenERPObjectOutputMeta` và khác tên file Java
> `objectoutput/`). Đừng nhầm thành `OpenERPObjectOutput`.

Ghi (import) từng dòng đầu vào thành bản ghi của một OpenERP model
(`<modelName>`) qua connection OpenERP (`<connection>` — THAM CHIẾU
tên DatabaseMeta, fixture PHẢI khai báo), theo batch commit
(`<readBatchSize>` — CHÚ Ý: tag XML vẫn tên `readBatchSize` dù field
Java là `commitBatchSize`). Ánh xạ cột dòng → field model trong
`<mappings>/<mapping>`; tra khóa trùng trong
`<key_mappings>/<key_map>`. Khi `<outputIDField>Y</outputIDField>`,
step gắn thêm cột id kiểu Integer tên `<outputIDFieldName>`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OpenERPObjectOutputImport</type>
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
    <readBatchSize>100</readBatchSize>
    <outputIDField>N</outputIDField>
    <outputIDFieldName/>
    <mappings>
      <mapping>
        <model_field>name</model_field>
        <stream_field>PARTNER_NAME</stream_field>
      </mapping>
    </mappings>
    <key_mappings>
      <key_map>
        <model_key_field>name</model_key_field>
        <comparitor>=</comparitor>
        <stream_key_field>PARTNER_NAME</stream_key_field>
      </key_map>
    </key_mappings>
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
| `<connection>` | Y | Tên DatabaseMeta OpenERP (THAM CHIẾU). Chỉ `${VAR}`, không credential thật. |
| `<modelName>` | Y | Tên model OpenERP ghi vào (chữ `N` hoa). |
| `<readBatchSize>` | Y (parse) | Batch commit; thực chất là `commitBatchSize` (mặc định step mới `100`, dòng 56). Thiếu tag → `Integer.parseInt(null)` ném. |
| `<outputIDField>` | N | `Y` = gắn thêm cột id Integer vào dòng ra; `N` (mặc định) = không. **Thiếu tag → NPE** (`.equals("Y")` trên null, dòng 210). Luôn ghi rõ Y/N. |
| `<outputIDFieldName>` | Y khi outputIDField=Y | Tên cột id gắn thêm; `getFields()` ném lỗi khi rỗng (dòng 67–69). |
| `<mappings>/<mapping>/<model_field>` | Y | Field model OpenERP nhận giá trị. |
| `<mappings>/<mapping>/<stream_field>` | Y | Cột dòng đầu vào cung cấp giá trị. |
| `<key_mappings>/<key_map>/<model_key_field>` | Y (mỗi key_map) | Field model dùng tra trùng. |
| `<key_mappings>/<key_map>/<comparitor>` | Y (mỗi key_map) | Phép so sánh — CHÚ Ý chính tả source: `comparitor` (viết `comparator` là sai tag, load bỏ qua). |
| `<key_mappings>/<key_map>/<stream_key_field>` | Y (mỗi key_map) | Cột dòng dùng tra trùng. |

`<mappings>` và `<key_mappings>` LUÔN emit (kể cả rỗng, dòng
104/111–113/121) → template giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: OPENERP_OBJECT_OUTPUT_IMPORT` | `<type>` | `OpenERPObjectOutputImport` (đầy đủ, không rút gọn). |
| `configuration.connection` | `<connection>` | Tên connection OpenERP. |
| `configuration.model` | `<modelName>` | Model ghi. |
| `configuration.commit_batch_size` | `<readBatchSize>` | BẪY TÊN: tag XML là `readBatchSize`, không phải `commitBatchSize`. |
| `configuration.output_id_field` | `<outputIDField>` | Boolean → Y/N; luôn emit. |
| `configuration.output_id_field_name` | `<outputIDFieldName>` | Tên cột id Integer. |
| `configuration.mappings[]` | `<mappings>/<mapping>/model_field+stream_field` | Cột → field model. |
| `configuration.key_lookups[]` | `<key_mappings>/<key_map>/...` | Giữ nguyên chính tả `comparitor`. |

`<mappings>` → MỘT lần `set_fields` (`listTag=mappings`,
`itemTag=mapping`); `<key_mappings>` → MỘT lần `set_fields`
(`listTag=key_mappings`, `itemTag=key_map`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="OpenERPObjectOutputImport", image =
  "ui/images/deprecated.svg", ...,
  categoryDescription = "...BaseStep.Category.Deprecated")`
  (`plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectoutput/OpenERPObjectOutputMeta.java`
  dòng 48–51). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 94–124) — thứ tự `connection`
  (97–98), `modelName` (99), **`readBatchSize` mang giá trị
  `commitBatchSize`** (100), `outputIDField` boolean Y/N (101),
  `outputIDFieldName` (102), rồi `<mappings>` LUÔN emit (104–111; mỗi
  `<mapping>` có `model_field` 107, `stream_field` 108) và
  `<key_mappings>` LUÔN emit (113–121; mỗi `<key_map>` có
  `model_key_field` 116, `comparitor` 117 — giữ nguyên chính tả
  source, `stream_key_field` 118).
- Deserialization: `loadXML()` (dòng 127–129) gọi `readData()` (dòng
  204–244) — `commitBatchSize` đọc từ tag `readBatchSize` (209);
  `outputIDField` qua
  `XMLHandler.getTagValue(...).equals("Y")` (210, **thiếu tag → NPE**,
  bọc `KettleXMLException` dòng 241–243); mappings đếm `<mapping>`
  trong sub-node `<mappings>` (213–214, `allocate`, 216); key lookups
  đếm `<key_map>` trong sub-node `<key_mappings>` (225–226).
- Khởi tạo: `setDefault()` RỖNG (dòng 199–202) — step mới giữ nguyên
  giá trị khởi tạo field: `commitBatchSize = 100` (dòng 56),
  `outputIDField = false` (59), `outputIDFieldName = ""` (60),
  0 mapping.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 64–76) chỉ gắn thêm MỘT cột
  Integer `outputIDFieldName` khi `outputIDField` true — và NÉM
  `KettleStepException` khi tên cột rỗng (67–69). Các field model
  không vào schema dòng ra.
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (gắn cột id + 2 mapping):

```xml
<readBatchSize>500</readBatchSize>
<outputIDField>Y</outputIDField>
<outputIDFieldName>OERP_ID</outputIDFieldName>
<mappings>
  <mapping>
    <model_field>name</model_field>
    <stream_field>PARTNER_NAME</stream_field>
  </mapping>
  <mapping>
    <model_field>email</model_field>
    <stream_field>PARTNER_EMAIL</stream_field>
  </mapping>
</mappings>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED**: chỉ đọc/bảo trì workload cũ; không dùng cho pipeline
  mới, không có replacement trong source 9.4.
- **XML type ≠ tên class**: `<type>` phải là
  `OpenERPObjectOutputImport` đầy đủ — `OpenERPObjectOutput` là sai.
- **Tag batch commit tên `readBatchSize`**, không phải
  `commitBatchSize` — ghi sai tên tag là load bỏ qua, batch về parse
  null → ném.
- **`comparitor`** (không phải `comparator`) trong `<key_map>` — sai
  một chữ là tag lạ, load bỏ qua lặng lẽ.
- **`<outputIDField>` thiếu là NPE khi load** — luôn ghi rõ Y/N.
- **Fixture phải khai báo connection**; credential/host/db/login nằm
  trong DatabaseMeta, không embed vào template.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
