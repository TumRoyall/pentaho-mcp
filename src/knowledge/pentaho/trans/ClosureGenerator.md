# ClosureGenerator — Step sinh quan hệ bao đóng (transitive closure)

Đọc các cặp `(parent, child)` từ stream vào và phát quan hệ bao đóng
truyền đạt (mọi cặp ancestor–descendant) kèm khoảng cách
(`distance_field`, Integer). `getFields()` XÓA row cũ (`row.clear()`) rồi
dựng lại: `parentId`/`childId` (reuse ValueMeta input khi tìm thấy) +
`distance` Integer LUÔN add (kể cả tên null). Cờ `is_root_zero` (Y/N)
điều khiển distance của root.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ClosureGenerator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <parent_id_field>PARENT_ID</parent_id_field>
    <child_id_field>CHILD_ID</child_id_field>
    <distance_field>DISTANCE</distance_field>
    <is_root_zero>N</is_root_zero>
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
| `<parent_id_field>` | Y | Tên field chứa id cha trong dòng đầu vào. |
| `<child_id_field>` | Y | Tên field chứa id con trong dòng đầu vào. |
| `<distance_field>` | Y | Tên cột khoảng cách (Integer) trong dòng ra. |
| `<is_root_zero>` | N | `Y` = distance root = 0; `N` (mặc định) = theo logic mặc định. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CLOSURE_GENERATOR` | `<type>` | `ClosureGenerator`. |
| `configuration.parent_field` | `<parent_id_field>` | Tham chiếu field input. |
| `configuration.child_field` | `<child_id_field>` | Tham chiếu field input. |
| `configuration.distance_field` | `<distance_field>` | Tên cột Integer output. |
| `configuration.root_zero` | `<is_root_zero>` | Boolean → Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="ClosureGenerator", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/closure/ClosureGeneratorMeta.java`
  dòng 58–60). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `ClosureGeneratorMeta.getXML()` (dòng 129–138) — đúng
  thứ tự `parent_id_field`, `child_id_field`, `distance_field` (3
  string) + `is_root_zero` (boolean → Y/N), luôn emit.
- Deserialization: `loadXML()` (dòng 73–75) gọi `readData()` (dòng
  83–92) — strings null khi thiếu; `rootIdZero="Y".equalsIgnoreCase(...)`
  (thiếu → false). Không `Const.toInt`/`parseInt`, không NPE guard.
- Khởi tạo: `setDefault()` (dòng 95–96) rỗng (no-op); constructor (dòng
  68–70) chỉ `super()` — mọi field = null/false Java default. Component
  mới KHÔNG có tên field nào (template là khung phải điền).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 99–126) `row.clear()` + rebuild:
  `parentId` (reuse ValueMeta input nếu `searchValueMeta` thấy, else bỏ
  qua), `childId` tương tự, `distance=Integer(len
  DEFAULT_INTEGER_LENGTH)` luôn add. **BẪY check đảo logic** (dòng
  167–199): `searchValueMeta(...)!=null` → báo ERROR "could not be
  found" (ngược ý nghĩa) — đọc message check của step này với dự phòng.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (root zero + tên org-chart):

```xml
<parent_id_field>MANAGER_ID</parent_id_field>
<child_id_field>EMP_ID</child_id_field>
<distance_field>LEVELS</distance_field>
<is_root_zero>Y</is_root_zero>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`getFields()` nuốt input**: output CHỈ có 3 cột (parent/child/
  distance) — mọi cột khác của dòng gốc biến mất.
- **Message `check()` bị đảo**: field TỒN TẠI vẫn có thể bị báo "could not
  be found" — không dùng message này làm bằng chứng thiếu field.
- **Thiếu tag → null/false lặng lẽ** — template luôn emit đủ 4 tag.
- **Bắt buộc có input** là các cặp parent/child — step đứng một mình
  không có gì để đóng bao.
- Template mặc định là khung cấu hình — người dùng phải điền 2 field input
  tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
