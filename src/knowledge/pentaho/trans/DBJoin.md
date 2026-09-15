# DBJoin — Step join dữ liệu bằng SQL có tham số

Với MỖI dòng đầu vào, chạy một câu SQL trên connection đã chọn, điền các
marker `?` bằng giá trị lấy từ field của dòng (`<parameter>/<field>`), rồi
gắn các cột kết quả query vào sau dòng gốc và truyền đi. `getFields()`
append field của query — output = input row + query result columns.
`outer_join=Y` giữ lại dòng nguồn (phần query NULL) khi query không trả
dòng nào; `=N` thì dòng không khớp bị loại.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DBJoin</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <rowlimit>0</rowlimit>
    <sql>SELECT {{RESULT_COLS}}
FROM ${SCHEMA}.{{LOOKUP_TABLE}}
WHERE {{LOOKUP_COL}} = ?</sql>
    <outer_join>N</outer_join>
    <replace_vars>N</replace_vars>
    <parameter>
      <field>
        <name>{{INPUT_FIELD}}</name>
        <type>String</type>
      </field>
    </parameter>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `getFields()` return sớm khi null; `check()` ERROR. |
| `<rowlimit>` | N | Số dòng query trả về cho mỗi dòng input; `0` (mặc định) = ALL. |
| `<sql>` | Y | SQL có 0..n marker `?`; giữ NGUYÊN VĂN (XML-escape `<`/`&`). `check()` ERROR khi rỗng (nếu đã nối DB). |
| `<outer_join>` | N | `Y` = không khớp vẫn giữ dòng nguồn (cột query NULL); `N` (mặc định) = loại dòng không khớp. |
| `<replace_vars>` | N | `Y` = substitute `${VAR}` trong SQL trước khi chạy; `N` (mặc định). |
| `<parameter>/<field>/<name>` | Y (mỗi marker `?`) | Tên field của DÒNG ĐẦU VÀO dùng điền marker `?` theo thứ tự. Số `<field>` PHẢI bằng số `?` (`check()` so `countParameters` với `parameterField.length`). |
| `<parameter>/<field>/<type>` | Y | Kiểu value-meta của field tham số DƯỚI DẠNG CHUỖI (`String`, `Integer`, `Number`, `Date`, ...) — không phải số. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DB_JOIN` | `<type>` | `DBJoin`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.row_limit` | `<rowlimit>` | Số; `0` = ALL. |
| `configuration.sql` | `<sql>` | Giữ nguyên văn, XML-escape. |
| `configuration.outer_join` | `<outer_join>` | Boolean → Y/N. |
| `configuration.replace_vars` | `<replace_vars>` | Boolean → Y/N. |
| `configuration.parameters[].field` | `<parameter>/<field>/<name>` | Field input điền `?` theo thứ tự. |
| `configuration.parameters[].type` | `<parameter>/<field>/<type>` | Tên value-meta chuỗi. |

`<parameter>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=parameter`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 24 —
  `<step id="DBJoin">` →
  `org.pentaho.di.trans.steps.databasejoin.DatabaseJoinMeta` (category
  Lookup). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `DatabaseJoinMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/databasejoin/DatabaseJoinMeta.java`
  dòng 338–359) — thứ tự `connection`, `rowlimit` (int), `sql`,
  `outer_join` (Y/N), `replace_vars` (Y/N), rồi wrapper `<parameter>`
  LUÔN emit kể cả 0 field (dòng 348/356) chứa các `<field>` với `<name>`
  và `<type>` là tên value-meta chuỗi qua
  `ValueMetaFactory.getValueMetaName` (dòng 352–353).
- Deserialization: `loadXML()` (dòng 196–202) reset
  `parameterField/parameterType = null`, 2 flag = false rồi gọi
  `readData()` (dòng 223–247) — 2 flag parse bằng
  `"Y".equalsIgnoreCase(...)` (thiếu tag → false); `rowlimit` qua
  `Const.toInt(..., 0)` (thiếu tag → 0); list đọc từ sub-node
  `<parameter>`, mỗi `<field>` đọc `name` + `type` (map về id qua
  `ValueMetaFactory.getIdForValueMeta`, dòng 239–241).
- Khởi tạo: `setDefault()` (dòng 250–268) — `databaseMeta = null`,
  `rowLimit = 0`, `sql = ""`, cả 2 flag false, `allocate(0)` (0 tham số).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 285–335) append các field
  kết quả của query (`db.getQueryFields`, có cache) vào row — output =
  input row + query columns; cần DB thật nên không test runtime ở đây.
  `getParameterRow()` (dòng 270–282) lấy các `parameterField` từ row đầu
  vào để bind `?`. `check()` (dòng 411–524) khi nối được DB: query phải
  parse được field (dòng 429–440), SỐ marker `?`
  (`db.countParameters`) phải bằng `parameterField.length` (dòng
  443–462), và mọi parameter field phải tồn tại trong stream trước (dòng
  466–496). Flag `outerJoin` (dòng 70–73): false = không trả dòng khi
  không tìm thấy; true = trả ít nhất một dòng nguồn, phần còn lại NULL.
- `getUsedDatabaseConnections()` (dòng 596–602) trả connection đã chọn —
  lineage thấy step này dùng DB.

Cấu hình không mặc định (SQL 1 marker `?` + 1 field tham số):

```xml
<sql>SELECT dept_name FROM ${SCHEMA}.dept WHERE dept_id = ?</sql>
<parameter>
  <field>
    <name>DEPT_ID</name>
    <type>Integer</type>
  </field>
</parameter>
```

Fill bằng `set_fields` (`listTag=parameter`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Số `<field>` phải bằng số `?`**: `check()` so sánh
  `countParameters(sql)` với `parameterField.length` — lệch là ERROR.
  Thêm/bớt marker trong SQL mà quên cập nhật list là lỗi phổ biến nhất.
- **`<field>/<type>` là tên chuỗi, không phải số**: `Integer`,
  `String`, `Number`, `Date`, ... (qua `ValueMetaFactory`) — ghi số id
  kiểu (ví dụ `5`) sẽ bị `getIdForValueMeta` map sai.
- **List là `<parameter>/<field>`, KHÔNG phải `<lookup>`**: dễ nhầm với
  `StreamLookup` (`<lookup>/<key>`+`<value>`) hay `DBLookup` — DBJoin chỉ
  có `<parameter>`.
- **`<parameter>` luôn paired**: `getXML()` emit cả khi 0 field, nên
  template giữ `<parameter></parameter>` (paired), không viết self-closing
  `<parameter/>` — `setFields` từ chối list self-closing.
- **XML-escape SQL**: `WHERE x < y` phải viết `WHERE x &lt; y` — quên →
  XML hỏng. `${VAR}` trong SQL chỉ substitute khi `replace_vars=Y`.
- **Mỗi dòng input = một query**: stream lớn + query nặng = chậm; cân nhắc
  `DBLookup` (cache) hoặc join trong DB khi phù hợp.
- Template mặc định là khung cấu hình — người dùng phải điền connection
  có thật, SQL nghiệp vụ và field tham số tồn tại trong stream trước;
  credential không bao giờ nằm trong `<sql>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
