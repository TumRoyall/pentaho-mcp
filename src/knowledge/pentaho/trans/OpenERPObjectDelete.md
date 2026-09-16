# OpenERPObjectDelete — Step xóa object OpenERP (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category `Deprecated` (icon `deprecated.svg`). Không có
> replacement trong source 9.4. `status=observed`,
> `generator_eligible=false`.

Xóa các bản ghi của một OpenERP model (`<modelName>`) có id lấy từ cột
dòng tên `<idFieldName>`, qua connection OpenERP (`<connection>` —
THAM CHIẾU tên DatabaseMeta, fixture PHẢI khai báo), theo batch commit
(`<readBatchSize>` — CHÚ Ý: tag XML vẫn tên `readBatchSize` dù field
Java là `commitBatchSize`, giống step Output). Step không đổi schema
dòng (không override `getFields`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OpenERPObjectDelete</type>
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
    <idFieldName>{{ID_FIELD}}</idFieldName>
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
| `<modelName>` | Y | Tên model OpenERP xóa bản ghi (chữ `N` hoa). |
| `<readBatchSize>` | Y (parse) | Batch commit; thực chất là `commitBatchSize` (mặc định step mới `1000`, dòng 49). Thiếu tag → `Integer.parseInt(null)` ném. |
| `<idFieldName>` | Y | Tên CỘT DÒNG chứa id bản ghi cần xóa (dynamic, không phải id cố định). Load về null được chuẩn hóa thành `""` khi đọc qua getter (dòng 160). |

Không có list lặp — fragment chỉ 4 tag scalar theo đúng thứ tự
`getXML()`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: OPENERP_OBJECT_DELETE` | `<type>` | `OpenERPObjectDelete`. |
| `configuration.connection` | `<connection>` | Tên connection OpenERP. |
| `configuration.model` | `<modelName>` | Model xóa. |
| `configuration.commit_batch_size` | `<readBatchSize>` | BẪY TÊN: tag XML là `readBatchSize`. |
| `configuration.id_field` | `<idFieldName>` | Cột dòng chứa id. |

Không có list → điền bằng `set_field_path` từng tag, không dùng
`set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="OpenERPObjectDelete", image =
  "ui/images/deprecated.svg", ...,
  categoryDescription = "...BaseStep.Category.Deprecated")`
  (`plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectdelete/OpenERPObjectDeleteMeta.java`
  dòng 41–44). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 67–77) — đúng 4 tag theo thứ tự
  `connection` (70–71), `modelName` (72), **`readBatchSize` mang giá
  trị `commitBatchSize`** (73), `idFieldName` (74). Không có wrapper
  list nào.
- Deserialization: `loadXML()` (dòng 80–82) gọi `readData()` (dòng
  118–129) — connection qua `DatabaseMeta.findDatabase` (121);
  `commitBatchSize` đọc từ tag `readBatchSize` qua `Integer.parseInt`
  (123, thiếu tag → ném, bọc `KettleXMLException` dòng 126–128).
- Khởi tạo: `setDefault()` RỖNG (dòng 113–116) — step mới giữ nguyên
  giá trị khởi tạo field: `commitBatchSize = 1000` (dòng 49),
  `idFieldName = ""` (dòng 50).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: class không override `getFields()` — schema dòng
  đi qua nguyên vẹn; runtime đọc id từng dòng theo `idFieldName`
  (getter chuẩn hóa null → `""`, dòng 159–161).
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (model + cột id cụ thể):

```xml
<connection>${CONN}</connection>
<modelName>res.partner</modelName>
<readBatchSize>500</readBatchSize>
<idFieldName>OERP_ID</idFieldName>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED**: chỉ đọc/bảo trì workload cũ; không dùng cho pipeline
  mới, không có replacement trong source 9.4.
- **Tag batch commit tên `readBatchSize`** — giống step Output, đừng
  bịa `commitBatchSize`/`commit_batch_size`.
- **`<idFieldName>` là tên cột dòng (dynamic)**, không phải id cố
  định — cột phải tồn tại trong stream trước.
- **Thiếu `<readBatchSize>` là load FAIL** (parseInt không null-guard).
- **Fixture phải khai báo connection**; credential/host/db/login nằm
  trong DatabaseMeta, không embed vào template.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
