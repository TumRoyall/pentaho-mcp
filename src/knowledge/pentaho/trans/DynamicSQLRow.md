# DynamicSQLRow — Step chạy SQL động theo từng dòng

Với MỖI dòng đầu vào, chạy câu SQL trên `<connection>` rồi gắn các cột kết
quả vào sau dòng gốc (giống `DBJoin`), nhưng SQL LẤY TỪ FIELD
(`<sql_fieldname>`) thay vì SQL tĩnh — mỗi dòng có thể chạy một câu khác
nhau. `getFields()` append cột của query (cần DB thật). `query_only_on_change=Y`
chỉ chạy lại khi SQL đổi so với dòng trước.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DynamicSQLRow</type>
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
    <sql>SELECT {{RESULT_COLS}} FROM ${SCHEMA}.{{LOOKUP_TABLE}} WHERE {{LOOKUP_COL}} = ?</sql>
    <outer_join>N</outer_join>
    <replace_vars>N</replace_vars>
    <sql_fieldname>{{SQL_FIELD}}</sql_fieldname>
    <query_only_on_change>N</query_only_on_change>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — fixture phải khai báo). |
| `<rowlimit>` | N | Số dòng query trả về mỗi dòng input; `0` (mặc định) = ALL. Int. |
| `<sql>` | N | SQL mẫu/fallback (giữ nguyên văn, XML-escape `<`/`&`). |
| `<outer_join>` | N | `Y` = giữ dòng nguồn khi query rỗng (cột query NULL); mặc định `N`. |
| `<replace_vars>` | N | `Y` = substitute `${VAR}` trong SQL; mặc định `N`. |
| `<sql_fieldname>` | Y | Tên FIELD chứa câu SQL động của từng dòng. Step cần hop vào. |
| `<query_only_on_change>` | N | `Y` = chỉ chạy lại khi SQL khác dòng trước; mặc định `N`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DYNAMIC_SQL_ROW` | `<type>` | `DynamicSQLRow`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.row_limit` | `<rowlimit>` | Số; `0` = ALL. |
| `configuration.sql_template` | `<sql>` | Giữ nguyên văn, escape. |
| `configuration.sql_field` | `<sql_fieldname>` | Field động, cần hop vào. |
| `configuration.outer_join` / `replace_vars` / `query_only_on_change` | 3 cờ Y/N | Boolean → Y/N. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`. Step cần
hop vào (đọc field động) nhưng không khai báo tham chiếu step trong XML.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 80 —
  `<step id="DynamicSQLRow">` →
  `org.pentaho.di.trans.steps.dynamicsqlrow.DynamicSQLRowMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `DynamicSQLRowMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/dynamicsqlrow/DynamicSQLRowMeta.java`
  dòng 274–287) — đúng thứ tự `connection`, `rowlimit` (int), `sql`,
  `outer_join`, `replace_vars`, `sql_fieldname`, `query_only_on_change`
  (dòng 277–284). Không có `<parameter>` (khác `DBJoin`).
- Deserialization: `loadXML()` (dòng 187–189) gọi `readData()` (dòng
  197–213) — `connection` resolve qua `findDatabase`; 3 cờ Y/N (thiếu →
  false); `rowlimit` qua `Const.toInt(..., 0)` (thiếu → 0).
- Khởi tạo: `setDefault()` (dòng 215–223) — `rowLimit=0`, `sql=""`, 3 cờ
  false, `sqlfieldname=null`, connection null.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 225–272) nối DB (hoặc cache) lấy
  cột của `sql` rồi `row.addRowMeta` — output = input + query columns;
  connection null → return sớm (dòng 228–230). Cần DB thật nên không test
  runtime ở đây.

Cấu hình không mặc định (outer join + chỉ chạy khi SQL đổi):

```xml
<connection>${CONN}</connection>
<rowlimit>1</rowlimit>
<outer_join>Y</outer_join>
<sql_fieldname>ROW_SQL</sql_fieldname>
<query_only_on_change>Y</query_only_on_change>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **SQL động từ field, không phải `<sql>` tĩnh**: `<sql>` chỉ là mẫu/
  fallback — câu chạy thật lấy từ field `sql_fieldname`. Đừng nhầm với
  `DBJoin` (SQL tĩnh + `<parameter>`); step này KHÔNG có `<parameter>`.
- **Mỗi dòng = một query**: stream lớn = chậm; `query_only_on_change=Y`
  giảm tải khi nhiều dòng trùng SQL liên tiếp.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  field SQL tồn tại trong stream trước; không chạy DB khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/DB thật) — không tuyên bố hai mức này.
