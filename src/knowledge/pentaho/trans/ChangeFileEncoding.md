# ChangeFileEncoding — Step chuyển encoding file theo dòng

Với MỖI dòng đầu vào, đọc file có path trong cột `<filenamefield>`,
chuyển từ `<sourceencoding>` sang `<targetencoding>` (ví dụ
`windows-1252` → `UTF-8`) và ghi ra path trong cột
`<targetfilenamefield>`. Tùy chọn thêm file nguồn/đích vào result
filenames (`addsourceresultfilenames`/`addtargetresultfilenames` — chú ý
thiếu chữ e ở "source"/"target": đúng `addsourceresultfilenames`) và tự
tạo thư mục cha (`createparentfolder`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ChangeFileEncoding</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filenamefield>{{SOURCE_FIELD}}</filenamefield>
    <targetfilenamefield>{{TARGET_FIELD}}</targetfilenamefield>
    <sourceencoding>windows-1252</sourceencoding>
    <targetencoding>UTF-8</targetencoding>
    <addsourceresultfilenames>N</addsourceresultfilenames>
    <addtargetresultfilenames>N</addtargetresultfilenames>
    <createparentfolder>Y</createparentfolder>
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
| `<filenamefield>` | Y | Cột path file nguồn. `check()` ERROR khi rỗng. |
| `<targetfilenamefield>` | Y | Cột path file đích. `check()` ERROR khi rỗng. |
| `<sourceencoding>` | Y | Encoding nguồn. Mặc định mới = `System.getProperty("file.encoding")` (máy-dependent — template pin `windows-1252` tường minh). |
| `<targetencoding>` | Y | Encoding đích (`UTF-8`). Mặc định mới null — phải điền. |
| `<addsourceresultfilenames>` | N | Thiếu e ("source" → "sourc"). Mặc định N. |
| `<addtargetresultfilenames>` | N | Thêm file đích vào result. Mặc định N. |
| `<createparentfolder>` | N | Y = tạo thư mục cha file đích. Mặc định N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CHANGE_FILE_ENCODING` | `<type>` | `ChangeFileEncoding`. |
| `configuration.source_field` | `<filenamefield>` | Cột nguồn. |
| `configuration.target_field` | `<targetfilenamefield>` | Cột đích. |
| `configuration.source_encoding` | `<sourceencoding>` | Tên charset Java. |
| `configuration.target_encoding` | `<targetencoding>` | `UTF-8`. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="ChangeFileEncoding", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/changefileencoding/ChangeFileEncodingMeta.java`
  dòng 51–53, category Utility).
- Serialization: `getXML()` (dòng 175–186) — `filenamefield` (178),
  `targetfilenamefield` (179), `sourceencoding` (180),
  `targetencoding` (181), `addsourceresultfilenames` (182),
  `addtargetresultfilenames` (183), `createparentfolder` (184).
- Deserialization: `readData()` (dòng 189–197+) — 3 cờ parse `"Y"`.
- Khởi tạo: `setDefault()` (dòng 166–173) — cờ false, target null,
  source = `System.getProperty("file.encoding")` (170, PHỤ THUỘC MÁY —
  không portable; template luôn pin tường minh).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker chuyển encoding từng file (cổng I/O —
  không chạy trong scope này).
- Không có `<connection>`.

Cấu hình không mặc định (đích vào result + tạo thư mục):

```xml
<filenamefield>LEGACY_PATH</filenamefield>
<targetfilenamefield>UTF8_PATH</targetfilenamefield>
<sourceencoding>ISO-8859-1</sourceencoding>
<targetencoding>UTF-8</targetencoding>
<addsourceresultfilenames>N</addsourceresultfilenames>
<addtargetresultfilenames>Y</addtargetresultfilenames>
<createparentfolder>Y</createparentfolder>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag thiếu chữ e**: `addsourceresultfilenames` (không phải
  `addsource...`), `addtargetresultfilenames` — viết đúng chính tả
  tiếng Anh sẽ load thành false lặng lẽ.
- **Default source encoding phụ thuộc máy** (`file.encoding`) — luôn
  pin tường minh trong template đã sinh, không dựa vào default.
- Không chạy I/O trong scope này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
