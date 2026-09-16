# CONNECTED_TO_REPOSITORY — Job entry kiểm tra kết nối repository

Entry điều kiện (`evaluates() = true`, không unconditional): pass khi
đang kết nối đúng repository (`isspecificrep=Y` so sánh
`environmentSubstitute(repname)` với `rep.getName()`) và đúng user
(`isspecificuser=Y` so sánh với `rep.getUserInfo().getLogin()`); `rep`
null → fail. KHÁC đa số entry: 4 tag custom emit TRƯỚC
`super.getXML()` (name/description/type) — thứ tự assert phải để custom
trước.

## 1. XML Template

```xml
<entry>
      <isspecificrep>N</isspecificrep>
      <repname/>
      <isspecificuser>N</isspecificuser>
      <username/>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>CONNECTED_TO_REPOSITORY</type>
      <attributes/>
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
| `<isspecificrep>` | N | `Y` = kiểm tra tên repository khớp `<repname>`; `N` (mặc định) = chỉ cần đang kết nối. |
| `<repname>` | Y khi `isspecificrep=Y` | Tên repository mong đợi (substitute `${VAR}` khi chạy). |
| `<isspecificuser>` | N | `Y` = kiểm tra user khớp `<username>`; `N` (mặc định). |
| `<username>` | Y khi `isspecificuser=Y` | Login user mong đợi. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CONNECTED_TO_REPOSITORY` | `<type>` | `CONNECTED_TO_REPOSITORY`. |
| `configuration.specific_repository` | `<isspecificrep>` | Boolean → Y/N. |
| `configuration.repository` | `<repname>` | Cho phép `${VAR}`. |
| `configuration.specific_user` | `<isspecificuser>` | Boolean → Y/N. |
| `configuration.username` | `<username>` | Login mong đợi. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 47 —
  `<job-entry id="CONNECTED_TO_REPOSITORY">` →
  `org.pentaho.di.job.entries.connectedtorepository.JobEntryConnectedToRepository`
  (không có `@JobEntry`). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `JobEntryConnectedToRepository.getXML()` (dòng 106–116)
  — thứ tự `isspecificrep` (Y/N), `repname` (string),
  `isspecificuser` (Y/N), `username` (string) **RỒI MỚI**
  `super.getXML()` = `name`, `description`, `type` (+ attributes).
  Ngược với đa số entry (thường super trước) — template giữ đúng thứ tự
  này.
- Deserialization: `loadXML()` (dòng 118–131) — `super.loadXML()` trước
  (chỉ đọc `name`/`description`); booleans `"Y".equalsIgnoreCase`
  (thiếu → false); strings `getTagValue` (thiếu → null).
- Khởi tạo: KHÔNG có `setDefault`. Constructor (dòng 57–63):
  `isspecificrep=false`, `repname=null`, `isspecificuser=false`,
  `username=null`.
- Wrapper: `JobEntryCopy.getXML()` (`engine/.../job/entry/JobEntryCopy.java`
  dòng 102–119) bao `entry.getXML()` bằng `<entry>` + `parallel`,
  `draw`, `nr`, `xloc`, `yloc`; `JobEntryBase.getXML()`
  (`engine/.../job/entry/JobEntryBase.java` dòng 415–424) emit
  `name`, `description`, `type` (+ attributes). Template trên là một
  `<entry>` đầy đủ theo hai wrapper này.
- Ngữ nghĩa runtime: `evaluates()=true` (dòng 219),
  `isUnconditional()=false` (dòng 223). `execute()` (dòng 172–217):
  `rep==null` → fail; `isspecificrep` → so sánh tên sau substitute;
  `isspecificuser` → so sánh login; pass → `result=true`, `nrErrors=0`.
- Không có `<connection>`: entry không tham chiếu DB — template không
  mang tag này.

Cấu hình không mặc định (khóa cả repo lẫn user):

```xml
<isspecificrep>Y</isspecificrep>
<repname>${REPO_NAME}</repname>
<isspecificuser>Y</isspecificuser>
<username>${REPO_USER}</username>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Thứ tự ngược**: 4 tag custom ĐỨNG TRƯỚC name/description/type —
  copy wrapper entry thường (super trước) là sai order.
- **Bool thiếu tag = false** (không phân biệt `N`/missing).
- Entry này kiểm tra KẾT NỐI repository của job đang chạy — không tạo kết
  nối mới, không nhận credential.
- Template mặc định là khung cấu hình — pass (`N`/`N`) nghĩa là chỉ cần
  đang kết nối bất kỳ repo nào.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
