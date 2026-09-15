# DBProc — Step gọi stored procedure / function của DB

Với MỖI dòng đầu vào, gọi một stored procedure (hoặc function) trên
connection đã chọn, truyền các argument (`<lookup>/<arg>`) rồi gắn kết quả
trả về vào sau dòng gốc và truyền đi. `getFields()` append một field
`<result>/<name>` (nếu non-empty) CỘNG một field cho MỖI argument có
`<direction>OUT` — output = input row + result + OUT args. `auto_commit=Y`
commit sau mỗi lần gọi; `=N` thì caller quản lý transaction.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DBProc</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <procedure>${PROC}</procedure>
    <lookup>
      <arg>
        <name>{{ARG_FIELD}}</name>
        <direction>IN</direction>
        <type>String</type>
      </arg>
    </lookup>
    <result>
      <name>result</name>
      <type>Number</type>
    </result>
    <auto_commit>Y</auto_commit>
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
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). `check()` ERROR khi null; `getUsedDatabaseConnections()` trả connection này. |
| `<procedure>` | Y | Tên stored procedure / function cần gọi (hỗ trợ biến). |
| `<lookup>/<arg>/<name>` | Y (mỗi arg) | Tên argument của procedure (đồng thời là tên field khi direction=OUT). `check()` đòi arg tồn tại trong stream trước. |
| `<lookup>/<arg>/<direction>` | Y (mỗi arg) — LUÔN phải có | `IN`, `OUT` hoặc `INOUT`. Chỉ `OUT` (case-insensitive) mới thêm output field; còn lại coi như input. `getFields()` gọi `equalsIgnoreCase` KHÔNG null-guard — thiếu tag NÉM NPE. |
| `<lookup>/<arg>/<type>` | Y (mỗi arg) | Kiểu value-meta của argument DƯỚI DẠNG CHUỖI (`String`, `Integer`, `Number`, `Date`, ...) — không phải số id. |
| `<result>/<name>` | N | Tên field chứa giá trị trả về của procedure/function (mặc định step mới: `result`); để trống = không thêm field result. |
| `<result>/<type>` | N | Kiểu value-meta của result DƯỚI DẠNG CHUỖI (mặc định step mới: `Number`). |
| `<auto_commit>` | N | `Y` (mặc định step mới) = auto-commit sau mỗi lần gọi; `N` = caller quản lý transaction. Template LUÔN pin tag này显式. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DB_PROC` | `<type>` | `DBProc`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.procedure` | `<procedure>` | Cho phép `${VAR}`. |
| `configuration.arguments[].name` | `<lookup>/<arg>/<name>` | Tên argument. |
| `configuration.arguments[].direction` | `<lookup>/<arg>/<direction>` | `IN` / `OUT` / `INOUT`. BẮT BUỘC có mặt. |
| `configuration.arguments[].type` | `<lookup>/<arg>/<type>` | Tên value-meta chuỗi. |
| `configuration.result_name` | `<result>/<name>` | Trống = không thêm field. |
| `configuration.result_type` | `<result>/<type>` | Tên value-meta chuỗi. |
| `configuration.auto_commit` | `<auto_commit>` | Boolean → Y/N. |

`<lookup>` chứa list `<arg>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=lookup`, `itemTag=arg`); block đơn `<result>` sửa
bằng `set_field_path` (`result/name`, `result/type`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 51 —
  `<step id="DBProc">` →
  `org.pentaho.di.trans.steps.dbproc.DBProcMeta` (category Lookup).
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `DBProcMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/dbproc/DBProcMeta.java`
  dòng 288–316) — thứ tự `connection` (tên `DatabaseMeta`, `""` khi null),
  `procedure`, rồi wrapper `<lookup>` LUÔN emit kể cả 0 arg (dòng 294/305)
  chứa các `<arg>` với `<name>` + `<direction>` + `<type>` là tên value-meta
  chuỗi qua `ValueMetaFactory.getValueMetaName` (dòng 296–303); rồi block
  `<result>` LUÔN emit (dòng 307/311) với `<name>` + `<type>`; rồi
  `auto_commit` (Y/N, dòng 313).
- Deserialization: `loadXML()` (dòng 213–215) gọi `readData()` (dòng
  318–347) — `connection` resolve qua `DatabaseMeta.findDatabase`;
  `procedure` đọc nguyên văn; list đọc từ sub-node `<lookup>`, mỗi `<arg>`
  đọc `name` + `direction` + `type` (map về id qua
  `ValueMetaFactory.getIdForValueMeta`, dòng 335–337); `resultName` optional
  có thể null (dòng 340); `autoCommit` parse đảo
  `!"N".equalsIgnoreCase(...)` (thiếu tag → true, dòng 343).
- Khởi tạo: `setDefault()` (dòng 236–255) — `databaseMeta = null`, 0 arg,
  `resultName = "result"`, `resultType = TYPE_NUMBER`, `autoCommit = true`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 258–286) thêm field
  `resultName` (khi non-empty) rồi một field cho mỗi arg direction=`OUT` —
  output = input row + result + OUT args; cần DB thật nên không test runtime
  ở đây. `check()` (dòng 399–477) khi nối được DB: mọi arg phải tồn tại
  trong stream trước và (với kiểu số) phải tương thích (dòng 416–439); step
  phải có input (dòng 465–475). `getUsedDatabaseConnections()` (dòng
  488–494) trả connection đã chọn — lineage thấy step này dùng DB.
  `supportsErrorHandling()` = true (dòng 496–498).

Cấu hình không mặc định (1 arg IN + 1 arg OUT + result kiểu String):

```xml
<procedure>${PROC}</procedure>
<lookup>
  <arg>
    <name>IN_PRICE_ID</name>
    <direction>IN</direction>
    <type>Integer</type>
  </arg>
  <arg>
    <name>OUT_PRICE</name>
    <direction>OUT</direction>
    <type>Number</type>
  </arg>
</lookup>
<result>
  <name>proc_status</name>
  <type>String</type>
</result>
```

Fill list bằng `set_fields` (`listTag=lookup`, `itemTag=arg`); block
`<result>` sửa bằng `set_field_path` (`result/name`, `result/type`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<direction>` bắt buộc trên MỌI `<arg>`**: `getFields()` dòng 273 gọi
  `argumentDirection[i].equalsIgnoreCase("OUT")` KHÔNG null-guard — thiếu tag
  NÉM NPE khi tính output fields.
- **`<direction>` chỉ có `IN` / `OUT` / `INOUT`**: chỉ `OUT`
  (case-insensitive) mới sinh thêm output field; ghi giá trị lạ sẽ lặng lẽ
  bị coi như input.
- **`<arg>/<type>` và `<result>/<type>` là tên chuỗi, không phải số**:
  `Integer`, `String`, `Number`, ... (qua `ValueMetaFactory`) — ghi số id
  kiểu sẽ bị `getIdForValueMeta` map sai (cùng bẫy DBJoin).
- **List là `<lookup>/<arg>`, KHÔNG phải `<arguments>` hay `<parameter>`**:
  dễ nhầm với DBJoin (`<parameter>/<field>`) — DBProc chỉ có `<lookup>`.
- **`<lookup>` và `<result>` luôn paired**: `getXML()` emit cả khi 0 arg,
  nên template giữ paired, không viết self-closing — `setFields` từ chối
  list self-closing.
- **`<result>/<name>` trống = không có field result**: khác với technical key
  bắt buộc của DimensionLookup — ở đây result rỗng là hợp lệ (chỉ OUT args
  ra output).
- Template mặc định là khung cấu hình — người dùng phải điền connection có
  thật, tên procedure tồn tại và arg khớp signature procedure;
  credential không bao giờ nằm trong XML này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
