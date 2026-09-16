# JavaFilter — Step lọc dòng bằng biểu thức Java (2 nhánh)

Đánh giá biểu thức boolean Janino (`<condition>`) trên MỖI dòng đầu vào:
true → hop tới step `<send_true_to>`, false → hop tới
`<send_false_to>`. Hai target là info-stream THAM CHIẾU STEP (bắt buộc
nối hop khi chạy; `check()` cảnh báo khi thiếu). Step không thêm/bớt cột.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>JavaFilter</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <send_true_to>{{TRUE_STEP}}</send_true_to>
    <send_false_to>{{FALSE_STEP}}</send_false_to>
    <condition>{{INPUT_FIELD}} != null &amp;&amp; {{INPUT_FIELD}}.length() &gt; 0</condition>
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
| `<send_true_to>` | Y (khi chạy) | Tên step nhận dòng true (tham chiếu hop). |
| `<send_false_to>` | Y (khi chạy) | Tên step nhận dòng false (tham chiếu hop). |
| `<condition>` | Y | Biểu thức boolean Janino; mặc định mới `"true"`. Giữ nguyên văn, escape XML. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: JAVA_FILTER` | `<type>` | `JavaFilter`. |
| `configuration.true_step` | `<send_true_to>` | Tham chiếu step. |
| `configuration.false_step` | `<send_false_to>` | Tham chiếu step. |
| `configuration.condition` | `<condition>` | Biểu thức boolean. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 17 —
  `<step id="JavaFilter">` →
  `org.pentaho.di.trans.steps.javafilter.JavaFilterMeta` (category Flow).
- Serialization: `JavaFilterMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/javafilter/JavaFilterMeta.java`
  dòng 92–102) — `send_true_to` từ target stream 0 (96),
  `send_false_to` từ stream 1 (97), `condition` (99).
- Deserialization: `loadXML()` (dòng 83–90) — đọc 2 target vào
  StepIOMeta (86–87), `condition` nguyên văn (89, không fallback).
- Khởi tạo: `setDefault()` (dòng 123–125) — `condition "true"`.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker route từng dòng theo kết quả boolean; cột
  giữ nguyên. `check()` đòi 2 hop ra (theo StepIOMeta target streams).
- Không có `<connection>`.

Cấu hình không mặc định (lọc số dương):

```xml
<send_true_to>Positive rows</send_true_to>
<send_false_to>Non-positive rows</send_false_to>
<condition>AMOUNT != null &amp;&amp; AMOUNT &gt; 0</condition>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Hai target là tham chiếu hop**: fixture chạy thật cần 2 step đích +
  hop; validator knowledge chỉ kiểm tra XML parse (không kiểm hop).
- **Điều kiện XML-escape** (`&&` → `&amp;&amp;`, `>` → `&gt;`).
- Mặc định `"true"` — step mới cho mọi dòng đi nhánh true.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
