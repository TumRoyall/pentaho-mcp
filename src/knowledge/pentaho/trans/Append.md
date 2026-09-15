# Append — Step nối hai stream head rồi tail

Đọc cạn toàn bộ dòng của head stream trước, sau đó đọc toàn bộ dòng của
tail stream (`Append.processRow()` — head rồi tail, không xen kẽ). Khối cấu
hình chỉ có đúng 2 tag theo thứ tự `head_name`, `tail_name` — TÊN HAI STEP
NGUỒN (info streams), không phải field hay literal. Output schema = schema
của head (merge từ info[0]); dòng đầu của tail bị kiểm tra layout trùng
head, sai layout thì lỗi.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Append</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <head_name>{{HEAD_STEP}}</head_name>
    <tail_name>{{TAIL_STEP}}</tail_name>
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
| `<head_name>` | Y | Tên step nguồn đọc TRƯỚC (head stream). THAM CHIẾU STEP — step này phải nối hop vào Append. |
| `<tail_name>` | Y | Tên step nguồn đọc SAU (tail stream). THAM CHIẾU STEP — step này phải nối hop vào Append. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: APPEND` | `<type>` | `Append`. |
| `configuration.head_step` | `<head_name>` | Tham chiếu tên step nguồn head. |
| `configuration.tail_step` | `<tail_name>` | Tham chiếu tên step nguồn tail. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "Append", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/append/AppendMeta.java`
  dòng 63–65, category Flow). KHÔNG có trong
  `engine/src/main/resources/kettle-steps.xml` — plugin core đăng ký bằng
  annotation; registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `AppendMeta.getXML()` (dòng 89–97) — ghi đúng 2 tag theo
  thứ tự `head_name`, `tail_name`, lấy từ 2 INFO stream của
  `getStepIOMeta()` (không đọc trực tiếp field `headStepname`/
  `tailStepname`; hai field đó là target `@Injection(name =
  "HEAD_STEP"/"TAIL_STEP")`, dòng 70–73). Không có tag nào khác trong
  fragment.
- Deserialization: `loadXML()` (dòng 79–81) gọi `readData()` (dòng
  99–109) — `head_name`/`tail_name` vào subject của 2 stream; thiếu tag →
  null.
- Khởi tạo: `setDefault()` (dòng 111–112) rỗng — template phải pin cả 2
  tag.
- Refs: `getStepIOMeta()` (dòng 208–222) khai báo 2 stream INFO (head,
  tail); `searchInfoAndTargetSteps()` (dòng 141–147) resolve tên step thành
  `StepMeta`; `getFields()` (dòng 157–167) merge row-meta của info[0]
  (head) — output schema = schema head.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`Append.processRow()`,
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/append/Append.java`
  dòng 57–111): khi `data.processHead` thì đọc `data.headRowSet` tới cạn
  (dòng 62–75), hết head mới bật `data.processTail` đọc `data.tailRowSet`
  (dòng 77–98); dòng đầu của tail kiểm tra layout trùng head qua
  `checkInputLayoutValid` (dòng 87–97) — sai layout ném `KettleException`.
  `init()` (dòng 116–149) BẮT BUỘC cả hai hop: thiếu tên head hoặc tail thì
  `logError("BothHopsAreNeeded")` và trả `false` (dòng 135–146) — step
  không chạy khi thiếu một nguồn.
- `check()` (Meta dòng 169–194): cả hai tên có đủ → OK; cả hai null →
  ERROR; thiếu một → OK kèm cảnh báo một nguồn (không chặn ở validate,
  nhưng `init()` runtime vẫn đòi đủ cả hai — xem bẫy).

Cấu hình không mặc định (hai step nguồn có tên thật):

```xml
<head_name>Head input</head_name>
<tail_name>Tail input</tail_name>
```

## 5. Lưu ý / bẫy

- **Bắt buộc cả hai hop vào đã bật**: `head_name`/`tail_name` là THAM CHIẾU
  STEP (info streams), hai step nguồn phải nối hop vào Append; thiếu một
  bên là `init()` fail (`BothHopsAreNeeded`). Khi đổi tên step nguồn phải
  cập nhật cùng graph như `send_true_to`/`send_false_to` của `FilterRows`.
- **Thứ tự cố định head-trước-tail-sau**: không phải merge xen kẽ hay sort
  merge — muốn trộn có thứ tự phải sort trước rồi dùng `SortedMerge`/`MergeJoin`.
- **Schema tail phải tương thích head**: output lấy schema head; tail khác
  layout thì lỗi runtime ở dòng tail đầu tiên.
- Template mặc định là khung cấu hình, chưa gắn với step nguồn nghiệp vụ
  cụ thể — người dùng phải điền tên hai step nguồn có thật và nối hop.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
