# WRITE_TO_FILE — Job entry ghi nội dung ra file

Entry ghi chuỗi `<content>` (hỗ trợ biến) ra file `<filename>` với encoding
chỉ định, có thể tạo thư mục cha (`<createParentFolder>`) và nối thay vì ghi
đè (`<appendFile>`). Entry điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>WRITE_TO_FILE</type>
      <attributes/>
      <filename>${TARGET_FILE}</filename>
      <createParentFolder>N</createParentFolder>
      <appendFile>N</appendFile>
      <content>{{CONTENT}}</content>
      <encoding>UTF-8</encoding>
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
| `<filename>` | Y | Path file đích (dùng `${VAR}`). `check()` đòi non-blank. |
| `<createParentFolder>` | N | `Y` = tự tạo thư mục cha; `N` (mặc định). |
| `<appendFile>` | N | `Y` = nối vào cuối file; `N` (mặc định) = ghi đè. |
| `<content>` | Y | Nội dung ghi (hỗ trợ `${VAR}`); ký tự CR được mã hoá `&#xd;` khi save. |
| `<encoding>` | N | Encoding ghi file (ví dụ `UTF-8`); null = mặc định hệ thống. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WRITE_TO_FILE` | `<type>` | `WRITE_TO_FILE`. |
| `configuration.file` | `<filename>` | Dùng `${VAR}`. |
| `configuration.content` | `<content>` | Giữ nguyên văn + escape XML. |
| `configuration.encoding` | `<encoding>` | Ví dụ `UTF-8`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` —
  `<job-entry id="WRITE_TO_FILE">` →
  `org.pentaho.di.job.entries.writetofile.JobEntryWriteToFile` (category
  FileManagement). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryWriteToFile.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/writetofile/JobEntryWriteToFile.java`
  dòng 91–108) — `super.getXML()` rồi `filename`, `createParentFolder`,
  `appendFile`, `content`, `encoding` (dòng 95–102).
- **BẪY round-trip (dòng 98–101):** parser XML chuẩn hoá CRLF/CR thành LF
  khi đọc, nên `getXML()` mã hoá mọi CR thành `&#xd;` qua `encodeCR()`
  (dòng 319–321: `s.replaceAll("\r", "&#xd;")`) — file .kjb có `<content>`
  nhiều dòng sẽ chứa `&#xd;`, đó là hành vi ĐÚNG của source, không phải dữ
  liệu hỏng.
- Deserialization: `loadXML()` (dòng 110–122) — `super.loadXML()` rồi đọc 5
  tag theo thứ tự; 2 cờ Y/N thiếu → false.
- Khởi tạo: constructor (dòng 73–80) — mọi field null/false; không có
  `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) như các job entry khác.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 281–283). `check()` (dòng
  313–317) đòi `filename` non-blank.

Cấu hình không mặc định (nối log UTF-8, tự tạo thư mục):

```xml
<filename>${LOG_DIR}/run.log</filename>
<createParentFolder>Y</createParentFolder>
<appendFile>Y</appendFile>
<content>Run started at ${START_TS}</content>
<encoding>UTF-8</encoding>
```

## 5. Lưu ý / bẫy

- **`&#xd;` trong `<content>` là đúng** — CR được mã hoá khi save để qua
  được parser XML; đừng "sửa" thành xuống dòng thật trong .kjb.
- **XML-escape nội dung**: `<`/`&` trong content phải escape — quên → file
  job hỏng.
- Template mặc định là khung cấu hình — người dùng phải điền path và nội
  dung thật (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
