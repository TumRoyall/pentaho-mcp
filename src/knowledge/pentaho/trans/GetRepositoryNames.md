# GetRepositoryNames — Step liệt kê object trong repository

Step nguồn KHÔNG nhận input (`check()` ERROR khi có input): liệt kê các
object trong repository (transformation/job) khớp filter file. Loại
object chọn bằng `<object_type>` (tên enum: `All`, `Transformation`,
`Job` — chuỗi lạ NÉM `IllegalArgumentException` khi load). Filter gồm
MỘT nhóm `<file>` (số ít, không phải `<files>`) với 4 tag phẳng lặp
(`directory`, `name_mask`, `exclude_name_mask`, `include_subfolders`).
Output cố định 8 cột + cột rownr tùy chọn.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetRepositoryNames</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <object_type>All</object_type>
    <rownum>Y</rownum>
    <rownum_field>rownr</rownum_field>
    <file>
      <directory>/</directory>
      <name_mask>.*</name_mask>
      <exclude_name_mask/>
      <include_subfolders>Y</include_subfolders>
    </file>
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
| `<object_type>` | Y | Tên enum: `All`, `Transformation`, `Job`. Chuỗi khác → load NÉM lỗi (bọc `KettleXMLException`). |
| `<rownum>` | N | `Y` (mặc định) = thêm cột số thứ tự Integer tên `<rownum_field>`. |
| `<rownum_field>` | Y khi `rownum=Y` | Tên cột số thứ tự; mặc định `rownr`. |
| `<file>/<directory>` | Y | Thư mục repository quét; mặc định `/`. |
| `<file>/<name_mask>` | N | Regex tên gồm; mặc định `.*`. |
| `<file>/<exclude_name_mask>` | N | Regex tên loại; trống = không loại. |
| `<file>/<include_subfolders>` | N | `Y` (mặc định) = quét cả thư mục con. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_REPOSITORY_NAMES` | `<type>` | `GetRepositoryNames`. |
| `configuration.object_type` | `<object_type>` | Enum tên: `All`/`Transformation`/`Job`. |
| `configuration.include_row_number` | `<rownum>` | Boolean → Y/N (mặc định Y). |
| `configuration.row_number_field` | `<rownum_field>` | Mặc định `rownr`. |
| `configuration.directory` | `<file>/<directory>` | Wrapper số ít `<file>`. |
| `configuration.name_mask` | `<file>/<name_mask>` | Regex. |
| `configuration.exclude_mask` | `<file>/<exclude_name_mask>` | Regex. |
| `configuration.include_subfolders` | `<file>/<include_subfolders>` | Boolean → Y/N. |

Khối `<file>` là 4 tag phẳng lặp (KHÔNG phải list item đồng nhất) →
set từng tag bằng `setFieldPath` (`file/directory`, `file/name_mask`,
...), không dùng `set_fields` cho khối này.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 119 —
  `<step id="GetRepositoryNames">` →
  `org.pentaho.di.trans.steps.getrepositorynames.GetRepositoryNamesMeta`
  (category Input). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `GetRepositoryNamesMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/getrepositorynames/GetRepositoryNamesMeta.java`
  dòng 205–223) — đúng thứ tự `object_type` (tên enum), `rownum` (Y/N),
  `rownum_field`, rồi wrapper `<file>` (SỐ ÍT) với bộ 4 phẳng lặp:
  `directory`, `name_mask`, `exclude_name_mask`, `include_subfolders`
  (Y/N). Không có item wrapper.
- Deserialization: `loadXML()` (dòng 225–255) — `object_type` null → giữ
  default constructor; chuỗi lạ → `valueOf` ném `IllegalArgumentException`
  (bọc `KettleXMLException` — bẫy compat); `rownum` Y-parse (thiếu →
  false); list đọc bằng cách đếm `directory` rồi lấy từng tag con theo
  index (`getSubNodeByNr` từng tag, dòng ~240–250) — lệch số lượng tag
  con gây misalign/null, nên luôn giữ đủ bộ 4.
- Khởi tạo: `setDefault()` (dòng 115–129) — `All`,
  `includeRowNumber=true`, `rowNumberField="rownr"`, một dòng
  `("/", ".*", "", true)`; constructor (dòng 80–84):
  `objectTypeSelection=All`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 131–203) cố định 8 cột
  (`object`, `directory`, `name`, `object_type`, `object_id`,
  `modified_by` String 500, `modified_date` Date, `description` String
  500) + Integer `rownr` tùy chọn. `check()` (dòng 304–319) ERROR khi có
  input (step nguồn, không nhận input).
- Không có `<connection>`: repository lấy từ runtime context — template
  không mang `<connection>`, fixture test không cần khai báo connection.

Cấu hình không mặc định (chỉ transformation, không rownr):

```xml
<object_type>Transformation</object_type>
<rownum>N</rownum>
<rownum_field>rownr</rownum_field>
<file>
  <directory>/production</directory>
  <name_mask>.*_daily</name_mask>
  <exclude_name_mask>.*_backup</exclude_name_mask>
  <include_subfolders>N</include_subfolders>
</file>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Wrapper là `<file>` số ít** — viết `<files>` là sai tag, load bỏ qua
  filter.
- **`<object_type>` sai chính tả NÉM lỗi load** (không fallback lặng lẽ)
  — chỉ dùng `All`, `Transformation`, `Job` đúng case.
- **Luôn giữ đủ bộ 4 tag con** trong `<file>` — cơ chế đọc theo index
  từng tag dễ misalign khi lệch số lượng.
- **`name_mask` là regex Java** — `.` khớp mọi ký tự; muốn khớp буквально
  phải escape.
- **Không nhận input** — nối hop vào là `check()` ERROR.
- Template mặc định là khung cấu hình — cần repository thật lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
