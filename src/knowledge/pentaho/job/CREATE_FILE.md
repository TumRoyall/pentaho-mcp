# CREATE_FILE — Job entry tạo file rỗng

Entry tạo một file trống tại `<filename>` (dùng `${VAR}`). Khi file đã tồn
tại, hành vi do `<fail_if_file_exists>` quyết định: `Y` (mặc định!) = fail
entry, `N` = bỏ qua êm. Entry điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>CREATE_FILE</type>
      <attributes/>
      <filename>${TARGET_FILE}</filename>
      <fail_if_file_exists>Y</fail_if_file_exists>
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
| `<filename>` | Y | Path file cần tạo (dùng `${VAR}`). `check()` đòi non-null + file CHƯA tồn tại. |
| `<fail_if_file_exists>` | N | `Y` (mặc định) = fail khi file đã tồn tại; `N` = thành công êm. Y/N, thiếu tag → false. |
| `<add_filename_result>` | N | `Y` = đưa file vào result filenames; `N` (mặc định). Y/N, thiếu tag → false. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CREATE_FILE` | `<type>` | `CREATE_FILE`. |
| `configuration.file` | `<filename>` | Dùng `${VAR}`. |
| `configuration.fail_if_exists` | `<fail_if_file_exists>` | Boolean → Y/N, mặc định Y. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` —
  `<job-entry id="CREATE_FILE">` →
  `org.pentaho.di.job.entries.createfile.JobEntryCreateFile` (category
  FileManagement). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryCreateFile.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/createfile/JobEntryCreateFile.java`
  dòng 88–99) — `super.getXML()` rồi đúng thứ tự `filename`,
  `fail_if_file_exists`, `add_filename_result`.
- Deserialization: `loadXML()` (dòng 101–112) — `super.loadXML()` rồi đọc 3
  tag; 2 cờ Y/N thiếu → false.
- Khởi tạo: constructor (dòng 72–77) — `filename` null,
  **`failIfFileExists = true`**, `addfilenameresult = false`; không có
  `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 239–241) — entry điều kiện.
  `check()` (dòng 265–271) đòi `filename` non-null VÀ file chưa tồn tại
  (`fileDoesNotExistValidator`) — check design-time đã giả định file đích
  là mới.

Cấu hình không mặc định (ghi đè êm + đưa vào result):

```xml
<filename>${TARGET_FILE}</filename>
<fail_if_file_exists>N</fail_if_file_exists>
<add_filename_result>Y</add_filename_result>
```

## 5. Lưu ý / bẫy

- **Mặc định `fail_if_file_exists=Y`** (ngược trực giác) — template giữ `Y`
  theo constructor; muốn idempotent phải đặt `N` tường minh.
- **Y/N chứ không phải true/false** — ghi `true` load thành false, biến
  entry "fail khi tồn tại" thành "bỏ qua" lặng lẽ.
- Template mặc định là khung cấu hình — người dùng phải điền path có thật
  (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
