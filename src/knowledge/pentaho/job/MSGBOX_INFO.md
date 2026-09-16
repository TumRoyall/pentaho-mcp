# MSGBOX_INFO — Job entry hiện hộp thoại thông tin

Entry hiển thị hộp thoại (`threadMessageBox(...INFO)` với title +
body, substitute `${VAR}` qua `getReal*`): `evaluates() = true`, không
unconditional. Headless (`dialogs==null`) → mặc định `response=true`
(pass). Hai tag `<bodymessage>` (trước) + `<titremessage>` (sau);
constructor null nhưng getter null-safe (`""` khi null) nên load thiếu
tag an toàn — template vẫn emit rỗng để khớp order.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MSGBOX_INFO</type>
      <attributes/>
      <bodymessage>${INFO_BODY}</bodymessage>
      <titremessage>${INFO_TITLE}</titremessage>
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
| `<bodymessage>` | N | Nội dung hộp thoại (trước title theo thứ tự emit); cho phép `${VAR}`. Null-safe (thiếu → `""`). |
| `<titremessage>` | N | Tiêu đề hộp thoại (giữ đúng `titre` tiếng Pháp); cho phép `${VAR}`. Null-safe. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MSGBOX_INFO` | `<type>` | `MSGBOX_INFO`. |
| `configuration.body` | `<bodymessage>` | Cho phép `${VAR}`. |
| `configuration.title` | `<titremessage>` | Giữ đúng `titremessage`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 25 —
  `id="MSGBOX_INFO"` →
  `org.pentaho.di.job.entries.msgboxinfo.JobEntryMsgBoxInfo` (không có
  `@JobEntry`). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryMsgBoxInfo.getXML()` (dòng 75–83) —
  `super.getXML()` + `bodymessage` (string) rồi `titremessage` (string):
  body TRƯỚC title.
- Deserialization: `loadXML()` (dòng 85–94) — cả hai `getTagValue`
  (thiếu → null). `loadRep`/`saveRep` (dòng 96–118) cùng keys.
- Khởi tạo: KHÔNG có `setDefault`. Constructor (dòng 60–64): cả hai
  `=null`; nhưng getter null-safe — `getTitleMessage` (dòng 181–186),
  `getBodyMessage` (dòng 188–194) trả `""` khi null; `getReal*` (dòng
  173–179) có `environmentSubstitute`.
- Wrapper: `JobEntryCopy.getXML()` (`engine/.../job/entry/JobEntryCopy.java`
  dòng 102–119) + `JobEntryBase.getXML()` (dòng 415–424) — template trên
  là một `<entry>` đầy đủ.
- Ngữ nghĩa runtime: `evaluates()=true` (dòng 165),
  `isUnconditional()=false` (dòng 170),
  `resetErrorsBeforeExecution()=false` (dòng 159). `evaluate()` (dòng
  123–144) hiện qua `GUIFactory.getThreadDialogs().threadMessageBox(...
  INFO)`; headless (`dialogs==null`) → `response=true` mặc định.
  `execute()` (dòng 154–157) gán result.
- Không có `<connection>`: entry không tham chiếu DB — template không mang
  tag này.

Cấu hình không mặc định (thông báo kết thúc ETL):

```xml
<bodymessage>ETL nightly finished with ${ERRORS} errors.</bodymessage>
<titremessage>Nightly ETL — ${TODAY}</titremessage>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Giữ đúng `titremessage`** (`titre` Pháp) — viết `titlemessage` là sai
  tag, load → null (nhưng null-safe nên lặng lẽ thành `""`).
- **Headless luôn pass**: chạy Kitchen/pan không GUI thì entry này luôn
  true — đừng dùng làm cổng dừng.
- **Thứ tự body trước title** — giữ đúng order khi assert.
- Template mặc định là khung — người dùng điền nội dung hiển thị (qua
  biến khi cần).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
