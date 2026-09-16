# ReservoirSampling — Step lấy mẫu ngẫu nhiên (thuật toán reservoir)

Lấy mẫu ngẫu nhiên cỡ `<sample_size>` từ toàn bộ stream bằng thuật toán
reservoir sampling với seed `<seed>` (lặp lại được khi seed cố định). Cấu
hình bọc trong block `<reservoir_sampling>` (chứa `sample_size` +
`seed`, cả hai dạng CHUỖI số). Output = các dòng mẫu, schema giữ nguyên
(không thêm cột).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ReservoirSampling</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <reservoir_sampling>
      <sample_size>1000</sample_size>
      <seed>42</seed>
    </reservoir_sampling>
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
| `<reservoir_sampling>/<sample_size>` | Y | Cỡ mẫu, chuỗi số; mặc định `"100"`. Parse `Integer.valueOf` lúc chạy — chữ → lỗi runtime (không phải lỗi load). |
| `<reservoir_sampling>/<seed>` | Y | Seed RNG, chuỗi số; mặc định `"1"`. Cùng seed → cùng mẫu. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RESERVOIR_SAMPLING` | `<type>` | `ReservoirSampling`. |
| `configuration.sample_size` | `<reservoir_sampling>/<sample_size>` | Chuỗi số. |
| `configuration.seed` | `<reservoir_sampling>/<seed>` | Chuỗi số. |

Không dùng `set_fields` (block đơn, không phải list).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 88 —
  `<step id="ReservoirSampling">` → `...reservoirsampling.ReservoirSamplingMeta`
  (category Statistics).
- Tên block: `XML_TAG = "reservoir_sampling"` (dòng 58).
- Serialization: `getXML()` (dòng 116–125) — mở `<reservoir_sampling>`
  (119), `sample_size` (120), `seed` (121), đóng block (122).
- Deserialization: `loadXML()` (dòng 174–185) — CHỈ đọc khi block tồn
  tại (`nrSteps > 0`, 178); thiếu block → giữ mặc định field
  `"100"`/`"1"` (dòng 61/64), không fail.
- Khởi tạo: `setDefault()` (dòng 151–154) — `"100"` / `"1"`.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker `ReservoirSampling` init
  `initialize(Integer.valueOf(sampleSize), Integer.valueOf(seed))`
  (`ReservoirSampling.java` dòng 109–110) — MỘT pass, reservoir thay
  dần; output schema = input (không thêm cột).
- Không có `<connection>`.

Cấu hình không mặc định (mẫu nhỏ, seed cố định):

```xml
<reservoir_sampling>
  <sample_size>50</sample_size>
  <seed>7</seed>
</reservoir_sampling>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Block bọc `<reservoir_sampling>` bắt buộc**: `sample_size`/`seed`
  nằm TRONG block, không trực tiếp dưới `<step>`.
- **Chuỗi số nhưng parse lúc chạy**: giá trị không số load OK nhưng
  chạy FAIL (`Integer.valueOf` dòng 110) — template luôn dùng số.
- Khác SampleRows (khoảng cố định): đây là mẫu NGẪU NHIÊN.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
