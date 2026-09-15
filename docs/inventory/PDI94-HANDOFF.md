# PDI 9.4 catalog — handoff đang hoạt động

**Cập nhật:** 2026-09-15. **Đọc file này đầu tiên khi tiếp tục phiên mới.**

## Trạng thái hiện tại

- **Đã xong:** B1 gói 2 — 5 ID result files ĐÃ NGHIỆM THU (Kiro verify 2026-09-15, xem "B1 gói 2 — nghiệm thu" bên dưới). Phase implement của OpenCode đã kết thúc và tự sửa cả F1–F5; không còn process nào chạy.
- **Bước tiếp theo:** B1 gói cuối — `Append`, `BlockingStep`, `DetectEmptyStream`, `DetectLastRow` (xem "Sau gói 2"). Chưa bắt đầu.
- **Trạng thái commit:** toàn bộ B1 (gói 1 + gói 2) vẫn UNCOMMITTED theo đúng ràng buộc "không commit". Working tree giữ nguyên; chờ user quyết định commit.

## Mục tiêu và ủy quyền

User muốn mở rộng step/job entry, lấy XML chuẩn từ source Pentaho 9.4, và giao Codex điều phối trực tiếp OpenCode để không phải copy prompt. User đã duyệt việc tiếp tục và yêu cầu handoff bền vững.

- Repo làm việc: `C:/Users/TumRoyal/Documents/GitHub/pentaho-mcp-server`.
- Source chỉ đọc: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`, commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
- OpenCode model bắt buộc: `opencode/muse-spark-1.3-contributor-free` (user gọi “muskspark 1.3 free”). Không tự đổi model trả phí.
- Không commit/push; giữ thay đổi đang có. Không chạy job nghiệp vụ, DB, email, shell của PDI hoặc sửa source Pentaho.
- Quyền OpenCode chỉ áp dụng bằng `OPENCODE_CONFIG_CONTENT` trong process con: đọc source; edit allowlist theo batch; bash/mutation khác bị chặn. Primary Codex chạy test. Không bật `--auto` hoặc sửa config global.
- Đang dùng checkout hiện tại nơi user đã triển khai gói đầu; không chuyển/reset checkout làm mất thay đổi uncommitted.

## Tài liệu nguồn

- Plan: `docs/superpowers/plans/2026-09-15-expand-pdi94-component-catalog.md`.
- Inventory: `docs/inventory/2026-09-15-pdi94-components.md` và `.json`.
- Review gói 1: `docs/inventory/2026-09-15-b1-package1-review.md`.
- Inventory là snapshot phát triển, không thay catalog runtime. Các con số 92/198 ở phần baseline là lịch sử trước khi bổ sung.

## Phần đã hoàn tất

### B1 gói 1 — đã qua review

`RowsFromResult`, `MappingInput`, `MappingOutput`; canonical/eligible PDI 9.4 ở mức `source_reviewed`.

- Catalog hiện sau gói 1: **95 dòng = 34 job + 61 trans**, 94 eligible, 1 observed (`SetSessionVariableStep`).
- Đã sửa ba lỗi review: routing/rename của MappingOutput; select_unspecified=N không loại cột; RowsFromResult truyền row/meta nguyên từ previousResult, không convert theo fields khai báo.
- Test gần nhất: **35 knowledge pass**; toàn suite **264 tests: 263 pass, 0 fail, 1 skipped**.
- Source review chưa có Spoon/runtime verification. Có 4 dòng evidence-report cũ thiếu per-row: TransExecutor, SimpleMapping, SingleThreader, MetaInject; không bịa evidence để lấp.
- OpenCode session gói 1: `ses_f5cf313c9ffeojqRxxVNfSGgFk`.
- Log gói 1: `%TEMP%/opencode-b1-review-fix-scoped.jsonl`; log suite `%TEMP%/pentaho-b1-fixed-suite.log`.

## B1 gói 2 — phạm vi 5 ID

| Kind | ID | Reference cần tạo |
|---|---|---|
| trans | FilesFromResult | src/knowledge/pentaho/trans/FilesFromResult.md |
| trans | FilesToResult | src/knowledge/pentaho/trans/FilesToResult.md |
| job | ADD_RESULT_FILENAMES | src/knowledge/pentaho/job/ADD_RESULT_FILENAMES.md |
| job | DELETE_RESULT_FILENAMES | src/knowledge/pentaho/job/DELETE_RESULT_FILENAMES.md |
| job | COPY_MOVE_RESULT_FILENAMES | src/knowledge/pentaho/job/COPY_MOVE_RESULT_FILENAMES.md |

Test riêng: `test/knowledge-result-files.test.js`. Test dùng temporary fixtures, không cần thêm fixture production.
OpenCode được sửa 5 reference, test riêng, catalog, evidence report, inventory .md/.json; primary giữ quyền cập nhật handoff.

### Checkpoint

- [x] Đọc source và viết test — agent dừng trước implementation.
- [x] Primary chạy test red, xác nhận lý do đúng.
- [x] Thêm reference/catalog, evidence và inventory — agent (5 reference + 5 catalog row + evidence report 100 dòng).
- [x] Primary kiểm tra serializer/load/default + runtime semantics của 5 ID (Kiro đối chiếu F1–F5, tất cả đã fixed).
- [x] Chạy targeted tests và full suite; không còn finding.
- [x] Cập nhật handoff/checklist; gói 2 được nghiệm thu.

### B1 gói 2 — nghiệm thu (Kiro verify 2026-09-15)

Xác minh thực tế trên đĩa (không tin checklist agent):

- 5 reference tồn tại và mô tả ĐÚNG semantics source — cả 5 finding review đã fixed:
  - F1 FilesFromResult: phát 7-field file-info rows từ `ResultFile.getRow()`, RowMeta mới qua `getFields()`, không phải nội dung/result rows gốc. ✔
  - F2 FilesToResult: có `processRow` (buffer `data.filenames`, `addResultFile` khi `getRow()==null`, row truyền nguyên downstream, thiếu field → setErrors/stopAll). ✔
  - F3 DELETE_RESULT_FILENAMES: nhánh Y kiểm `exists()` VFS, không gọi là "không I/O"; `<foldername/>` self-closing. ✔
  - F4 COPY_MOVE_RESULT_FILENAMES: success/counter đúng (NrErrors<=limit cuối, NrSuccess không tăng, OverwriteFile=N bỏ qua không đếm, ctor-true-load-false); `<foldername/>` self-closing. ✔
  - F5 ADD_RESULT_FILENAMES: directory chỉ để quét không thành entry; delete_all_before chỉ clear map; rows null mới fallback static. ✔
- 5 catalog row: job dòng 47–49, trans dòng 113–114 — canonical/eligible/source_reviewed 9.4.
- Regression assertions default boolean COPY_MOVE có đủ (order 17 tag, RemovedSourceFilename/AddDestinationFilename=Y, 7 cờ ctor-false=N).
- `test/knowledge.test.js` chỉ thêm 3 ID gói 1 vào EVIDENCE_BACKED_TYPES; KHÔNG thêm 5 ID gói 2 (đúng chỉ dẫn — ngoài allowlist, batch riêng đã kiểm).
- Test: `knowledge-result-files.test.js` 9/9 pass; nhóm knowledge (components+result-files+knowledge+coverage+intake) 44/44 pass; `npm test` toàn suite **273 tests: 272 pass, 0 fail, 1 skipped** (skip = symlink platform).
- Evidence report: **100 dòng (37 job + 63 trans)**, source_reviewed 91, spoon_loaded 8, observed 1 (SetSessionVariableStep).
- Mức bằng chứng: `source_reviewed` (chưa Spoon/runtime) — đúng chính sách, không nâng mức.

## B1 gói cuối (gói 3) — stream control — ĐÃ NGHIỆM THU + B1 HOÀN TẤT (Kiro verify 2026-09-15)

Nghiệm thu (xác minh thực tế trên đĩa, không tin summary agent):
- 4 reference đúng semantics source (đối chiếu source-notes có trích dẫn class/method/dòng tại commit ghim):
  - Append: head_name/tail_name = THAM CHIẾU STEP (2 info streams), bắt buộc 2 hop, init() fail BothHopsAreNeeded, output schema = head, layout tail phải khớp. ✔
  - BlockingStep: 5 tag (pass_all_rows/directory/prefix/cache_size/compress); bẫy compress load-thiếu-tag→N (template pin `<compress>Y</compress>`); không nhầm SortRows. ✔
  - DetectEmptyStream: thân RỖNG (kế thừa BaseStepMeta); nuốt dòng gốc, phát 1 empty row null theo prev-step fields khi stream rỗng. ✔
  - DetectLastRow: 1 tag resultfieldname (mặc định "result", load thiếu→null, init() fail khi rỗng → template pin); thêm ValueMetaBoolean; dòng cuối ra trễ một nhịp. ✔
- 4 catalog row: trans dòng 115–118 (APPEND, BLOCKING_STEP, DETECT_EMPTY_STREAM, DETECT_LAST_ROW) — canonical/eligible/source_reviewed 9.4.
- EVIDENCE_BACKED_TYPES: KHÔNG thêm 4 ID gói 3 (nhất quán với gói 2 — batch test riêng đã kiểm eligibility; toàn suite vẫn xanh).
- Test: `knowledge-stream-control.test.js` 8/8 pass; `npm test` toàn suite **281 tests: 280 pass, 0 fail, 1 skipped**.
- Evidence report: **104 dòng (37 job + 67 trans)**, source_reviewed 95, spoon_loaded 8, observed 1.
- Mức bằng chứng: `source_reviewed` (chưa Spoon/runtime) — đúng chính sách.

## B2a — existence + DB join (4 ID) — ĐÃ NGHIỆM THU (Kiro verify 2026-09-15)

Phạm vi: trans `TableExists`, job `TABLE_EXISTS`, trans `ColumnExists`, trans `DBJoin`.
Source-notes: `docs/inventory/2026-09-15-b2a-source-notes.md`. Test: `test/knowledge-b2a-existence.test.js`.
- 4 reference đúng semantics source (đối chiếu source-notes có trích class/method/dòng):
  TableExists dùng `tablenamefield` (dynamic, KHÔNG có `<tablename>` tĩnh); job TABLE_EXISTS dùng `tablename` TĨNH;
  ColumnExists `columnnamefield` (KHÔNG `<columnname>`/`<valuename>`); DBJoin `<parameter>/<field>` paired (KHÔNG `<lookup>`),
  `<type>` = tên value-meta chuỗi, số field = số `?`. Cả 4 tham chiếu `<connection>` theo tên (${VAR}, không credential thật).
- 4 catalog row (job dòng 50, trans dòng 120–122). Alias `TABLE_EXISTS` trùng chuỗi giữa job/trans nhưng KHÁC KIND —
  hợp lệ (catalog tách list theo kind; test "catalog aliases are unique..." PASS).
- Kiro FIX lỗi test do OpenCode: fixture minimalKtr/minimalKjb thiếu khai báo `<connection>` nên validator báo
  "undefined connection" (5/8 fail). Đã thêm `<connection><name>${CONN}</name></connection>` vào 2 fixture → 8/8 pass.
  (BÀI HỌC cho B2 sau: step DB tham chiếu connection thì fixture PHẢI khai báo connection đó.)
- Test: targeted 8/8; `npm test` toàn suite **289: 288 pass, 0 fail, 1 skipped**.
- Evidence report: **108 dòng (38 job + 70 trans)**, source_reviewed 107, observed 1. Mức source_reviewed.
- Commit: user cho phép → Kiro commit (xem git log). Còn lại B2: AnalyticQuery, CombinationLookup, DBProc,
  DimensionLookup, MemoryGroupBy, SortedMerge, SynchronizeAfterMerge, WAIT_FOR_SQL (9 ID) — chia gói tiếp.

=> **B1 HOÀN TẤT** (gói 1: RowsFromResult/MappingInput/MappingOutput; gói 2: 5 result-file ID; gói 3: 4 stream-control ID). Đợt tiếp theo: B2 theo inventory.
Commit: user cho phép commit 2026-09-15 → Kiro commit toàn bộ B1 (xem git log).

### (lịch sử) B1 gói cuối (gói 3) — stream control — điều phối OpenCode

Phạm vi 4 ID trans: `Append`, `BlockingStep`, `DetectEmptyStream`, `DetectLastRow`.
Runner: `docs/inventory/run-opencode-b1-package3.ps1` (cùng cấu trúc quyền/model gói 2;
model `opencode/muse-spark-1.3-contributor-free`). Test riêng: `test/knowledge-stream-control.test.js`;
source-notes: `docs/inventory/2026-09-15-b1-package3-source-notes.md`. Log: `%TEMP%/opencode-b1-package3-<phase>.jsonl` (UTF-16LE).

**OpenCode session gói 3:** `ses_f5c459fe6ffeYcVULNkxHWHCw2` (phase tests). Lượt implement/fix dùng `-SessionId ses_f5c459fe6ffeYcVULNkxHWHCw2`.
Trạng thái: phase `tests` đã dispatch, đang chạy. Chưa có file test/source-notes trên đĩa. Chưa nghiệm thu.
Note môi trường: log JSONL là UTF-16LE — parse phải decode utf16le. Foreground shell nhiễu khi có process nền; đọc trạng thái qua `.superpowers/oc-log.cjs` (ghi ra `.superpowers/oc-status.txt`).

## Cách tiếp tục OpenCode

Runner PS1 trong cùng thư mục tạo config quyền theo lượt, không ghi config chung. Lượt đầu `-Phase tests` mở session OpenCode riêng cho gói để tránh mang context lớn của gói trước. Lấy `sessionID` từ event JSONL đầu tiên và ghi tại đây. Lượt tiếp dùng `-Phase implement -SessionId <ID đã ghi>`. Log mặc định nằm trong `%TEMP%/opencode-b1-package2-<phase>.jsonl`.

**OpenCode session gói 2:** `ses_f5c984ba0ffeO1XEWv3pCZCRxc`.
**Unified exec session:** `35969` đang chạy phase implement; `17646` đã hoàn tất phase tests (exit 0); ID này chỉ hữu ích trong cùng phiên Codex, sau restart kiểm tra process/log trước khi launch lại.

Nếu hết context giữa chừng:

1. Đọc handoff này và kiểm tra `git status --short`.
2. Đọc các event cuối JSONL: `tool_use` status, text, `step_finish.reason=stop` hoặc error. Exit 0 một mình không chứng minh agent hoàn thành.
3. Kiểm tra OpenCode có còn chạy không; không launch writer thứ hai trên cùng repo khi writer cũ còn chạy.
4. Kiểm tra file thực tế, catalog và tests; không tin checklist/summary của agent nếu chưa xác minh.
5. Tiếp tục đúng phase/session, cập nhật handoff khi dispatch, test red, implementation, review, test pass hoặc blocker.

## Test và vấn đề môi trường đã biết

```powershell
node --test --test-isolation=none test/knowledge-result-files.test.js
node --test --test-isolation=none test/knowledge-components.test.js test/knowledge-result-files.test.js test/knowledge.test.js test/knowledge-coverage.test.js test/knowledge-intake.test.js
npm.cmd test
git diff --check
```

- Dùng `npm.cmd`, không dùng npm.ps1 (ExecutionPolicy).
- Sandbox chặn Node child process (`spawn EPERM`); chạy full suite bằng exec require_escalated với lý do chạy tests. Không đổi ExecutionPolicy.
- OpenCode cũng cần exec require_escalated để ghi log/session nội bộ và gọi model; scope code edits vẫn theo allowlist runner.
- Đừng chạy `npm.cmd test` và nuốt exit code bằng lệnh tail: lưu `$LASTEXITCODE`, in tail, rồi `exit` đúng mã.

## Sau gói 2

Gói cuối B1: `Append`, `BlockingStep`, `DetectEmptyStream`, `DetectLastRow`. Sau đó B2 theo inventory. Chỉ đánh dấu hoàn tất khi có review + tests; không tính việc tìm thấy class là XML evidence.


## Ghi chú source reviewer cho gói 2 (đã đọc sơ bộ)

- FilesFromResult không có config plugin riêng; runtime xuất ResultFile.getRow, gồm type, filename (basename), path (URI), parentorigin, origin, comment, timestamp. Theo helper thay vì đoán schema.
- FilesToResult có filename_field và file_type; buffer ResultFile rồi đăng ký khi input hết, vẫn truyền row đầu vào. ResultFile.getTypeCode/getType quy định code/fallback.
- ADD_RESULT_FILENAMES: fields/field/name+filemask; arg_from_previous đọc cột 0/1 của previous result rows; delete_all_before chỉ clear result map.
- DELETE_RESULT_FILENAMES: specify_wildcard=N clear map; Y xét file.exists trước khi remove entry theo regex basename, không delete file vật lý.
- COPY_MOVE_RESULT_FILENAMES: action copy/move/delete; các tag hỗn hợp chữ hoa như SpecifyFormat, AddDateBeforeExtension phải giữ nguyên. RemovedSourceFilename/AddDestinationFilename mặc định constructor true, nhưng tag thiếu load thành false. foldername được serialize nhưng runtime dùng destination_folder.
- Cẩn thận success_condition của copy/move: source chỉ khai báo/reset NrSuccess, không thấy increment; getSuccessStatus dùng NrSuccess>=limitFiles. errors_less final dùng <= nhưng early-stop dùng >=. Không mô tả các mode này theo tên UI mà bỏ khác biệt source; không sửa code Java trong scope này.

### Checkpoint test-first gói 2

- Source commit được primary xác nhận bằng git rev-parse; source checkout clean.
- 9 test RED do missing catalog/reference; log `%TEMP%/pentaho-b1-package2-red.log`.
- Primary sửa lỗi test: đọc `reparsed.job.entries.entry` thay vì `reparsed.job.entry`; order assertion nhận cả self-closing và paired tags. Hai sửa này không thay expected cấu hình domain.
- DELETE_RESULT_FILENAMES thật sự serialize/load foldername; nhận xét ban đầu của reviewer đọc thiếu dòng đã được rút lại sau khi đọc lại toàn method. Không bỏ tag này.
- Cần agent sửa source notes: success_when_at_least không được quảng cáo đếm đúng file thành công vì source NrSuccess không increment; đọc ghi chú reviewer phía trên.

### Review đang mở trong lúc implement

Primary đã tạo `docs/inventory/2026-09-15-b1-package2-review.md` (F1–F5). Chờ writer implement kết thúc rồi đối chiếu trạng thái mới nhất; có thể agent tự sửa một số findings trong bước self-review. Chỉ gửi những gì còn cần sửa qua runner phase fix, cùng session hiện có. Chưa nghiệm thu gói 2 dù các file reference đã xuất hiện.
