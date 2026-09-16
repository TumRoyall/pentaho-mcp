# FileLocked — Step kiểm tra file có đang bị lock

Với MỖI dòng đầu vào, kiểm tra file có path trong cột `<filenamefield>`
đang bị lock không (thử `getOutputStream`/rename probe tùy platform),
ghi kết quả boolean vào `<resultfieldname>` (mặc định `"result"`). Tùy
chọn thêm file vào result filenames. Serializer CHỈ có 3 tag (không có
`includefiletype` như FileExists).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FileLocked</type>
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
| `<filenamefield>` | Y | Cột chứa path file. `check()` ERROR khi rỗng. |
| `<resultfieldname>` | N | Cột boolean (true = ĐANG lock); mặc định `"result"`. |
| `<addresultfilenames>` | N | Y = thêm file vào result filenames. Mặc định N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILE_LOCKED` | `<type>` | `FileLocked`. |
| `configuration.filename_field` | `<filenamefield>` | Cột path. |
| `configuration.result_field` | `<resultfieldname>` | `"result"`. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 109 —
  `<step id="FileLocked">` →
  `org.pentaho.di.trans.steps.filelocked.FileLockedMeta` (category Lookup).
- Serialization: `FileLockedMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/filelocked/FileLockedMeta.java`
  dòng 138–143+) — CHỈ 3 tag: `filenamefield` (141),
  `resultfieldname` (142), `addresultfilenames` Y/N (143).
- Deserialization: `readData()` (dòng 147–151+) — cờ parse `"Y"`.
- Khởi tạo: `setDefault()` (dòng 124–129) — result `"result"`, cờ false.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 131–132+) append Boolean;
  worker probe lock từng file (không đọc nội dung).
- Không có `<connection>`.

Cấu hình không mặc định:

```xml
<filenamefield>TARGET_PATH</filenamefield>
<resultfieldname>IS_LOCKED</resultfieldname>
<addresultfilenames>Y</addresultfilenames>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Chỉ 3 tag**: đừng copy `includefiletype`/`filetypefieldname` từ
  FileExists sang — load bỏ qua lặng lẽ.
- **true = đang lock** — ngữ nghĩa ngược với FileExists (true = tồn tại).
- Kết quả probe phụ thuộc OS/filesystem (file đang mở ở process khác).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
