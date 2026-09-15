# B1 package 2 — Source notes (result files, 5 ID)

Ngày: 2026-09-15. Source: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`,
branch `9.4`, commit `1a939ab5cabe4517867879684aeca2a526bcc638` (giả định —
reviewer chạy `git -C ../pentaho-kettle rev-parse HEAD` để xác nhận; mọi số
dòng dưới đây ứng với commit đã ghim trong plan).

Phạm vi: `FilesFromResult`, `FilesToResult`, `ADD_RESULT_FILENAMES`,
`DELETE_RESULT_FILENAMES`, `COPY_MOVE_RESULT_FILENAMES`. Tất cả đã đối chiếu
`getXML()`/`loadXML()`/`setDefault()` + superclass/helper + wrapper. Mức bằng
chứng đề xuất: `source_reviewed`, `source_version: 9.4`,
`verified_versions: 9.4` → đủ điều kiện `canonical + generator_eligible: true`.

Test hồi quy: `test/knowledge-result-files.test.js` (viết trước theo plan —
hiện FAIL vì 5 ID chưa có catalog/reference; chuyển GREEN sau khi thêm
reference + dòng catalog).

## Quy ước chung đã xác minh (dùng cho cả 5 reference)

- `XMLHandler.addTagValue(tag, null|"")` → self-closing `<tag/>`
  (`core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java` dòng 795–804).
- `XMLHandler.addTagValue(tag, boolean)` → `Y`/`N` (cùng file, dòng 869–871).
- Load boolean: `"Y".equalsIgnoreCase(getTagValue(...))` — chỉ `Y` (mọi kiểu
  hoa/thường) là true; tag thiếu → false.
- Wrapper step: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng 210–264)
  bao fragment plugin bằng `name`, `type` (= step ID), `description`,
  `distribute`, `custom_distribution`, `copies`, `partitioning`, rồi
  `attributes`, `cluster_schema`, `remotesteps`, `GUI`. `getXML()` của plugin
  chỉ trả fragment.
- Wrapper entry: `JobEntryBase.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` dòng
  415–424) ghi `name`, `description`, `type` (= configId), `attributes`;
  `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–119) bao ngoài bằng `parallel`, `draw`, `nr`, `xloc`, `yloc`,
  `attributes_kjc`.
- Wildcard ở cả 3 job entry là **regex Java** (`Pattern.compile(...).matcher().
  matches()` — full-match), KHÔNG phải glob. Ghi rõ trong reference để tránh
  bẫy `*.csv`.

## 1. trans `FilesFromResult`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 45
  (`<step id="FilesFromResult">`,
  `classname=org.pentaho.di.trans.steps.filesfromresult.FilesFromResultMeta`,
  category Job). Class không mang annotation `@Step`.
- Serialization: **không override `getXML()`** — kế thừa
  `BaseStepMeta.getXML()` trả `""`
  (`engine/src/main/java/org/pentaho/di/trans/step/BaseStepMeta.java` dòng
  200–202). `readData()` rỗng
  (`engine/.../trans/steps/filesfromresult/FilesFromResultMeta.java` dòng
  73–74), `setDefault()` rỗng (dòng 76–77), `loadXML()` (dòng 64–66) chỉ gọi
  `readData`. Template step thân RỖNG (giống `RowsToResult`, `MappingOutput`) —
  KHÔNG bịa `<filename_field>`/`<file_type>`/`<fields>`.
- Output schema (không cấu hình, do `getFields()` dòng 85–103 khai báo qua
  `ResultFile.getRow()`): `type`, `filename`, `path`, `parentorigin`,
  `origin`, `comment` (String) + `timestamp` (Date).
  (`core/src/main/java/org/pentaho/di/core/ResultFile.java` dòng 247–272).
- Ngữ nghĩa runtime: `init()` (dòng 83–99 trong `FilesFromResult.java`) lấy
  `getTrans().getPreviousResult()` rồi giữ `data.resultFilesList` (null khi
  không có previous result). `processRow()` (dòng 57–81) lấy từng `ResultFile`
  theo `getLinesRead()`, gọi `resultFile.getRow()` ra `RowMetaAndData`; lần
  đầu dựng `new RowMeta()` mới + `smi.getFields(...)`, rồi
  `putRow(data.outputRowMeta, r.getData())` — row phát ra là THÔNG TIN FILE
  (7 field), KHÔNG phải nội dung file, KHÔNG phải result rows gốc, row-meta
  dựng mới chứ không tái dùng meta gốc.
- `check()` (Meta dòng 105–120) báo ERROR nếu step có input — step này không
  nhận input stream, đặt ở đầu luồng.
- Catalog đề xuất:
  `{type: FILES_FROM_RESULT, xml_type: FilesFromResult, file: trans/FilesFromResult.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 2. trans `FilesToResult`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 46
  (`<step id="FilesToResult">`,
  `classname=org.pentaho.di.trans.steps.filestoresult.FilesToResultMeta`,
  category Job).
- Serialization:
  `engine/src/main/java/org/pentaho/di/trans/steps/filestoresult/FilesToResultMeta.java
  :: getXML()` (dòng 109–116) — đúng 2 tag theo thứ tự `filename_field`,
  `file_type` (code qua `ResultFile.getTypeCode(fileType)`).
- Deserialization: `readData()` (dòng 118–121) — `filename_field` đọc chuỗi
  (thiếu → null); `file_type` qua `ResultFile.getType()` (dòng 194–205 trong
  `core/.../ResultFile.java`): khớp description HOẶC code, **không khớp →
  FILE_TYPE_GENERAL** (fallback im lặng — bẫy chính tả code).
- Khởi tạo: `setDefault()` (dòng 123–126) — `filenameField = null`
  (serialize thành `<filename_field/>`), `fileType = FILE_TYPE_GENERAL`
  (serialize thành `<file_type>GENERAL</file_type>`).
- Enum code: `fileTypeCode = { GENERAL, LOG, ERRORLINE, ERROR, WARNING }`
  (`core/src/main/java/org/pentaho/di/core/ResultFile.java` dòng 45–51).
- `check()` (dòng 143–158) NGƯỢC với FilesFromResult: báo ERROR khi KHÔNG có
  input — step này thu filename từ stream vào result. `getFields()` (dòng
  138–141) no-op.
- Ngữ nghĩa runtime (`FilesToResult.java` dòng 55–109): mỗi dòng input tạo
  `ResultFile` buffer trong `data.filenames` (dòng 87–93); chỉ khi
  `getRow() == null` mới lặp `addResultFile` (dòng 60–69). Dòng input vẫn
  `putRow` downstream nguyên vẹn (dòng 98–101) — không tạo/copy nội dung
  file. `filename_field` vắng trong schema → `logError` + `setErrors(1)` +
  `stopAll()` (dòng 74–81).
- Catalog đề xuất:
  `{type: FILES_TO_RESULT, xml_type: FilesToResult, file: trans/FilesToResult.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 3. job `ADD_RESULT_FILENAMES`

- Đăng ký: annotation `@JobEntry(id = "ADD_RESULT_FILENAMES", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/job/entries/addresultfilenames/JobEntryAddResultFilenames.java`
  dòng 70–75, category FileManagement). KHÔNG có trong
  `kettle-job-entries.xml` — nguồn đăng ký duy nhất là annotation plugin core.
- Serialization: `getXML()` (dòng 107–130) — `super.getXML()` rồi đúng thứ tự
  `arg_from_previous`, `include_subfolders`, `delete_all_before` (Y/N), khối
  `<fields>` chứa 0..n `<field>`, mỗi item đúng thứ tự `name`, `filemask`.
  `arguments == null` → khối `<fields>` rỗng (vẫn luôn serialize wrapper).
- Deserialization: `loadXML()` (dòng 132–158) — 3 cờ đọc Y/N; đếm `<field>`
  dưới `<fields>` qua `countNodes`, đọc `name`/`filemask` từng item.
- Defaults ctor (dòng 89–96): `argFromPrevious = false`,
  `deleteallbefore = false`, `arguments = null`, `includeSubfolders = false`.
- Ngữ nghĩa runtime (`execute()`, dòng 203–270):
  `deleteallbefore` chỉ `clear()` map result trong memory (dòng 210–221),
  KHÔNG xóa file trên đĩa; nhánh `argFromPrevious && rows != null` (dòng
  230–248) đọc cặp (folder, mask) từ 2 cột đầu của result ROWS —
  `else-if arguments != null` (dòng 249–262) là fallback static khi rows
  null (rows rỗng non-null → 0 vòng, không fallback); thư mục nêu ra chỉ để
  quét và đăng ký các FILE con — thư mục không tự thành result entry;
  `includeSubfolders` chỉ có tác dụng trong `TextFileSelector` khi quét thư
  mục (dòng 356–378); `filemask` là regex (`GetFileWildcard`, dòng 391–405).
  Thêm file vào result dưới dạng `ResultFile(FILE_TYPE_GENERAL, ...)`
  (dòng 294–298, 308–313).
- Catalog đề xuất:
  `{type: ADD_RESULT_FILENAMES, xml_type: ADD_RESULT_FILENAMES, file: job/ADD_RESULT_FILENAMES.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 4. job `DELETE_RESULT_FILENAMES`

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 40
  (`<job-entry id="DELETE_RESULT_FILENAMES">`,
  `classname=org.pentaho.di.job.entries.deleteresultfilenames.JobEntryDeleteResultFilenames`,
  category FileManagement).
- Serialization: `getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/deleteresultfilenames/JobEntryDeleteResultFilenames.java`
  dòng 88–98) — `super.getXML()` rồi đúng thứ tự `foldername`,
  `specify_wildcard` (Y/N), `wildcard`, `wildcardexclude`.
- Deserialization: `loadXML()` (dòng 100–113) — `specify_wildcard` đọc Y/N,
  còn lại đọc chuỗi (thiếu → null).
- Defaults ctor (dòng 71–77): `foldername = null`, `wildcardexclude = null`,
  `wildcard = null`, `specifywildcard = false`.
- Ngữ nghĩa runtime (`execute()`, dòng 176–222): entry này chỉ xóa khỏi
  **danh sách result** (không xóa file trên đĩa — bẫy tên gọi):
  `specifywildcard=N` → `clear()` toàn bộ, không cần kiểm tra (dòng
  186–192); `specifywildcard=Y` → chỉ xét file còn `exists()` qua VFS
  (dòng 199, entry trỏ file đã mất được giữ lại), gỡ khi khớp `wildcard` VÀ
  không khớp `wildcardexclude` (dòng 196–214, regex qua `CheckFileWildcard`
  dòng 230–244 — full-match; wildcard rỗng hợp lệ, khớp tất cả).
  `foldername` serialize/load nhưng không dùng lọc.
- Catalog đề xuất:
  `{type: DELETE_RESULT_FILENAMES, xml_type: DELETE_RESULT_FILENAMES, file: job/DELETE_RESULT_FILENAMES.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 5. job `COPY_MOVE_RESULT_FILENAMES`

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 43
  (`<job-entry id="COPY_MOVE_RESULT_FILENAMES">`,
  `classname=org.pentaho.di.job.entries.copymoveresultfilenames.JobEntryCopyMoveResultFilenames`,
  category FileManagement).
- Serialization: `getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/copymoveresultfilenames/JobEntryCopyMoveResultFilenames.java`
  dòng 137–163) — `super.getXML()` rồi đúng 17 tag theo thứ tự: `foldername`,
  `specify_wildcard`, `wildcard`, `wildcardexclude`, `destination_folder`,
  `nr_errors_less_than`, `success_condition`, `add_date`, `add_time`,
  `SpecifyFormat` (giữ HOA đúng source), `date_time_format`, `action`,
  `AddDateBeforeExtension`, `OverwriteFile`, `CreateDestinationFolder`,
  `RemovedSourceFilename`, `AddDestinationFilename`.
- Deserialization: `loadXML()` (dòng 165–196) — booleans đọc Y/N, còn lại đọc
  chuỗi; tag thiếu → null/false. LƯU Ý LOAD-KHÁC-DEFAULT: `RemovedSourceFilename`
  và `AddDestinationFilename` ctor `true` nhưng load thiếu tag → `false`
  (dòng 188–190) — file load từ XML thiếu tag có default NGƯỢC với step mới.
- Defaults ctor (dòng 105–126): `RemovedSourceFilename = true`,
  `AddDestinationFilename = true`, `CreateDestinationFolder = false`,
  `foldername/wildcardexclude/wildcard = null`, `specifywildcard = false`,
  `OverwriteFile/add_date/add_time/SpecifyFormat/AddDateBeforeExtension = false`,
  `date_time_format = null`, `destination_folder = null`,
  `nr_errors_less_than = "10"`, `action = "copy"`,
  `success_condition = SUCCESS_IF_NO_ERRORS`.
- Enum `success_condition` (dòng 80–82 + `getSuccessStatus()` dòng 509–519):
  `success_if_no_errors` (NrErrors == 0, dòng 512); `success_if_errors_less`
  cuối so `NrErrors <= limit` (dòng 514) nhưng dừng sớm kích hoạt ở
  `NrErrors >= limit` (`checkIfSuccessConditionBroken` dòng 500–507, ném ở
  vòng lặp tiếp theo dòng 441–446) — sau catch vẫn gọi `getSuccessStatus()`
  (dòng 485–487) nên bằng ngưỡng vẫn có thể `result=true`; KHÔNG kết luận
  "bằng limit là fail". `success_when_at_least` so `NrSuccess >= limit`
  (dòng 513) nhưng toàn file KHÔNG chỗ nào tăng `NrSuccess` (khai báo dòng
  100, reset dòng 426, đọc dòng 484/513) — KHÔNG quảng cáo mode này đếm đúng
  file thành công; tên hằng `SUCCESS_IF_AT_LEAST_X_FILES_UN_ZIPPED` cũng
  không liên quan unzip. Cần chế độ đáng tin cậy thì dùng
  `success_if_no_errors` tới khi có runtime evidence.
- Ngữ nghĩa runtime: `action` = `copy` (dòng 597–603, qua
  `destinationfile.copyFrom`) / `move` (dòng 604–611, `sourcefile.moveTo`) /
  `delete` (dòng 399 + 563–582 — nhánh delete KHÔNG cần destination folder,
  dòng 407–414); wildcard biên dịch một lần từ `environmentSubstitute`
  (dòng 415–420); `RemovedSourceFilename`/`AddDestinationFilename` chỉ thuộc
  nhánh copy/move khi thực sự xử lý (dòng 612–631) — nhánh delete gỡ khỏi
  result khi xóa thành công (dòng 571–577), không phụ thuộc hai cờ;
  `OverwriteFile=N` + đích tồn tại → `processFile()` trả `true` mà không
  copy/move, không đổi counter; `foldername` (field dòng 73) serialize/load
  đầy đủ nhưng `execute()` KHÔNG đọc — nguồn là result files list, đích là
  `destination_folder`.
- Catalog đề xuất:
  `{type: COPY_MOVE_RESULT_FILENAMES, xml_type: COPY_MOVE_RESULT_FILENAMES, file: job/COPY_MOVE_RESULT_FILENAMES.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## Việc còn lại cho agent viết reference/catalog (ngoài scope file này)

1. Tạo 5 reference `.md` theo format 5 phần (dùng template skeleton trong test
   làm khung, thay secret/path bằng `${VAR}`), ghi provenance file+method+dòng
   ở trên.
2. Thêm 5 dòng catalog (alias duy nhất, đã kiểm tra không trùng).
3. Bổ sung 5 ID vào `EVIDENCE_BACKED_TYPES` trong `test/knowledge.test.js`.
4. Cập nhật `docs/pdi94-evidence-report.md` (95 → 100 dòng; breakdown
   source_reviewed 86 → 91) và checklist B1 trong
   `docs/inventory/2026-09-15-pdi94-components.md` (5 ô `[ ]` → `[x]`).
5. Chạy `node --test test/knowledge-result-files.test.js
   test/knowledge.test.js test/knowledge-coverage.test.js
   test/knowledge-intake.test.js` + toàn suite; agent hiện tại không có shell
   nên chưa chạy — reviewer chạy và xác nhận GREEN.
