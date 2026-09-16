# EVAL — Job entry chạy script JavaScript (Rhino)

Entry điều kiện (`evaluates() = true`, không unconditional): chạy
`<script>` (JavaScript, Rhino `cx.evaluateString`) với scope biến job
(`errors`, `lines_input/output/updated/rejected/read/written`,
`exit_status`, `files_retrieved`, `nr`, `is_windows`, `_entry_`,
`rows`, `parent_job`, `previous_result`); `Context.toBoolean(res)` thành
result, exception → `nrErrors=1`, false. `resetErrorsBeforeExecution()=
false`. Script giữ CDATA-escaped bởi XMLHandler — template viết script
không chứa `<`/`&` thô.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>EVAL</type>
      <attributes/>
      <script>true;</script>
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
| `<script>` | Y | Script JavaScript (Rhino). `check()` đòi notBlank. Viết tránh `<`/`&` thô (dùng `&lt;`/`&amp;` khi cần); CDATA do XMLHandler xử lý khi Spoon lưu. |

Scope biến dùng được trong script: `errors`, `lines_input`,
`lines_output`, `lines_updated`, `lines_rejected`, `lines_read`,
`lines_written`, `exit_status`, `files_retrieved`, `nr`, `is_windows`,
`_entry_` (entry hiện tại), `rows` (mảng), `parent_job`,
`previous_result`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EVAL` | `<type>` | `EVAL`. |
| `configuration.script` | `<script>` | Script JS, escape XML. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 17 —
  `id="EVAL"` → `org.pentaho.di.job.entries.eval.JobEntryEval` (không có
  `@JobEntry`). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `JobEntryEval.getXML()` (dòng 78–85) —
  `super.getXML()` + duy nhất `<script>` (string, CDATA-escaped bởi
  XMLHandler).
- Deserialization: `loadXML()` (dòng 87–95) —
  `script=getTagValue(entrynode,"script")` (thiếu → null).
  `loadRep`/`saveRep` (dòng 97–116) cùng key `script`.
- Khởi tạo: KHÔNG có `setDefault`. Constructor (dòng 64–71):
  `JobEntryEval("","")` → `script=""`.
- Wrapper: `JobEntryCopy.getXML()` (`engine/.../job/entry/JobEntryCopy.java`
  dòng 102–119) + `JobEntryBase.getXML()` (dòng 415–424) — template trên
  là một `<entry>` đầy đủ.
- Ngữ nghĩa runtime: `evaluates()=true` (dòng 219),
  `isUnconditional()=false` (dòng 224),
  `resetErrorsBeforeExecution()=false` (dòng 213). `evaluate()` (dòng
  137–198) chạy Rhino với scope biến kể ở mục 2; `Context.toBoolean(res)`;
  exception → `nrErrors=1`, false; success reset `nrErrors=0`.
  `execute()` (dòng 208–211) gán `prev_result.result=evaluate(...)`.
  `check()` (dòng 227–230) đòi script notBlank.
- Không có `<connection>`: entry không tham chiếu DB — template không mang
  tag này.

Cấu hình không mặc định (nhánh theo số lỗi trước):

```xml
<script>previous_result.getNrErrors() == 0;</script>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Script null (tag thiếu) → fail-closed** (false): `evaluateString`
  ném → entry false — template luôn emit `<script>`.
- **Fail-closed, không fail-open**: exception trong script = nhánh false,
  không phải crash job — thiết kế điều kiện phải tính cả hai nhánh.
- **`resetErrorsBeforeExecution()=false`**: lỗi trước đó giữ nguyên —
  script phải tự reset nếu muốn đếm sạch.
- **Rhino JS, không phải Node**: không có `require`/`Promise`/`arrow`
  đầy đủ hiện đại — viết JS cổ điển (ES5).
- Template mặc định (`true;`) là khung — người dùng phải viết điều kiện
  nghiệp vụ; không chạy script lạ chưa review (RCE trong phạm vi job).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
