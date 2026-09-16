# SampleRows — Step giữ lại các dòng theo khoảng số thứ tự

Chỉ cho qua các dòng có số thứ tự nằm trong `<linesrange>` (chuỗi khoảng,
ví dụ `1,5..10`; mặc định `"1"`), loại bỏ các dòng còn lại. Tùy chọn thêm
cột số thứ tự dòng (`<linenumfield>`, Integer) vào output.
`check()` ERROR khi `linesrange` rỗng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SampleRows</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <linesrange>1..100</linesrange>
    <linenumfield>ROW_NR</linenumfield>
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
| `<linesrange>` | Y | Khoảng dòng giữ lại (ví dụ `1`, `1..100`, `1,5..10`). Mặc định mới `"1"` (`DEFAULT_RANGE`, dòng 63). Rỗng → `check()` ERROR. |
| `<linenumfield>` | N | Tên cột số thứ tự thêm vào (Integer). Mặc định mới null = không thêm. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SAMPLE_ROWS` | `<type>` | `SampleRows`. |
| `configuration.lines_range` | `<linesrange>` | Chuỗi khoảng. |
| `configuration.line_number_field` | `<linenumfield>` | Cột số thứ tự. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 78 —
  `<step id="SampleRows">` →
  `org.pentaho.di.trans.steps.samplerows.SampleRowsMeta` (category
  Statistics).
- Serialization: `getXML()` (dòng 142–148) — đúng 2 tag: `linesrange`
  (144), `linenumfield` (145).
- Deserialization: `readData()` (dòng 89–97) — đọc nguyên văn, không
  fallback (thiếu → null).
- Khởi tạo: `setDefault()` (dòng 115–118) — range `"1"`, field null.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 78–87) append cột Integer tên
  `linenumfield` khi không rỗng; worker lọc theo khoảng (dòng đếm từ 1).
- Không có `<connection>`.

Cấu hình không mặc định (nhiều khoảng, không cột số):

```xml
<linesrange>1..10,50..60</linesrange>
<linenumfield/>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Số dòng đếm từ 1**, không phải 0 — `linesrange=1` giữ dòng đầu tiên.
- Step này LỌC (loại dòng ngoài khoảng), không phải "lấy mẫu ngẫu nhiên"
  như ReservoirSampling.
- Không có `<connection>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
