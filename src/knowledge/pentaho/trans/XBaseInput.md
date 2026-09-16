# XBaseInput — Step đọc file dBase (DBF)

Đọc một file `.dbf` (xBase) tĩnh và phát mỗi bản ghi thành một dòng.
Tên file cấu hình tĩnh (`<file_dbf>`); hoặc nhận tên file động từ field
của stream trước qua `accept_field` + `accept_stepname`. Có thể thêm cột
số thứ tự dòng (`field_rownr`) và cột tên file (`include_field`).
`getFields()` append schema đọc từ file DBF — output = cột DBF +
cột rownr/filename tùy chọn.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XBaseInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <file_dbf>${DBF_FILE}</file_dbf>
    <limit>0</limit>
    <add_rownr>N</add_rownr>
    <field_rownr/>
    <include>N</include>
    <include_field/>
    <charset_name/>
    <accept_filenames>N</accept_filenames>
    <accept_field/>
    <accept_stepname/>
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
| `<file_dbf>` | Y (khi không nhận tên file động) | Đường dẫn file `.dbf` tĩnh; cho phép `${VAR}`. |
| `<limit>` | N | Giới hạn số dòng đọc; `0` (mặc định) = đọc hết. |
| `<add_rownr>` | N | `Y` = thêm cột số thứ tự dòng tên `<field_rownr>` (Integer). |
| `<field_rownr>` | Y khi `add_rownr=Y` | Tên cột số thứ tự dòng. |
| `<include>` | N | `Y` = thêm cột tên file tên `<include_field>` (String 100). |
| `<include_field>` | Y khi `include=Y` | Tên cột tên file. |
| `<charset_name>` | N | Charset đọc file; trống = mặc định nền tảng. |
| `<accept_filenames>` | N | `Y` = lấy tên file từ field `<accept_field>` của step `<accept_stepname>` thay vì `<file_dbf>`. |
| `<accept_field>` | Y khi `accept_filenames=Y` | Tên field chứa tên file trong stream trước. |
| `<accept_stepname>` | Y khi `accept_filenames=Y` | Tên step cung cấp tên file (cần hop tới step này). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XBASE_INPUT` | `<type>` | `XBaseInput`. |
| `configuration.dbf_file` | `<file_dbf>` | Cho phép `${VAR}`. |
| `configuration.row_limit` | `<limit>` | Số; `0` = ALL. |
| `configuration.add_rownr` | `<add_rownr>` | Boolean → Y/N. |
| `configuration.rownr_field` | `<field_rownr>` | Tên cột số dòng. |
| `configuration.include_filename` | `<include>` | Boolean → Y/N. |
| `configuration.filename_field` | `<include_field>` | Tên cột tên file. |
| `configuration.charset` | `<charset_name>` | Chuỗi rỗng = mặc định. |
| `configuration.accept_filenames` | `<accept_filenames>` | Boolean → Y/N. |
| `configuration.accept_field` | `<accept_field>` | Tham chiếu field của stream trước. |
| `configuration.accept_step` | `<accept_stepname>` | Tham chiếu step (cần hop). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 55 —
  `<step id="XBaseInput">` →
  `org.pentaho.di.trans.steps.xbaseinput.XBaseInputMeta` (category Input).
  Registry presence không phải XML evidence, evidence là serializer dưới
  đây.
- Serialization: `XBaseInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/xbaseinput/XBaseInputMeta.java`
  dòng 362–383) — đúng thứ tự `file_dbf`, `limit` (int), `add_rownr`
  (Y/N), `field_rownr`, `include` (Y/N), `include_field`, `charset_name`,
  `accept_filenames` (Y/N), `accept_field`, `accept_stepname`, tất cả vô
  điều kiện qua `XMLHandler.addTagValue`. `accept_stepname` được backfill
  từ object khi null (dòng 376–380).
- Deserialization: `loadXML()` (dòng 249–252) gọi `readData()` (dòng
  260–279) — strings `getTagValue` (thiếu → null); `limit` qua
  `Const.toInt(..., 0)` (thiếu → 0); 3 boolean parse bằng
  `"Y".equalsIgnoreCase(...)` (thiếu/rỗng → false). Toàn thân bọc
  try/catch → `KettleXMLException`.
- Khởi tạo: `setDefault()` (dòng 282–287) — `dbfFileName=null`,
  `rowLimit=0`, `rowNrAdded=false`, `rowNrField=null`; KHÔNG reset các
  field include/accept/charset.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 349–359) throw khi chưa có file
  (`fileList.nrOfFiles()==0`); append schema DBF (`getOutputFields`,
  dòng 333–344) gồm các cột file + Integer `rowNrField` (khi
  `rowNrAdded`) + String(100) `filenameField` (khi `includeFilename`).
  `check()` (dòng 434–491) ERROR khi `dbfFileName==null` mà không nhận
  tên file động.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (thêm cột rownr + tên file):

```xml
<file_dbf>${DBF_FILE}</file_dbf>
<limit>1000</limit>
<add_rownr>Y</add_rownr>
<field_rownr>ROW_NR</field_rownr>
<include>Y</include>
<include_field>SRC_FILE</include_field>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Không bịa tag output-fields**: schema output đọc từ file DBF lúc
  runtime (`getOutputFields`), không serialize trong XML — template chỉ
  có 10 tag cấu hình trên.
- **Chế độ động cần hop thật**: `accept_filenames=Y` đòi step nguồn tồn
  tại và nối hop, nếu không `searchInfoAndTargetSteps` (dòng 297–299)
  không resolve được `acceptingStep` và runtime fail.
- **Booleans thiếu tag → false**: file cũ thiếu `add_rownr`/`include`/
  `accept_filenames` load thành `N`, không throw.
- **`charset_name` có thể stale**: `setDefault()` không reset — tái dùng
  object cũ có thể giữ charset trước đó.
- Template mặc định là khung cấu hình — người dùng phải điền file DBF
  có thật (hoặc cấu hình accept động); credential không bao giờ nằm ở
  đây.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
