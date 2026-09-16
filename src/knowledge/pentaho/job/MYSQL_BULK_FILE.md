# MYSQL_BULK_FILE — Job entry xuất bảng MySQL ra file

Entry chạy `SELECT ... INTO OUTFILE '<file>'` trên connection MySQL đã
chọn (ngược với `MYSQL_BULK_LOAD`). `outdumpvalue`/`iffileexists` là MÃ SỐ
int (không phải Y/N) — xem bẫy.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MYSQL_BULK_FILE</type>
      <attributes/>
      <schemaname>${SCHEMA}</schemaname>
      <tablename>{{TABLE}}</tablename>
      <filename>${OUTPUT_FILE}</filename>
      <separator>,</separator>
      <enclosed>"</enclosed>
      <optionenclosed>N</optionenclosed>
      <lineterminated>\n</lineterminated>
      <limitlines>0</limitlines>
      <listcolumn/>
      <highpriority>Y</highpriority>
      <outdumpvalue>0</outdumpvalue>
      <iffileexists>2</iffileexists>
      <addfiletoresult>N</addfiletoresult>
      <connection>${CONN}</connection>
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
| `<schemaname>` / `<tablename>` / `<filename>` | Y | Schema/bảng nguồn + file đích (`${VAR}`). |
| `<separator>` / `<enclosed>` | N | Phân tách/bao field. |
| `<optionenclosed>` | N | `OPTIONALLY ENCLOSED BY`; mặc định `N`. |
| `<lineterminated>` | N | Kết thúc dòng. |
| `<limitlines>` | N | `LIMIT n`; mặc định `"0"` (chuỗi, 0 = không giới hạn). |
| `<listcolumn>` | N | Danh sách cột SELECT (rỗng = `*`). |
| `<highpriority>` | N | `HIGH_PRIORITY`; mặc định `Y` (ctor `true`). |
| `<outdumpvalue>` | N | Mã int chế độ dump (ctor Java default 0; load-thiếu → `-1`). |
| `<iffileexists>` | N | Mã int xử lý khi file đã tồn tại: ctor `2`; `execute()` rẽ nhánh `==2`/`==1` (dòng 263–270); load-thiếu → `-1`. |
| `<addfiletoresult>` | N | Thêm file ra vào result files; mặc định `N`. |
| `<connection>` | Y | Tên DB connection MySQL (THAM CHIẾU — đứng cuối). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MYSQL_BULK_FILE` | `<type>` | `MYSQL_BULK_FILE`. |
| `configuration.schema` / `table` / `filename` | `<schemaname>` / `<tablename>` / `<filename>` | `${VAR}` cho file. |
| `configuration.limit_lines` | `<limitlines>` | Chuỗi số. |
| `configuration.high_priority` | `<highpriority>` | Boolean → Y/N (mặc định Y). |
| `configuration.if_file_exists` | `<iffileexists>` | MÃ SỐ int (mặc định 2). |
| `configuration.connection` | `<connection>` | Tham chiếu; đứng cuối. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 28 —
  `<job-entry id="MYSQL_BULK_FILE">` →
  `org.pentaho.di.job.entries.mysqlbulkfile.JobEntryMysqlBulkFile`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryMysqlBulkFile.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkfile/JobEntryMysqlBulkFile.java`
  dòng 112–133) — `super.getXML()` rồi 14 tag đúng thứ tự template (từ
  `schemaname` dòng 116 đến `addfiletoresult` dòng 128), `<connection>`
  đứng cuối (dòng 129–130).
- Deserialization: `loadXML()` (dòng 135–157) — `highpriority`/
  `optionenclosed`/`addfiletoresult` Y/N; `outdumpvalue`/`iffileexists`
  qua `Const.toInt(..., -1)` (thiếu → `-1`, dòng 149–150); `connection`
  resolve qua `findDatabase` (dòng 151–152).
- Khởi tạo: constructor (dòng 86–101) — `limitlines="0"`,
  `highpriority=true`, `optionenclosed=false`, `iffileexists=2`,
  `outdumpvalue` int Java default 0, còn lại null/false. (Thông điệp lỗi
  `loadXML` ghi nhầm `'table exists'`, dòng 155 — lỗi text gốc, không ảnh
  hưởng XML.)
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `evaluates()` (dòng 236); `execute()` rẽ nhánh file
  tồn tại theo `iffileexists` (dòng 263–270); chạy `SELECT INTO OUTFILE`
  thật — không chạy DB khi test template.

Cấu hình không mặc định (danh sách cột + giới hạn 1000 dòng):

```xml
<listcolumn>id, name, total</listcolumn>
<limitlines>1000</limitlines>
<highpriority>N</highpriority>
<connection>${CONN}</connection>
```

## 5. Lưu ý / bẫy

- **`outdumpvalue`/`iffileexists` là SỐ, không phải Y/N**: ghi `2`, không
  ghi `Y`. `iffileexists` ctor = 2 nhưng load-thiếu-tag → `-1` — template
  ghi `2` rõ ràng.
- **`highpriority` mặc định `Y`**: ctor `true` (dòng 96) — khác trực giác
  cờ thường `N`.
- **`<connection>` đứng cuối + là tham chiếu**: fixture `.kjb` test phải
  khai báo `<connection><name>${CONN}</name></connection>` (bẫy B2).
- Template mặc định là khung cấu hình — người dùng phải điền bảng, file,
  connection MySQL có thật; không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/MySQL thật) — không tuyên bố hai
  mức này.
