# TABLE_EXISTS — Job entry kiểm tra bảng có tồn tại

Entry điều kiện (`evaluates() = true`, không unconditional): kiểm tra một
bảng TĨNH (`<tablename>` + `<schemaname>`) trên connection đã chọn bằng
`db.checkTableExists`; tồn tại → `result = true` (đi nhánh success), ngược
lại `result = false`. Khác với step trans `TableExists` (tên bảng lấy từ
field động của stream), entry này dùng tên bảng tĩnh.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>TABLE_EXISTS</type>
      <attributes/>
      <tablename>${TABLE}</tablename>
      <schemaname>${SCHEMA}</schemaname>
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
| `<tablename>` | Y | Tên bảng tĩnh cần kiểm tra (hỗ trợ biến, substitute khi chạy). `check()` đòi non-blank. |
| `<schemaname>` | N | Schema chứa bảng (hỗ trợ biến); để trống khi DB không dùng schema. |
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). Thiếu → `NrErrors=1` khi chạy. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TABLE_EXISTS` | `<type>` | `TABLE_EXISTS`. |
| `configuration.table` | `<tablename>` | Tên bảng tĩnh; cho phép `${VAR}`. |
| `configuration.schema` | `<schemaname>` | Cho phép `${VAR}`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 15 —
  `<job-entry id="TABLE_EXISTS">` →
  `org.pentaho.di.job.entries.tableexists.JobEntryTableExists` (category
  Conditions). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryTableExists.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/tableexists/JobEntryTableExists.java`
  dòng 81–92) — `super.getXML()` rồi đúng thứ tự `tablename`,
  `schemaname`, `connection` (= tên `DatabaseMeta`, null khi chưa chọn).
- Deserialization: `loadXML()` (dòng 94–106) — `super.loadXML()` rồi đọc
  3 tag; `connection` resolve qua `DatabaseMeta.findDatabase`; thiếu tag →
  null.
- Khởi tạo: constructor (dòng 65–74) đặt `schemaname`, `tablename`,
  `connection` về null; không có `setDefault()` riêng.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime (`JobEntryTableExists.execute()`, dòng 164–203):
  `evaluates()` = true (dòng 156–158), `isUnconditional()` = false (dòng
  160–162) — entry điều kiện, rẽ nhánh theo `result`. Khi chạy:
  substitute `tablename`/`schemaname` (dòng 173–174), gọi
  `db.checkTableExists(realSchemaname, realTablename)` (dòng 176) →
  tồn tại thì `result = true` (dòng 180), ngược lại giữ `false`;
  connection null → `NrErrors = 1` + log `NoConnectionDefined`
  (dòng 197–200). `check()` (dòng 221–225) chỉ đòi `tablename` non-blank.

Cấu hình không mặc định (bảng dimension + connection):

```xml
<tablename>${TABLE}</tablename>
<schemaname>${SCHEMA}</schemaname>
<connection>${CONN}</connection>
```

## 5. Lưu ý / bẫy

- **Entry điều kiện, không phải action**: `result` true/false rẽ nhánh hop
  success/failure — đừng mong entry này trả dữ liệu hay chặn job khi bảng
  thiếu (thiếu bảng chỉ là `result = false`, KHÔNG phải error).
- **Chỉ lỗi khi thiếu connection**: `NrErrors = 1` chỉ xảy ra khi
  connection null hoặc `KettleDatabaseException`; bảng không tồn tại là
  kết quả hợp lệ (`false`).
- **Tên bảng tĩnh** — khác step trans `TableExists` (đọc tên bảng từ field
  động `<tablenamefield>`). Cần kiểm tra tên bảng động trong job thì đây
  không phải entry phù hợp.
- Template mặc định là khung cấu hình — người dùng phải điền tên bảng và
  connection có thật; credential không bao giờ nằm trong XML.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
