# Cài đặt

Cách cài chuẩn cho end user: **tải bản ZIP phát hành từ GitHub Releases → giải nén → trỏ AI client tới `pentaho-mcp.exe`**. Máy đích không cần Node.js, không cần `npm install`; knowledge base và companion skill đã nằm sẵn trong ZIP.

Biên workspace và cấu hình runtime tùy chọn xem `docs/configuration.md`; vận hành, nâng cấp xem `docs/operations.md`.

## Yêu cầu

- Windows 10/11 x64.
- PowerShell 5.1 trở lên (có sẵn trên Windows).
- Tùy chọn: Pentaho Data Integration (PDI) cục bộ, chỉ cần khi dùng 4 tool `kettle_runtime_*`.

## Bước 1 — Tải bản phát hành

Trang phát hành: <https://github.com/TumRoyall/pentaho-mcp/releases>

Mỗi phiên bản `vX.Y.Z` có hai file:

| File | Nội dung |
| --- | --- |
| `pentaho-mcp-X.Y.Z-win-x64.zip` | `pentaho-mcp.exe`, `doctor.ps1`, `README.md` (hướng dẫn cài cho Claude Code / Kiro / Codex — đọc được ngay sau khi giải nén), `VERSION`, `skills/developing-pentaho-jobs/` |
| `checksums.sha256` | SHA-256 của file ZIP |

Tải bằng trình duyệt, hoặc bằng PowerShell (đổi `$v` thành phiên bản muốn cài):

```powershell
$v    = '1.0.0'
$base = "https://github.com/TumRoyall/pentaho-mcp/releases/download/v$v"
$zip  = "pentaho-mcp-$v-win-x64.zip"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest "$base/$zip"              -OutFile $zip              -UseBasicParsing
Invoke-WebRequest "$base/checksums.sha256"  -OutFile checksums.sha256  -UseBasicParsing
```

## Bước 2 — Kiểm tra toàn vẹn

```powershell
$expected = ((Get-Content checksums.sha256 -TotalCount 1) -split '\s+')[0].ToLower()
$actual   = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum mismatch: $actual" } else { 'checksum OK' }
```

## Bước 3 — Giải nén và bỏ chặn

Giải nén ra một thư mục **cố định** (các client trỏ thẳng vào `.exe`; di chuyển/xóa thư mục này sẽ làm hỏng cấu hình):

```powershell
$dest = 'C:\Tools\pentaho-mcp'
Expand-Archive $zip -DestinationPath $dest -Force
Get-ChildItem $dest -Recurse | Unblock-File   # tránh SmartScreen/AV chặn file tải từ Internet
```

## Bước 4 — Kiểm tra bằng `doctor.ps1`

```powershell
powershell -ExecutionPolicy Bypass -File C:\Tools\pentaho-mcp\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

Kỳ vọng kết thúc bằng `doctor: OK` (handshake MCP, đúng 41 tool, không có tool `pentaho_*`). Bỏ `-PentahoHome` nếu không dùng PDI — thiếu PDI không làm fail.

## Bước 5 — Đăng ký vào AI client

Mọi client dùng chung một mô hình:

- `command`: `C:/Tools/pentaho-mcp/pentaho-mcp.exe` (dấu `/` để khỏi phải escape trong JSON/TOML).
- `args`: rỗng.
- `env`: chỉ `PENTAHO_HOME` (tùy chọn, cho runtime). Thêm `PENTAHO_ENABLE_EXECUTE=1` **chỉ khi** muốn cho phép thực thi Kitchen/Pan thật.
- **Không có biến nào đặt workspace root** — xem mục "Workspace root" bên dưới.

### Claude Code

Khuyến nghị dùng CLI với **scope `user`**: cài một lần, dùng được ở mọi project. Workspace root sẽ là thư mục bạn chạy `claude`.

```powershell
claude mcp add --scope user --transport stdio pentaho-mcp `
  -e PENTAHO_HOME=C:/Pentaho/data-integration `
  -- C:/Tools/pentaho-mcp/pentaho-mcp.exe
```

- Mọi option (`--scope`, `--transport`, `-e`) phải đứng **trước** `--`; sau `--` là lệnh chạy server.
- Muốn cho phép thực thi thật: thêm `-e PENTAHO_ENABLE_EXECUTE=1` (đặt trước `--`).
- Không dùng PDI: bỏ dòng `-e PENTAHO_HOME=...`.

Các scope của Claude Code:

| Scope | Lưu ở đâu | Khi nào dùng |
| --- | --- | --- |
| `local` (mặc định) | `~/.claude.json`, gắn với project hiện tại | Chỉ bật cho một project trên máy bạn |
| `user` | `~/.claude.json` | **Khuyến nghị** — dùng cho mọi project |
| `project` | `.mcp.json` ở project root (commit vào git) | Chia sẻ cho cả team — mọi máy phải giải nén `.exe` cùng đường dẫn |

Nếu muốn dùng `.mcp.json` (scope project), tạo file ở **root của project Pentaho** (không phải trong `.claude/`):

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

`.mcp.json` hỗ trợ `${VAR}` và `${VAR:-mặc định}`, nên mỗi máy có thể tự đặt `PENTAHO_HOME` riêng. Lần đầu mở project, Claude Code sẽ hỏi phê duyệt server trong `.mcp.json`; đặt lại lựa chọn bằng `claude mcp reset-project-choices`.

Kiểm tra:

```powershell
claude mcp list              # pentaho-mcp phải ở trạng thái ✓ Connected
claude mcp get pentaho-mcp
```

Trong phiên Claude Code: gõ `/mcp` để xem trạng thái, rồi nhờ Claude gọi `kettle_list` để xác nhận nó đang thấy đúng các file `.kjb`/`.ktr` của project. Gỡ: `claude mcp remove pentaho-mcp --scope user`.

### Kiro

File `.kiro/settings/mcp.json` (workspace) hoặc `%USERPROFILE%/.kiro/settings/mcp.json` (user):

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

Lưu file rồi reconnect `pentaho-mcp` trong MCP panel của Kiro.

### Codex

File `.codex/config.toml` (project) hoặc `%USERPROFILE%/.codex/config.toml` (user):

```toml
[mcp_servers.pentaho-mcp]
command = "C:/Tools/pentaho-mcp/pentaho-mcp.exe"
args = []

[mcp_servers.pentaho-mcp.env]
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

Kiểm tra bằng `codex mcp list` hoặc `/mcp` trong Codex TUI. Thêm qua MCP settings UI của IDE extension thì cần restart extension.

### Cursor / Windsurf

Cùng khối JSON `mcpServers` như Kiro (bỏ `disabled`/`autoApprove`), đặt trong `.cursor/mcp.json` (Cursor) hoặc `~/.codeium/windsurf/mcp_config.json` (Windsurf).

## Bước 6 — Cài companion skill (khuyến nghị)

Skill nằm trong ZIP tại `skills/developing-pentaho-jobs/`, nhưng client chỉ nhận khi copy vào thư mục skills của nó:

| Client | Project scope | User scope |
| --- | --- | --- |
| Claude Code | `.claude/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.claude/skills/developing-pentaho-jobs/` |
| Kiro | `.kiro/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.kiro/skills/developing-pentaho-jobs/` |
| Codex | `.agents/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.agents/skills/developing-pentaho-jobs/` |

Ví dụ Claude Code, user scope:

```powershell
$skills = "$env:USERPROFILE\.claude\skills"
New-Item -ItemType Directory -Force $skills | Out-Null
Copy-Item -Recurse -Force C:\Tools\pentaho-mcp\skills\developing-pentaho-jobs $skills
```

Đây là skill dẫn dắt workflow phát triển Pentaho năm pha (xem `docs/workflow-guide.md`).

## Workspace root

Root **đi theo thư mục bạn mở client** (với Claude Code: thư mục chạy `claude`). Không có biến môi trường nào chỉ định root. Các file repository đã đăng ký trong Spoon (`%USERPROFILE%/.kettle/repositories.xml`, `PENTAHO_HOME/repositories.xml`) chỉ dùng để biết thư mục đó có phải repository không:

| Bạn mở client ở… | Kết quả |
| --- | --- |
| Đúng thư mục repository, hoặc thư mục con của nó | Repository mode, root = thư mục repository |
| Thư mục cha chứa một repository (hoặc nhiều, có một repo mặc định) | Repository mode, root = repository đó |
| Thư mục bình thường, không liên quan repository nào | File mode, root = thư mục đó |
| Thư mục home / gốc ổ đĩa (client không đặt cwd) | Repository mặc định đã đăng ký |

Một repository đăng ký ở nơi khác **không** chiếm root của thư mục bạn đang mở. Muốn làm việc kiểu repository: đăng ký thư mục đó làm File Repository trong Spoon (hoặc nhờ Claude gọi `kettle_repository_register`), rồi mở client ở đúng thư mục đó.

Chế độ quyết định XML được sinh:

| | Repository mode | File mode |
| --- | --- | --- |
| Header `<directory>` của job/trans | Thư mục repo của file, ví dụ `/batch/daily/job` | `/` |
| Ref job → trans | `rep_name` + `<transname>` + `<directory>/batch/daily/trans</directory>` | `specification_method=filename` + `<filename>` đường dẫn tuyệt đối |

Khi khởi động, server in ra stderr: `pentaho-mcp running on stdio (root=<path>, mode=<mode>, source=<source>, match=<match>)`.

Biên luôn được enforce: đường tương đối resolve theo root; đường tuyệt đối chỉ hợp lệ khi nằm trong root; `..`, sibling-prefix và symlink/junction escape đều bị từ chối.

## An toàn thực thi

- Kitchen/Pan chỉ chạy khi **cả hai**: `PENTAHO_ENABLE_EXECUTE=1` trong `env` của client **và** lời gọi có `confirmed: true`.
- Server không bao giờ thay đổi Git (không commit/push/amend).

## Nâng cấp / gỡ bỏ

- **Nâng cấp:** làm lại Bước 1–4 với phiên bản mới vào cùng thư mục `C:\Tools\pentaho-mcp`, rồi restart/reconnect client. Nếu `Expand-Archive` báo `Access to the path ... pentaho-mcp.exe is denied` thì một client (ví dụ phiên Claude Code đang mở) vẫn đang chạy server: đóng client, hoặc đổi tên file đang chạy trước khi giải nén: `Move-Item C:\Tools\pentaho-mcp\pentaho-mcp.exe "C:\Tools\pentaho-mcp\pentaho-mcp.exe.old-$(Get-Date -Format yyyyMMddHHmmss)"` (tên kèm thời gian để không đụng file `.old` cũ vẫn đang bị giữ; sau khi restart client, xóa các file `.old-*` bằng `Get-ChildItem C:\Tools\pentaho-mcp -Filter 'pentaho-mcp.exe.old*' | Remove-Item -ErrorAction SilentlyContinue`). Đường dẫn trong cấu hình không đổi nên không cần sửa. Nhớ copy lại skill (Bước 6).
- **Gỡ bỏ:** xóa mục `pentaho-mcp` khỏi cấu hình client (`claude mcp remove pentaho-mcp --scope user` với Claude Code), xóa thư mục skill đã copy, rồi xóa `C:\Tools\pentaho-mcp`.

## Phụ lục A — Source mode (cho developer)

Yêu cầu Node.js 20+.

```powershell
git clone https://github.com/TumRoyall/pentaho-mcp.git
cd pentaho-mcp
npm install
npm test
npm run verify:profile
```

Đăng ký với client giống trên, chỉ khác lệnh chạy là `node` + đường dẫn tuyệt đối `src/index.js`. Ví dụ Claude Code:

```powershell
claude mcp add --scope user --transport stdio pentaho-mcp `
  -e PENTAHO_HOME=C:/Pentaho/data-integration `
  -- node C:/src/pentaho-mcp/src/index.js
```

Mạng nội bộ không ra được npm: cài `npm install` một lần ở máy có mạng rồi copy cả repo (gồm `node_modules`), hoặc trỏ registry nội bộ bằng `npm config set registry <url>`. Hai runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`.

## Phụ lục B — Phát hành phiên bản mới (maintainer)

Release được build và đăng tự động bởi `.github/workflows/release.yml` khi push tag:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Workflow chạy `npm test` + `npm run verify:profile`, build `pentaho-mcp-1.0.0-win-x64.zip` + `checksums.sha256`, rồi tạo GitHub Release `v1.0.0` đính kèm hai file đó. Build thủ công tại máy (Windows): `npm run build:release -- --version 1.0.0`, kết quả nằm trong `dist/`.
