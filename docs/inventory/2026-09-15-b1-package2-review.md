# B1 gói 2 — review đang mở

Primary review source commit `1a939ab5cabe4517867879684aeca2a526bcc638`. Các findings dưới đây phải sửa trước nghiệm thu. Giữ XML structure đúng; không tạo Java runtime test giả.

## F1 — FilesFromResult: nhầm với RowsFromResult

`trans/FilesFromResult.md` mở đầu nói phát nguyên file/row-meta gốc; phần runtime nói dùng trực tiếp row.getRowMeta(). Source `FilesFromResult.java:57–81` gọi resultFile.getRow(), lần đầu tạo RowMeta mới rồi gọi smi.getFields, sau đó putRow(data.outputRowMeta, r.getData()). Không có row.getRowMeta() tại đây. Đây là row thông tin về file, KHÔNG phải nội dung file và KHÔNG phải result rows gốc. Sửa intro/runtime và source-notes cho đúng. Schema 7 field hiện ghi đúng; path là URI, filename là basename. Đọc init để mô tả việc lấy result-files list từ previousResult.

## F2 — FilesToResult: thiếu thời điểm ghi result

`trans/FilesToResult.md` nên bổ sung `FilesToResult.java::processRow`: mỗi row tạo ResultFile và buffer trong data.filenames; chỉ khi getRow()==null mới lặp addResultFile. Row đầu vào vẫn được truyền downstream, không tạo/copy nội dung file. Thiếu filename_field trong schema khiến setErrors/stopAll; nêu rõ field reference và thời điểm registration. Source-review phải gồm runtime class, không chỉ Meta.getFields/check.

## F3 — DELETE_RESULT_FILENAMES: không xóa đĩa không có nghĩa không I/O

Reference nói không có thao tác đĩa nào và wildcard chỉ dựa regex. Source execute kiểm `file != null && file.exists()` trong nhánh Y trước khi remove map. Nhánh Y có kiểm tra tồn tại qua VFS, entry trỏ file không tồn tại được giữ lại; nhánh N clear map không cần exists. Sửa mô tả và bẫy, không gọi đây là không I/O. Wildcard include rỗng hợp lệ (include default true), không bắt buộc khi bật cờ. `foldername` có serialize/load nhưng không dùng lọc; để `<foldername/>` trong template thay vì tạo biến RESULT_FOLDER không cần thiết, không gán ý nghĩa “ngữ cảnh” không có source.

## F4 — COPY_MOVE_RESULT_FILENAMES: success/counter semantics sai

Reference nói đạt ngưỡng lỗi bằng limit là fail, và NrSuccess đếm số file xử lý thành công. Source hiện tại không chứng minh hai điều này:

- Toàn file chỉ khai báo và reset NrSuccess=0, không increment; `getSuccessStatus()` dùng NrSuccess>=limitFiles. Không quảng cáo success_when_at_least đếm thành công đúng; ghi hạn chế source và khuyên dùng success_if_no_errors nếu cần chế độ đáng tin cậy trước khi có runtime evidence.
- Early stop dùng NrErrors>=limitFiles và ném/catch ở vòng lặp tiếp theo, nhưng sau catch vẫn gọi getSuccessStatus với NrErrors<=limitFiles rồi có thể setResult(true). Vì vậy không kết luận “bằng limit là fail”. Mô tả chính xác hai phép so và khả năng dừng sớm nhưng kết quả cuối vẫn true khi bằng ngưỡng.
- OverwriteFile=N và đích tồn tại thì processFile trả true mà không copy/move, nhưng không tăng NrSuccess; nói rõ bỏ qua, không nói đếm thành công.
- RemovedSourceFilename/AddDestinationFilename áp dụng nhánh copy/move khi thực sự xử lý. Nhánh delete gỡ result khi delete thành công, không phụ thuộc hai cờ này. Constructor true nhưng load thiếu tag thành false: ghi cụ thể trong bảng.
- `foldername` không chọn nguồn; source là result files. Để `<foldername/>` thay biến SOURCE_FOLDER không dùng. Giữ đầy đủ tag đúng serializer.
- Cập nhật source-notes cùng reference, bỏ câu “thực chất đếm file xử lý thành công”. Đọc ghi chú reviewer trong PDI94-HANDOFF.md.

## F5 — ADD_RESULT_FILENAMES: phân biệt nguồn rows và files

Intro “thêm file/thư mục vào result” dễ hiểu nhầm đưa directory vào result: thực tế nêu directory để quét và thêm file con. Ghi rõ chỉ đăng ký file, không directory. `delete_all_before` chỉ clear result map, không xóa file. `argFromPrevious && rows != null` dùng result rows; else-if arguments!=null có thể fallback static khi rows null. Không khẳng định vô điều kiện Y luôn bỏ qua static; nếu rows rỗng nhưng không null thì không fallback. Source `execute/processFile/TextFileSelector` là chuẩn.

## Regression và phạm vi

- Primary đã sửa test path `reparsed.job.entries.entry` và order regex nhận self-closing. Giữ hai sửa đó.
- Tăng assertions cho default boolean của COPY_MOVE_RESULT_FILENAMES (RemovedSourceFilename/AddDestinationFilename Y, các cờ constructor false là N) nếu chưa có; nhằm chống template đổi semantics mặc định.
- Không sửa EVIDENCE_BACKED_TYPES trong test/knowledge.test.js: file này ngoài allowlist, batch test riêng đã kiểm eligibility. Không cần cấp thêm quyền cho assertion trùng lặp.
- Chỉ sửa trong allowlist hiện có, không đổi catalog eligibility chỉ để lách test. Không sửa Java. Primary chạy targeted/full suite sau khi bạn báo xong.
