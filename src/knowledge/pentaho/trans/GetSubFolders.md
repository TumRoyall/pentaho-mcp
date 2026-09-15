# GetSubFolders — Step liệt kê thư mục con

Với MỖI thư mục khai báo (`<file>` cặp `name` + `file_required` flat),
liệt kê các thư mục con trực tiếp và phát MỖI thư mục con một dòng với 10
cột metadata CỐ ĐỊNH (`folderName`, `short_folderName`, `path`, `ishidden`,
`isreadable`, `iswriteable`, `lastmodifiedtime`, `uri`, `rooturi`,
`childrens`) + số dòng tùy chọn. Tên thư mục cũng có thể lấy động từ trường
vào (`<foldername_dynamic>=Y` + `<foldername_field>`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetSubFolders</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <rownum>N</rownum>
    <foldername_dynamic>N</foldername_dynamic>
    <rownum_field/>
    <foldername_field/>
    <limit>0</limit>
    <file>
      <name>${PARENT_DIR}</name>
      <file_required>N</file_required>
    </file>
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
| `<file>/<name>` | Điều kiện | Thư mục cha cần liệt kê (dùng `${VAR}`); nhiều thư mục = lặp cặp flat. Bỏ qua khi `foldername_dynamic=Y`. |
| `<file>/<file_required>` | N | Y/N từng thư mục (`N`/`Y` chuỗi). |
| `<foldername_dynamic>` | N | `Y` = lấy tên thư mục từ trường `<foldername_field>`; `N` (mặc định) = dùng `<file>`. |
| `<foldername_field>` | Điều kiện | Tên trường chứa tên thư mục khi dynamic. |
| `<rownum>` / `<rownum_field>` | N | `Y` = thêm cột số dòng (tên ở `rownum_field`); `N` (mặc định). |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định Java) = không giới hạn. |

10 cột ra cố định (không cấu hình): `folderName` (String 500),
`short_folderName` (String 500), `path` (String 500), `ishidden`
(Boolean), `isreadable` (Boolean), `iswriteable` (Boolean),
`lastmodifiedtime` (Date), `uri` (String), `rooturi` (String),
`childrens` (Integer) — cộng `rownum_field` khi bật.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_SUB_FOLDERS` | `<type>` | `GetSubFolders`. |
| `configuration.folders[].path` | `<file>/<name>` | `${VAR}`; cặp flat với `file_required`. |
| `configuration.dynamic_folder_field` | `<foldername_dynamic>` + `<foldername_field>` | Bật cả cờ lẫn tên trường. |

`<file>` flat (cặp `name`/`file_required`, KHÔNG mask/subfolders) — viết
lặp tay; scalar đổi bằng `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 70 —
  `<step id="GetSubFolders">` →
  `org.pentaho.di.trans.steps.getsubfolders.GetSubFoldersMeta` (category
  Input). Registry presence không phải XML evidence, evidence là serializer
  dưới đây.
- Serialization: `GetSubFoldersMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/getsubfolders/GetSubFoldersMeta.java`
  dòng 339–357) — thứ tự `rownum`, `foldername_dynamic`, `rownum_field`,
  `foldername_field`, `limit` (dòng 342–346), rồi `<file>` LUÔN emit (dòng
  347/354) chứa các CẶP flat `name` + `file_required` (dòng 350–351 —
  KHÔNG có mask/subfolders như họ file-input). Không có `<fields>`.
- Deserialization: `loadXML()` (dòng 232–234) gọi `readData()` (dòng
  359–383) — cờ Y/N thiếu → false; `limit` `toLong(..., 0L)` (dòng 367).
- Khởi tạo: `setDefault()` (dòng 254–267) — 0 thư mục, cờ false, chuỗi
  rỗng (`rowLimit` giữ 0 mặc định Java).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 269–337) thêm đúng 10 cột
  TÊN CỨNG (String 500/Boolean/Date/Integer, dòng 273–328) + cột rownumber
  khi bật — output schema KHÔNG cấu hình được, tên cột là hằng số.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (thư mục động + số dòng):

```xml
<rownum>Y</rownum>
<foldername_dynamic>Y</foldername_dynamic>
<rownum_field>rownumber</rownum_field>
<foldername_field>PARENT_PATH</foldername_field>
<limit>100</limit>
<file>
</file>
```

## 5. Lưu ý / bẫy — CRITICAL

- **10 cột tên cứng, không đổi được** — downstream phải dùng đúng
  `folderName`, `short_folderName`, … (`getFields()` dòng 269–337); sai
  tên là lỗi lookup lúc chạy.
- **`<file>` chỉ cặp name/required** — không có `filemask`/
  `include_subfolders` như họ file-input; đừng copy bộ 5 tag sang.
- **Chỉ liệt kê 1 cấp**: thư mục con trực tiếp — muốn đệ quy phải lặp
  transformation/job, step không có cờ recursive.
- **`<file>` luôn paired kể cả dynamic** — giữ `<file></file>` paired,
  không self-closing.
- Template mặc định là khung cấu hình — người dùng phải điền thư mục
  (`${VAR}`) hoặc trường động có thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
