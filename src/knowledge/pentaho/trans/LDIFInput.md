# LDIFInput — Step đọc file LDIF

Đọc các entry LDIF từ danh sách file (`<file>` — block PHẲNG: các tag
`name`/`filemask`/`exclude_filemask`/`file_required`/`include_subfolders`
lặp song song, đếm theo `<name>`, KHÔNG phải list `<field>`), hoặc tên
file động từ cột dòng (`filefield=Y` + `<dynamicFilenameField>`). Mỗi
attribute LDIF liệt kê trong `<fields>/<field>` thành một cột. Tag field
dùng `attribut` (không có e) như họ Access.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>LDIFInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filefield>N</filefield>
    <dynamicFilenameField/>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownum_field/>
    <contenttype>N</contenttype>
    <contenttype_field/>
    <dn_field>DN</dn_field>
    <dn>Y</dn>
    <addtoresultfilename>N</addtoresultfilename>
    <multiValuedSeparator>,</multiValuedSeparator>
    <file>
      <name>${LDIF_FILE}</name>
      <filemask>.*\.ldif</filemask>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{FIELD_NAME_1}}</name>
        <attribut>cn</attribut>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
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
| `<filefield>` + `<dynamicFilenameField>` | N | Y = đọc tên file từ cột dòng; N (mặc định) = dùng `<file>` tĩnh. |
| `<include>` + `<include_field>` | N | Thêm cột tên file đang đọc. |
| `<rownum>` + `<rownum_field>` | N | Cột số thứ tự. |
| `<contenttype>` + `<contenttype_field>` | N | Cột loại nội dung. |
| `<dn_field>` + `<dn>` | N | Cột DN entry (`dn=Y` phát cột tên `dn_field`). |
| `<addtoresultfilename>` | N | Thêm file vào result filenames. |
| `<multiValuedSeparator>` | N | Mặc định `","` (khác `";"` của LDAP/Access). Chú ý V hoa. |
| `<file>` (phẳng) | Y (khi filefield=N) | Các tag con lặp song song theo `<name>`; giữ thứ tự name/filemask/exclude_filemask/file_required/include_subfolders. |
| `<fields>/<field>` | Y | `name`, `attribut` (không e), `type` chuỗi, `format`, `currency`, `decimal`, `group`, `length`, `precision`, `trim_type`, `repeat`. |
| `<limit>` | N | Long; 0 = không giới hạn. |
| 8 tag `*FieldName` cuối | N | Cột phụ file (short/path/hidden/lastModification/uri/rootUri/extension/size); rỗng → không phát. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: LDIF_INPUT` | `<type>` | `LDIFInput`. |
| `configuration.filename_field_mode` | `<filefield>` | Y/N. |
| `configuration.dn_output` | `<dn>` + `<dn_field>` | Cờ + tên cột. |
| `configuration.separator` | `<multiValuedSeparator>` | V hoa, `","`. |
| `configuration.fields[].attribute` | `<fields>/<field>/<attribut>` | Không có e. |

`<fields>` → MỘT lần `set_fields`; `<file>` phẳng KHÔNG phải list
`<field>` — không dùng `set_fields` cho file.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (`LDIFInput` →
  `org.pentaho.di.trans.steps.ldifinput.LDIFInputMeta`, category Input).
- Field item: `LDIFInputField.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/ldifinput/LDIFInputField.java`
  dòng 93–107): `name` (97), `attribut` (98), `type` (99), `format`
  (100), `currency` (101), `decimal` (102), `group` (103), `length`
  (104), `precision` (105), `trim_type` (106), `repeat` (107). Load
  `repeat` là `!"N"...` (dòng 125) — THIẾU → TRUE, luôn emit.
- Serialization: `LDIFInputMeta.getXML()` (dòng 652–695) — `filefield`
  (655) ... `multiValuedSeparator` V hoa (666), block `<file>` PHẲNG
  (668–676: lặp 5 tag song song, không bọc `<field>`), block
  `<fields>` (678–683), `limit` (684), 8 tag phụ (685–693).
- Deserialization: `readData()` (dòng 697–751) — đếm file theo
  `<name>` trong `<file>` (712–714), đọc từng tag song song bằng
  `getSubNodeByNr` (719–730); `limit` long (739).
- Khởi tạo: `setDefault()` (dòng 763–789) — cờ false, separator `","`,
  allocate 0/0.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Không có `<connection>`.

Cấu hình không mặc định (file động + DN + giới hạn):

```xml
<filefield>Y</filefield>
<dynamicFilenameField>SOURCE_FILE</dynamicFilenameField>
<dn_field>ENTRY_DN</dn_field>
<dn>Y</dn>
<file>
  <name/>
  <filemask/>
  <exclude_filemask/>
  <file_required>N</file_required>
  <include_subfolders>N</include_subfolders>
</file>
<fields>
  <field>
    <name>COMMON_NAME</name>
    <attribut>cn</attribut>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>255</length>
    <precision>-1</precision>
    <trim_type>both</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
<limit>1000</limit>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<file>` phẳng, không phải list `<field>`**: đếm file theo `<name>`
  (dòng 714) — bọc mỗi file trong `<field>` sẽ load 0 file lặng lẽ.
- **`attribut` không có e** (dòng 98) — viết `attribute` load null.
- **`<repeat>` thiếu → TRUE** (dòng 125) — luôn emit.
- **`<multiValuedSeparator>` V hoa, mặc định `","`** — khác họ LDAP.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
