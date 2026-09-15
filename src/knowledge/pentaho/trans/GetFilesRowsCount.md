# GetFilesRowsCount — Step đếm dòng các file

Với DANH SÁCH file (`<file>` flat 5 tag), đếm số dòng mỗi file (theo
`<row_separator>` + `<rowseparator_format>`) và phát MỖI FILE một dòng gồm
trường đếm dòng (`<rows_count_fieldname>`, Integer, luôn có) + (tùy chọn)
trường đếm file (`<files_count_fieldname>`, Integer, khi
`<files_count>=Y`). Không có list `<fields>` — step không khai báo trường
trích xuất nào.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetFilesRowsCount</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <files_count>N</files_count>
    <files_count_fieldname/>
    <rows_count_fieldname>rowscount</rows_count_fieldname>
    <rowseparator_format>CR</rowseparator_format>
    <row_separator>\n</row_separator>
    <isaddresult>Y</isaddresult>
    <filefield>N</filefield>
    <filename_Field/>
    <smartCount>N</smartCount>
    <file>
      <name>${INPUT_FILE}</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
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
| `<file>/<name>` | Y (ít nhất 1) | File cần đếm (dùng `${VAR}`); nhiều file = lặp bộ 5 tag flat. |
| `<filemask>` / `<exclude_filemask>` | N | Regex lọc/bỏ file. |
| `<file_required>` / `<include_subfolders>` | N | Y/N từng file. |
| `<rows_count_fieldname>` | Y | Tên trường đếm DÒNG (Integer, luôn phát); mặc định `rowscount`. |
| `<files_count>` / `<files_count_fieldname>` | N | `Y` = thêm trường đếm FILE (Integer); `N` (mặc định) = chỉ đếm dòng. |
| `<rowseparator_format>` | N | Định dạng separator (ví dụ `CR`); mặc định step mới `"CR"`. |
| `<row_separator>` | N | Ký tự phân dòng (ví dụ `\n`); rỗng = mặc định runtime. |
| `<isaddresult>` | N | `Y` = đưa file vào result; **thiếu tag → TRUE**. |
| `<filefield>` / `<filename_Field>` | N | `Y` = lấy danh sách file từ trường vào (tên trường ở `filename_Field`, CHÚ Ý F hoa); `N` (mặc định) = dùng `<file>`. |
| `<smartCount>` | N | `Y` = đếm thông minh (nhanh hơn); `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_FILES_ROWS_COUNT` | `<type>` | `GetFilesRowsCount`. |
| `configuration.files[].path` | `<file>/<name>` | `${VAR}`; bộ 5 tag flat. |
| `configuration.rows_field` | `<rows_count_fieldname>` | Mặc định `rowscount`. |
| `configuration.count_files` | `<files_count>` + `<files_count_fieldname>` | Bật cả cờ lẫn tên. |

Không có list `<fields>` — `<file>` flat viết lặp tay; scalar đổi bằng
`set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 58 —
  `<step id="GetFilesRowsCount">` →
  `org.pentaho.di.trans.steps.getfilesrowscount.GetFilesRowsCountMeta`
  (category Input). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `GetFilesRowsCountMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/getfilesrowscount/GetFilesRowsCountMeta.java`
  dòng 373–398) — thứ tự `files_count`, `files_count_fieldname`,
  `rows_count_fieldname`, `rowseparator_format`, `row_separator`,
  `isaddresult`, `filefield`, `filename_Field` (F hoa, dòng 383),
  `smartCount` (dòng 376–384), rồi `<file>` LUÔN emit (dòng 386/395) với
  các bộ 5 tag flat (dòng 388–392). Không có `<fields>`.
- Deserialization: `loadXML()` (dòng 354–356) gọi `readData()` (dòng
  419–461) — `rowseparator_format` qua `scrubOldRowSeparator` (dòng 426):
  **`"CR"` cũ load thành `"LINEFEED"`, `"LF"` thành `"CARRIAGERETURN"`**
  (dòng 407–417, compat ngược tên cũ); `isaddresult` thiếu/rỗng → TRUE
  (dòng 431–436); file đọc song song (dòng 445–456).
- Khởi tạo: `setDefault()` (dòng 471–493) — `rowsCountFieldName =
  "rowscount"`, `RowSeparator_format = "CR"`, `isaddresult = true`, còn
  lại false/rỗng, 0 file.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 495–509) LUÔN thêm Integer
  `rowsCountFieldName`, thêm Integer `filesCountFieldName` chỉ khi
  `includeFilesCount` — output = 1–2 cột đếm, MỖI FILE một dòng.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (đếm cả file lẫn dòng):

```xml
<files_count>Y</files_count>
<files_count_fieldname>filescount</files_count_fieldname>
<rows_count_fieldname>rowscount</rows_count_fieldname>
<file>
  <name>${INPUT_DIR}</name>
  <filemask>.*\.csv</filemask>
  <exclude_filemask/>
  <file_required>N</file_required>
  <include_subfolders>Y</include_subfolders>
</file>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Load đổi `rowseparator_format` cũ**: file .ktr ghi `CR`/`LF` theo nghĩa
  cũ sẽ load thành `LINEFEED`/`CARRIAGERETURN` (đảo tên!) — template mới
  nên dùng giá trị hiện hành, đừng copy format từ file cổ mà không kiểm.
- **Tag `filename_Field` F hoa** (dòng 383) — viết `filename_field` thường
  là tag lạ bị bỏ qua, mode trường vào lặng lẽ tắt.
- **Không có `<fields>`**: step không có khái niệm field trích xuất — đừng
  bịa `<fields>/<field>` (tag lạ bị bỏ qua, step vẫn chỉ ra cột đếm).
- **`isaddresult` thiếu = TRUE** — muốn không đưa file vào result ghi `N`
  tường minh.
- Template mặc định là khung cấu hình — người dùng phải điền file
  (`${VAR}`) có thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
