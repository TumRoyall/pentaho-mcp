# Cấu hình

Tài liệu schema cho operator và maintainer. Nguồn sự thật: `src/workspace/resolve-root.js`, `src/workspace/boundary.js`, `src/server.js`, `src/runtime/detect.js`, `src/runtime/policy.js`, `src/tools/runtime.tools.js`.

## Dò root tự động và biên workspace

- Root là scope chia sẻ cho read/edit/validate/coverage. Root được **dò tự động** bởi `src/workspace/resolve-root.js` (`resolveWorkspaceRoot()`); **không có biến môi trường nào chỉ định root**. Thứ tự:
  1. Thư mục mở client (cwd) **là hoặc nằm trong** `base_directory` của một file repository đã đăng ký → chế độ repository, root = `base_directory` đó (repo sâu nhất thắng), match `cwd_inside_repository`.
  2. cwd **chứa** đúng một repository đã đăng ký (hoặc nhiều repo, trong đó có một repo mặc định) → chế độ repository, root = repo đó, match `repository_inside_cwd`.
  3. cwd là thư mục khởi chạy chứ không phải project (thư mục home, gốc ổ đĩa, thư mục Windows) → repository mặc định đã đăng ký (không có thì repo đầu tiên), match `fallback_default`.
  4. Còn lại → chế độ file, root = cwd, source `cwd`.
- "Đã đăng ký" = file repository khai báo trong `%USERPROFILE%/.kettle/repositories.xml` (source `kettle_home`) hoặc `PENTAHO_HOME/repositories.xml` (source `pentaho_home`) có `base_directory` tồn tại. Repo database (không có `base_directory`) bị bỏ qua. `is_default` nhận cả `true` (Spoon 9.x) lẫn `Y`.
- Một repository đăng ký **ở nơi khác** không bao giờ chiếm root của thư mục bạn đang mở; `repositories.xml` chỉ dùng để biết thư mục đang mở có phải repository hay không.
- Chế độ quyết định XML được sinh: repository mode → header `<directory>` = thư mục repo của file (ví dụ `/batch/daily/job`), ref job→trans dùng `rep_name` + `<directory>`; file mode → `<directory>/</directory>`, ref dùng `specification_method=filename` + đường dẫn tuyệt đối.
- Chính sách chứa (canonical containment) do `src/workspace/boundary.js` (`createWorkspaceBoundary`) sở hữu và dùng chung cho mọi factory tool. Biên **luôn được enforce** — không có chế độ tắt biên.
- Đường tương đối resolve theo root. Đường **tuyệt đối chỉ hợp lệ khi nằm trong root**.
- Từ chối mọi đường thoát root: `..`, sibling-prefix (ví dụ `C:\ws-other` khi root là `C:\ws`), và symlink/junction escape. So sánh containment không phân biệt hoa/thường trên Windows; ancestor đã tồn tại được canonical hóa trước khi so.
- Log khởi động in ra stderr: `pentaho-mcp running on stdio (root=<path>, mode=<mode>, source=<source>, match=<match>)`.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `PENTAHO_HOME` | Hai vai trò: bước 2 của dò root (đọc `repositories.xml` bên trong), và `detectPdi` (`src/runtime/detect.js`) định vị `Kitchen.bat`/`Pan.bat` cho 4 tool `kettle_runtime_*` tùy chọn. Unset → runtime không khả dụng, mọi tool tĩnh vẫn chạy. | không đặt |
| `PENTAHO_REPOSITORY_NAME` | Ghi đè tên repository tùy chọn (`src/server.js`, `src/repository/registration.js`). Không đặt → dùng tên repository dò được từ `repositories.xml`. | tên dò từ `repositories.xml` |
| `PENTAHO_ENABLE_EXECUTE` | Cổng opt-in phía server cho thực thi. **Chỉ giá trị đúng `1` mới bật**; mọi giá trị khác (kể cả `true`, `0`, unset) đều tắt. | không đặt (tắt) |
| `KETTLE_KNOWLEDGE_DIR` | Ghi đè knowledge base nhúng để nhiều checkout chia sẻ một cây canonical. | `src/knowledge/pentaho` đóng gói |
| `USERPROFILE` / `HOME` | Do OS cung cấp, chỉ dùng cho bước 1 của dò root. Người dùng không tự đặt. | biến môi trường của OS |

Không còn file cấu hình YAML theo project, biến môi trường tên môi trường, hay biến ghi đè tên thư mục docs/jobs. Server không tự phát hiện, tạo hay đổi tên thư mục con của project.

## Runtime tùy chọn: một root, dùng chung biên

Bốn tool `kettle_runtime_*` dùng đúng root và biên đã dò như các tool tĩnh. Không có tham số chọn project riêng cho từng lời gọi (không còn tham số workspace-root hay requirement-folder theo lời gọi).

- `artifact` resolve theo root (tương đối, hoặc tuyệt đối nằm trong root); chỉ nhận `.kjb`/`.ktr`.
- `PENTAHO_HOME` là thiết lập vị trí PDI duy nhất. Bỏ trống → runtime báo không khả dụng, tool tĩnh vẫn chạy.
- Log đã khử được ghi lười (lazy) dưới `<root>/.pentaho-mcp/runtime-logs/`. Nên thêm `.pentaho-mcp/` vào `.gitignore` của project (MCP không tự sửa `.gitignore`).
- Sau mỗi lần chạy, thư mục log giữ **100 file `.log` mới nhất**; file cũ hơn bị xóa (retention theo số lượng).

## Chính sách thực thi: cần cả opt-in server và xác nhận từng lời gọi

Thực thi yêu cầu **hai lớp độc lập**: operator bật `PENTAHO_ENABLE_EXECUTE=1` ở môi trường server, và mỗi lời gọi phải khẳng định `confirmed: true`. `confirmed` chỉ là khẳng định của caller, không phải bằng chứng có người phê duyệt — vô nghĩa nếu thiếu opt-in phía server.

| Server (`PENTAHO_ENABLE_EXECUTE`) | Lời gọi | Kết quả |
|-----------------------------------|---------|---------|
| khác `1` (unset/`0`/`true`...) | bất kỳ | `EXECUTE_DISABLED` (không detect, không spawn) |
| `1` | không `confirmed` | `CONFIRM_REQUIRED` (không spawn) |
| `1` | `confirmed: true` | `ALLOW` |

`kettle_runtime_loadcheck` không cần opt-in/xác nhận thực thi nhưng vẫn validation tĩnh trước.

Nguồn: `src/runtime/policy.js` (`executionPolicy({confirmed, executeEnabled})`), cổng server ở `src/server.js` (`executeEnabled: process.env.PENTAHO_ENABLE_EXECUTE === '1'`). `loadcheck`/`execute` luôn validation tĩnh trước; `STATIC_VALIDATION_FAILED` khi có structural error.

## An toàn khi spawn và output bị chặn kích thước

- **Kiểm token Windows:** khi launcher là `.bat`/`.cmd`, mọi token (command, `/file:`, `/param:name=value`) bị từ chối nếu chứa CR, LF, NUL, `"`, `&`, `|`, `<`, `>`, `^`, `%`, hoặc `!` trước khi spawn. Khoảng trắng, dấu phẩy, dấu hai chấm ổ đĩa, dấu phân tách đường dẫn, `=`, dấu chấm, gạch nối, gạch dưới vẫn hợp lệ. Tên tham số phải khớp `^[A-Za-z_][A-Za-z0-9_.-]*$`. Nguồn: `src/runtime/windows-args.js`.
- **Output có chặn:** stdout/stderr dùng tail buffer cố định **256 KiB mỗi luồng** ngay khi dữ liệu đến (không bao giờ tích lũy chuỗi không giới hạn rồi mới cắt). Phần được giữ là phần **đuôi** (mới nhất). Nguồn: `src/runtime/tail-buffer.js`.
- **Timeout theo cây tiến trình:** khi hết `timeoutMs`, trên Windows chạy `taskkill.exe /PID <pid> /T /F` (`shell:false`) để hạ cả cây tiến trình JVM; trên nền tảng khác gửi `SIGTERM`, chờ ân hạn ngắn rồi `SIGKILL`. Kết quả trả `TIMEOUT`. Nguồn: `src/runtime/run.js`.
- **Đọc log có chặn:** `kettle_runtime_logs` nhận `name` (tùy chọn) và `limit` (1..100), trả **mới nhất trước**, tối đa **256 KiB mỗi file**, kiểm chứa canonical cho từng file (từ chối tên thoát khỏi thư mục log).

## Discovery PDI tùy chọn

- `PENTAHO_HOME` unset → `detectPdi` trả `{available: false, reason: PENTAHO_HOME is not configured}`.
- Home không tồn tại → throw `Configured PDI home not found`.
- Resolve `Kitchen.bat`/`Pan.bat` dưới home; ngoài home → throw; thiếu một trong hai → `available: false`. Sau kiểm tồn tại, launcher được canonical hóa bằng `realpathSync` và kiểm lại vẫn nằm trong home canonical (chống symlink/junction thoát ra ngoài).
- Không có PDI vẫn dùng được đầy đủ read/edit/validate/knowledge; `runPdi` trả `UNAVAILABLE` thay vì fail toàn cục.

## Mô hình đăng ký client dùng chung

Mọi client đều dùng chung mô hình command/args/env cho server `pentaho-mcp`:

- `command` là đường dẫn tuyệt đối `pentaho-mcp.exe` (bản packaged) hoặc `node` (source-mode).
- `args` rỗng cho bản packaged, hoặc một phần tử là đường dẫn tuyệt đối `src/index.js` cho source-mode.
- `env` chỉ chứa những biến thật sự được đọc: `PENTAHO_HOME` là biến duy nhất một bản cài bình thường cần; `PENTAHO_REPOSITORY_NAME` và `PENTAHO_ENABLE_EXECUTE` là tùy chọn. **Không có biến nào đặt root** — root do dò tự động.

Ví dụ chính xác cho từng client xem `docs/install.md`: Kiro (`.kiro/settings/mcp.json`), Claude Code (`claude mcp add --scope user`, hoặc `.mcp.json` tại project root), Codex (`.codex/config.toml`).

Vì `env` không đặt được root, root đi theo thư mục bạn mở client (xem mục "Dò root tự động và biên workspace"). `PENTAHO_HOME` chỉ cần khi dùng nhóm runtime tùy chọn, hoặc khi muốn dò root qua `repositories.xml` trong thư mục PDI. `PENTAHO_ENABLE_EXECUTE` cũng tùy chọn: **chỉ đặt `"1"` khi muốn cho phép thực thi thật**; bỏ hẳn để chặn (`EXECUTE_DISABLED`).

## Lỗi biên thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| Đường ngoài root bị từ chối | Absolute ngoài root, `..`, sibling-prefix, hoặc symlink/junction escape | Đưa target vào trong root |
| Tuyệt đối bị từ chối | Đường tuyệt đối nhưng không nằm trong root | Dùng đường tương đối, hoặc tuyệt đối bên trong root |
| Dò nhầm project | Root lấy từ repository mặc định trong `repositories.xml`, không phải project đang mở | Khởi chạy client với project làm thư mục làm việc, hoặc đăng ký/sửa repository trong `%USERPROFILE%/.kettle/repositories.xml` |
| Runtime báo không khả dụng | `PENTAHO_HOME` chưa đặt hoặc trỏ sai | Đặt `PENTAHO_HOME` tới thư mục PDI chứa `Kitchen.bat`/`Pan.bat` |
