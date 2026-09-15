# DetectEmptyStream — Step phát một dòng rỗng khi stream rỗng

Nuốt toàn bộ dòng input (không `putRow` dòng nào đi tiếp); chỉ khi stream
vào RỖNG (không có dòng nào) mới phát ra ĐÚNG MỘT dòng — một empty row toàn
null sized theo fields của step trước. Step KHÔNG có cấu hình — thân
`<step>` là RỖNG (kế thừa `BaseStepMeta.getXML()` trả `""`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DetectEmptyStream</type>
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
| (không có config riêng) | — | Step không có field cấu hình. Nó quan sát stream vào và chỉ phát 1 empty row khi stream rỗng |

Output schema do runtime dựng (không cấu hình, xem mục 4): fields của step
trước (`getPrevStepFields`), toàn giá trị null.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DETECT_EMPTY_STREAM` | `<type>` | `DetectEmptyStream`. |
| (không ánh xạ) | — | Chỉ cần khai báo step, không có config |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (dòng 76, `<step
  id="DetectEmptyStream">`,
  `classname=org.pentaho.di.trans.steps.detectemptystream.DetectEmptyStreamMeta`,
  category Flow). Class không mang annotation `@Step`.
- Serialization: class KHÔNG override `getXML()` — kế thừa
  `BaseStepMeta.getXML()` trả `""`
  (`engine/src/main/java/org/pentaho/di/trans/step/BaseStepMeta.java` dòng
  200–202). `loadXML()` (dòng 59–61) gọi `readData()` rỗng (dòng 68–69).
  Phần thân step là RỖNG, không có node cấu hình nào — không bịa
  `<fields>`, `<head_name>`, `<resultfieldname>` hay tag cùng gói khác.
- Khởi tạo: `setDefault()` (dòng 71–72) rỗng.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment rỗng bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`DetectEmptyStream.processRow()`,
  `engine/src/main/java/org/pentaho/di/trans/steps/detectemptystream/DetectEmptyStream.java`
  dòng 64–90): dòng input bị NUỐT — nhánh `r != null` chỉ `return true`
  mà không `putRow` (dòng 85–89), downstream không nhận dòng gốc nào; chỉ
  khi `first && getRow() == null` (stream rỗng) mới phát ĐÚNG 1 dòng (dòng
  70–80). Dòng phát ra là empty row sized theo prev-step fields:
  `data.outputRowMeta = getTransMeta().getPrevStepFields(getStepMeta())`
  (dòng 72) + `buildOneRow()` allocate nulls theo `outputRowMeta.size()`
  (dòng 58–62).
- `check()` (Meta dòng 80–108) báo ERROR khi KHÔNG có input — step này quan
  sát stream vào nên PHẢI có hop vào.

## 5. Lưu ý / bẫy

- **Phải có input hop**: step quan sát stream vào; không nối hop vào là lỗi
  `check()`.
- **Dòng gốc không đi tiếp**: downstream của step này KHÔNG BAO GIỜ thấy
  dòng input gốc — non-empty stream cho ra 0 dòng, empty stream cho ra đúng
  1 dòng null. Đừng đặt step này giữa luồng rồi mong dữ liệu đi qua.
- **Dòng phát ra toàn null**: 1 empty row theo schema step trước, không phải
  flag/counter — downstream chỉ nhận được dòng khi stream gốc rỗng, nên
  pattern thường gặp là nối tiếp step sinh giá trị thay thế (ví dụ ghi log
  hoặc chèn dòng mặc định).
- **Đừng copy node cấu hình từ step khác**: `readData()` đọc NOTHING — node
  lạ bị bỏ qua khi load, gây hiểu sai là đã cấu hình.
- Template mặc định là khung cấu hình, chưa gắn với stream nghiệp vụ cụ
  thể.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()` (kế thừa, trả rỗng)/
  `loadXML()`/`setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
