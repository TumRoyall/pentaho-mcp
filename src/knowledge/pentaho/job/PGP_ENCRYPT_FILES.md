# PGP_ENCRYPT_FILES — Job entry mã hóa file bằng PGP

Mã hóa (hoặc ký, hoặc ký+kèm mã hóa theo `<action_type>` từng dòng:
`encrypt`/`sign`/`signandencrypt`) các file liệt kê trong
`<fields>/<field>` bằng GPG (`<gpglocation>`) với khóa người nhận
(`<userid>`). Tên file có thể lấy từ previous result
(`<arg_from_previous>=Y`) thay vì danh sách tĩnh. Cần GPG cài sẵn.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>PGP_ENCRYPT_FILES</type>
      <attributes/>
      <gpglocation>${GPG_PATH}</gpglocation>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <add_result_filesname>N</add_result_filesname>
      <destination_is_a_file>N</destination_is_a_file>
      <create_destination_folder>N</create_destination_folder>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <nr_errors_less_than>10</nr_errors_less_than>
      <success_condition>success_if_no_errors</success_condition>
      <AddDateBeforeExtension>N</AddDateBeforeExtension>
      <DoNotKeepFolderStructure>N</DoNotKeepFolderStructure>
      <iffileexists>do_nothing</iffileexists>
      <destinationFolder/>
      <ifmovedfileexists>do_nothing</ifmovedfileexists>
      <moved_date_time_format/>
      <create_move_to_folder>N</create_move_to_folder>
      <add_moved_date>N</add_moved_date>
      <add_moved_time>N</add_moved_time>
      <SpecifyMoveFormat>N</SpecifyMoveFormat>
      <AddMovedDateBeforeExtension>N</AddMovedDateBeforeExtension>
      <asciiMode>N</asciiMode>
      <fields>
        <field>
          <action_type>encrypt</action_type>
          <source_filefolder>${SOURCE_FILE}</source_filefolder>
          <userid>${PGP_KEY_USER}</userid>
          <destination_filefolder>${DEST_FILE}</destination_filefolder>
          <wildcard/>
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
| `<gpglocation>` | Y | Đường dẫn GPG. `${GPG_PATH}`. |
| `<arg_from_previous>` | N | Y = lấy danh sách file từ previous result rows; N (mặc định) = dùng `<fields>` tĩnh. |
| `<include_subfolders>` | N | Y = quét cả subfolder khi nguồn là thư mục. |
| `<add_result_filesname>` | N | Y = thêm file đích vào result filenames. |
| `<destination_is_a_file>` | N | Y = đích là 1 file cụ thể. |
| `<create_destination_folder>` | N | Y = tự tạo thư mục đích. |
| `<add_date>` / `<add_time>` / `<SpecifyFormat>` / `<date_time_format>` / `<AddDateBeforeExtension>` | N | Thêm ngày/giờ vào tên file đích (giữ nguyên case `SpecifyFormat`, `AddDateBeforeExtension`). |
| `<nr_errors_less_than>` | N | Chuỗi số; mặc định `"10"`. |
| `<success_condition>` | N | `success_if_no_errors` (mặc định) / `success_if_errors_less` / `success_when_at_least`. |
| `<DoNotKeepFolderStructure>` | N | Y = không giữ cấu trúc thư mục ở đích. |
| `<iffileexists>` | N | `do_nothing` (mặc định) / `overwrite_file` / `unique_name` / `delete_file` / `move_file` / `fail`. |
| `<destinationFolder>` / `<ifmovedfileexists>` / `<moved_date_time_format>` / `<create_move_to_folder>` / `<add_moved_date>` / `<add_moved_time>` / `<SpecifyMoveFormat>` / `<AddMovedDateBeforeExtension>` | N | Xử lý file nguồn sau khi xong (move + format tên). |
| `<asciiMode>` | N | Y = output ASCII-armor; N mặc định. |
| `<fields>/<field>/<action_type>` | Y | Mã chuỗi `encrypt` / `sign` / `signandencrypt`. Lạ/thiếu → `encrypt`. |
| `<fields>/<field>/<source_filefolder>` | Y | File/thư mục nguồn. |
| `<fields>/<field>/<userid>` | Y | User ID khóa PGP người nhận. `${VAR}`. |
| `<fields>/<field>/<destination_filefolder>` | N | File/thư mục đích. |
| `<fields>/<field>/<wildcard>` | N | Wildcard lọc file. |

`<fields>` là paired list — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PGP_ENCRYPT_FILES` | `<type>` | `PGP_ENCRYPT_FILES`. |
| `configuration.gpg_location` | `<gpglocation>` | `${GPG_PATH}`. |
| `configuration.success_condition` | `<success_condition>` | 3 mã trên. |
| `configuration.files[].action` | `<fields>/<field>/<action_type>` | Mã chuỗi. |
| `configuration.files[].source` | `<fields>/<field>/<source_filefolder>` | Path (biến được). |
| `configuration.files[].user_id` | `<fields>/<field>/<userid>` | `${VAR}`. |
| `configuration.files[].destination` | `<fields>/<field>/<destination_filefolder>` | Path đích. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 63 —
  `<job-entry id="PGP_ENCRYPT_FILES">` →
  `org.pentaho.di.job.entries.pgpencryptfiles.JobEntryPGPEncryptFiles`
  (category FileEncryption).
- Mã action: `actionTypeCodes = {"encrypt","sign","signandencrypt"}`
  (dòng 78), `getActionTypeCode` out-of-range → `[0]` (dòng 238–243).
- Serialization: `JobEntryPGPEncryptFiles.getXML()` (dòng 187–236) —
  `super.getXML()` (190) rồi đúng thứ tự `gpglocation` (191) ...
  `asciiMode` (217, cuối trước `<fields>`), block `<fields>` (219–233;
  mỗi `<field>`: `action_type` mã 223–224, `source_filefolder` 225,
  `userid` 226, `destination_filefolder` 227–228, `wildcard` 229).
- Deserialization: `loadXML()` (dòng 245+) — cờ parse `"Y"`, action qua
  `getActionTypeByCode(NVL(tag,""))`.
- Khởi tạo: constructor `JobEntryPGPEncryptFiles(String)` (dòng
  129–159) — mọi cờ false, `nr_errors_less_than "10"` (150),
  `success_condition success_if_no_errors` (151),
  `iffileexists`/`ifmovedfileexists "do_nothing"`.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–424:
  `name`/`description`/`type` + attributes) trong
  `JobEntryCopy.getXML()` (dòng 102–119: `<entry>`, plugin fragment,
  `parallel`/`draw`/`nr`/`xloc`/`yloc`).
- Không có `<connection>` — fixture không cần khai báo connection.

Cấu hình không mặc định (ký + mã hóa, ghi đè đích):

```xml
<asciiMode>Y</asciiMode>
<iffileexists>overwrite_file</iffileexists>
<success_condition>success_if_no_errors</success_condition>
<fields>
  <field>
    <action_type>signandencrypt</action_type>
    <source_filefolder>${SOURCE_FILE}</source_filefolder>
    <userid>${PGP_KEY_USER}</userid>
    <destination_filefolder>${DEST_FILE}</destination_filefolder>
    <wildcard>.*\.csv</wildcard>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<action_type>` là mã chuỗi**, không phải số; mã lạ → `encrypt`
  lặng lẽ.
- **Tag case hỗn hợp giữ nguyên**: `SpecifyFormat`,
  `AddDateBeforeExtension`, `DoNotKeepFolderStructure`,
  `SpecifyMoveFormat`, `AddMovedDateBeforeExtension` — viết sai case
  load thành false.
- Cần GPG thật khi chạy; template/test không chạy I/O.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
