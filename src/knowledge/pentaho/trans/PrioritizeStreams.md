# PrioritizeStreams — Step sắp thứ tự ưu tiên luồng vào

Khai báo thứ tự ưu tiên các step đầu vào qua list `<steps>/<step>` (mỗi
item chỉ có `<name>` là tên step). Runtime đọc các luồng vào theo đúng
thứ tự đã khai báo. `getFields()` là no-op (giữ schema); `check()`
WARNING khi không có input và ERROR khi thiếu input. Mỗi `<name>` là
THAM CHIẾU step — cần hop thật từ các step đó.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PrioritizeStreams</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <steps>
      <step>
        <name>{{SOURCE_STEP_1}}</name>
      </step>
    </steps>
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
| `<steps>/<step>/<name>` | Y (ít nhất 1 khi chạy) | Tên step đầu vào, theo đúng thứ tự ưu tiên (đầu list = ưu tiên cao nhất). Mỗi tên là THAM CHIẾU step — phải tồn tại và nối hop. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PRIORITIZE_STREAMS` | `<type>` | `PrioritizeStreams`. |
| `configuration.steps[]` | `<steps>/<step>/<name>` | Tên step theo thứ tự ưu tiên. |

`<steps>` chứa list `<step>` đồng nhất (mỗi item chỉ có `<name>`) →
fill bằng MỘT lần `set_fields` (`listTag=steps`, `itemTag=step`).
Chú ý `itemTag=step` trùng tên với root `<step>` nhưng `setFields` chỉ
tìm trong phạm vi `<steps>` nên không nhầm với root.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 117 —
  `<step id="PrioritizeStreams">` →
  `org.pentaho.di.trans.steps.prioritizestreams.PrioritizeStreamsMeta`
  (category Flow). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `PrioritizeStreamsMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/prioritizestreams/PrioritizeStreamsMeta.java`
  dòng 120–132) — wrapper `<steps>`, mỗi item `<step>` chỉ emit duy nhất
  `<name>` (string). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 66–68) gọi `readData()` (dòng
  104–118) — `getSubNode("steps")` + `countNodes(..., "step")`, mỗi item
  `getTagValue(fnode, "name")`. `<steps>` thiếu → bọc try thành
  `KettleXMLException` (backward-compat yếu — luôn giữ `<steps>` paired).
- Khởi tạo: `setDefault()` (dòng 134–142) — `allocate(0)` (0 step).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 99–102) là no-op. `check()`
  (dòng 169–206) WARNING khi `prev` rỗng hoặc list rỗng; ERROR khi không
  có input stream.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 luồng ưu tiên):

```xml
<steps>
  <step>
    <name>HIGH_PRIORITY_SOURCE</name>
  </step>
  <step>
    <name>LOW_PRIORITY_SOURCE</name>
  </step>
</steps>
```

Fill bằng `set_fields` (`listTag=steps`, `itemTag=step`).

## 5. Lưu ý / bẫy — CRITICAL

- **Tên step phải khớp hop thật**: `<name>` là tham chiếu — step không
  tồn tại hoặc thiếu hop thì runtime không đọc được luồng (và `check()`
  WARNING/ERROR).
- **Thứ tự list = thứ tự ưu tiên** — đảo thứ tự là đổi semantics, không
  phải cosmetic.
- **Không bịa thêm tag trong item**: mỗi `<step>` chỉ có `<name>` —
  không có `<type>`, `<priority>` hay weight nào.
- **`<steps>` luôn paired** — self-closing làm `setFields` ném lỗi.
- Template mặc định là khung cấu hình — người dùng phải điền step nguồn
  tồn tại và nối hop trước khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
