# XML_WELL_FORMED — Job entry kiểm tra XML well-formed hàng loạt

Entry điều kiện (`evaluates() = true`): quét các file XML khai báo trong
list `<fields>/<field>` (`<source_filefolder>` + `<wildcard>`, hoặc lấy từ
dòng result trước khi `<arg_from_previous>=Y`), parse từng file và đếm
well-formed/bad-formed. Thành công hay không do `<success_condition>` kết
hợp `<nr_errors_less_than>` quyết định; file được chọn bởi
`<resultfilenames>` sẽ đưa vào result filenames của job.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>XML_WELL_FORMED</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <nr_errors_less_than>10</nr_errors_less_than>
      <success_condition>success_if_no_errors</success_condition>
      <resultfilenames>all_filenames</resultfilenames>
      <fields>
        <field>
          <source_filefolder>${XML_DIR}</source_filefolder>
          <wildcard>.*\.xml</wildcard>
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
| `<fields>/<field>/<source_filefolder>` | Y (mỗi field) | File hoặc thư mục nguồn (dùng `${VAR}`); cột 0 của dòng result khi `arg_from_previous=Y`. |
| `<fields>/<field>/<wildcard>` | N | Regex lọc tên file (cột 1 của dòng result khi `arg_from_previous=Y`). |
| `<arg_from_previous>` | N | `Y` = lấy (file, wildcard) từ dòng result trước; `N` (mặc định) = dùng list tĩnh. Tag `@Deprecated` nhưng vẫn serialize/load. |
| `<include_subfolders>` | N | `Y` = quét cả thư mục con; `N` (mặc định). Tag `@Deprecated` nhưng vẫn serialize/load. |
| `<nr_errors_less_than>` | N | Ngưỡng X DẠNG CHUỖI cho 2 mode đếm; mặc định `"10"` (parse lỗi → 10). |
| `<success_condition>` | Y | Một trong `success_if_no_errors` (mặc định), `success_when_at_least`, `success_if_bad_formed_files_less`. |
| `<resultfilenames>` | N | `all_filenames` (mặc định) = đưa mọi file đã quét vào result; `only_well_formed_filenames` / `only_bad_formed_filenames` = chỉ đưa nhóm tương ứng. |

Luật thành công (`getSuccessStatus()`, dòng 345–355): `success_if_no_errors`
đòi 0 lỗi; `success_when_at_least` đòi số file well-formed ≥ X;
`success_if_bad_formed_files_less` đòi số file bad-formed < X (với X =
`<nr_errors_less_than>`).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XML_WELL_FORMED` | `<type>` | `XML_WELL_FORMED`. |
| `configuration.files[].path` | `<fields>/<field>/<source_filefolder>` | Dùng `${VAR}`. |
| `configuration.files[].wildcard` | `<fields>/<field>/<wildcard>` | Regex, ví dụ `.*\.xml`. |
| `configuration.success_condition` | `<success_condition>` | 1 trong 3 hằng. |
| `configuration.error_threshold` | `<nr_errors_less_than>` | Chuỗi số, mặc định `"10"`. |
| `configuration.result_filenames` | `<resultfilenames>` | 1 trong 3 hằng. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@JobEntry(id = "XML_WELL_FORMED", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xmlwellformed/JobEntryXMLWellFormed.java`
  dòng 74–77, category `XML_WELL_FORMED.Category`). KHÔNG nằm trong
  `engine/.../kettle-job-entries.xml` (plugin XML) — annotation là evidence
  đăng ký, serializer dưới đây mới là XML evidence.
- Serialization: `JobEntryXMLWellFormed.getXML()`
  (`.../xmlwellformed/JobEntryXMLWellFormed.java` dòng 131–152) —
  `super.getXML()` rồi `arg_from_previous`, `include_subfolders`,
  `nr_errors_less_than`, `success_condition`, `resultfilenames`, rồi wrapper
  `<fields>` LUÔN emit paired (dòng 140/149) chứa các `<field>` với
  `source_filefolder` + `wildcard` (dòng 144–145).
- Deserialization: `loadXML()` (dòng 154–184) — `super.loadXML()` rồi 2 cờ
  Y/N, 3 chuỗi, đếm `<field>` trong `<fields>` (dòng 169) đọc từng cặp
  (dòng 177–178). Thiếu `<fields>` → 0 entry (count trên null = 0).
- Khởi tạo: constructor (dòng 111–120) — `resultfilenames =
  "all_filenames"`, `nr_errors_less_than = "10"`, `success_condition =
  "success_if_no_errors"`; các field `arg_from_previous`,
  `include_subfolders`, `source_filefolder`, `wildcard` mang `@Deprecated`
  (dòng 89–97) NHƯNG vẫn serialize/load bình thường.
- Wrapper: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–419: `name`, `description`, `type` = configId, `attributes`) +
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`) bao ngoài fragment
  plugin.
- Ngữ nghĩa runtime: `evaluates()` = true (dòng 644–646) — entry điều kiện.
  `limitFiles = Const.toInt(substitute(nr_errors_less_than), 10)` (dòng
  246). Gãy sớm khi (`checkIfSuccessConditionBroken()`, dòng 336–343):
  có lỗi + mode no_errors, hoặc bad ≥ X + mode bad_less. Thành công
  (`getSuccessStatus()`, dòng 345–355) theo luật ở mục 2. File bad-formed
  đưa vào result khi mode all/bad (dòng 518–519), file well-formed khi mode
  all/well (dòng 528–529) — qua `ResultFile.FILE_TYPE_GENERAL` (dòng
  550–553).

Cấu hình không mặc định (ít nhất 5 file tốt + chỉ giữ file tốt):

```xml
<arg_from_previous>N</arg_from_previous>
<include_subfolders>Y</include_subfolders>
<nr_errors_less_than>5</nr_errors_less_than>
<success_condition>success_when_at_least</success_condition>
<resultfilenames>only_well_formed_filenames</resultfilenames>
<fields>
  <field>
    <source_filefolder>${XML_DIR}</source_filefolder>
    <wildcard>.*\.xml</wildcard>
  </field>
</fields>
```

## 5. Lưu ý / bẫy

- **`success_when_at_least` đếm file TỐT, không đếm lỗi**: X là ngưỡng số
  file well-formed (dòng 349) — đừng nhầm với ngưỡng lỗi của mode
  `bad_formed_files_less` (bad < X, dòng 350).
- **So sánh early-break KHÔNG đối xứng**: gãy sớm khi `bad ≥ X` (dòng 339)
  nhưng thành công khi `bad < X` (dòng 350) — hiểu đúng để khỏi cấu hình
  ngưỡng sai 1 đơn vị.
- **Deprecated nhưng bắt buộc có**: 4 field `@Deprecated` vẫn serialize —
  template giữ đủ, không lược vì "deprecated".
- **`<fields>` luôn paired** — giữ paired kể cả rỗng, không self-closing.
- Template mặc định là khung cấu hình — người dùng phải điền path/wildcard
  có thật (dùng `${VAR}`).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
