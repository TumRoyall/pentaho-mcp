# MS_ACCESS_BULK_LOAD — Job entry nạp hàng loạt file vào MS Access (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@JobEntry` category `JobCategory.Category.Deprecated`, icon
> `deprecated.svg`). Reference này phục vụ **đọc/bảo trì workload cũ** —
> `status: observed`, `generator_eligible: false`, KHÔNG phát sinh entry mới.
> Không có replacement canonical nào được source chỉ định.

Nạp dữ liệu từ danh sách file/thư mục vào các file `.mdb` MS Access
(qua Jackcess): mỗi `<field>` khai báo `source_filefolder` (file hoặc
thư mục nguồn), `source_wildcard` (regex `Pattern.matcher().matches()`
lọc basename khi nguồn là thư mục), `delimiter`, `target_db` (ĐƯỜNG DẪN
file `.mdb` — KHÔNG phải DB connection reference) và `target_table`.
Chế độ `is_args_from_previous=Y` lấy 5 cột (0–4) từ previous-result rows
thay cho danh sách tĩnh. KHÔNG có tag `<connection>` — entry này không
tham chiếu DatabaseMeta, fixture KHÔNG cần khai báo connection.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MS_ACCESS_BULK_LOAD</type>
      <attributes/>
      <include_subfolders>N</include_subfolders>
      <is_args_from_previous>N</is_args_from_previous>
      <add_result_filenames>N</add_result_filenames>
      <limit>10</limit>
      <success_condition>success_if_no_errors</success_condition>
      <fields>
        <field>
          <source_filefolder>${SOURCE_FILE}</source_filefolder>
          <source_wildcard>.*\.csv</source_wildcard>
          <delimiter>;</delimiter>
          <target_db>${ACCESS_DB}</target_db>
          <target_table>{{TARGET_TABLE}}</target_table>
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
| `<include_subfolders>` | N | `Y` = duyệt thư mục đệ quy (`is_args_from_previous=N`, dòng 365). Mặc định N. |
| `<is_args_from_previous>` | N | `Y` = lấy danh sách từ previous-result rows (5 cột 0–4), bỏ qua list tĩnh. Mặc định N. |
| `<add_result_filenames>` | N | `Y` = đăng ký file đã nạp vào result filenames. Mặc định N. |
| `<limit>` | N | Chuỗi số cho điều kiện success (`Const.toInt(..., 10)` khi chạy). Mặc định `"10"`. |
| `<success_condition>` | N | `success_if_no_errors` (mặc định) / `success_when_at_least` / `success_if_errors_less`. Thiếu tag → null (ghi đè default ctor). |
| `<fields>/<field>/<source_filefolder>` | Y (mỗi field) | File hoặc thư mục nguồn; hỗ trợ biến. |
| `<fields>/<field>/<source_wildcard>` | N | Regex lọc basename khi nguồn là thư mục; rỗng = nhận hết (dòng 319). |
| `<fields>/<field>/<delimiter>` | N | Ký tự phân tách trong file nguồn. |
| `<fields>/<field>/<target_db>` | Y | ĐƯỜNG DẪN file `.mdb` đích (`${VAR}`, không embed thật). KHÔNG phải connection reference. |
| `<fields>/<field>/<target_table>` | Y | Bảng Access đích. |

`<fields>` LUÔN emit (kể cả 0 field, dòng 159/171) — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MS_ACCESS_BULK_LOAD` | `<type>` | `MS_ACCESS_BULK_LOAD`. |
| `configuration.include_subfolders` | `<include_subfolders>` | Boolean → Y/N. |
| `configuration.args_from_previous` | `<is_args_from_previous>` | Boolean → Y/N. |
| `configuration.limit` | `<limit>` | Chuỗi số. |
| `configuration.success_condition` | `<success_condition>` | 1 trong 3 mã. |
| `configuration.items[].source` | `<fields>/<field>/<source_filefolder>` | File/thư mục. |
| `configuration.items[].wildcard` | `<fields>/<field>/<source_wildcard>` | Regex. |
| `configuration.items[].target_db` | `<fields>/<field>/<target_db>` | Path `.mdb`. |
| `configuration.items[].target_table` | `<fields>/<field>/<target_table>` | Bảng đích. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@JobEntry(id="MS_ACCESS_BULK_LOAD", ...)`
  (`plugins/ms-access/impl/src/main/java/org/pentaho/di/job/entries/msaccessbulkload/JobEntryMSAccessBulkLoad.java`
  dòng 72–76, category `...JobCategory.Category.Deprecated`, icon
  `ui/images/deprecated.svg`; KHÔNG có trong
  `engine/src/main/resources/kettle-job-entries.xml`). Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Hằng success (dòng 92–94): `success_when_at_least`,
  `success_if_errors_less`, `success_if_no_errors`.
- Serialization: `getXML()` (dòng 148–173) — `super.getXML()`
  (`JobEntryBase`, `name`/`description`/`type` + `attributes`) rồi đúng
  thứ tự `include_subfolders` (Y/N, 152), `is_args_from_previous` (Y/N,
  153), `add_result_filenames` (Y/N, 155), `limit` (chuỗi, 156),
  `success_condition` (mã, 157), `<fields>` LUÔN emit (159–171; mỗi
  `<field>`: `source_filefolder` 163, `source_wildcard` 164,
  `delimiter` 165, `target_db` 166 — đọc từ field `target_Db` —,
  `target_table` 167).
- Deserialization: `loadXML()` (dòng 175–209) — `super.loadXML()` (178);
  3 boolean parse bằng `"Y".equalsIgnoreCase(...)` (179–181, thiếu →
  false); `limit`/`success_condition` đọc thô (183–184, thiếu → null
  GHI ĐÈ default ctor); `<fields>` đếm `<field>` (185–188), mỗi item đọc
  5 tag (199–203). BẪY repo: `saveRep` lưu `"target_Db"` (dòng 303, D
  hoa) nhưng `loadRep`/`loadXML` đọc `"target_db"` (thường).
- Khởi tạo: ctor `JobEntryMSAccessBulkLoad(String)` (dòng 102–113) —
  `limit="10"`, `success_condition=success_if_no_errors`,
  `add_result_filenames=false`, `include_subfolders=false`, 5 mảng null.
  Không có `setDefault()`.
- Wrapper: `JobEntryCopy` bao fragment bằng `parallel`, `draw`, `nr`,
  `xloc`, `yloc`, `attributes_kjc` (xem `TABLE_EXISTS.md`).
- Ngữ nghĩa runtime: `execute()` (dòng 465–540) — 2 mode (args-previous
  493–510 dùng cột 0–4 nguyên văn; tĩnh 511–523 có substitute); file →
  `importFile` Jackcess (385), thư mục → list + regex `matches()` (319)
  + đệ quy khi `include_subfolders` (365). Final `getSuccessStatus`
  (542): `NO_ERRORS: NrErrors==0` | `AT_LEAST: NrSuccess>=limitFiles` |
  `ERRORS_LESS: NrErrors<=limitFiles`. `evaluates() = true` (554).

Cấu hình không mặc định (đệ quy + success theo số lượng):

```xml
<include_subfolders>Y</include_subfolders>
<is_args_from_previous>N</is_args_from_previous>
<add_result_filenames>Y</add_result_filenames>
<limit>5</limit>
<success_condition>success_when_at_least</success_condition>
<fields>
  <field>
    <source_filefolder>${SOURCE_DIR}</source_filefolder>
    <source_wildcard>.*\.csv</source_wildcard>
    <delimiter>;</delimiter>
    <target_db>${ACCESS_DB}</target_db>
    <target_table>STAGING_SALES</target_table>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định.
- **`target_db` là ĐƯỜNG DẪN file `.mdb`**, không phải DB connection —
  KHÔNG khai báo `<connection>` trong fixture; entry này không có tag đó.
- **`success_condition` thiếu tag → null** (ghi đè default
  `success_if_no_errors` của ctor) — template luôn pin tường minh.
- **`source_wildcard` là regex full-match** (`matcher.matches()`), không
  phải glob — `*.csv` SAI, phải `.*\.csv`.
- **Bẫy case repo `target_Db` vs `target_db`** — XML dùng thường, đừng
  đổi thành D hoa.
- Mọi path/file placeholder `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  ctor tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
