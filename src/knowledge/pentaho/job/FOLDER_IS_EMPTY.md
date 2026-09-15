# FOLDER_IS_EMPTY — Job entry kiểm tra thư mục rỗng (Conditions)

Entry điều kiện (`evaluates() = true`, category Conditions): kiểm tra thư mục
`<foldername>` có chứa file nào không (lọc theo `<wildcard>` khi
`<specify_wildcard>=Y`, quét thư mục con khi `<include_subfolders>=Y`).
RỖNG (0 file) → `result = true`; có file → `result = false`. Path không tồn
tại hoặc không phải thư mục → `NrErrors = 1`.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FOLDER_IS_EMPTY</type>
      <attributes/>
      <foldername>${TARGET_DIR}</foldername>
      <include_subfolders>N</include_subfolders>
      <specify_wildcard>N</specify_wildcard>
      <wildcard/>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<foldername>` | Y | Path thư mục cần kiểm tra (dùng `${VAR}`). Rỗng → error "No Foldername". |
| `<include_subfolders>` | N | `Y` = đếm cả file trong thư mục con; `N` (mặc định). |
| `<specify_wildcard>` | N | `Y` = chỉ đếm file khớp `<wildcard>`; `N` (mặc định) = đếm mọi file. |
| `<wildcard>` | Điều kiện | Regex lọc tên file khi `specify_wildcard=Y` (compile `Pattern`, hỗ trợ biến). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FOLDER_IS_EMPTY` | `<type>` | `FOLDER_IS_EMPTY`. |
| `configuration.folder` | `<foldername>` | Dùng `${VAR}`. |
| `configuration.include_subfolders` | `<include_subfolders>` | Boolean → Y/N. |
| `configuration.wildcard` | `<specify_wildcard>` + `<wildcard>` | Đặt cả cờ lẫn pattern. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` —
  `<job-entry id="FOLDER_IS_EMPTY">` →
  `org.pentaho.di.job.entries.folderisempty.JobEntryFolderIsEmpty`
  (category Conditions). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `JobEntryFolderIsEmpty.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/folderisempty/JobEntryFolderIsEmpty.java`
  dòng 94–106) — `super.getXML()` rồi `foldername`, `include_subfolders`,
  `specify_wildcard`, `wildcard` (dòng 98–101).
- Deserialization: `loadXML()` (dòng 108–115+) — cùng thứ tự; 2 cờ Y/N
  thiếu → false.
- Khởi tạo: constructor (dòng 77–83) — `foldername`/`wildcard` null, 2 cờ
  false; không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime (`execute()`, dòng 187–259): `filescount == 0` →
  `result = true` (dòng 228–231); path không tồn tại hoặc không phải thư
  mục → `NrErrors = 1` (dòng 232–243, 257–259). Biến tương thích
  `KETTLE_COMPATIBILITY_SET_ERROR_ON_SPECIFIC_JOB_ENTRIES` đổi số lỗi khởi
  đầu 0/1 (dòng 189–194, PDI-10270). `evaluates()` = true (dòng 360–362).

Cấu hình không mặc định (chỉ đếm file XML, gồm thư mục con):

```xml
<foldername>${TARGET_DIR}</foldername>
<include_subfolders>Y</include_subfolders>
<specify_wildcard>Y</specify_wildcard>
<wildcard>.*\.xml</wildcard>
```

## 5. Lưu ý / bẫy

- **Rỗng là `true`, có file là `false`** — ngược cảm giác "tìm thấy = true";
  rẽ nhánh hop cho đúng.
- **`wildcard` không có tác dụng khi `specify_wildcard=N`**: pattern chỉ
  compile khi cờ bật — điền pattern mà quên cờ là cấu hình chết.
- **Không tồn tại ≠ rỗng**: path sai cho `NrErrors = 1` (error), không phải
  `result = true` — đừng dùng entry này để kiểm tra tồn tại.
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
