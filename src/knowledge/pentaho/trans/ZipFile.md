# ZipFile — Step nén file thành zip theo dòng

Với MỖI dòng đầu vào, thêm file có path trong cột
`<sourcefilenamefield>` vào file zip có path trong cột
`<targetfilenamefield>` (gốc tương đối tính từ cột `<baseFolderField>`).
Sau khi zip: không làm gì / move / xóa nguồn theo `<operation_type>`
(mã `""`/`move`/`delete`, mặc định `""` = nothing). Tùy chọn ghi đè entry
(`overwritezipentry`), tạo thư mục cha (`createparentfolder`), giữ cấu
trúc thư mục nguồn (`keepsourcefolder`), move nguồn tới cột
`<movetofolderfield>`, thêm zip vào result (`addresultfilenames`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ZipFile</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <sourcefilenamefield>{{SOURCE_FIELD}}</sourcefilenamefield>
    <targetfilenamefield>{{TARGET_FIELD}}</targetfilenamefield>
    <baseFolderField>{{BASE_FIELD}}</baseFolderField>
    <operation_type/>
    <addresultfilenames>N</addresultfilenames>
    <overwritezipentry>N</overwritezipentry>
    <createparentfolder>N</createparentfolder>
    <keepsourcefolder>N</keepsourcefolder>
    <movetofolderfield/>
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
| `<sourcefilenamefield>` | Y | Cột path file nguồn. |
| `<targetfilenamefield>` | Y | Cột path file zip đích. |
| `<baseFolderField>` | N | Cột thư mục gốc (F hoa). |
| `<operation_type>` | N | Mã `""` (nothing, mặc định) / `move` / `delete`. Thiếu/lạ → `""`. |
| `<addresultfilenames>` | N | Y = thêm zip vào result. |
| `<overwritezipentry>` | N | Y = ghi đè entry trùng tên. |
| `<createparentfolder>` | N | Y = tạo thư mục cha của zip. |
| `<keepsourcefolder>` | N | Y = giữ cấu trúc thư mục nguồn trong zip. |
| `<movetofolderfield>` | N (Y khi operation=move) | Cột thư mục move nguồn tới. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ZIP_FILE_STEP` | `<type>` | `ZipFile` (trùng tên job entry `ZIP_FILE` nhưng khác kind — hợp lệ). |
| `configuration.source_field` | `<sourcefilenamefield>` | Cột nguồn. |
| `configuration.target_field` | `<targetfilenamefield>` | Cột zip đích. |
| `configuration.after_zip` | `<operation_type>` | `""`/`move`/`delete`. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 125 —
  `<step id="ZipFile">` →
  `org.pentaho.di.trans.steps.zipfile.ZipFileMeta` (category Utility).
- Mã operation: `operationTypeCode = {"", "move", "delete"}` (dòng 85);
  `NOTHING = 0`, `MOVE = 1`, `DELETE = 2` (87–91); thiếu/lạ → `[0]`
  (207–212, 237–238).
- Serialization: `getXML()` (dòng 214–230) — `sourcefilenamefield`
  (217), `targetfilenamefield` (218), `baseFolderField` F hoa (219),
  `operation_type` mã (220), `addresultfilenames` (221),
  `overwritezipentry` (222), `createparentfolder` (223),
  `keepsourcefolder` (224), `movetofolderfield` (225). (Dòng 226–228:
  đăng ký URL cluster — không phải tag XML.)
- Deserialization: `readData()` (dòng 232+) — operation qua
  `getOperationTypeByCode(NVL(tag,""))`.
- Khởi tạo: `setDefault()` (dòng 199–205) — 4 cờ false, operation
  NOTHING.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Không có `<connection>`. Không thực thi I/O trong scope này.

Cấu hình không mặc định (move nguồn sau zip + ghi đè):

```xml
<sourcefilenamefield>SOURCE_PATH</sourcefilenamefield>
<targetfilenamefield>ZIP_PATH</targetfilenamefield>
<baseFolderField>BASE_DIR</baseFolderField>
<operation_type>move</operation_type>
<addresultfilenames>Y</addresultfilenames>
<overwritezipentry>Y</overwritezipentry>
<createparentfolder>Y</createparentfolder>
<keepsourcefolder>Y</keepsourcefolder>
<movetofolderfield>ARCHIVE_DIR</movetofolderfield>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<operation_type>` rỗng = do-nothing** (mã `""`, không phải chữ
  `nothing`) — thiếu tag cũng về `""` lặng lẽ.
- **Chú ý case**: `baseFolderField` F hoa (dòng 219);
  `sourcefilenamefield`, `targetfilenamefield`, `movetofolderfield`
  viết thường hết. Viết `basefolderfield` thường load null.
- Mọi path đều qua CỘT dòng, không có path tĩnh.
- Không chạy I/O trong scope này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
