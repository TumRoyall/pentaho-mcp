# FILE_COMPARE — Job entry so sánh nhị phân 2 file

Entry điều kiện (`evaluates() = true`): so sánh 2 file (`<filename1>`,
`<filename2>`) theo từng byte; GIỐNG nhau → `result = true` (đi nhánh
success), khác nhau → `result = false`. Tùy chọn đưa tên file vào result
filenames (`<add_filename_result>`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FILE_COMPARE</type>
      <attributes/>
      <filename1>${FILE_1}</filename1>
      <filename2>${FILE_2}</filename2>
      <add_filename_result>N</add_filename_result>
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
| `<filename1>` | Y | Path file thứ nhất (dùng `${VAR}`). |
| `<filename2>` | Y | Path file thứ hai (dùng `${VAR}`). |
| `<add_filename_result>` | N | `Y` = đưa tên file vào result filenames; `N` (mặc định). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILE_COMPARE` | `<type>` | `FILE_COMPARE`. |
| `configuration.file1/file2` | `<filename1>`/`<filename2>` | Dùng `${VAR}`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` —
  `<job-entry id="FILE_COMPARE">` →
  `org.pentaho.di.job.entries.filecompare.JobEntryFileCompare` (category
  FileManagement). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryFileCompare.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/filecompare/JobEntryFileCompare.java`
  dòng 94–106) — `super.getXML()` rồi `filename1`, `filename2`,
  `add_filename_result`.
- Deserialization: `loadXML()` (dòng 108–119) — `super.loadXML()` rồi đọc 3
  tag; cờ Y/N thiếu → false.
- Khởi tạo: constructor (dòng 78–83) — 2 filename null,
  `addFilenameToResult = false`; không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime (javadoc class, dòng 62–64): so sánh NHỊ PHÂN 2 file —
  giống nhau đi nhánh true, khác nhau đi nhánh false.
  `evaluates()` = true (dòng 285–287).

Cấu hình không mặc định (so sánh 2 bản export + đưa vào result):

```xml
<filename1>${DATA_DIR}/export_new.csv</filename1>
<filename2>${DATA_DIR}/export_old.csv</filename2>
<add_filename_result>Y</add_filename_result>
```

## 5. Lưu ý / bẫy

- **So sánh nhị phân, không phải text/diff**: khác một byte (kể cả newline
  CRLF vs LF) là false — đừng dùng để so nội dung logic.
- **Giống nhau là `result = true`, KHÔNG phải error** — rẽ nhánh hop
  success/failure, không ném exception.
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
