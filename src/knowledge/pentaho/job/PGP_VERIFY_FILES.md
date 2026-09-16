# PGP_VERIFY_FILES — Job entry xác minh chữ ký PGP

Xác minh chữ ký PGP của MỘT file (`<filename>`) bằng GPG
(`<gpglocation>`), dùng chữ ký tách rời (`<detachedfilename>`) khi
`<useDetachedSignature>=Y`. Entry đơn giản: chỉ 4 tag plugin, không có
block `<fields>`, không điều kiện success phức tạp.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>PGP_VERIFY_FILES</type>
      <attributes/>
      <gpglocation>${GPG_PATH}</gpglocation>
      <filename>${SIGNED_FILE}</filename>
      <detachedfilename/>
      <useDetachedSignature>N</useDetachedSignature>
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
| `<gpglocation>` | Y | Đường dẫn GPG. `${GPG_PATH}`. Mặc định mới null. |
| `<filename>` | Y | File cần xác minh chữ ký. |
| `<detachedfilename>` | N (Y khi useDetachedSignature=Y) | File chữ ký tách rời (`.sig`/`.asc`). |
| `<useDetachedSignature>` | N | Y = dùng chữ ký tách rời; N (mặc định) = chữ ký kèm trong file. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PGP_VERIFY_FILES` | `<type>` | `PGP_VERIFY_FILES`. |
| `configuration.gpg_location` | `<gpglocation>` | `${GPG_PATH}`. |
| `configuration.filename` | `<filename>` | File xác minh. |
| `configuration.detached_filename` | `<detachedfilename>` | File `.sig`. |
| `configuration.use_detached` | `<useDetachedSignature>` | Y/N. |

Không có list lặp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 64 —
  `<job-entry id="PGP_VERIFY_FILES">` →
  `org.pentaho.di.job.entries.pgpverify.JobEntryPGPVerify`
  (category FileEncryption).
- Serialization: `JobEntryPGPVerify.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/pgpverify/JobEntryPGPVerify.java`
  dòng 91–100) — `super.getXML()` (94) rồi đúng 4 tag: `gpglocation`
  (95), `filename` (96), `detachedfilename` (97),
  `useDetachedSignature` Y/N (98).
- Deserialization: `loadXML()` (dòng 102–115) — đọc nguyên văn 3 chuỗi,
  cờ parse `"Y"` (109).
- Khởi tạo: constructor (dòng 74–80) — tất cả null trừ cờ false.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–424) trong
  `JobEntryCopy.getXML()` (dòng 102–119).
- Không có `<connection>`.

Cấu hình không mặc định (chữ ký tách rời):

```xml
<gpglocation>${GPG_PATH}</gpglocation>
<filename>${SIGNED_FILE}</filename>
<detachedfilename>${SIG_FILE}</detachedfilename>
<useDetachedSignature>Y</useDetachedSignature>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Đừng lẫn với Encrypt/Decrypt**: Verify chỉ xử lý 1 file, không có
  `<fields>` — đừng bịa block fields.
- Cần GPG + keyring thật khi chạy; không chạy I/O trong scope này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
