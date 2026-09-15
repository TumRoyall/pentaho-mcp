# DELETE_RESULT_FILENAMES — Job entry gỡ filenames khỏi result

Gỡ file khỏi result filenames của job — theo TẤT CẢ hoặc lọc regex
(`wildcard`/`wildcardexclude` khi `specify_wildcard=Y`). BẪY TÊN GỌI: entry
chỉ xóa khỏi **danh sách result trong memory**, KHÔNG xóa file trên đĩa
(khác với `DELETE_FILE`/`DELETE_FILES`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DELETE_RESULT_FILENAMES</type>
      <attributes/>
      <foldername/>
      <specify_wildcard>N</specify_wildcard>
      <wildcard>{{WILDCARD}}</wildcard>
      <wildcardexclude>{{WILDCARD_EXCLUDE}}</wildcardexclude>
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
| `<foldername>` | N | Serialize/load đầy đủ nhưng `execute()` KHÔNG dùng để lọc — template để self-closing. Đừng gán ý nghĩa ngữ cảnh không có source. |
| `<specify_wildcard>` | N | `N` (mặc định) gỡ TẤT CẢ result files; `Y` chỉ gỡ file khớp `<wildcard>` mà không khớp `<wildcardexclude>`. |
| `<wildcard>` | N | **Regex Java** (full-match) khớp tên base của file cần gỡ. Rỗng là HỢP LỆ (khớp tất cả — `CheckFileWildcard` giữ `include=true` khi pattern null). |
| `<wildcardexclude>` | N | **Regex Java** (full-match) giữ lại file khớp — file khớp cả hai thì ĐƯỢC GIỮ. Rỗng nghĩa là không loại trừ. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.foldername` | `<foldername>` | Ngữ cảnh, không lọc. |
| `configuration.specify_wildcard` | `<specify_wildcard>` | Y/N. |
| `configuration.wildcard` | `<wildcard>` | Regex, không phải glob. |
| `configuration.wildcardexclude` | `<wildcardexclude>` | Regex giữ lại. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` (dòng 40,
  `<job-entry id="DELETE_RESULT_FILENAMES">`,
  `classname=org.pentaho.di.job.entries.deleteresultfilenames.JobEntryDeleteResultFilenames`,
  category FileManagement).
- Serialization:
  `engine/src/main/java/org/pentaho/di/job/entries/deleteresultfilenames/JobEntryDeleteResultFilenames.java
  :: getXML()` (dòng 88–98) — `super.getXML()` rồi đúng thứ tự `foldername`,
  `specify_wildcard` (Y/N), `wildcard`, `wildcardexclude`.
- Deserialization: `loadXML()` (dòng 100–113) — `specify_wildcard` đọc Y/N,
  còn lại đọc chuỗi (thiếu → null).
- Defaults ctor (dòng 71–77): cả bốn về null/false (`specifywildcard =
  false`).
- Wrapper ngoài: `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–119) bao bằng `parallel`, `draw`, `nr`, `xloc`, `yloc`,
  `attributes_kjc` — giữ nguyên theo mẫu.
- Ngữ nghĩa runtime (`execute()`, dòng 176–222): nhánh `!specifywildcard`
  (dòng 186–192) `clear()` toàn bộ map result; nhánh wildcard (dòng
  196–214) duyệt từng `ResultFile`, chỉ xét file còn `exists()` trên đĩa
  (dòng 199) rồi gỡ khỏi map khi khớp `wildcard` VÀ không khớp
  `wildcardexclude` (regex qua `CheckFileWildcard`, dòng 230–244 —
  `Pattern.compile().matcher().matches()`, rỗng thì giữ nguyên giá trị
  `include` truyền vào). Nhánh Y CÓ kiểm tra tồn tại qua VFS
  (`file != null && file.exists()`, dòng 199) — entry trỏ file không còn
  tồn tại được GIỮ LẠI trong map; nhánh N `clear()` không cần kiểm tra.
  Không có xóa/tạo file nào trong cả hai nhánh.

Cấu hình lọc wildcard (gỡ file `.*\.tmp$`, giữ file `keep_.*`):

```xml
<foldername/>
<specify_wildcard>Y</specify_wildcard>
<wildcard>.*\.tmp$</wildcard>
<wildcardexclude>keep_.*</wildcardexclude>
```

## 5. Lưu ý / bẫy

- **Không xóa file trên đĩa**: sau entry này file vật lý vẫn còn nguyên, chỉ
  biến mất khỏi result filenames. Muốn xóa đĩa dùng `DELETE_FILE`/
  `DELETE_FILES`; muốn xóa + gỡ khỏi result dùng `COPY_MOVE_RESULT_FILENAMES`
  với `action=delete`.
- `wildcard`/`wildcardexclude` là regex full-match (`.*\.tmp$`, không phải
  `*.tmp`); `wildcardexclude` thắng khi file khớp cả hai.
- `specify_wildcard=N` gỡ tất cả không cần điều kiện — kiểm tra kỹ trước khi
  đặt sau entry tạo result quan trọng.
- Nhánh wildcard BỎ QUA (giữ lại) entry mà file đã không còn tồn tại trên
  đĩa — result sau entry có thể vẫn chứa file "ma" không khớp điều kiện gỡ.
  Dọn đĩa và dọn result là hai việc riêng.
- `<foldername>` không tham gia lọc — đừng điền rồi trông chờ giới hạn phạm
  vi theo thư mục.
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/ctor
  tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
