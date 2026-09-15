# FilesToResult — Step đẩy filenames trong stream vào result

Đọc tên file từ một field trong stream và thêm từng file vào result
filenames của transformation, để job/transformation cha đọc tiếp qua
`FilesFromResult` (hoặc các entry `*_RESULT_FILENAMES`). Khối cấu hình chỉ có
đúng 2 tag theo thứ tự `filename_field`, `file_type` — step này là chiều GHI
(stream → result), ngược với `FilesFromResult` (không cấu hình).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FilesToResult</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename_field>{{FILENAME_FIELD}}</filename_field>
    <file_type>GENERAL</file_type>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<filename_field>` | Y | Tên field trong stream chứa tên file/đường dẫn cần đưa vào result. Mặc định (chưa cấu hình) serialize thành `<filename_field/>` (do `setDefault` gán null). |
| `<file_type>` | Y | Code loại file: `GENERAL`, `LOG`, `ERRORLINE`, `ERROR`, `WARNING` (do `ResultFile.getTypeCode()` sinh ra). Mặc định `GENERAL` (`setDefault` gán `FILE_TYPE_GENERAL`). Lúc load, code lạ/khuyết → im lặng thành `GENERAL` — kiểm tra chính tả, đừng trông chờ lỗi load. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILES_TO_RESULT` | `<type>` | `FilesToResult`. |
| `configuration.filename_field` | `<filename_field>` | Tên field chứa filename — THAM CHIẾU FIELD trong stream. |
| `configuration.file_type` | `<file_type>` | Một trong 5 code trên; mặc định `GENERAL`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (dòng 46, `<step
  id="FilesToResult">`,
  `classname=org.pentaho.di.trans.steps.filestoresult.FilesToResultMeta`,
  category Job). Class không mang annotation `@Step`.
- Serialization:
  `engine/src/main/java/org/pentaho/di/trans/steps/filestoresult/FilesToResultMeta.java
  :: getXML()` (dòng 109–116) — ghi đúng 2 tag theo thứ tự
  `filename_field` (qua `XMLHandler.addTagValue(String,String)` — null/rỗng
  thành self-closing), `file_type` (qua `ResultFile.getTypeCode(fileType)` —
  luôn ghi code, không bao giờ self-closing). Không có tag nào khác trong
  fragment.
- Enum code: `ResultFile.fileTypeCode = { GENERAL, LOG, ERRORLINE, ERROR,
  WARNING }`
  (`core/src/main/java/org/pentaho/di/core/ResultFile.java` dòng 45–51);
  `getTypeCode(int)` (dòng 212–214); `getType(String)` (dòng 194–205) khớp
  description HOẶC code, không khớp → `FILE_TYPE_GENERAL`.
- Deserialization: `loadXML()` (dòng 100–102) gọi `readData()` (dòng
  118–121) — `filename_field` đọc chuỗi (thiếu → null), `file_type` qua
  `ResultFile.getType()`.
- Khởi tạo: `setDefault()` (dòng 123–126) — `filenameField = null`,
  `fileType = FILE_TYPE_GENERAL`, khác với fallback load ở trên.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`. `getFields()` (dòng 138–141) là no-op — step không đổi row-meta.
- Ngữ nghĩa runtime (`FilesToResult.processRow()`,
  `engine/src/main/java/org/pentaho/di/trans/steps/filestoresult/FilesToResult.java`
  dòng 55–109): mỗi dòng input, step lấy chuỗi filename ở `filename_field`
  (dòng 85), buffer một `ResultFile(meta.getFileType(), ...)` vào
  `data.filenames` (dòng 87–93) — file chỉ được đăng ký vào result qua
  `addResultFile` khi `getRow()` trả null, tức input đã hết (dòng 60–69),
  rồi `putRow` truyền NGUYÊN dòng input xuống step tiếp theo (dòng 98–101).
  Step KHÔNG tạo/copy nội dung file — chỉ đăng ký tham chiếu file đã có.
  Field `filename_field` không tồn tại trong stream → `logError` +
  `setErrors(1)` + `stopAll()` (dòng 74–81), vì vậy `<filename_field>` là
  THAM CHIẾU FIELD bắt buộc phải khớp schema stream.
- Ngữ nghĩa input: `check()` (Meta dòng 143–158) báo ERROR khi KHÔNG có input
  — step này thu filename từ stream nên PHẢI có hop vào (ngược với
  `FilesFromResult`).

Cấu hình không mặc định (field chứa filename + code ERROR):

```xml
<filename_field>result_filename</filename_field>
<file_type>ERROR</file_type>
```

## 5. Lưu ý / bẫy

- **Phải có input hop**: step đọc `filename_field` từ từng dòng stream vào.
  Không nối hop vào là lỗi `check()` (khác với `FilesFromResult` cấm input).
- **`<filename_field>` là tham chiếu field**, không phải đường dẫn literal:
  điền tên field có trong stream (ví dụ field do `GetFileNames` sinh ra),
  không điền `${DIR}/file.csv` trực tiếp.
- **Code `file_type` sai chính tả không báo lỗi khi load** — `getType()`
  im lặng trả `GENERAL`. Chỉ dùng 5 code ở bảng mục 2, viết HOA đúng.
- `getFields()` là no-op: metadata stream đi qua không đổi; file được thêm
  vào result filenames chứ không thành field mới trong row.
- Template mặc định là khung cấu hình, chưa gắn với field/stream nghiệp
  vụ cụ thể — người dùng phải điền đúng tên field chứa filename.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
