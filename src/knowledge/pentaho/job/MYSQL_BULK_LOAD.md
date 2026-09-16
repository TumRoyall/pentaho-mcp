# MYSQL_BULK_LOAD — Job entry load data MySQL

Entry chạy `LOAD DATA [LOCAL] INFILE '<file>' [REPLACE] INTO TABLE` trên
connection MySQL đã chọn. Chú ý typo gốc `prorityvalue` (thiếu chữ "o"
thứ hai) — giữ nguyên chính tả này.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MYSQL_BULK_LOAD</type>
      <attributes/>
      <schemaname>${SCHEMA}</schemaname>
      <tablename>{{TABLE}}</tablename>
      <filename>${BULK_FILE}</filename>
      <separator>,</separator>
      <enclosed>"</enclosed>
      <escaped/>
      <linestarted/>
      <lineterminated>\n</lineterminated>
      <replacedata>Y</replacedata>
      <ignorelines>0</ignorelines>
      <listattribut/>
      <localinfile>Y</localinfile>
      <prorityvalue>0</prorityvalue>
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
| `<schemaname>` / `<tablename>` / `<filename>` | Y | Schema/bảng đích + file (`${VAR}`). |
| `<separator>` / `<enclosed>` / `<escaped>` | N | Phân tách/bao/escape field. |
| `<linestarted>` / `<lineterminated>` | N | Bắt đầu/kết thúc dòng (`STARTING BY` / `TERMINATED BY`). |
| `<replacedata>` | N | Mặc định `Y` (ctor `true`) — `REPLACE` thay `IGNORE`. |
| `<ignorelines>` | N | Số dòng đầu bỏ qua (`IGNORE n LINES`); mặc định `"0"` (chuỗi). |
| `<listattribut>` | N | Danh sách cột `(a,b,c)` (tên giữ typo-ish gốc). |
| `<localinfile>` | N | Mặc định `Y` (ctor `true`) — `LOCAL INFILE`. |
| `<prorityvalue>` | N | typo gốc (thiếu "o"): int, ctor Java default 0; load-thiếu → `-1`. |
| `<addfiletoresult>` | N | Thêm file vào result files; mặc định `N`. |
| `<connection>` | Y | Tên DB connection MySQL (THAM CHIẾU — đứng cuối). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MYSQL_BULK_LOAD` | `<type>` | `MYSQL_BULK_LOAD`. |
| `configuration.schema` / `table` / `filename` | `<schemaname>` / `<tablename>` / `<filename>` | `${VAR}` cho file. |
| `configuration.replace_data` | `<replacedata>` | Boolean → Y/N (mặc định Y). |
| `configuration.ignore_lines` | `<ignorelines>` | Chuỗi số. |
| `configuration.local_infile` | `<localinfile>` | Boolean → Y/N (mặc định Y). |
| `configuration.connection` | `<connection>` | Tham chiếu; đứng cuối. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 24 —
  `<job-entry id="MYSQL_BULK_LOAD">` →
  `org.pentaho.di.job.entries.mysqlbulkload.JobEntryMysqlBulkLoad`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryMysqlBulkLoad.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkload/JobEntryMysqlBulkLoad.java`
  dòng 115–142) — `super.getXML()` rồi 15 tag đúng thứ tự template (từ
  `schemaname` dòng 119 đến `addfiletoresult` dòng 136), `<connection>`
  đứng cuối (dòng 138–139).
- Deserialization: `loadXML()` (dòng 144–168) — `replacedata`/
  `localinfile` Y/N; `prorityvalue` qua `Const.toInt(..., -1)` (thiếu →
  `-1`, dòng 161); `connection` resolve qua `findDatabase` (dòng 162–164).
- Khởi tạo: constructor (dòng 88–104) — `replacedata=true`,
  `localinfile=true`, `ignorelines="0"`, còn lại null/false (`prorityvalue`
  int Java default 0).
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: chạy `LOAD DATA` thật — không chạy DB khi test template.

Cấu hình không mặc định (IGNORE + bỏ 1 dòng đầu + LOCAL off):

```xml
<separator>;</separator>
<replacedata>N</replacedata>
<ignorelines>1</ignorelines>
<localinfile>N</localinfile>
<connection>${CONN}</connection>
```

## 5. Lưu ý / bẫy

- **`prorityvalue` giữ nguyên typo**: thiếu chữ "o" trong source (dòng
  134, 161) — sửa thành `priorityvalue` sẽ thành tag lạ, load về `-1`
  lặng lẽ.
- **`replacedata`/`localinfile` mặc định `Y`**: ctor `true` (dòng 98,
  101) — khác đa số cờ khác mặc định `N`. Template ghi rõ cả hai.
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
