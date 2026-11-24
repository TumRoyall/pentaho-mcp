# pentaho-mcp {{VERSION}} — Hướng dẫn cài đặt (Windows x64)

MCP server cho Pentaho Kettle (`.kjb` / `.ktr`): đọc, sinh, sửa XML không làm vỡ định dạng, validate tĩnh, knowledge base Pentaho 9.4 nhúng sẵn, và (tùy chọn) chạy Kitchen/Pan cục bộ.

Bản này **tự chứa**: không cần cài Node.js, không cần `npm install`.

## Nội dung gói

| File | Vai trò |
| --- | --- |
| `pentaho-mcp.exe` | MCP server (stdio) |
| `doctor.ps1` | Kiểm tra cài đặt: handshake MCP, đủ 41 tool, dò PDI |
| `skills/developing-pentaho-jobs/` | Companion skill: quy trình 5 pha từ yêu cầu → job/trans đã validate |
| `VERSION` | Số phiên bản |
| `README.md` | File này |

## Yêu cầu

- Windows 10/11 x64, PowerShell 5.1 trở lên.
- Một trong các AI client: **Claude Code**, **Kiro**, **Codex**.
- Tùy chọn: Pentaho Data Integration (PDI) cục bộ — chỉ cần khi muốn chạy job/trans thật.

---

## Bước 1 — Kiểm tra file tải về

Đặt `pentaho-mcp-{{VERSION}}-win-x64.zip` và `checksums.sha256` cùng một thư mục, mở PowerShell tại đó:

```powershell
$zip      = 'pentaho-mcp-{{VERSION}}-win-x64.zip'
$expected = ((Get-Content checksums.sha256 -TotalCount 1) -split '\s+')[0].ToLower()
$actual   = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum mismatch: $actual" } else { 'checksum OK' }
```

## Bước 2 — Giải nén vào thư mục cố định

Các client trỏ thẳng vào `.exe`, nên chọn thư mục ổn định (hướng dẫn này dùng `C:\Tools\pentaho-mcp`):

```powershell
Expand-Archive $zip -DestinationPath C:\Tools\pentaho-mcp -Force
Get-ChildItem C:\Tools\pentaho-mcp -Recurse | Unblock-File   # tránh SmartScreen/AV chặn file tải từ Internet
```

## Bước 3 — Chạy kiểm tra

```powershell
powershell -ExecutionPolicy Bypass -File C:\Tools\pentaho-mcp\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

Kết quả mong đợi: dòng cuối `doctor: OK`. Không dùng PDI thì bỏ `-PentahoHome` — thiếu PDI không làm fail.

---

## Bước 4 — Đăng ký vào AI client

Quy ước chung cho mọi client:

- Lệnh chạy: `C:/Tools/pentaho-mcp/pentaho-mcp.exe`, không có tham số.
- Biến môi trường (đều tùy chọn):
  - `PENTAHO_HOME` — thư mục PDI chứa `Kitchen.bat` / `Pan.bat`.
  - `PENTAHO_ENABLE_EXECUTE=1` — **chỉ** đặt khi muốn cho phép chạy Kitchen/Pan thật.
- Không có biến nào chọn thư mục làm việc: server làm việc trong **thư mục bạn mở client** (xem "Thư mục làm việc" bên dưới).

### Claude Code

Cách khuyến nghị — đăng ký một lần cho mọi project (scope `user`):

```powershell
claude mcp add --scope user --transport stdio pentaho-mcp `
  -e PENTAHO_HOME=C:/Pentaho/data-integration `
  -- C:/Tools/pentaho-mcp/pentaho-mcp.exe
```

- Mọi option phải đứng **trước** `--`; sau `--` là lệnh chạy server.
- Không dùng PDI: bỏ dòng `-e PENTAHO_HOME=...`.

Kiểm tra:

```powershell
claude mcp list            # pentaho-mcp phải hiện ✓ Connected
claude mcp get pentaho-mcp
```

Chia sẻ cho cả team qua git thay vì cài từng máy: tạo `.mcp.json` ở **thư mục gốc project Pentaho** (mọi máy phải giải nén `.exe` cùng đường dẫn):

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "type": "stdio",
      "command": "C:/Tools/pentaho-mcp/pentaho-mcp.exe",
      "args": [],
      "env": {
        "PENTAHO_HOME": "${PENTAHO_HOME:-C:/Pentaho/data-integration}"
      }
    }
  }
}
```

Lần đầu mở project, Claude Code hỏi phê duyệt server trong `.mcp.json` (đặt lại: `claude mcp reset-project-choices`).

Gỡ: `claude mcp remove pentaho-mcp --scope user`.

### Kiro

Tạo/sửa `%USERPROFILE%\.kiro\settings\mcp.json` (mọi workspace) hoặc `.kiro\settings\mcp.json` trong project (một workspace):

```json
{
  "mcpServers": {
    "pentaho-mcp": {
      "command": "C:/Tools/pentaho-mcp/pentaho-mcp.exe",
      "args": [],
      "env": {
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Nếu file đã có server khác, chỉ thêm khối `"pentaho-mcp": { ... }` vào trong `mcpServers`. Lưu file, rồi reconnect `pentaho-mcp` trong panel **MCP Servers** của Kiro.

Gỡ: xóa khối `pentaho-mcp` khỏi `mcp.json`.

### Codex

Thêm vào `%USERPROFILE%\.codex\config.toml` (mọi project) hoặc `.codex\config.toml` trong project:

```toml
[mcp_servers.pentaho-mcp]
command = "C:/Tools/pentaho-mcp/pentaho-mcp.exe"
args = []

[mcp_servers.pentaho-mcp.env]
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

Kiểm tra: `codex mcp list`, hoặc gõ `/mcp` trong Codex. Dùng Codex trong IDE extension thì restart extension sau khi sửa.

Gỡ: xóa hai bảng `[mcp_servers.pentaho-mcp]` và `[mcp_servers.pentaho-mcp.env]`.

---

## Bước 5 — Cài companion skill (khuyến nghị)

Skill hướng dẫn AI đi theo quy trình 5 pha (yêu cầu → spec → plan → sinh XML → validate). Copy thư mục `skills\developing-pentaho-jobs` vào thư mục skills của client:

| Client | Mọi project (user) | Một project |
| --- | --- | --- |
| Claude Code | `%USERPROFILE%\.claude\skills\` | `.claude\skills\` |
| Kiro | `%USERPROFILE%\.kiro\skills\` | `.kiro\skills\` |
| Codex | `%USERPROFILE%\.agents\skills\` | `.agents\skills\` |

Ví dụ cho Claude Code (đổi `.claude` thành `.kiro` hoặc `.agents` cho client khác):

```powershell
$skills = "$env:USERPROFILE\.claude\skills"
New-Item -ItemType Directory -Force $skills | Out-Null
Copy-Item -Recurse -Force C:\Tools\pentaho-mcp\skills\developing-pentaho-jobs $skills
```

## Bước 6 — Thử dùng

Mở client trong thư mục chứa file `.kjb` / `.ktr`, rồi yêu cầu AI, ví dụ: *"gọi kettle_list và tóm tắt các job trong thư mục này"*. AI phải liệt kê đúng file của thư mục bạn đang mở.

---

## Thư mục làm việc (workspace)

Server làm việc trong **thư mục bạn mở client** (Claude Code: thư mục chạy `claude`). Các File Repository đã đăng ký trong Spoon (`%USERPROFILE%\.kettle\repositories.xml`) chỉ dùng để nhận biết thư mục đó có phải repository không:

| Bạn mở client ở… | Chế độ | XML được sinh |
| --- | --- | --- |
| Thư mục repository, hoặc thư mục con của nó | Repository | `<directory>/batch/daily/job</directory>`; job gọi trans bằng tên repo (`rep_name`) |
| Thư mục cha chứa đúng một repository | Repository (root = repository đó) | như trên |
| Thư mục bình thường | File | `<directory>/</directory>`; job gọi trans bằng `<filename>` đường dẫn tuyệt đối |

Repository đăng ký ở chỗ khác không ảnh hưởng thư mục bạn đang mở. Mọi thao tác ghi file đều bị giới hạn trong thư mục làm việc.

## An toàn khi chạy job/trans thật

Kitchen/Pan chỉ chạy khi có **đủ cả hai**: `PENTAHO_ENABLE_EXECUTE=1` trong cấu hình client **và** bạn xác nhận từng lần chạy. Mặc định chỉ đọc/sửa/validate, không chạy gì. Server không bao giờ commit hay push git.

## Nâng cấp

1. Tải ZIP phiên bản mới, làm lại Bước 1–3 vào **cùng** thư mục `C:\Tools\pentaho-mcp`.
2. Nếu `Expand-Archive` báo `Access to the path ... pentaho-mcp.exe is denied`, client vẫn đang chạy server. Đóng client, hoặc đổi tên file đang chạy (Windows cho phép đổi tên file đang chạy) rồi giải nén lại:

   ```powershell
   Move-Item C:\Tools\pentaho-mcp\pentaho-mcp.exe "C:\Tools\pentaho-mcp\pentaho-mcp.exe.old-$(Get-Date -Format yyyyMMddHHmmss)"
   ```

3. Restart/reconnect client (đường dẫn không đổi nên không phải sửa cấu hình), copy lại skill (Bước 5), rồi dọn các file `.old-*` không còn bị giữ:

   ```powershell
   Get-ChildItem C:\Tools\pentaho-mcp -Filter 'pentaho-mcp.exe.old*' | Remove-Item -ErrorAction SilentlyContinue
   ```

## Gỡ cài đặt

1. Gỡ server khỏi client (xem mục "Gỡ" của từng client ở Bước 4).
2. Xóa thư mục skill đã copy.
3. Xóa `C:\Tools\pentaho-mcp`.

## Sự cố thường gặp

| Triệu chứng | Cách xử lý |
| --- | --- |
| `doctor.ps1` báo FAIL handshake | File bị chặn: chạy lại `Unblock-File` (Bước 2), kiểm tra antivirus |
| Client không thấy server / báo lỗi kết nối | Kiểm tra đường dẫn `C:/Tools/pentaho-mcp/pentaho-mcp.exe` trong cấu hình, rồi reconnect/restart client |
| AI liệt kê file của thư mục khác | Mở client đúng thư mục project. Nếu thư mục đang mở **chứa** một repository đã đăng ký trong Spoon, server làm việc trong repository đó — mở thẳng thư mục cần làm |
| Tool runtime báo không khả dụng | Đặt `PENTAHO_HOME` tới thư mục PDI chứa `Kitchen.bat` / `Pan.bat` |
| Chạy job báo `EXECUTE_DISABLED` | Thêm `PENTAHO_ENABLE_EXECUTE=1` vào cấu hình client (chỉ khi thật sự muốn chạy) |
