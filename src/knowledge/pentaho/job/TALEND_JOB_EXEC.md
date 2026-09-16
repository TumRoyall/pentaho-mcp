# TALEND_JOB_EXEC — Job entry thực thi Talend job đóng gói (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (registry `kettle-job-entries.xml` category `JobCategory.Category.Deprecated`,
> icon `deprecated.svg`). Reference này phục vụ **đọc/bảo trì workload cũ** —
> `status: observed`, `generator_eligible: false`, KHÔNG phát sinh entry mới.
> Không có replacement canonical nào được source chỉ định.

Thực thi một Talend job đã export thành file `.zip`/`.jar`
(`<filename>`) bằng cách nạp class điều khiển (`<class_name>`) qua
`KettleURLClassLoader` và gọi `runJobInTOS(String[])`. Chỉ 2 tag cấu hình,
không connection, không boolean. `filename` null → `NrErrors=1` ngay;
file không tồn tại/không đọc được → log `File_Does_Not_Exist`, result
false.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>TALEND_JOB_EXEC</type>
      <attributes/>
      <filename>${TALEND_JOB_PACKAGE}</filename>
      <class_name>{{TALEND_MAIN_CLASS}}</class_name>
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
| `<filename>` | Y | Đường dẫn package Talend job (`.zip`/`.jar` export); hỗ trợ biến `${VAR}`. `check()` đòi non-blank; null → `NrErrors=1` khi chạy. |
| `<class_name>` | Y | Tên đầy đủ class điều khiển Talend (chứa `runJobInTOS`); substitute biến khi chạy. |

Không có tag nào khác. Không boolean/enum, không list, không connection.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TALEND_JOB_EXEC` | `<type>` | `TALEND_JOB_EXEC`. |
| `configuration.filename` | `<filename>` | Path package; `${VAR}`. |
| `configuration.class_name` | `<class_name>` | Main class Talend. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 60 —
  `<job-entry id="TALEND_JOB_EXEC">` →
  `org.pentaho.di.job.entries.talendjobexec.JobEntryTalendJobExec`
  (category `...JobCategory.Category.Deprecated`, icon
  `ui/images/deprecated.svg`). Không có annotation `@JobEntry` trong
  class. Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/talendjobexec/JobEntryTalendJobExec.java`
  dòng 95–103) — `super.getXML()` (`JobEntryBase`: `name`/`description`/
  `type` + `attributes`) rồi đúng thứ tự `filename` (99), `class_name`
  (100).
- Deserialization: `loadXML()` (dòng 105–115) — `super.loadXML()` (108)
  rồi `filename` (109), `className` (110); thiếu tag → null (không
  default); lỗi → `KettleXMLException ERROR_0001`. `loadRep`/`saveRep`
  (117–136) dùng cùng 2 key.
- Khởi tạo: ctor (dòng 81–88) — `super(n, "")`, `filename = null`
  (`className` ngầm null). Không có `setDefault()`.
- Wrapper: `JobEntryCopy` bao fragment bằng `parallel`, `draw`, `nr`,
  `xloc`, `yloc`, `attributes_kjc` (xem `TABLE_EXISTS.md`).
- Ngữ nghĩa runtime: `execute()` (dòng 150–174) — `filename` null →
  `NrErrors=1` + `ERROR_0005`; ngược lại `getRealFilename()` (substitute,
  138–148) → file không tồn tại/không đọc được → chỉ log
  `File_Does_Not_Exist` (result false); ngược lại `executeTalenJob`
  (176–226): cache `KettleURLClassLoader` theo URL file, lần đầu
  `prepareJarFiles` (228: giải nén `.*\.jar$` trừ `.*classpath\.jar$` ra
  `${java.io.tmpdir}` + shutdown-hook `cleanupJarFiles` 252), nạp
  `class_name`, `newInstance()`, gọi `runJobInTOS` (209–214); success →
  `result=true`, `NrErrors=0` (216–218). `evaluates() = true` (263);
  `check()` (279–283) chỉ đòi `filename` non-blank.

Cấu hình không mặc định (package + class thật theo placeholder):

```xml
<filename>${TALEND_JOB_PACKAGE}</filename>
<class_name>routines.customer_sync_0_1.CustomerSync</class_name>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định.
- **Chỉ 2 tag** — đừng bịa thêm `connection`, `arguments`, `timeout` hay
  list param: `getXML()` chỉ emit `filename` + `class_name`.
- **Thiếu tag → null**, không fallback — template luôn mang cả 2 tag.
- **Giải nén jar ra tmpdir hệ thống** khi chạy (`prepareJarFiles`) — chỉ
  ghi nhận hành vi, không chạy I/O nghiệp vụ trong scope này.
- Mọi path placeholder `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  ctor tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
