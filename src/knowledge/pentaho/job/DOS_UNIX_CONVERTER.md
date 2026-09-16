# DOS_UNIX_CONVERTER — Job entry chuyển đổi xuống dòng DOS/Unix

Chuyển đổi định dạng xuống dòng file (guess/dostounix/unixtodos) cho
danh sách tĩnh `<fields>/<field>` (`source_filefolder` + `wildcard`
regex + `ConversionType` code VIẾT HOA C) hoặc cho rows từ entry trước
(`arg_from_previous=Y`: row[0]=path, row[1]=wildcard, row[2]=
conversionCode). Điều kiện success (`success_condition`) và ngưỡng lỗi
(`nr_errors_less_than` chuỗi số) quyết định result. **BẪY NPE**:
`success_condition`/`resultfilenames` null (tag thiếu) NÉM ở
`resultfilenames.equals(...)` và `getSuccessCondition().equals(...)` —
template luôn emit.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DOS_UNIX_CONVERTER</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <nr_errors_less_than>10</nr_errors_less_than>
      <success_condition>success_if_no_errors</success_condition>
      <resultfilenames>all_filenames</resultfilenames>
      <fields>
        <field>
          <source_filefolder>${SOURCE_DIR}</source_filefolder>
          <wildcard>.*\.txt</wildcard>
          <ConversionType>dostounix</ConversionType>
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
| `<arg_from_previous>` | N | `Y` = lấy file/wildcard/conversion từ rows entry trước (bỏ qua list tĩnh); `N` (mặc định). |
| `<include_subfolders>` | N | `Y` = quét cả thư mục con; `N` (mặc định). |
| `<nr_errors_less_than>` | N | Ngưỡng lỗi, CHUỖI số; mặc định `"10"`. |
| `<success_condition>` | Y | `success_if_no_errors` (mặc định), `success_if_error_files_less`, `success_when_at_least`. Null → NPE lúc chạy. |
| `<resultfilenames>` | Y | `all_filenames` (mặc định), `only_processed_filenames`, `only_error_filenames`. Null → NPE lúc chạy. |
| `<fields>/<field>/<source_filefolder>` | Y (mỗi field, khi tĩnh) | Thư mục/file nguồn; cho phép `${VAR}`. |
| `<fields>/<field>/<wildcard>` | N | Regex tên file (Java regex); rỗng = khớp tất cả. |
| `<fields>/<field>/<ConversionType>` | N | Code VIẾT HOA C: `guess` (mặc định, int 0), `dostounix` (1), `unixtodos` (2). Lạ/null → `guess`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DOS_UNIX_CONVERTER` | `<type>` | `DOS_UNIX_CONVERTER`. |
| `configuration.arg_from_previous` | `<arg_from_previous>` | Boolean → Y/N. |
| `configuration.include_subfolders` | `<include_subfolders>` | Boolean → Y/N. |
| `configuration.max_errors` | `<nr_errors_less_than>` | Chuỗi số. |
| `configuration.success_condition` | `<success_condition>` | 1 trong 3 code. |
| `configuration.result_filenames` | `<resultfilenames>` | 1 trong 3 code. |
| `configuration.fields[].source` | `<fields>/<field>/<source_filefolder>` | Đường dẫn. |
| `configuration.fields[].wildcard` | `<fields>/<field>/<wildcard>` | Regex. |
| `configuration.fields[].conversion` | `<fields>/<field>/<ConversionType>` | Code, giữ đúng hoa `C`. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 61 —
  `id="DOS_UNIX_CONVERTER"` →
  `org.pentaho.di.job.entries.dostounix.JobEntryDosToUnix` (không có
  `@JobEntry`). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryDosToUnix.getXML()` (dòng 155–178) —
  `super.getXML()` trước, rồi `arg_from_previous` (Y/N),
  `include_subfolders` (Y/N), `nr_errors_less_than` (chuỗi số),
  `success_condition` (code), `resultfilenames` (code), rồi
  `<fields>`/`<field>` (`source_filefolder`, `wildcard`,
  `ConversionType` VIẾT HOA C, code). Guard null ở dòng 165 (thiếu list
  không crash khi ghi).
- Deserialization: `loadXML()` (dòng 222–254) — booleans Y-check (dòng
  227–228); 3 strings nullable (dòng 230–232); `allocate(nrFields)` theo
  `countNodes(fields,"field")` (dòng 238, thiếu → mảng rỗng);
  `ConversionType` qua `getConversionTypeByCode(Const.NVL(..., ""))`
  (dòng 246–247) → lạ/null về `0=guess` (dòng 209–220).
- Khởi tạo: KHÔNG có `setDefault`. Constructor (dòng 121–131):
  `resultfilenames=all_filenames`, `arg_from_previous=false`,
  `source/wildcard/conversionTypes=null`, `include_subfolders=false`,
  `nr_errors_less_than="10"`,
  `success_condition=success_if_no_errors`.
- Wrapper: `JobEntryCopy.getXML()` (`engine/.../job/entry/JobEntryCopy.java`
  dòng 102–119) + `JobEntryBase.getXML()` (dòng 415–424) — template trên
  là một `<entry>` đầy đủ.
- Ngữ nghĩa runtime: `arg_from_previous=true` bỏ qua mảng tĩnh, đọc
  row[0]=path, row[1]=wildcard, row[2]=conversionCode (dòng 337–364).
  `wildcard` là regex Java (dòng 740–753), rỗng = match all.
  **NPE khi tag thiếu**: `resultfilenames.equals(...)` (dòng 687–698) và
  `getSuccessCondition().equals(...)` (dòng 414–431) — luôn emit cả hai.
- Không có `<connection>`: entry chỉ xử lý file — template không mang tag
  này.

Cấu hình không mặc định (unix→dos + ngưỡng lỗi):

```xml
<arg_from_previous>N</arg_from_previous>
<include_subfolders>Y</include_subfolders>
<nr_errors_less_than>5</nr_errors_less_than>
<success_condition>success_if_error_files_less</success_condition>
<resultfilenames>only_error_filenames</resultfilenames>
<fields>
  <field>
    <source_filefolder>${SOURCE_DIR}</source_filefolder>
    <wildcard>.*\.sh</wildcard>
    <ConversionType>unixtodos</ConversionType>
  </field>
</fields>
```

Fill fields bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Luôn emit `success_condition` + `resultfilenames`**: thiếu tag load
  thành null rồi NPE lúc chạy — không được lược.
- **`ConversionType` hoa `C`**: viết thường là sai tag, load về `guess`
  lặng lẽ.
- **`wildcard` là regex Java**, không phải glob — `*.txt` (glob) là regex
  sai; phải `.*\.txt`.
- **Chế độ rows bỏ qua list tĩnh**: `arg_from_previous=Y` thì `<fields>`
  bị lờ — đừng cấu hình cả hai rồi mong gộp.
- Template mặc định là khung cấu hình — người dùng phải điền thư mục/file
  có thật (qua biến).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
