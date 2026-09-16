# ExecSQLRow — Step chạy SQL lấy từ field của từng dòng

Với MỖI dòng đầu vào, lấy câu SQL từ field (`<sql_field>`) — hoặc từ file
(`sqlFromfile=Y`) — rồi chạy trên `<connection>` với `commit` cho trước.
`getFields()` merge thêm 4 cột đếm kết quả (`insert_field`,
`update_field`, `delete_field`, `read_field`, qua `ExecSQL.getResultRow`)
nên output = input row + cột thống kê. Khác step `ExecSQL` (SQL tĩnh):
SQL ở đây ĐỘNG theo từng dòng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ExecSQLRow</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <commit>1</commit>
    <connection>${CONN}</connection>
    <sql_field>{{SQL_FIELD}}</sql_field>
    <insert_field>INSERT_COUNT</insert_field>
    <update_field>UPDATE_COUNT</update_field>
    <delete_field>DELETE_COUNT</delete_field>
    <read_field>READ_COUNT</read_field>
    <sqlFromfile>N</sqlFromfile>
    <sendOneStatement>Y</sendOneStatement>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<commit>` | N | Commit size; `setDefault=1`. ĐỨNG TRƯỚC `<connection>`. |
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — fixture phải khai báo). |
| `<sql_field>` | Y | Tên field chứa câu SQL (động theo dòng). Step cần hop vào. |
| `<insert_field>` / `<update_field>` / `<delete_field>` / `<read_field>` | N | Tên 4 cột đếm kết quả merge vào output. |
| `<sqlFromfile>` | N | `Y` = field chứa ĐƯỜNG DẪN file SQL. Mặc định `N`. |
| `<sendOneStatement>` | N | `Y` (mặc định) = gửi nguyên khối; `N` = tách theo `;`. Load-thiếu-tag → `true` (NVL `"Y"`). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EXEC_SQL_ROW` | `<type>` | `ExecSQLRow`. |
| `configuration.commit_size` | `<commit>` | Số; đứng trước connection. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.sql_field` | `<sql_field>` | Field động, cần hop vào. |
| `configuration.stats_fields` | `<insert_field>`…`<read_field>` | Tên 4 cột thống kê. |
| `configuration.sql_from_file` | `<sqlFromfile>` | Boolean → Y/N. |
| `configuration.single_statement` | `<sendOneStatement>` | Boolean → Y/N. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`. Step cần
hop vào (đọc field động) nhưng không khai báo tham chiếu step trong XML.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 79 —
  `<step id="ExecSQLRow">` →
  `org.pentaho.di.trans.steps.execsqlrow.ExecSQLRowMeta`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `ExecSQLRowMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/execsqlrow/ExecSQLRowMeta.java`
  dòng 298–313) — thứ tự `commit` TRƯỚC (dòng 300), rồi `connection`,
  `sql_field`, `insert_field`, `update_field`, `delete_field`,
  `read_field`, `sqlFromfile`, `sendOneStatement` (dòng 301–311). Không có
  tag SQL tĩnh — khác `ExecSQL`.
- Deserialization: `readData()` (dòng 258–280, qua `loadXML()` dòng
  249–251) — `commit` qua `Const.toInt(..., 0)` (thiếu → 0, dòng 264–265);
  `sendOneStatement` NVL `"Y"` (thiếu → true, dòng 274–275).
- Khởi tạo: `setDefault()` (dòng 282–288) — `commitSize=1`,
  `sendOneStatement=true`, `sqlFromfile=false`, còn lại null.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 290–296) merge 4 cột thống kê từ
  `ExecSQL.getResultRow` (insert/update/delete/read) — output = input +
  cột đếm. Cần DB thật nên không test runtime ở đây.

Cấu hình không mặc định (SQL từ file + commit 100 + tách statement):

```xml
<commit>100</commit>
<connection>${CONN}</connection>
<sql_field>SQL_FILE_PATH</sql_field>
<insert_field>ROWS_INSERTED</insert_field>
<update_field>ROWS_UPDATED</update_field>
<delete_field>ROWS_DELETED</delete_field>
<read_field>ROWS_READ</read_field>
<sqlFromfile>Y</sqlFromfile>
<sendOneStatement>N</sendOneStatement>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **`<commit>` đứng TRƯỚC `<connection>`**: ngược với đa số step DB
  (connection trước) — giữ đúng thứ tự `getXML()`.
- **`commit` 2 default khác nhau**: step mới = 1 (`setDefault`), file
  thiếu tag load thành 0 (`Const.toInt`, dòng 265). Template ghi `1` rõ ràng.
- **Không có tag SQL tĩnh**: SQL nằm trong FIELD của dòng vào — đừng bịa
  `<sql>` (đó là `ExecSQL`/`DBJoin`). Step bắt buộc có hop vào chứa
  `sql_field`.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  field SQL tồn tại trong stream trước; không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/DB thật) — không tuyên bố hai mức này.
