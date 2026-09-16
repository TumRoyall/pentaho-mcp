# Trung tâm tài liệu (Documentation Hub)

Chào mừng bạn đến với hệ thống tài liệu kỹ thuật của **Pentaho MCP Server** (`pentaho-mcp-server` / `kettle-mcp-dte`). Thư mục `docs/` chứa toàn bộ kiến trúc chi tiết, quy chuẩn thiết kế, hướng dẫn vận hành, danh mục công cụ và quy trình kiểm chứng hệ thống.

---

## 🗺️ Lộ trình đọc theo vai trò (Reading Paths)

Tùy theo nhu cầu tiếp cận, bạn có thể tham khảo các lộ trình gợi ý dưới đây:

### 1. Dành cho người dùng / Tích hợp AI Client (End User / Client Integrator)

Nếu bạn muốn cấu hình máy chủ MCP vào các AI Client (Claude Code, Cursor, Windsurf, Kiro, Codex) và bắt đầu làm việc với các file Kettle `.kjb`/`.ktr`:

1. [Hướng dẫn cài đặt (`install.md`)](install.md): Hướng dẫn kết nối file chạy `.exe` hoặc chế độ source vào client.
2. [Cấu hình môi trường (`configuration.md`)](configuration.md): Thiết lập `KETTLE_ROOT` và phát hiện workspace tự động.
3. [Playbook phát triển Pentaho 5 pha (`workflow-guide.md`)](workflow-guide.md): Quy trình chuẩn kết hợp AI reasoning (Superpowers/Skill) với các tool deterministic của MCP.
4. [Tra cứu 41 Tool MCP (`tools-reference.md`)](tools-reference.md): Danh mục chi tiết tham số, input schema và ví dụ của từng tool.

### 2. Dành cho ETL Developer & Kỹ sư Giải pháp (Solution Architect)

Nếu bạn muốn hiểu cách server phân tích, chỉnh sửa XML không mất mát và quản lý repository Kettle:

1. [Kiến trúc hệ thống (`architecture.md`)](architecture.md): Mô hình chỉnh sửa span-based, module map, luồng xử lý JSON-RPC và biên an toàn.
2. [Tra cứu 41 Tool MCP (`tools-reference.md`)](tools-reference.md): Bảng phân nhóm tính năng (Read, Edit, Artifact, Removal, Connections, Repository, Validate, Knowledge, Runtime).
3. [Bằng chứng kiểm chứng PDI 9.4 (`pdi94-evidence-report.md`)](pdi94-evidence-report.md): Báo cáo kiểm thử độ phủ tri thức và độ tương thích trên Pentaho Data Integration 9.4 thật.
4. [Bằng chứng kiểm chứng File Repository (`pdi94-repository-evidence.md`)](pdi94-repository-evidence.md): Kiểm chứng quản lý connection `.kdb` và Pentaho File Repository.

### 3. Dành cho Quản trị viên Vận hành / DevOps (Operator / SysAdmin)

Nếu bạn chịu trách nhiệm triển khai, giám sát an toàn và duy trì hoạt động của MCP server trong tổ chức:

1. [Hướng dẫn vận hành (`operations.md`)](operations.md): Triển khai, nâng cấp/rollback, kiểm tra sức khỏe bằng `doctor.ps1`, quản lý log và xử lý sự cố.
2. [Chính sách cấu hình & an toàn (`configuration.md`)](configuration.md): Cơ chế cô lập biên workspace (`canonical containment`), khử thông tin nhạy cảm và chính sách gating thực thi PDI (`PENTAHO_ENABLE_EXECUTE`).
3. [Hướng dẫn cài đặt môi trường hạn chế (`install.md#mạng-nội-bộ-hạn-chế-không-ra-npm`)](install.md#mạng-nội-bộ-hạn-chế-không-ra-npm): Triển khai server trong môi trường mạng nội bộ (air-gapped/offline).

### 4. Dành cho Lập trình viên đóng góp (Contributor / Maintainer)

Nếu bạn muốn mở rộng tính năng, bổ sung component vào catalog hoặc phát hành phiên bản:

1. [Hướng dẫn phát triển (`development.md`)](development.md): Setup môi trường, cấu trúc test suite, quy trình thêm tool factory và quy trình đóng gói SEA `.exe`.
2. [Bảng sự thật kỹ thuật (`documentation-facts.md`)](documentation-facts.md): Nguồn sự thật đối chiếu duy nhất giữa code, test và tài liệu.
3. [Hướng dẫn đóng góp (`../CONTRIBUTING.md`)](../CONTRIBUTING.md): Quy chuẩn viết code, format XML và checklist pull request.

---

## 📚 Danh mục tài liệu chi tiết

| Tập tin | Đối tượng | Mô tả nội dung chính |
|---------|-----------|----------------------|
| [`architecture.md`](architecture.md) | Architect, Dev | Kiến trúc chi tiết, nguyên tắc thiết kế ba trục, span-based XML engine, luồng xử lý MCP và chính sách biên. |
| [`configuration.md`](configuration.md) | Operator, Dev | Toàn bộ biến môi trường (`KETTLE_ROOT`, `PENTAHO_HOME`, `PENTAHO_ENABLE_EXECUTE`), biên an toàn và chính sách kiểm soát spawn tiến trình. |
| [`tools-reference.md`](tools-reference.md) | All | Danh mục đầy đủ 41 công cụ sản xuất, phân loại 8 nhóm, giải thích tham số, envelope phản hồi và ví dụ thực tế. |
| [`workflow-guide.md`](workflow-guide.md) | User, Agent | Playbook 5 pha phát triển Pentaho (BA -> Brainstorm -> Spec -> Plan -> Exec), hợp đồng đặc tả, cổng mutation kép và runtime phase-gated. |
| [`install.md`](install.md) | Operator, User | Hướng dẫn cài đặt thủ công bản `.exe` độc lập và bản mã nguồn cho các client AI phổ biến; triển khai mạng nội bộ. |
| [`operations.md`](operations.md) | Operator | Hướng dẫn vận hành, script chẩn đoán `doctor.ps1`, quản lý companion skill, dọn dẹp log và khắc phục sự cố. |
| [`development.md`](development.md) | Contributor | Setup môi trường lập trình, kiểm thử `node:test`, bổ sung step/job type mới vào knowledge base, đóng gói Windows release. |
| [`documentation-facts.md`](documentation-facts.md) | Reviewer, Maintainer | Bảng ánh xạ đối chiếu sự thật kỹ thuật (Single Source of Truth) giữa mã nguồn thực tế và toàn bộ tài liệu. |
| [`pdi94-evidence-report.md`](pdi94-evidence-report.md) | Reviewer, Architect | Báo cáo chi tiết về độ tương thích và kiểm chứng trên bộ testcase thực tế của Pentaho Data Integration 9.4. |
| [`pdi94-repository-evidence.md`](pdi94-repository-evidence.md) | Reviewer, Architect | Kết quả xác thực các tính năng quản lý Kettle File Repository và kết nối cơ sở dữ liệu (`.kdb`). |

---

## 🔑 Các khái niệm & Quy chuẩn cốt lõi

Khi đọc tài liệu và làm việc với codebase, cần lưu ý các quy chuẩn nền tảng sau:

- **Chỉnh sửa XML Span-Based (Lossless XML Editing)**:
  Server sử dụng `fast-xml-parser` kết hợp định vị byte span trong `src/core/span.js` để chỉ thay thế chính xác những byte cần chỉnh sửa. Giữ nguyên 100% định dạng ban đầu, thứ tự trường, ghi chú (comments), khoảng trắng và ký tự xuống dòng (CRLF/LF) của Pentaho Spoon.
- **Biên chứa chuẩn tắc (Canonical Workspace Containment)**:
  Mọi thao tác đọc/ghi file đều được bảo vệ bởi `src/workspace/boundary.js`. Tuyệt đối không cho phép truy cập file ngoài thư mục `KETTLE_ROOT` (tự động phát hiện hoặc chỉ định rõ). Mọi thủ thuật path traversal (`..`), sibling directory escape hay symlink/junction trỏ ra ngoài đều bị chặn đứng.
- **Tiếp cận Knowledge-First**:
  AI agent tuyệt đối không được tự suy đoán cấu trúc XML của step hoặc job entry. Trước khi thêm hoặc sửa bất kỳ thành phần nào, bắt buộc phải tra cứu cấu trúc chuẩn thông qua `kettle_knowledge_get`.
- **Cổng biến đổi kép (Dual Mutation Gate)**:
  Trong luồng phát triển, không có công cụ chỉnh sửa (`kettle_add_element`, `kettle_set_field`, v.v.) nào được phép chạy cho đến khi **cả** bản đặc tả (Specification) **và** kế hoạch triển khai (Plan) đã được người dùng/BA phê duyệt rõ ràng.
- **Thực thi Runtime phân pha (Phase-Gated Runtime)**:
  Các công cụ thực thi PDI (`Kitchen.bat` / `Pan.bat`) chỉ được kích hoạt sau khi đã vượt qua bước kiểm tra cấu trúc tĩnh (`kettle_validate` báo zero structural error), có cấu hình `PENTAHO_ENABLE_EXECUTE=1` từ phía server và được người dùng xác nhận (`confirmed: true`).
