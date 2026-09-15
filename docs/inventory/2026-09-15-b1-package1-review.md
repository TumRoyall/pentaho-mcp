# Review B1 gói 1 — R1–R3 đã sửa và kiểm tra lại

## Cập nhật sau sửa — 2026-09-15

OpenCode session `ses_f5cf313c9ffeojqRxxVNfSGgFk`, model `opencode/muse-spark-1.3-contributor-free`, đã sửa R1–R3 trong ba reference và thêm regression đọc XML ví dụ thứ hai. Primary Codex đối chiếu lại nội dung với source và chạy test độc lập:

- Nhóm knowledge: **35 pass, 0 fail**.
- Toàn suite `npm.cmd test`: **264 tests, 263 pass, 0 fail, 1 skipped**, exit 0.
- Reviewer chỉnh thêm một câu giới thiệu MappingInput để chỉ nói về sắp xếp field, và một lỗi khoảng trắng trong RowsFromResult; không đổi XML/test sau lần chạy trên.
- Không còn finding R1–R3 mở. Mức bằng chứng vẫn `source_reviewed`, không có Spoon/runtime verification mới.
- OpenCode chỉ được cấp cấu hình quyền cho process của lượt sửa, không lưu thay đổi quyền vào config chung. Agent không được chạy shell; test do primary reviewer chạy.

Phần dưới giữ lại findings và kết quả review ban đầu để truy vết.

Ngày: 2026-09-15. Phạm vi: RowsFromResult, MappingInput, MappingOutput; đối chiếu source PDI 9.4 tại commit `1a939ab5cabe4517867879684aeca2a526bcc638`.

## Kết luận

Ba template đầu tiên phù hợp cấu trúc serializer đã kiểm tra; catalog và test mới có mặt. Tuy nhiên phần hướng dẫn cấu hình/ngữ nghĩa có ba nhóm lỗi dưới đây. Vì knowledge được agent dùng để tạo ETL, cần sửa trước khi đánh dấu gói hoàn tất review. Review này chưa sửa implementation/reference.

## R1 — P1: MappingOutput nhầm tên step với field rename

**File:** `src/knowledge/pentaho/trans/MappingOutput.md:50`, ví dụ XML tại dòng 59.

`output_step` là tên step nhận dữ liệu ở transformation cha, không phải tên field trả về. Ví dụ hiện dùng `{{OUTPUT_FIELD}}` trong `output_step` và không có connector nên agent làm theo sẽ tạo tham chiếu step sai, không tạo rename field như mô tả.

**Source:** `engine/src/main/java/org/pentaho/di/trans/steps/mapping/MappingIODefinition.java`, constructor Node dòng 103–120 và getXML dòng 123–143: rename nằm trong `connector/parent` và `connector/child`. `Mapping.java::pickupTargetStepsFor` dùng `outputDefinition.getOutputStepname()` để tìm step bên cha. Đọc thêm chiều source/target của MappingValueRename và MappingOutputMeta.getFields trước khi viết ví dụ.

**Sửa:** tách cấu hình routing step khỏi field rename; ví dụ có step name đúng và connector đúng chiều. Kiểm tra cả XML ví dụ thứ hai bằng regression, không chỉ first fenced XML block. Trong `MappingInput.md:142` cũng đang nhầm field name với `output_step`: output_step của input mapping là tên MappingInput step con, không phải tên field.

## R2 — P2: MappingInput mô tả sai select_unspecified=N

**File:** `src/knowledge/pentaho/trans/MappingInput.md:56` và phần giới thiệu.

Tài liệu nói N chỉ truyền các field khai báo. `MappingInputMeta.getFields`, nhánh false, lại merge toàn bộ `inputRowMeta` rồi kiểm tra các field khai báo tồn tại. Cờ Y đưa field đã khai báo lên trước, thêm các field còn lại được sort theo tên; không phải công tắc loại bỏ field thừa. Phần source explanation trong cùng reference đã mô tả nhánh false đúng nhưng mâu thuẫn với bảng cấu hình.

**Sửa:** đồng bộ giới thiệu/bảng/bẫy theo source, nêu rõ không dùng N để loại cột. Ví dụ input `[b,a,c]`, khai báo `[a]`: N giữ toàn bộ theo nhánh merge; Y sắp `[a,b,c]` khi không có rename khác. Không viết test Node giả lập engine rồi coi là runtime verification.

## R3 — P2: RowsFromResult gán ý nghĩa runtime không có trong source

**File:** `src/knowledge/pentaho/trans/RowsFromResult.md:49`–61, 91, 130–135.

Reference mô tả đọc theo tên/thứ tự field khai báo, sai kiểu gây chuyển đổi, và -2 là lệnh giữ metadata gốc. Nhưng `RowsFromResult.java::processRow` dòng 55–72 lấy row từ previousResult, dùng trực tiếp `row.getRowMeta()` và `row.getData()` rồi putRow. Nó không chọn/đổi thứ tự/convert field theo cấu hình. `RowsFromResultMeta.getFields()` phục vụ metadata khai báo; -2 là fallback load, không chứng minh một nhánh runtime riêng để kế thừa precision/length.

Ngoài ra ValueMetaFactory.getIdForValueMeta dòng 149–151 dùng equalsIgnoreCase: khẳng định Integer và integer khác nhau khi load là sai. Có thể khuyến nghị canonical spelling mà serializer sinh ra.

**Sửa:** phân biệt metadata khai báo với row/meta runtime truyền nguyên từ previousResult; cảnh báo schema khai báo lệch có thể gây hiểu sai downstream, không tuyên bố step tự lookup/convert theo schema. Bỏ diễn giải sentinel không có bằng chứng.

## Kiểm chứng độc lập

- Chạy lại nhóm knowledge bằng `node --test --test-isolation=none test/knowledge-components.test.js test/knowledge.test.js test/knowledge-coverage.test.js test/knowledge-intake.test.js`: **34 pass**.
- Chạy toàn suite bằng `npm.cmd test` ngoài sandbox sau khi sandbox chặn spawn: **263 tests, 262 pass, 0 fail, 1 skipped**, exit 0.
- `npm.cmd` tránh PowerShell ExecutionPolicy của npm.ps1; không cần đổi ExecutionPolicy hệ thống.
- `git diff --check`: không báo lỗi whitespace trong tracked diff.
- Không chạy Spoon/Pan/Kitchen để xác minh ba component mới. Test pass không xác minh mọi câu trong knowledge Markdown.

## Việc tiếp theo

1. Agent sửa R1–R3, thêm regression cho XML ví dụ routing/rename và chạy lại tests. Không mở rộng scope component trong lượt sửa này.
2. Sau review lại đạt yêu cầu, nhận gói B1 tiếp theo: FilesFromResult, FilesToResult, ADD_RESULT_FILENAMES, DELETE_RESULT_FILENAMES, COPY_MOVE_RESULT_FILENAMES (5 ID cùng nhóm result files).
3. Gói cuối B1: Append, BlockingStep, DetectEmptyStream, DetectLastRow (4 ID).

Giữ các gap evidence report có sẵn được ghi rõ; không bịa evidence để lấp bảng.
