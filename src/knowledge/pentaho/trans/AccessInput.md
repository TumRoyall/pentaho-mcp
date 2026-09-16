# AccessInput — Step đọc bảng MS Access (.mdb)

Đọc bảng (`<table_name>` tĩnh, hoặc tên bảng động từ cột
`<tablename_field>` khi `tablename=Y`) từ các file MS Access (`.mdb`)
liệt kê trong block `<file>` PHẲNG (như LDIFInput — lặp song song theo
`<name>`), hoặc file động từ cột (`filefield=Y` + `<filename_Field>`
CHÚ Ý F hoa). Mỗi cột bảng liệt kê trong `<fields>/<field>` (tag
`attribut` không e) thành cột dòng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AccessInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <include>N</include>
    <include_field/>
    <tablename>N</tablename>
    <filename_Field/>
    <tablename_field/>
    <rownum>N</rownum>
    <isaddresult>Y</isaddresult>
    <filefield>N</filefield>
    <rownum_field/>
    <resetrownumber>Y</resetrownumber>
    <table_name>${ACCESS_TABLE}</table_name>
    <file>
      <name>${ACCESS_FILE}</name>
      <filemask>.*\.mdb</filemask>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{FIELD_NAME_1}}</name>
        <attribut>COLUMN1</attribut>
        <type>String</type>
        <format/>
        <length>-1</length>
        <precision>-1</precision>
        <currency/>
        <decimal/>
        <group/>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <shortFileFieldName/>
    <pathFieldName/>
    <hiddenFieldName/>
    <lastModificationTimeFieldName/>
    <uriNameFieldName/>
    <rootUriNameFieldName/>
    <extensionFieldName/>
    <sizeFieldName/>
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
| `<include>` + `<include_field>` | N | Cột tên file đang đọc. |
| `<tablename>` + `<tablename_field>` | N | Y = tên bảng động từ cột. |
| `<filename_Field>` | N (Y khi filefield=Y) | Cột chứa tên file — F HOA. |
| `<rownum>` + `<rownum_field>` + `<resetrownumber>` | N | Cột số thứ tự + reset theo file (reset mặc định true ở dialog; tag thiếu → false). |
| `<isaddresult>` | N | Thêm file vào result; THIẾU/rỗng → TRUE. Template pin `Y` tường minh. |
| `<filefield>` | N | Y = file động từ cột. |
| `<table_name>` | Y (khi bảng tĩnh) | Tên bảng Access. |
| `<file>` (phẳng) | Y (khi filefield=N) | Như LDIFInput — song song theo `<name>`. |
| `<fields>/<field>` | Y | `name`, `attribut` (không e), `type`, `format`, `length`, `precision`, `currency`, `decimal`, `group`, `trim_type`, `repeat` (thiếu → false, an toàn). |
| `<limit>` + 8 tag phụ | N | Như LDIFInput. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ACCESS_INPUT` | `<type>` | `AccessInput`. |
| `configuration.table` | `<table_name>` | Bảng tĩnh. |
| `configuration.filename_column_mode` | `<filefield>` + `<filename_Field>` | F hoa. |
| `configuration.columns[].column` | `<fields>/<field>/<attribut>` | Không e. |

`<fields>` → MỘT lần `set_fields`; `<file>` phẳng không dùng.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="AccessInput", ...)`
  (`plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessinput/AccessInputMeta.java`
  dòng 73+, category Input).
- Serialization: `getXML()` (dòng 656–711) — `include` (658),
  `include_field` (659), `tablename` (660), `filename_Field` F hoa
  (661), `tablename_field` (662), `rownum` (663), `isaddresult` (664),
  `filefield` (665), `rownum_field` (666), `resetrownumber` (667),
  `table_name` (668), `<file>` phẳng (669–677), `<fields>` (682–699;
  `attribut` 686), `limit` (700), 8 tag phụ (701–709).
- Deserialization: `readData()` (dòng 713+) — `isaddresult`
  rỗng/thiếu → TRUE (dòng 721–726); `filename_Field` F hoa (731);
  `repeat` null → else-branch (766–768, an toàn false).
- Khởi tạo: `setDefault()` (dòng 812–836) — `isaddresult` true (822),
  còn lại false/rỗng, allocate 0/0.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Không có `<connection>` DB.

Cấu hình không mặc định (file + bảng động):

```xml
<tablename>Y</tablename>
<tablename_field>SOURCE_TABLE</tablename_field>
<filefield>Y</filefield>
<filename_Field>SOURCE_FILE</filename_Field>
<table_name/>
<limit>500</limit>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<filename_Field>` F hoa** (dòng 661/731) — viết `filename_field`
  thường load null.
- **`<isaddresult>` thiếu → TRUE** (dòng 721–726, ngược với cờ Y/N
  thường) — luôn ghi tường minh.
- **`<file>` phẳng như LDIF** — không bọc `<field>`.
- Chỉ đọc `.mdb` (Jackcess); không phải kết nối ODBC chung.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
