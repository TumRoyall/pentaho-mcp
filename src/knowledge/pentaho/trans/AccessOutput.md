# AccessOutput — Step ghi bảng MS Access (.mdb)

Ghi MỖI dòng đầu vào thành row trong bảng Access (`<table>` trong file
`<filename>`). Không có block `<fields>` — ánh xạ cột theo TÊN (cột dòng
trùng tên cột bảng). Tùy chọn tạo file/bảng (`create_file`,
`create_table` — mặc định mới true/true), truncate (`truncate`), commit
mỗi `<commit_size>` dòng (mặc định 500).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AccessOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename>${ACCESS_FILE}</filename>
    <table>${ACCESS_TABLE}</table>
    <truncate>N</truncate>
    <create_file>Y</create_file>
    <create_table>Y</create_table>
    <commit_size>500</commit_size>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <do_not_open_newfile_init>N</do_not_open_newfile_init>
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
| `<filename>` | Y | File `.mdb` đích. `${VAR}`. |
| `<table>` | Y | Tên bảng đích (tag rút gọn `table`, không phải `table_name`). |
| `<truncate>` | N | Y = xóa dữ liệu bảng trước khi ghi. Mặc định N. |
| `<create_file>` | N | Y (mặc định mới true) = tạo file khi chưa có. |
| `<create_table>` | N | Y (mặc định mới true) = tạo bảng khi chưa có. |
| `<commit_size>` | N | Số nguyên; mặc định 500 (`AccessOutput.COMMIT_SIZE`). Lạ/thiếu → 500. |
| `<add_to_result_filenames>` | N | Rỗng/thiếu → TRUE; template pin `Y`. |
| `<do_not_open_newfile_init>` | N | Y = không mở file khi init. Mặc định N. |

Không có `<fields>` — đừng bịa block mapping.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ACCESS_OUTPUT` | `<type>` | `AccessOutput`. |
| `configuration.filename` | `<filename>` | `${VAR}`. |
| `configuration.table` | `<table>` | Tag rút gọn. |
| `configuration.truncate` | `<truncate>` | Y/N. |
| `configuration.commit_size` | `<commit_size>` | Số, 500. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="AccessOutput", ...)`
  (`plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessoutput/AccessOutputMeta.java`
  dòng 76+, category Output).
- Serialization: `getXML()` (dòng 170–183) — đúng 8 tag: `filename`
  (173), `table` (174), `truncate` (175), `create_file` (176),
  `create_table` (177), `commit_size` số (178),
  `add_to_result_filenames` (179), `do_not_open_newfile_init` (180).
- Deserialization: `readData()` (dòng 139–159) — `commit_size` qua
  `Const.toInt(tag, COMMIT_SIZE=500)` (dòng 146,
  `AccessOutput.java` dòng 53); `add_to_result_filenames` rỗng →
  TRUE (147–152).
- Khởi tạo: `setDefault()` (dòng 161–168) — file/table true (162–163),
  truncate false, commit 500, do-not-open false, add-to-result true.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker `AccessOutput` truncate bảng khi cờ bật
  (dòng ~135); ghi theo tên cột, không có mapping field tường minh.
- Không có `<connection>` DB.

Cấu hình không mặc định (truncate + commit nhỏ):

```xml
<filename>${ACCESS_FILE}</filename>
<table>AUDIT_LOG</table>
<truncate>Y</truncate>
<create_file>N</create_file>
<create_table>N</create_table>
<commit_size>100</commit_size>
<add_to_result_filenames>N</add_to_result_filenames>
<do_not_open_newfile_init>N</do_not_open_newfile_init>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag bảng là `<table>`** (dòng 174), không phải `<table_name>` như
  AccessInput — copy nhầm load null.
- **`add_to_result_filenames` thiếu → TRUE** — luôn ghi tường minh.
- **Không có mapping field**: cột dòng phải trùng tên cột bảng.
- Chỉ ghi `.mdb`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
