# MSSQL_BULK_LOAD — Job entry bulk insert SQL Server

Entry chạy `BULK INSERT <schema>.<table> FROM '<file>'` trên connection
SQL Server đã chọn, với đầy đủ tùy chọn BULK INSERT (datafiletype,
terminator, codepage, format file, trigger/constraint, batch, order,
truncate). Entry chạy lệnh, không phải điều kiện phức tạp (`evaluates()`
tại dòng 351).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MSSQL_BULK_LOAD</type>
      <attributes/>
      <schemaname>${SCHEMA}</schemaname>
      <tablename>{{TABLE}}</tablename>
      <filename>${BULK_FILE}</filename>
      <datafiletype>char</datafiletype>
      <fieldterminator>,</fieldterminator>
      <lineterminated>\n</lineterminated>
      <codepage>OEM</codepage>
      <specificcodepage/>
      <formatfilename/>
      <firetriggers>N</firetriggers>
      <checkconstraints>N</checkconstraints>
      <keepnulls>N</keepnulls>
      <keepidentity>N</keepidentity>
      <tablock>N</tablock>
      <startfile>0</startfile>
      <endfile>0</endfile>
      <orderby/>
      <orderdirection>Asc</orderdirection>
      <maxerrors>0</maxerrors>
      <batchsize>0</batchsize>
      <rowsperbatch>0</rowsperbatch>
      <errorfilename/>
      <adddatetime>N</adddatetime>
      <addfiletoresult>N</addfiletoresult>
      <truncate>N</truncate>
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
| `<schemaname>` / `<tablename>` / `<filename>` | Y | Schema/bảng đích + file dữ liệu (`${VAR}`). |
| `<datafiletype>` | N | `char` (mặc định), `native`, `widechar`, `widenative`. |
| `<fieldterminator>` / `<lineterminated>` | N | Ký tự phân tách field/dòng. |
| `<codepage>` | N | Mặc định `OEM` (`RAW`, `ACP`, số codepage qua `<specificcodepage>`). |
| `<formatfilename>` | N | Format file (non-XML). |
| `<firetriggers>` / `<checkconstraints>` / `<keepnulls>` / `<keepidentity>` / `<tablock>` | N | Tùy chọn BULK INSERT (Y/N, mặc định `N`). |
| `<startfile>` / `<endfile>` | N | Số file đầu/cuối (int, mặc định 0; thiếu → 0). |
| `<orderby>` / `<orderdirection>` | N | Cột order + `Asc` (mặc định)/`Desc`. |
| `<maxerrors>` / `<batchsize>` / `<rowsperbatch>` | N | Int, mặc định 0; thiếu → 0. |
| `<errorfilename>` | N | File ghi dòng lỗi. |
| `<adddatetime>` | N | Thêm datetime vào tên error file. |
| `<addfiletoresult>` | N | Thêm file vào result files. |
| `<truncate>` | N | Truncate bảng trước khi load. |
| `<connection>` | Y | Tên DB connection SQL Server (THAM CHIẾU — đứng CUỐI, sau `truncate`). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MSSQL_BULK_LOAD` | `<type>` | `MSSQL_BULK_LOAD`. |
| `configuration.schema` / `table` / `filename` | `<schemaname>` / `<tablename>` / `<filename>` | `${VAR}` cho file. |
| `configuration.datafiletype` | `<datafiletype>` | `char`/`native`/… |
| `configuration.truncate` | `<truncate>` | Boolean → Y/N. |
| `configuration.connection` | `<connection>` | Tham chiếu; đứng cuối. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 41 —
  `<job-entry id="MSSQL_BULK_LOAD">` →
  `org.pentaho.di.job.entries.mssqlbulkload.JobEntryMssqlBulkLoad`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryMssqlBulkLoad.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/mssqlbulkload/JobEntryMssqlBulkLoad.java`
  dòng 143–178) — `super.getXML()` rồi 27 tag đúng thứ tự template (từ
  `schemaname` dòng 147 đến `truncate` dòng 172), `<connection>` đứng
  CUỐI CÙNG (dòng 174–175, null → null).
- Deserialization: `loadXML()` (dòng 180–222) — đọc thẳng; số int qua
  `Const.toInt(..., 0)` (thiếu → 0, dòng 201–202, 209–211); boolean Y/N
  (thiếu → false); `connection` resolve qua `DatabaseMeta.findDatabase`
  (dòng 213–217).
- Khởi tạo: constructor (dòng 102–132) — `datafiletype="char"`,
  `codepage="OEM"`, `orderdirection="Asc"`, số = 0, còn lại null/false.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `evaluates()` (dòng 351); chạy `BULK INSERT` thật —
  không chạy DB khi test template.

Cấu hình không mặc định (truncate + tablock + batch 10000):

```xml
<tablename>staging_sales</tablename>
<filename>${BULK_FILE}</filename>
<tablock>Y</tablock>
<batchsize>10000</batchsize>
<truncate>Y</truncate>
<connection>${CONN}</connection>
```

## 5. Lưu ý / bẫy

- **`<connection>` đứng CUỐI**: khác TABLE_EXISTS (connection sau
  schemaname) — giữ đúng thứ tự `truncate` rồi `connection`.
- **Job fixture có `<connection>`**: khác trans (connection khai báo ở
  `<connection>` top-level của `.kjb`), entry này tham chiếu theo tên —
  fixture test phải khai báo connection `${CONN}` (bẫy B2 áp dụng cho cả job).
- **Số int thiếu → 0**: `startfile/endfile/maxerrors/batchsize/
  rowsperbatch` dùng `Const.toInt(..., 0)` — template ghi `0` rõ ràng.
- Template mặc định là khung cấu hình — người dùng phải điền bảng, file,
  connection SQL Server có thật; không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/SQL Server thật) — không tuyên bố
  hai mức này.
