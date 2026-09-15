# B1 package 3 — Source notes (stream control, 4 ID)

Ngày: 2026-09-15. Source: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`,
branch `9.4`, commit `1a939ab5cabe4517867879684aeca2a526bcc638` (giả định —
reviewer chạy `git -C ../pentaho-kettle rev-parse HEAD` để xác nhận; mọi số
dòng dưới đây ứng với commit đã ghim trong plan).

Phạm vi: `Append`, `BlockingStep`, `DetectEmptyStream`, `DetectLastRow`
(kind `trans` cả 4). Tất cả đã đối chiếu registry → class → `getXML()` /
`loadXML()` (`readData`) / `setDefault()` + superclass/helper + runtime.
Mức bằng chứng đề xuất: `source_reviewed`, `source_version: 9.4`,
`verified_versions: 9.4` → đủ điều kiện `canonical + generator_eligible: true`.

Test hồi quy: `test/knowledge-stream-control.test.js` (viết trước theo plan —
hiện FAIL vì 4 ID chưa có catalog/reference; chuyển GREEN sau khi thêm
reference + dòng catalog).

## Quy ước chung đã xác minh (dùng cho cả 4 reference)

- `XMLHandler.addTagValue(tag, null|"")` → self-closing `<tag/>`;
  `addTagValue(tag, boolean)` → `Y`/`N` (đã xác minh ở gói 2:
  `core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java` dòng 795–804,
  869–871).
- Load boolean: `"Y".equalsIgnoreCase(getTagValue(...))` — tag thiếu → false.
- Không override `getXML()` → kế thừa `BaseStepMeta.getXML()` trả `""`
  (`engine/src/main/java/org/pentaho/di/trans/step/BaseStepMeta.java` dòng
  200–202): template step thân RỖNG, không bịa tag.
- Wrapper step: `StepMeta.getXML(boolean)`
  (`engine/.../trans/step/StepMeta.java` dòng 210–264) bao fragment plugin
  bằng `name`, `type` (= step ID), `description`, `distribute`,
  `custom_distribution`, `copies`, `partitioning`, rồi `attributes`,
  `cluster_schema`, `remotesteps`, `GUI`. `getXML()` của plugin chỉ trả
  fragment.
- Không có sort-field nào trong `BlockingStep`: `getXML()`/`readData` chỉ có
  5 tag dưới đây; đừng nhầm với `SortRows` (`<fields>`) — test không assert
  sort fields.

## 1. trans `Append`

- Đăng ký: annotation `@Step(id = "Append", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/append/AppendMeta.java`
  dòng 63–65, category Flow). KHÔNG có trong `engine/.../kettle-steps.xml`
  (registry engine chỉ chứa step core; plugin core đăng ký bằng annotation) —
  registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `getXML()` (dòng 89–97) — đúng 2 tag theo thứ tự
  `head_name`, `tail_name`, lấy từ 2 INFO stream của `getStepIOMeta()`
  (không đọc trực tiếp field `headStepname`/`tailStepname`, hai field đó là
  target `@Injection(name = "HEAD_STEP"/"TAIL_STEP")`, dòng 70–73).
- Deserialization: `loadXML()` (dòng 79–81) gọi `readData()` (dòng 99–109) —
  `head_name`/`tail_name` vào subject của 2 stream; thiếu tag → null.
- Khởi tạo: `setDefault()` (dòng 111–112) RỖNG — template phải pin cả 2 tag.
- Refs: `getStepIOMeta()` (dòng 208–222) khai báo 2 stream INFO (head, tail);
  `searchInfoAndTargetSteps()` (dòng 141–147) resolve tên step;
  `getFields()` (dòng 157–167) merge row-meta của info[0] (head) — output
  schema = schema head.
- Ngữ nghĩa runtime (`Append.java` dòng 57–111): đọc cạn head rowset trước
  (`data.processHead`, dòng 62–75), hết head mới chuyển sang tail
  (dòng 77–98); dòng đầu của tail kiểm tra layout trùng head
  (`checkInputLayoutValid`, dòng 87–97) — sai layout ném `KettleException`.
- Catalog đề xuất:
  `{type: APPEND, xml_type: Append, file: trans/Append.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 2. trans `BlockingStep`

- Đăng ký: annotation `@Step(id = "BlockingStep", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockingstep/BlockingStepMeta.java`
  dòng 53–55, category Flow). KHÔNG có trong `kettle-steps.xml` engine.
- Serialization: `getXML()` (dòng 172–183) — đúng 5 tag theo thứ tự
  `pass_all_rows`, `directory`, `prefix`, `cache_size`, `compress`.
- Deserialization: `readData()` (dòng 156–162) — booleans đọc Y/N;
  `cache_size` qua `Const.toInt(..., CACHE_SIZE)` (thiếu/sai → 5000).
- Khởi tạo: `setDefault()` (dòng 164–170) — `passAllRows = false`,
  `directory = "%%java.io.tmpdir%%"`, `prefix = "block"`,
  `cacheSize = CACHE_SIZE (5000, dòng 83)`, `compressFiles = true`.
  LƯU Ý LOAD-KHÁC-DEFAULT: `compress` fresh-default `Y` nhưng load thiếu tag
  → `false` — template phải pin `<compress>Y</compress>` tường minh, giống bẫy
  `RemovedSourceFilename`/`AddDestinationFilename` ở gói 2.
- `getFields()` (dòng 137–141) no-op — không thêm field.
- Ngữ nghĩa runtime (`BlockingStep.java` dòng 260–311): `passAllRows = false`
  → chỉ giữ `lastRow`, input hết mới `putRow` đúng 1 dòng cuối (dòng 271–282);
  `passAllRows = true` → buffer mọi dòng (`addBuffer`, dòng 68–119), đầy
  `cache_size` thì spool file tạm `prefix*.tmp` dưới `directory` (GZIP nếu
  `compress`, dòng 83–109), input hết mới replay toàn bộ (`getBuffer` +
  vòng `putRow`, dòng 291–306). Temp files xóa ở `dispose()` (dòng 224–242).
- Catalog đề xuất:
  `{type: BLOCKING_STEP, xml_type: BlockingStep, file: trans/BlockingStep.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 3. trans `DetectEmptyStream`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 76
  (`<step id="DetectEmptyStream">`,
  `classname=org.pentaho.di.trans.steps.detectemptystream.DetectEmptyStreamMeta`,
  category Flow). Class không mang annotation `@Step`.
- Serialization: **không override `getXML()`** — kế thừa
  `BaseStepMeta.getXML()` trả `""`. `readData()` rỗng
  (`engine/.../trans/steps/detectemptystream/DetectEmptyStreamMeta.java` dòng
  68–69), `setDefault()` rỗng (dòng 71–72), `loadXML()` (dòng 59–61) chỉ gọi
  `readData`. Template step thân RỖNG (giống `FilesFromResult`,
  `MappingOutput`) — KHÔNG bịa `<fields>`/`<head_name>`/`<resultfieldname>`.
- Ngữ nghĩa runtime (`DetectEmptyStream.java` dòng 64–90): dòng input bị
  nuốt (nhánh `r != null` chỉ `return true`, không `putRow`, dòng 85–89);
  chỉ khi `first && getRow() == null` (stream rỗng) mới phát ĐÚNG 1 dòng
  (dòng 70–80). Dòng phát ra là 1 empty row sized theo prev-step fields:
  `data.outputRowMeta = getTransMeta().getPrevStepFields(getStepMeta())`
  (dòng 72) + `buildOneRow()` allocate nulls theo `outputRowMeta.size()`
  (dòng 58–62). Output fields = fields của step trước, toàn null.
- Catalog đề xuất:
  `{type: DETECT_EMPTY_STREAM, xml_type: DetectEmptyStream, file: trans/DetectEmptyStream.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## 4. trans `DetectLastRow`

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 75
  (`<step id="DetectLastRow">`,
  `classname=org.pentaho.di.trans.steps.detectlastrow.DetectLastRowMeta`,
  category Flow). Class không mang annotation `@Step`.
- Serialization: `getXML()`
  (`engine/.../trans/steps/detectlastrow/DetectLastRowMeta.java` dòng 103–107)
  — đúng 1 tag `resultfieldname`.
- Deserialization: `readData()` (dòng 109–116) — đọc chuỗi, thiếu → null.
- Khởi tạo: `setDefault()` (dòng 88–90) — `resultfieldname = "result"`.
- Schema: `getFields()` (dòng 92–101) thêm 1 `ValueMetaBoolean`
  tên `resultfieldname` (substitute biến) — boolean flag duy nhất step này
  thêm vào dòng.
- Ngữ nghĩa runtime (`DetectLastRow.java` dòng 57–125): giữ `previousRow`,
  mỗi dòng (trừ dòng đầu tiên đọc) được phát kèm `falseArray`
  (`data.getFalseArray()`, dòng 105–107); khi input hết, dòng cuối phát kèm
  `getTrueArray()` (dòng 79–89); `trueArray/falseArray` là hằng
  `Boolean.TRUE/FALSE` (`DetectLastRowData.java` dòng 38–54). `init()`
  fail khi `resultfieldname` rỗng (dòng 127–140).
- Catalog đề xuất:
  `{type: DETECT_LAST_ROW, xml_type: DetectLastRow, file: trans/DetectLastRow.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`

## Việc còn lại cho phase implement (ngoài scope file này)

1. Tạo 4 reference `.md` theo format 5 phần (template đầu là 1 `<step>`
   đúng type; `DetectEmptyStream` thân rỗng; placeholder tên step/config
   theo convention editor; `Append` head/tail là THAM CHIẾU STEP).
2. Thêm 4 dòng catalog (alias duy nhất, đã kiểm tra không trùng:
   `APPEND`, `BLOCKING_STEP`, `DETECT_EMPTY_STREAM`, `DETECT_LAST_ROW`).
3. Bổ sung 4 ID vào `EVIDENCE_BACKED_TYPES` trong `test/knowledge.test.js`.
4. Cập nhật `docs/pdi94-evidence-report.md` (100 → 104 dòng; breakdown
   source_reviewed 91 → 95) và checklist B1 trong
   `docs/inventory/2026-09-15-pdi94-components.md` (4 ô `[ ]` → `[x]`).
5. Chạy `node --test test/knowledge-stream-control.test.js`
   + nhóm knowledge + toàn suite; agent hiện tại không có shell nên chưa
   chạy — primary chạy và xác nhận RED trước, GREEN sau implement.
