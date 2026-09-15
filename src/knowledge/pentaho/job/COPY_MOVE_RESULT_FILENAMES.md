# COPY_MOVE_RESULT_FILENAMES — Job entry copy/move/delete result filenames

Copy hoặc move từng file trong result filenames tới thư mục đích (kèm tùy
chọn đóng dấu ngày/giờ vào tên file), hoặc xóa file (`action=delete`).
`getXML()` ghi đúng 17 tag theo thứ tự cố định — giữ nguyên thứ tự trong
template. Điều kiện thành công (`success_condition`) có ba enum với ngữ nghĩa
đếm khác nhau (xem bẫy ở mục 5).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>COPY_MOVE_RESULT_FILENAMES</type>
      <attributes/>
      <foldername/>
      <specify_wildcard>N</specify_wildcard>
      <wildcard>{{WILDCARD}}</wildcard>
      <wildcardexclude>{{WILDCARD_EXCLUDE}}</wildcardexclude>
      <destination_folder>${DEST_FOLDER}</destination_folder>
      <nr_errors_less_than>10</nr_errors_less_than>
      <success_condition>success_if_no_errors</success_condition>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <action>copy</action>
      <AddDateBeforeExtension>N</AddDateBeforeExtension>
      <OverwriteFile>N</OverwriteFile>
      <CreateDestinationFolder>N</CreateDestinationFolder>
      <RemovedSourceFilename>Y</RemovedSourceFilename>
      <AddDestinationFilename>Y</AddDestinationFilename>
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
| `<foldername>` | N | Serialize/load đầy đủ nhưng `execute()` KHÔNG đọc field này — nguồn xử lý là result files list, đích là `<destination_folder>`. Template để self-closing; giữ tag cho đúng serializer. |
| `<specify_wildcard>` | N | `Y` lọc file theo regex; `N` (mặc định) xử lý tất cả result files. |
| `<wildcard>` | N | **Regex Java** (full-match) khớp tên base của file cần xử lý. |
| `<wildcardexclude>` | N | **Regex Java** (full-match) bỏ qua file khớp. |
| `<destination_folder>` | Y (trừ `action=delete`) | Thư mục đích. Dùng biến (`${DEST_DIR}`), không hardcode đường dẫn máy. Nhánh `delete` không cần tag này. |
| `<nr_errors_less_than>` | N | Ngưỡng `limitFiles` cho `success_condition` (số nguyên dạng chuỗi, mặc định `"10"`). |
| `<success_condition>` | N | Một trong `success_if_no_errors` (mặc định), `success_if_errors_less`, `success_when_at_least` — xem mục 5. |
| `<add_date>` / `<add_time>` | N | `Y` chèn ngày (`yyyyMMdd`) / giờ (`HHmmssSSS`) vào tên file đích. |
| `<SpecifyFormat>` | N | `Y` dùng `<date_time_format>` thay cho mẫu ngày/giờ mặc định (giữ HOA đúng source). |
| `<date_time_format>` | N (Y khi `SpecifyFormat=Y`) | Mẫu `SimpleDateFormat` tùy ý. |
| `<action>` | N | `copy` (mặc định), `move`, hoặc `delete`. |
| `<AddDateBeforeExtension>` | N | `Y` chèn đóng dấu trước phần mở rộng thay vì cuối tên. |
| `<OverwriteFile>` | N | `Y` cho phép ghi đè file đích đã tồn tại; `N` (mặc định) bỏ qua — `processFile()` trả `true` mà không copy/move, không đổi counter. |
| `<CreateDestinationFolder>` | N | `Y` tự tạo thư mục đích khi chưa có; `N` (mặc định) fail khi thư mục đích không tồn tại. |
| `<RemovedSourceFilename>` | N | Ctor mặc định `true`, nhưng load tag thiếu/rỗng → `false` (`"Y".equalsIgnoreCase`, dòng 188–190) — file load từ XML thiếu tag có default NGƯỢC với step mới tạo. `Y` gỡ source khỏi result sau xử lý; `N` giữ lại. |
| `<AddDestinationFilename>` | N | Như trên: ctor `true`, load thiếu tag → `false` (dòng 189–190). `Y` thêm file đích vào result; `N` không thêm. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.specify_wildcard` | `<specify_wildcard>` | Y/N. |
| `configuration.wildcard` / `configuration.wildcardexclude` | `<wildcard>` / `<wildcardexclude>` | Regex, không phải glob. |
| `configuration.destination_folder` | `<destination_folder>` | Biến, không hardcode. |
| `configuration.action` | `<action>` | `copy`/`move`/`delete`. |
| `configuration.success_condition` | `<success_condition>` | Một trong 3 enum. |
| `configuration.nr_errors_less_than` | `<nr_errors_less_than>` | Chuỗi số nguyên. |
| `configuration.add_date` / `add_time` / `specify_format` / `date_time_format` / `add_before_extension` | `<add_date>` / `<add_time>` / `<SpecifyFormat>` / `<date_time_format>` / `<AddDateBeforeExtension>` | Y/N trừ format. |
| `configuration.overwrite` / `create_destination` / `remove_source` / `add_destination` | `<OverwriteFile>` / `<CreateDestinationFolder>` / `<RemovedSourceFilename>` / `<AddDestinationFilename>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` (dòng 43,
  `<job-entry id="COPY_MOVE_RESULT_FILENAMES">`,
  `classname=org.pentaho.di.job.entries.copymoveresultfilenames.JobEntryCopyMoveResultFilenames`,
  category FileManagement).
- Serialization:
  `engine/src/main/java/org/pentaho/di/job/entries/copymoveresultfilenames/JobEntryCopyMoveResultFilenames.java
  :: getXML()` (dòng 137–163) — `super.getXML()` rồi đúng 17 tag theo thứ
  tự: `foldername`, `specify_wildcard`, `wildcard`, `wildcardexclude`,
  `destination_folder`, `nr_errors_less_than`, `success_condition`,
  `add_date`, `add_time`, `SpecifyFormat`, `date_time_format`, `action`,
  `AddDateBeforeExtension`, `OverwriteFile`, `CreateDestinationFolder`,
  `RemovedSourceFilename`, `AddDestinationFilename`.
- Deserialization: `loadXML()` (dòng 165–196) — booleans đọc Y/N, còn lại
  đọc chuỗi; tag thiếu → null/false.
- Defaults ctor (dòng 105–126): `action = "copy"`, `success_condition =
  SUCCESS_IF_NO_ERRORS`, `nr_errors_less_than = "10"`,
  `RemovedSourceFilename = true`, `AddDestinationFilename = true`, còn lại
  false/null.
- Wrapper ngoài: `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–119) bao bằng `parallel`, `draw`, `nr`, `xloc`, `yloc`,
  `attributes_kjc` — giữ nguyên theo mẫu.
- Ngữ nghĩa runtime: nhánh `delete` (`getAction().equals("delete")`, dòng
  399 + `processFile()` dòng 563–582) xóa file và gỡ khỏi result, KHÔNG cần
  destination (dòng 407–414); nhánh copy (dòng 597–603,
  `destinationfile.copyFrom`) / move (dòng 604–611, `sourcefile.moveTo`);
  wildcard biên dịch một lần từ `environmentSubstitute` (dòng 415–420);
  `isRemovedSourceFilename` gỡ source khỏi result, `isAddDestinationFilename`
  thêm đích vào result (dòng 612–631); đóng dấu tên file ở
  `getDestinationFilename()` (dòng 641–673). `NrErrors`/`limitFiles` điều
  khiển điều kiện thành công (dòng 422–428, 483–519); `foldername` (field
  dòng 73) không được `execute()` đọc — đích thật là `destination_folder`.

Cấu hình move tới thư mục đích:

```xml
<destination_folder>${DEST_DIR}</destination_folder>
<action>move</action>
```

## 5. Lưu ý / bẫy

- **`success_condition`: đọc đúng hai phép so, đừng suy ra kết luận**: dừng
  sớm kích hoạt khi `NrErrors >= limitFiles` (`checkIfSuccessConditionBroken`,
  dòng 500–507 — ném exception ở vòng lặp tiếp theo, dòng 441–446), NHƯNG
  sau `catch` vẫn gọi `getSuccessStatus()` (dòng 485–487) với điều kiện cuối
  `NrErrors <= limitFiles` (dòng 514) — nên bằng ngưỡng vẫn có thể kết thúc
  `result=true`; không kết luận "bằng limit là fail".
  `success_if_no_errors` cần `NrErrors == 0` (dòng 512).
  `success_when_at_least` so `NrSuccess >= limitFiles` (dòng 513) nhưng
  source KHÔNG chỗ nào tăng `NrSuccess` (chỉ khai báo dòng 100, reset dòng
  426, đọc dòng 484/513) — không quảng cáo mode này đếm thành công đúng;
  cần chế độ đáng tin cậy thì dùng `success_if_no_errors` cho tới khi có
  runtime evidence. Tên hằng `SUCCESS_IF_AT_LEAST_X_FILES_UN_ZIPPED`
  (dòng 80) KHÔNG liên quan unzip.
- **`OverwriteFile=N` + đích đã tồn tại = bỏ qua**: `processFile()` trả
  `true` mà không copy/move (dòng 590–631) và không đổi counter nào — nói rõ
  bỏ qua, không nói đếm thành công.
- **`RemovedSourceFilename`/`AddDestinationFilename` chỉ thuộc nhánh
  copy/move khi thực sự xử lý** (dòng 612–631); nhánh `delete` gỡ khỏi
  result khi xóa thành công (dòng 571–577), không phụ thuộc hai cờ này.
- Nhánh `delete` không dùng `<destination_folder>` — để trống, đừng điền
  thư mục giả.
- `CreateDestinationFolder=N` (mặc định) + thư mục đích chưa có = entry fail
  — tạo thư mục trước hoặc bật cờ này.
- `OverwriteFile=N` (mặc định) bỏ qua im lặng file đích đã tồn tại (vẫn tính
  thành công) — bật `Y` khi cần ghi đè thật.
- Wildcard là regex full-match (`.*\.csv$`, không phải `*.csv`).
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/ctor
  tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
