# FileExists — Step kiểm tra file có tồn tại

Với MỖI dòng đầu vào, kiểm tra file có path trong cột `<filenamefield>`
tồn tại không (VFS), ghi kết quả boolean vào cột `<resultfieldname>`
(mặc định `"result"`). Tùy chọn thêm cột loại file (`<includefiletype>`
+ `<filetypefieldname>`: `file`/`dir`/...) và thêm file tồn tại vào
result filenames (`<addresultfilenames>`). Output = input + cột kết quả.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FileExists</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filenamefield>{{FILENAME_FIELD}}</filenamefield>
    <resultfieldname>result</resultfieldname>
    <includefiletype>N</includefiletype>
    <filetypefieldname/>
    <addresultfilenames>N</addresultfilenames>
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
| `<filenamefield>` | Y | Cột dòng chứa path file cần kiểm tra. `check()` ERROR khi rỗng. |
| `<resultfieldname>` | N | Cột boolean kết quả; mặc định `"result"`. Rỗng → không thêm cột. |
| `<includefiletype>` + `<filetypefieldname>` | N | Thêm cột loại file (String) khi Y và tên không rỗng. |
| `<addresultfilenames>` | N | Y = thêm file tồn tại vào result filenames. Mặc định N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILE_EXISTS` | `<type>` | `FileExists`. |
| `configuration.filename_field` | `<filenamefield>` | Cột path. |
| `configuration.result_field` | `<resultfieldname>` | `"result"`. |
| `configuration.include_file_type` | `<includefiletype>` | Y/N. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 68 —
  `<step id="FileExists">` →
  `org.pentaho.di.trans.steps.fileexists.FileExistsMeta` (category Lookup).
- Serialization: `FileExistsMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/fileexists/FileExistsMeta.java`
  dòng 174–183) — `filenamefield` (177), `resultfieldname` (178),
  `includefiletype` Y/N (179), `filetypefieldname` (180),
  `addresultfilenames` Y/N (181).
- Deserialization: `readData()` (dòng 185–191+) — 2 cờ parse `"Y"`,
  còn lại nguyên văn.
- Khởi tạo: `setDefault()` (dòng 149–154) — result `"result"`,
  filetype null/false, addresult false. (`filenamefield` không default —
  phải điền.)
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 156–172) append cột Boolean
  (rỗng → bỏ qua) + cột String loại file khi bật. Worker kiểm tra VFS
  `exists()` từng dòng — chỉ stat, không đọc nội dung.
- Không có `<connection>`.

Cấu hình không mặc định (kèm loại file + result):

```xml
<filenamefield>SOURCE_PATH</filenamefield>
<resultfieldname>EXISTS_FLAG</resultfieldname>
<includefiletype>Y</includefiletype>
<filetypefieldname>PATH_KIND</filetypefieldname>
<addresultfilenames>Y</addresultfilenames>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Kết quả là Boolean** (`ValueMetaBoolean`), không phải Y/N chuỗi —
  downstream so sánh boolean.
- **Phân biệt FileLocked**: cùng 3 tag đầu nhưng FileLocked KHÔNG có
  `includefiletype`/`filetypefieldname` — đừng copy sang.
- Không có `<connection>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
