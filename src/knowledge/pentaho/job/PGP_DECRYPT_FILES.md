# PGP_DECRYPT_FILES — Job entry giải mã file bằng PGP

Giải mã các file liệt kê trong `<fields>/<field>` bằng GPG
(`<gpglocation>`), passphrase từng dòng (`<passphrase>`, lưu mã hóa) hoặc
lấy từ previous result (`<arg_from_previous>=Y`). Khác bản Encrypt: KHÔNG
có `<action_type>`/`<userid>`/`asciiMode` — mỗi `<field>` chỉ có
`source_filefolder`/`passphrase`/`destination_filefolder`/`wildcard`.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>PGP_DECRYPT_FILES</type>
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
      <fields>
        <field>
          <source_filefolder>${SOURCE_FILE}</source_filefolder>
          <passphrase>${PGP_PASSPHRASE}</passphrase>
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
| `<arg_from_previous>` ... `<AddMovedDateBeforeExtension>` | N | Cùng họ Encrypt (điều kiện success, xử lý tên file, move nguồn). Thứ tự y hệt Encrypt trừ `<asciiMode>`. |
| `<nr_errors_less_than>` | N | `"10"` mặc định. |
| `<success_condition>` | N | `success_if_no_errors` / `success_if_errors_less` / `success_when_at_least`. |
| `<iffileexists>` | N | `do_nothing` mặc định (cùng 6 giá trị họ Encrypt). |
| `<fields>/<field>/<source_filefolder>` | Y | File/thư mục nguồn mã hóa. |
| `<fields>/<field>/<passphrase>` | Y | Passphrase dòng này, mã hóa khi lưu. `${VAR}`. |
| `<fields>/<field>/<destination_filefolder>` | N | Đích giải mã. |
| `<fields>/<field>/<wildcard>` | N | Wildcard lọc. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PGP_DECRYPT_FILES` | `<type>` | `PGP_DECRYPT_FILES`. |
| `configuration.files[].source` | `<fields>/<field>/<source_filefolder>` | Path nguồn. |
| `configuration.files[].passphrase` | `<fields>/<field>/<passphrase>` | `${VAR}`, mã hóa. |
| `configuration.files[].destination` | `<fields>/<field>/<destination_filefolder>` | Path đích. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 62 —
  `<job-entry id="PGP_DECRYPT_FILES">` →
  `org.pentaho.di.job.entries.pgpdecryptfiles.JobEntryPGPDecryptFiles`
  (category FileEncryption).
- Serialization: `JobEntryPGPDecryptFiles.getXML()` (dòng 173–220) —
  `super.getXML()` (176) rồi `gpglocation` (177) ...
  `AddMovedDateBeforeExtension` (201–202), block `<fields>` (204–217;
  mỗi `<field>`: `source_filefolder` 208, `passphrase` mã hóa 209–210,
  `destination_filefolder` 211–212, `wildcard` 213). KHÔNG có
  `asciiMode`/`action_type`/`userid` (khác Encrypt).
- Deserialization: `loadXML()` (dòng 222–274) — passphrase giải mã
  (265); allocate theo số `<field>` (257–258).
- Khởi tạo: constructor (dòng 118–147) — cờ false, `"10"`,
  `success_if_no_errors`, `do_nothing` ×2.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–424) trong
  `JobEntryCopy.getXML()` (dòng 102–119).
- Không có `<connection>`.

Cấu hình không mặc định (ghi đè + thêm vào result):

```xml
<iffileexists>overwrite_file</iffileexists>
<add_result_filesname>Y</add_result_filesname>
<fields>
  <field>
    <source_filefolder>${SOURCE_FILE}</source_filefolder>
    <passphrase>${PGP_PASSPHRASE}</passphrase>
    <destination_filefolder>${DEST_FILE}</destination_filefolder>
    <wildcard>.*\.gpg</wildcard>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Không copy `<action_type>`/`<userid>` từ Encrypt sang**: Decrypt
  không có 2 tag này — thêm vào bị bỏ qua, thiếu `passphrase` mới là lỗi.
- **Passphrase luôn `${VAR}`**, không embed thật.
- Cần GPG thật khi chạy; không chạy I/O trong scope này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
