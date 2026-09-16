# CubeInput — Step đọc file cube (.cube)

Step nguồn đọc file `.cube` (gZIP serialize của RowMeta + data):
`<file>/<name>` là đường dẫn (cho phép `${VAR}`), `<limit>` là chuỗi
(giữ `${VAR}`, không parse int khi load), `<addfilenameresult>` cờ Y/N.
`getFields()` MỞ FILE THẬT (`KettleVFS.getInputStream` + `new
RowMeta(dis)`, merge vào row) — thiếu file NÉM `KettleStepException`
nên không test runtime ở đây.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CubeInput</type>
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
      <limit>0</limit>
      <addfilenameresult>N</addfilenameresult>
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
| `<file>/<name>` | Y | Đường dẫn file `.cube`; cho phép `${VAR}`. Chú ý wrapper literal `<file>`, con là `<name>` (không phải `<filename>`). |
| `<file>/<limit>` | N | Giới hạn dòng, DƯỚI DẠNG CHUỖI (giữ `${VAR}`); mặc định `"0"` = đọc hết. |
| `<file>/<addfilenameresult>` | N | `Y` = thêm file vào result filenames (giữ đúng thường toàn bộ). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CUBE_INPUT` | `<type>` | `CubeInput`. |
| `configuration.filename` | `<file>/<name>` | Nested `file/name`, cho phép `${VAR}`. |
| `configuration.row_limit` | `<file>/<limit>` | Chuỗi số, mặc định `"0"`. |
| `configuration.add_to_result` | `<file>/<addfilenameresult>` | Boolean → Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="CubeInput", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeinput/CubeInputMeta.java`
  dòng 66–68). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `CubeInputMeta.getXML()` (dòng 198–208) — wrapper
  `<file>` literal (dòng 201, 203) chứa đúng thứ tự `name` (filename
  string), `limit` (rowLimit STRING — dòng 202, 204–205),
  `addfilenameresult` (Y/N).
- Deserialization: `readData()` (dòng 144–154, qua `loadXML` dòng 80–83)
  — `filename=getTagValue(stepnode,"file","name")` (nested, thiếu →
  null); `rowLimit=getTagValue(stepnode,"limit")` (thiếu → null, giữ
  String để chứa `${VAR}`, không parse int); `addfilenameresult`
  `"Y".equalsIgnoreCase` (thiếu → false, dòng 148).
- Khởi tạo: `setDefault()` (dòng 156–160) — `filename="file"`,
  `rowLimit="0"`, `addfilenameresult=false`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 162–196) mở file `.cube` gzip
  thật (`KettleVFS.getInputStream(environmentSubstitute(filename))`
  dòng 168, `new RowMeta(dis)` dòng 172, `mergeRowMeta` dòng 176) —
  thiếu file → `KettleStepException`. `check()` (dòng 241–250) chỉ
  comment. `readRep` (dòng 210–226) backward-compat PDI-12897: thử
  `getStepAttributeString(limit)` rồi fallback
  `getStepAttributeInteger` (dòng 214–219).
- Không có `<connection>`: step chỉ đọc file — template không mang tag
  này, fixture test không cần khai báo connection.

Cấu hình không mặc định (giới hạn + add to result):

```xml
<file>
  <name>${CUBE_DIR}/sales.cube</name>
  <limit>5000</limit>
  <addfilenameresult>Y</addfilenameresult>
</file>
```

Set qua `setFieldPath` (`file/name`, `file/limit`,
`file/addfilenameresult`).

## 5. Lưu ý / bẫy — CRITICAL

- **Con của `<file>` là `<name>`**, không phải `<filename>` — nhầm tên
  là mất đường dẫn lặng lẽ (load → null).
- **`<limit>` là chuỗi**: giữ `${VAR}` được; đừng parse/validate số ở
  tầng template.
- **Đừng nhầm CubeOutput**: Output dùng `<file>` với 3 con khác (`name`,
  `add_to_result_filenames`, `do_not_open_newfile_init`) — khác tên tag
  với Input.
- **Không test runtime ở đây**: `getFields()` mở file thật — test chỉ
  dừng ở XML/validate.
- Template mặc định là khung cấu hình — người dùng phải điền file
  `.cube` có thật (qua biến).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
