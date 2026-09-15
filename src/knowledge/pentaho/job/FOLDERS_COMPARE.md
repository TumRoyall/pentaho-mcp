# FOLDERS_COMPARE — Job entry so sánh 2 thư mục

Entry điều kiện (`evaluates() = true`): so sánh 2 thư mục (`<filename1>`,
`<filename2>` — tên tag là filename dù chứa thư mục), lọc theo
`<wildcard>` + phạm vi `<compareonly>`, có thể so nội dung
(`<compare_filecontent>`), kích thước (`<compare_filesize>`) và quét thư mục
con (`<include_subfolders>`). Giống nhau → `result = true`, khác → `false`.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FOLDERS_COMPARE</type>
      <attributes/>
      <include_subfolders>N</include_subfolders>
      <compare_filecontent>N</compare_filecontent>
      <compare_filesize>N</compare_filesize>
      <compareonly>all</compareonly>
      <wildcard>.*</wildcard>
      <filename1>${DIR_1}</filename1>
      <filename2>${DIR_2}</filename2>
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
| `<filename1>` / `<filename2>` | Y | Path 2 THƯ MỤC cần so (dùng `${VAR}`) — tên tag là filename nhưng ngữ nghĩa là folder. |
| `<compareonly>` | Y | Phạm vi so: `all` (mặc định — mọi entry), `only_files`, `only_folders`, `specify` (kết hợp `<wildcard>`). |
| `<wildcard>` | Điều kiện | Regex lọc tên khi `compareonly=specify`; các mode khác bỏ qua. |
| `<include_subfolders>` | N | `Y` = quét cả thư mục con; `N` (mặc định). |
| `<compare_filecontent>` | N | `Y` = so nội dung file; `N` (mặc định, chỉ so tên/cấu trúc). |
| `<compare_filesize>` | N | `Y` = so thêm kích thước; `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FOLDERS_COMPARE` | `<type>` | `FOLDERS_COMPARE`. |
| `configuration.dir1/dir2` | `<filename1>`/`<filename2>` | Thư mục, dùng `${VAR}`. |
| `configuration.scope` | `<compareonly>` | `all`/`only_files`/`only_folders`/`specify`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` —
  `<job-entry id="FOLDERS_COMPARE">` →
  `org.pentaho.di.job.entries.folderscompare.JobEntryFoldersCompare`
  (category FileManagement). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `JobEntryFoldersCompare.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/folderscompare/JobEntryFoldersCompare.java`
  dòng 113–130) — `super.getXML()` rồi `include_subfolders`,
  `compare_filecontent`, `compare_filesize`, `compareonly`, `wildcard`,
  `filename1`, `filename2` (dòng 117–124).
- Deserialization: `loadXML()` (dòng 132–143+) — cùng thứ tự; 3 cờ Y/N
  thiếu → false.
- Khởi tạo: constructor (dòng 84–94) — 3 cờ false, `compareonly = "all"`,
  còn lại null; không có `setDefault()` riêng.
- Phạm vi `compareonly` (dòng 537–549): `"all"` (mọi entry),
  `"only_files"`, `"only_folders"`, `"specify"` (kết hợp wildcard qua
  `GetFileWildcard`) — giá trị khác khớp NOTHING (không match nhánh nào).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime (javadoc, dòng 66–67): giống nhau đi nhánh true, khác
  đi nhánh false. `evaluates()` = true (dòng 592–594).

Cấu hình không mặc định (chỉ so file XML, kèm nội dung):

```xml
<include_subfolders>Y</include_subfolders>
<compare_filecontent>Y</compare_filecontent>
<compare_filesize>N</compare_filesize>
<compareonly>specify</compareonly>
<wildcard>.*\.xml</wildcard>
<filename1>${DIR_1}</filename1>
<filename2>${DIR_2}</filename2>
```

## 5. Lưu ý / bẫy

- **Tag tên `filename` nhưng là THƯ MỤC** — đừng nhầm với entry FILE_COMPARE
  (file thật); điền file lẻ vào đây cho hành vi không xác định.
- **`compareonly` lạ khớp nothing**: không fallback `all` — sai chính tả là
  so rỗng (luôn true) lặng lẽ.
- **Mặc định chỉ so tên/cấu trúc**: muốn so nội dung phải bật
  `compare_filecontent=Y` tường minh (tốn I/O).
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
