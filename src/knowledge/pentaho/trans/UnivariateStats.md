# UnivariateStats — Step thống kê đơn biến

Tính thống kê mô tả (N, mean, độ lệch chuẩn, min, max, median,
percentile tùy ý, nội suy) cho mỗi cột liệt kê trong các block
`<univariate_stats>` TRỰC TIẾP dưới `<step>` (KHÔNG bọc `<fields>` —
giống họ Janino). Từng block: `source_field_name` + các cờ Y/N (`N`,
`mean`, `stdDev`, `min`, `max`, `median`, `interpolate`) + `percentile`
(số thực, `-1` = không tính).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>UnivariateStats</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <univariate_stats>
      <source_field_name>{{INPUT_FIELD}}</source_field_name>
      <N>Y</N>
      <mean>Y</mean>
      <stdDev>Y</stdDev>
      <min>Y</min>
      <max>Y</max>
      <median>N</median>
      <percentile>-1</percentile>
      <interpolate>Y</interpolate>
    </univariate_stats>
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
| `<univariate_stats>/<source_field_name>` | Y | Cột nguồn tính thống kê. |
| `<univariate_stats>/<N>` / `<mean>` / `<stdDev>` / `<min>` / `<max>` / `<median>` / `<interpolate>` | Y* | Cờ Y/N — BẮT BUỘC có mặt (thiếu → NPE khi load, `temp.equalsIgnoreCase` không null-guard). Mặc định hàm mới đều true (trừ percentile -1). |
| `<univariate_stats>/<percentile>` | Y* | Số thực 0..1 (ví dụ `0.95`); `-1` = không tính. Lỗi parse → -1 (an toàn). |

Nhiều `<univariate_stats>` ngang hàng cho nhiều cột.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: UNIVARIATE_STATS` | `<type>` | `UnivariateStats`. |
| `configuration.stats[].source_field` | `<univariate_stats>/<source_field_name>` | Cột nguồn. |
| `configuration.stats[].mean` ... | `<univariate_stats>/<mean>` ... | Y/N từng thống kê. |
| `configuration.stats[].percentile` | `<univariate_stats>/<percentile>` | Số thực hoặc -1. |

Mỗi thống kê là một block `<univariate_stats>` lặp (không phải
`set_fields` chuẩn).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 89 —
  `<step id="UnivariateStats">` → `...univariatestats.UnivariateStatsMeta`
  (category Statistics).
- Tên block: `XML_TAG = "univariate_stats"` (dòng 44).
- Serialization: `UnivariateStatsMetaFunction.getXML()` (dòng 202–215):
  `source_field_name` (205), `N` (206), `mean` (207), `stdDev` (208),
  `min` (209), `max` (210), `median` (211), `percentile` số thực (212),
  `interpolate` (213), bọc `<univariate_stats>` (203/215). Đếm khi load
  trực tiếp dưới step (dòng 124–128), KHÔNG qua `<fields>`.
- Deserialization: constructor (dòng 99–143) — mỗi cờ chỉ false khi đúng
  `"N"` (104–130, mặc định field true dòng 47–54); NHƯNG
  `temp.equalsIgnoreCase` KHÔNG null-guard — tag cờ thiếu → NPE bọc
  `KettleXMLException`. `percentile` parse lỗi → -1 (133–137, an toàn).
- Khởi tạo: `setDefault()` (dòng 196+) — 0 thống kê.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: median/percentile cần cache + sort toàn bộ; worker
  phát 1 dòng kết quả mỗi cột nguồn.
- Không có `<connection>`.

Cấu hình không mặc định (percentile 95 + nội suy):

```xml
<univariate_stats>
  <source_field_name>ORDER_TOTAL</source_field_name>
  <N>Y</N>
  <mean>Y</mean>
  <stdDev>Y</stdDev>
  <min>Y</min>
  <max>Y</max>
  <median>Y</median>
  <percentile>0.95</percentile>
  <interpolate>Y</interpolate>
</univariate_stats>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Mọi tag cờ bắt buộc có mặt** (thiếu → NPE dòng 103–142) — không
  được lược `<median>` hay `<interpolate>` kể cả khi N.
- **Không có `<fields>`**: block `<univariate_stats>` trực tiếp dưới
  `<step>` — bọc sai load 0 thống kê.
- Tag `<N>` viết hoa — đúng như source (dòng 206).
- Không có `<connection>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
