# TeraFast — Step bulk-load Teradata FastLoad (trans)

Ghi stream vào Teradata bằng tiện ích FastLoad ngoài (`<fastload_path>`,
mặc định `/usr/bin/fastload`): ánh xạ trường stream (`<stream_field_list>`)
sang cột bảng đích (`<table_field_list>`, nối nhau bằng DẤU PHẨY trong MỘT
tag), ghi file dữ liệu trung gian (`<datafile_path>`) và file log, điều
khiển session/giới hạn lỗi/truncate. `TeraFastPlugin` là ALIAS cùng class —
xem mục 4. Step THAM CHIẾU DB connection theo tên (`<connection>`) như họ
bulk-loader.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TeraFast</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <controlfile_path/>
    <datafile_path>${Internal.Step.CopyNr}.dat</datafile_path>
    <error_limit>25</error_limit>
    <fastload_path>/usr/bin/fastload</fastload_path>
    <logfile_path/>
    <sessions>2</sessions>
    <stream_field_list>{{STREAM_FIELDS}}</stream_field_list>
    <table_field_list>{{TABLE_COLUMNS}}</table_field_list>
    <target_table>${TARGET_TABLE}_${RUN_ID}</target_table>
    <truncate_table>Y</truncate_table>
    <use_control_file>Y</use_control_file>
    <variable_substitution>Y</variable_substitution>
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
| `<connection>` | Y | Tên DB connection Teradata (THAM CHIẾU — phải tồn tại; `initDbMeta` resolve, thiếu → null). Dùng `${VAR}`. |
| `<fastload_path>` | Y | Path tiện ích fastload; mặc định `/usr/bin/fastload`. |
| `<controlfile_path>` | Điều kiện | Path control file khi `use_control_file=Y`; rỗng = sinh tự động. |
| `<datafile_path>` | Y | File dữ liệu trung gian; mặc định `${Internal.Step.CopyNr}.dat`. |
| `<logfile_path>` | N | File log fastload. |
| `<sessions>` | N | Số session; số int, mặc định `2`. **Thiếu tag → NumberFormatException khi load** (parse không null-guard). |
| `<error_limit>` | N | Giới hạn lỗi; số int, mặc định `25`. Thiếu tag → lỗi như trên. |
| `<target_table>` | Y | Bảng đích (hỗ trợ biến); mặc định `${TARGET_TABLE}_${RUN_ID}`. |
| `<table_field_list>` | Y | Cột bảng đích, NỐI DẤU PHẨY trong MỘT tag (không phải list lặp!). |
| `<stream_field_list>` | Y | Trường stream tương ứng, NỐI DẤU PHẨY, cùng thứ tự. |
| `<truncate_table>` | N | `Y` (mặc định) = truncate trước load. Y/N. |
| `<use_control_file>` | N | `Y` (mặc định) = dùng control file; `N` = đọc schema bảng live qua DB. |
| `<variable_substitution>` | N | `Y` (mặc định) = substitute biến. Y/N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TERA_FAST` | `<type>` | `TeraFast` (alias `TeraFastPlugin` cùng file này). |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.target_table` | `<target_table>` | Hỗ trợ biến. |
| `configuration.table_columns[]` | `<table_field_list>` | JOIN dấu phẩy thành 1 chuỗi. |
| `configuration.stream_fields[]` | `<stream_field_list>` | JOIN dấu phẩy, cùng thứ tự. |

KHÔNG có list lặp — `table_field_list`/`stream_field_list` là chuỗi phẩy
đơn; KHÔNG dùng `set_fields`. Mọi cấu hình đổi bằng `set_field_path`.

## 4. Ví dụ thực tế — BẰNG CHỨNG ALIAS

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "TeraFast,TeraFastPlugin", ...)`
  (`plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java`
  dòng 56–61, category Bulk). HAI ID trong MỘT annotation trỏ CÙNG class —
  `TeraFastPlugin` là alias, KHÔNG phải implementation riêng. Kết luận:
  **alias thật → 1 reference chung** (2 catalog row cùng file này;
  `addElement()` với alias chèn `<type>TeraFast</type>` chuẩn vì cùng
  serializer).
- Serialization: KHÔNG có `getXML()` riêng trong `TeraFastMeta` — kế thừa
  `AbstractStepMeta.getXML()` (`engine/.../core/util/AbstractStepMeta.java`
  dòng 131–134) = `PluginPropertyHandler.toXml(properties)`, mỗi property
  emit tag theo key (`StringPluginProperty.appendXml`,
  `.../StringPluginProperty.java` dòng 72–74). Thứ tự tag là ALPHABET do
  `KeyValueSet` dùng `TreeMap` (`.../KeyValueSet.java` dòng 50):
  `connection`, `controlfile_path`, `datafile_path`, `error_limit`,
  `fastload_path`, `logfile_path`, `sessions`, `stream_field_list`,
  `table_field_list`, `target_table`, `truncate_table`, `use_control_file`,
  `variable_substitution` (key ở `TeraFastMeta.java` dòng 93–115, thêm
  `connection` ở `AbstractStepMeta.java` dòng 56–69).
- Deserialization: `AbstractStepMeta.loadXML()` (dòng 111–114) walk
  `LoadXml` + `initDbMeta` resolve connection theo tên (dòng 120–124).
  **BẪY**: `IntegerPluginProperty.loadXml` parse KHÔNG null-guard
  (`.../IntegerPluginProperty.java` dòng 81–84) — `<sessions>`/
  `<error_limit>` thiếu tag NÉM `NumberFormatException`.
- Khởi tạo: `setDefault()` (`TeraFastMeta.java` dòng 277–286) —
  fastload `/usr/bin/fastload`, datafile `${Internal.Step.CopyNr}.dat`,
  sessions 2, errorLimit 25, truncate/variableSubstitution true,
  targetTable `${TARGET_TABLE}_${RUN_ID}`, useControlFile true.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 295–299) NO-OP (pass-through).
  `use_control_file=N` đọc schema bảng live qua DB connection (dòng
  306–323) — cần DB thật. Cần binary fastload + Teradata nên không test
  runtime ở đây.
- `getUsedDatabaseConnections()` trả connection đã chọn (họ bulk-loader) —
  lineage thấy step này dùng DB.

Cấu hình không mặc định (bảng staging, 4 cột):

```xml
<connection>${TERADATA_CONN}</connection>
<target_table>${TARGET_TABLE}_${RUN_ID}</target_table>
<table_field_list>ID,NAME,AMOUNT,LOAD_DT</table_field_list>
<stream_field_list>ID,NAME,AMOUNT,LOAD_DT</stream_field_list>
<sessions>4</sessions>
<truncate_table>N</truncate_table>
```

Đổi bằng `set_field_path` từng tag.

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là THAM CHIẾU DB**: fixture/test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2) — thiếu là
  validator báo "undefined connection".
- **Danh sách nối phẩy, KHÔNG phải list lặp**: `table_field_list` MỘT tag
  chứa `A,B,C` (`SEPARATOR_CHAR = ','`,
  `StringListPluginProperty.java` dòng 57) — đừng viết nhiều
  `<table_field_list>` (tag sau ĐÈ tag trước khi load).
- **`<sessions>`/`<error_limit>` thiếu = CRASH load** (parseInt null) —
  không bao giờ lược 2 tag này.
- **Boolean Y/N** (`BOOLEAN_STRING_TRUE = "Y"`,
  `PluginProperty.java` dòng 62) — ghi `true` load thành false.
- **Thứ tự tag là alphabet** (TreeMap), không phải thứ tự khai báo —
  đừng "sửa order cho đẹp" lệch khỏi serializer.
- Template mặc định là khung cấu hình — cần Teradata thật + binary
  fastload; credential không bao giờ nằm trong XML.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu annotation đa-ID,
  property-framework serializer, `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
