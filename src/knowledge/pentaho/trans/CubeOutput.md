# CubeOutput — Step ghi file cube (.cube)

Ghi các dòng đầu vào ra file `.cube` (gZIP serialize của RowMeta +
data, đọc lại bằng `CubeInput`): khối `<file>` chứa `name` (đường dẫn,
`${VAR}`), `add_to_result_filenames` (Y/N) và `do_not_open_newfile_init`
(Y/N). Không override `getFields` (pass-through); `check()` OK khi có
input.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CubeOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <file>
      <name>${CUBE_FILE}</name>
      <add_to_result_filenames>N</add_to_result_filenames>
      <do_not_open_newfile_init>N</do_not_open_newfile_init>
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
| `<file>/<name>` | Y | Đường dẫn file `.cube` output; cho phép `${VAR}`. |
| `<file>/<add_to_result_filenames>` | N | `Y` = thêm file vào result filenames. |
| `<file>/<do_not_open_newfile_init>` | N | `Y` = không mở file mới ở init (nối file). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CUBE_OUTPUT` | `<type>` | `CubeOutput`. |
| `configuration.filename` | `<file>/<name>` | Nested `file/name`, cho phép `${VAR}`. |
| `configuration.add_to_result` | `<file>/<add_to_result_filenames>` | Boolean → Y/N. |
| `configuration.no_new_file_init` | `<file>/<do_not_open_newfile_init>` | Boolean → Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="CubeOutput", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeoutput/CubeOutputMeta.java`
  dòng 59–61). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `CubeOutputMeta.getXML()` (dòng 151–162) — một wrapper
  `<file>` (dòng 154, 159) chứa đúng thứ tự `name` (string),
  `add_to_result_filenames` (Y/N), `do_not_open_newfile_init` (Y/N),
  vô điều kiện (dòng 155–157).
- Deserialization: `readData()` (dòng 131–143, qua `loadXML` dòng 76–78)
  — cả 3 nested dưới `"file"`: `getTagValue(stepnode,"file","name")`
  (thiếu → null, dòng 133); 2 booleans `"Y".equalsIgnoreCase` (thiếu →
  false, dòng 134–137).
- Khởi tạo: `setDefault()` (dòng 145–149) — `filename="file.cube"`,
  `addToResultFilenames=false`, `doNotOpenNewFileInit=false`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: không override `getFields` (pass-through). `check()`
  (dòng 188–205) OK khi `prev>0` + comment, không error.
- Không có `<connection>`: step chỉ ghi file — template không mang tag
  này, fixture test không cần khai báo connection.

Cấu hình không mặc định (add to result):

```xml
<file>
  <name>${CUBE_DIR}/sales.cube</name>
  <add_to_result_filenames>Y</add_to_result_filenames>
  <do_not_open_newfile_init>N</do_not_open_newfile_init>
</file>
```

Set qua `setFieldPath` (`file/name`, `file/add_to_result_filenames`,
`file/do_not_open_newfile_init`).

## 5. Lưu ý / bẫy — CRITICAL

- **Đừng nhầm CubeInput**: Input dùng `<file>` với (`name`, `limit`,
  `addfilenameresult`) — khác tên tag với Output (`name`,
  `add_to_result_filenames`, `do_not_open_newfile_init`). Copy nhầm là
  mất cấu hình lặng lẽ.
- **Booleans thiếu tag → false**.
- **Cặp với CubeInput**: file `.cube` chỉ đọc lại được bằng `CubeInput`
  (định dạng gZIP nội bộ, không phải CSV).
- Template mặc định là khung cấu hình — người dùng phải điền đường dẫn
  output (qua biến).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
