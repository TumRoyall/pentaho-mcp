# FilesFromResult — Step đọc result files vào stream

Đọc các file mà transformation/job trước đã đặt vào result filenames
(`FilesToResult` ở chiều ngược lại) và phát mỗi file thành MỘT DÒNG THÔNG
TIN FILE (schema 7 field từ `ResultFile.getRow()` — xem bảng mục 2) ra
stream. Đây là row MÔ TẢ file (tên base, URI, nguồn gốc...), KHÔNG phải nội
dung file và KHÔNG phải result rows gốc. Step KHÔNG có cấu hình — thân
`<step>` là RỖNG (kế thừa `BaseStepMeta.getXML()` trả `""`). Không có input
stream — step này là điểm bắt đầu đọc kết quả đã lưu.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FilesFromResult</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
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
| (không có config riêng) | — | Step không có field cấu hình. Nó đọc toàn bộ result files từ previous result và phát ra stream |

Output schema do `getFields()` khai báo (không cấu hình, xem mục 4):

| Output field | Kiểu | Nguồn |
|---|---|---|
| `type` | String | Mô tả loại file (`ResultFile.getTypeDesc()`) |
| `filename` | String | Tên base của file |
| `path` | String | URI đầy đủ của file |
| `parentorigin` | String | Transformation/job đã sinh file |
| `origin` | String | Step/entry đã sinh file |
| `comment` | String | Ghi chú |
| `timestamp` | Date | Thời điểm ghi nhận |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILES_FROM_RESULT` | `<type>` | `FilesFromResult`. |
| (không ánh xạ) | — | Chỉ cần khai báo step, không có config |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (dòng 45, `<step
  id="FilesFromResult">`,
  `classname=org.pentaho.di.trans.steps.filesfromresult.FilesFromResultMeta`,
  category Job). Class không mang annotation `@Step`; registry XML là
  nguồn đăng ký duy nhất trong phạm vi source đã kiểm kê.
- Serialization: class KHÔNG override `getXML()` — kế thừa
  `BaseStepMeta.getXML()` trả `""`
  (`engine/src/main/java/org/pentaho/di/trans/step/BaseStepMeta.java` dòng
  200–202). `loadXML()` (dòng 64–66) gọi `readData()` rỗng (dòng 73–74).
  Phần thân step là RỖNG, không có node cấu hình nào — không bịa
  `<filename_field>`, `<file_type>` hay `<fields>`.
- Khởi tạo: `setDefault()` (dòng 76–77) rỗng.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment rỗng bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime — init lấy danh sách, processRow phát file-info rows:
  `FilesFromResult.init()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/filesfromresult/FilesFromResult.java`
  dòng 83–99) lấy `getTrans().getPreviousResult()` rồi giữ
  `data.resultFilesList` (null khi không có previous result).
  `processRow()` (dòng 57–81) lấy từng `ResultFile` theo `getLinesRead()`,
  gọi `resultFile.getRow()` ra `RowMetaAndData r`; lần đầu dựng
  `data.outputRowMeta = new RowMeta()` MỚI rồi `smi.getFields(...)` (schema
  7 field ở bảng mục 2 —
  `core/src/main/java/org/pentaho/di/core/ResultFile.java` dòng 247–272),
  sau đó `putRow(data.outputRowMeta, r.getData())` — row phát ra là THÔNG
  TIN FILE, không phải nội dung file, không phải result rows gốc, và
  row-meta được dựng mới qua `getFields()` chứ không tái dùng meta gốc.
  `check()` (Meta dòng 105–120) báo ERROR nếu step có input
  (`input.length > 0`) — step này không nhận input stream.

## 5. Lưu ý / bẫy

- **Không có input hop tới step này**: `check()` coi mọi input stream là
  lỗi. Đặt step ở đầu luồng đọc result, không nối hop vào.
- **Output là file-info rows, không phải nội dung file**: downstream chỉ thấy
  7 field mô tả (`type`, `filename` = basename, `path` = URI, `parentorigin`,
  `origin`, `comment`, `timestamp`). Muốn đọc NỘI DUNG file phải dùng step
  input file (ví dụ `TextFileInput`) với đường dẫn từ các field này.
- **Đừng nhầm với `FilesToResult`**: step này là chiều ĐỌC (result → stream);
  `FilesToResult` là chiều GHI (stream → result, có `filename_field` +
  `file_type`). Hai step KHÔNG chia sẻ node cấu hình nào.
- **Đừng copy node cấu hình từ step file khác** (ví dụ `<fields>` của
  `RowsFromResult`): `readData()` của step này đọc NOTHING — node lạ bị bỏ
  qua khi load, gây hiểu sai là đã cấu hình.
- Cặp đôi với `FilesToResult`: trans A `FilesToResult` → result, trans B
  `FilesFromResult` → stream. Dữ liệu result nằm trong memory của
  transformation cha/job.
- Template mặc định là khung cấu hình, chưa gắn với result files nghiệp
  vụ cụ thể.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()` (kế thừa, trả rỗng)/
  `loadXML()`/`setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
