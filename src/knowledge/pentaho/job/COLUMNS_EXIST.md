# COLUMNS_EXIST — Job entry kiểm tra các cột tồn tại trên bảng

Entry điều kiện (`evaluates() = true`, không unconditional): kiểm tra một
bảng TĨNH (`<tablename>` + `<schemaname>`) trên connection đã chọn, rồi kiểm
tra TỪNG cột trong danh sách tĩnh (`<fields>/<field>/<name>`). Kết quả true
CHỈ khi TẤT CẢ các cột đều tồn tại (PDI-15801) — một cột thiếu là cả entry
false (rẽ nhánh failure, KHÔNG phải error). Khác với step trans
`ColumnExists` (cột cần kiểm tra là field ĐỘNG `<columnnamefield>` của
stream), entry này dùng danh sách cột TĨNH.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>COLUMNS_EXIST</type>
      <attributes/>
      <tablename>${TABLE}</tablename>
      <schemaname>${SCHEMA}</schemaname>
      <connection>${CONN}</connection>
      <fields>
        <field>
          <name>{{COLUMN_NAME}}</name>
        </field>
      </fields>
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
| `<tablename>` | Y | Tên bảng tĩnh cần kiểm tra (hỗ trợ biến, substitute khi chạy). Thiếu → error. `check()` đòi non-blank. |
| `<schemaname>` | N | Schema chứa bảng (hỗ trợ biến); để trống khi DB không dùng schema. |
| `<connection>` | Y | Tên DB connection (THAM CHIẾU — phải tồn tại trong artifact/shared). Thiếu → error khi chạy. |
| `<fields>/<field>/<name>` | Y (ít nhất 1) | Tên cột TĨNH trên bảng. `arguments` null (không cấu hình cột nào) → error khi chạy. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: COLUMNS_EXIST` | `<type>` | `COLUMNS_EXIST`. |
| `configuration.table` | `<tablename>` | Tên bảng tĩnh; cho phép `${VAR}`. |
| `configuration.schema` | `<schemaname>` | Cho phép `${VAR}`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.columns[]` | `<fields>/<field>/<name>` | Tên cột tĩnh. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 45 —
  `<job-entry id="COLUMNS_EXIST">` →
  `org.pentaho.di.job.entries.columnsexist.JobEntryColumnsExist` (category
  Conditions). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryColumnsExist.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/columnsexist/JobEntryColumnsExist.java`
  dòng 94–115) — `super.getXML()` rồi đúng thứ tự `tablename` (dòng 99),
  `schemaname` (dòng 100), `connection` (= tên `DatabaseMeta`, null khi chưa
  chọn, dòng 101–102), rồi wrapper `<fields>` LUÔN emit kể cả 0 field (dòng
  104/112) chứa các `<field>` với `<name>` (tên cột, dòng 107–109).
- Deserialization: `loadXML()` (dòng 117–142) — `super.loadXML()` rồi đọc
  `tablename`/`schemaname` nguyên văn (dòng 121–122); `connection` resolve
  qua `DatabaseMeta.findDatabase` (dòng 124–125); đếm field từ sub-node
  `<fields>` (dòng 127–131), mỗi `<field>` đọc `name` (dòng 134–137).
- Khởi tạo: constructor (dòng 69–74) đặt `schemaname`, `tablename`,
  `connection` về null; `arguments` KHÔNG allocate (null).
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime (`execute()`, dòng 226–296): `evaluates()` = true (dòng
  218–220), `isUnconditional()` = false (dòng 222–224) — entry điều kiện, rẽ
  nhánh theo `result`. Thiếu `tablename` → error (dòng 234–237);
  `arguments` null → error (dòng 238–241); thiếu connection → error (dòng
  284–286). Kiểm tra bảng tồn tại rồi TỪNG cột qua
  `db.checkColumnExists` (dòng 256–270); **result true CHỈ khi tất cả cột
  tồn tại** (`nrexistcolums == arguments.length`, dòng 291–294, PDI-15801).
  `check()` (dòng 318–322) chỉ đòi `tablename` non-blank.
  `getUsedDatabaseConnections()` (dòng 302–304) — DB lineage applies.

Cấu hình không mặc định (bảng staging + 2 cột bắt buộc):

```xml
<tablename>${TABLE}</tablename>
<schemaname>${SCHEMA}</schemaname>
<connection>${CONN}</connection>
<fields>
  <field>
    <name>CUST_ID</name>
  </field>
  <field>
    <name>CUST_NAME</name>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy

- **Cột TĨNH, không phải stream field động** — ngược với step trans
  `ColumnExists` (B2a) dùng `<columnnamefield>` động. Cần kiểm tra cột mà
  tên chỉ biết khi chạy trong job thì entry này không phù hợp.
- **Một cột thiếu = cả entry false (không phải error)**: thiếu cột chỉ ghi
  log `ColumnNotExists` rồi `result=false`; chỉ thiếu bảng/connection/cấu
  hình mới là error path. Thiết kế hop failure cho trường hợp thiếu cột.
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field, nên template
  giữ `<fields></fields>` (paired), không viết self-closing `<fields/>` —
  `setFields` từ chối list self-closing (cùng bẫy `<parameter>` của DBJoin).
- **Entry điều kiện, không phải action**: `result` true/false rẽ nhánh hop
  success/failure — đừng mong entry này trả dữ liệu.
- Template mặc định là khung cấu hình — người dùng phải điền tên bảng, danh
  sách cột và connection có thật; credential không bao giờ nằm trong XML.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
