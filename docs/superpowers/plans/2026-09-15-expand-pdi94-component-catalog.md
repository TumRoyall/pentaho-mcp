# PDI 9.4 Component Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng knowledge step/entry theo danh sách source PDI 9.4 có thể kiểm tra, ưu tiên các luồng ETL cơ bản và giữ bằng chứng cho từng XML template.

**Architecture:** Giữ `catalog.yaml` làm catalog duy nhất tại runtime và một Markdown reference cho mỗi type/nhóm alias được xác minh. Tái sử dụng loader, generic XML editor, knowledge intake và coverage hiện có; mỗi component không cần một MCP tool mới. Inventory trong docs là snapshot phục vụ phát triển, không phải catalog thứ hai cho server.

**Tech Stack:** Node.js >=20, ES modules, node:test, fast-xml-parser; source Pentaho Kettle branch 9.4; PDI 9.4 runtime tùy chọn.

**Spec:** [Danh sách và phạm vi đã kiểm kê](../../inventory/2026-09-15-pdi94-components.md). Đây là kế hoạch đề xuất để giao agent, chưa triển khai component.

## Global Constraints

- Target duy nhất: `pdi_version: "9.4"`.
- Source đã kiểm kê: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
- Không suy XML từ tên step, ảnh Spoon hoặc tên injection property. Đọc `getXML()`, `loadXML()`, `setDefault()` và superclass/helper có liên quan.
- Có tên trong registry không đủ để gắn `source_reviewed` cho XML template. Chỉ sau khi kiểm tra serializer và loader mới được ghi bằng chứng cấu trúc.
- `source_reviewed`, `spoon_loaded`, `runtime_passed` là ba mức bằng chứng khác nhau. Không nâng mức khi chưa thực hiện kiểm chứng tương ứng.
- `canonical + generator_eligible:true + verified_versions` chứa `9.4` là điều kiện generation hiện hành. Thiếu bằng chứng thì giữ observed/ineligible; không lách cổng bằng `allowObserved` để tuyên bố hoàn thành.
- Catalog giữ flow-map YAML đơn giản mà `parseCatalog()` đang hỗ trợ. Ghi metadata nghiên cứu phong phú trong Markdown/JSON inventory.
- Không đổi API MCP hoặc thêm dependency chỉ để thêm reference. Production knowledge tiếp tục read-only.
- Mọi tác vụ runtime execute tuân thủ cổng phê duyệt hiện hành; kế hoạch này không cấp quyền chạy database, shell, email hoặc network. Source review và test offline đủ cho mốc hoàn thành catalog ở mức source_reviewed.

## 1. Baseline và định nghĩa “đủ”

Catalog hiện có **92 dòng**: 58 transformation step và 34 job entry. Có 91 dòng generator-eligible; `SetSessionVariableStep` là observed. START và FAILURE cùng mang XML type SPECIAL, vì vậy chỉ có 33 job XML type riêng.

Phạm vi quét source tìm thấy 215 step ID và 73 entry ID, trong đó 198 ID chưa có trong catalog (158 step, 40 entry). Con số bao gồm alias; không phải 198 component độc lập. Inventory không chứng minh plugin đã có trong distribution đang cài và không bao phủ repository plugin bên ngoài.

Hai mốc nghiệm thu:

1. **Mốc hữu dụng:** B1–B4 có reference, cấu hình minh họa và regression test đạt yêu cầu cho từng ID được nhận.
2. **Mốc phủ inventory:** Mọi ID còn lại được xử lý bằng reference có bằng chứng hoặc quyết định hoãn/loại trừ có lý do cụ thể. Báo riêng số canonical, observed, alias, deprecated và deferred; chỉ tuyên bố hỗ trợ generation đầy đủ khi không còn ID trong scope bị deferred/observed.

Nếu mục tiêu là “đủ như Spoon trên máy”, cần thêm inventory từ PluginRegistry của đúng runtime/distribution, đối chiếu với snapshot source rồi bổ sung plugin ngoài source. Không dùng số 288 ID của snapshot làm mẫu số cho runtime chưa kiểm kê.

## 2. Bản đồ file và API để agent bắt đầu

| File | Vai trò / thay đổi dự kiến |
|---|---|
| `src/knowledge/pentaho/catalog.yaml` | Thêm dòng đã kiểm chứng, alias duy nhất |
| `src/knowledge/pentaho/trans/<ID>.md` | Reference step mới; tên file theo ID sau khi xác minh alias |
| `src/knowledge/pentaho/job/<ID>.md` | Reference entry mới |
| `src/knowledge/loader.js` | `listTypes(kind)`, `findByXmlType(kind,id)`, `getReference(kind,id)`, `isGeneratorEligible(kind,id)`; thường không sửa |
| `src/core/edit.js` | `addElement(filePath, xmlType, name, opts={})`; dùng để kiểm tra template có thể được chèn |
| `src/core/knowledge-coverage.js` | `knowledgeCoverage(root,{includeExamples=true})`; kiểm tra type mới không còn missing |
| `test/knowledge.test.js` | Invariant catalog và first XML block hiện có |
| `test/knowledge-components.test.js` | Tạo regression cho các component mới, table-driven theo batch |
| `test/fixtures/knowledge-components/<kind>/<ID>.ktr` hoặc `.kjb` | Fixture tối thiểu tự chứa, không credentials thật; chỉ tạo fixture cần cho scenario |
| `docs/pdi94-evidence-report.md` | Cập nhật số liệu/bằng chứng từ catalog, đang lệch 88 so với 92 dòng |
| `docs/inventory/2026-09-15-pdi94-components.md` | Checklist theo ID, trạng thái thực hiện |
| `docs/inventory/2026-09-15-pdi94-components.json` | Snapshot provenance, class, source, batch; không nạp vào runtime |

## 3. Task 0 — Khóa baseline và chọn gói đầu tiên

**Consumes:** catalog và inventory hiện tại. **Produces:** danh sách 3–5 ID nhận làm và ghi chú baseline trong handoff của batch.

- [ ] Kiểm tra `git status --short`; giữ các thay đổi đang có của người dùng.
- [ ] Kiểm tra commit source bằng `git -C ../pentaho-kettle rev-parse HEAD`. Nếu khác snapshot, ghi rõ và đối chiếu lại các ID nhận làm.
- [ ] Đọc `src/knowledge/pentaho/README.md`, reference `trans/Sequence.md`, `trans/Mapping.md`, `job/TRANS.md`, `test/knowledge.test.js`, `src/core/edit.js`.
- [ ] Chạy `node --test test/knowledge.test.js test/knowledge-coverage.test.js test/knowledge-intake.test.js` và ghi kết quả baseline.
- [ ] Chọn gói đầu: `RowsFromResult`, `MappingInput`, `MappingOutput`. Đối chiếu inventory để lấy class source chính xác, đọc cả implementation hiện có của `RowsToResult` và `Mapping`.
- [ ] Nếu có workload KJB/KTR thật được chỉ định, gọi coverage trên root đó để ưu tiên missing theo uses; không coi fixture trong test là tần suất production.

**Baseline của lần lập kế hoạch:** 27 test knowledge/intake/coverage pass với `--test-isolation=none`. Chạy mặc định bị sandbox chặn child-process (`spawn EPERM`); chưa chạy toàn suite. Dùng chế độ không isolation chỉ cho nhóm này nếu gặp cùng giới hạn, không suy ra toàn bộ test khác tương thích chế độ đó.

## 4. Task lặp — Một gói 3–5 ID cùng chức năng

**Files:** đúng các reference/catalog/test/fixture/evidence tại mục 2 cho những ID được nhận; không sửa các batch khác.

**Consumes:** hàng inventory `(kind,id,className,source,batch)` và API hiện có.
**Produces:** reference có provenance, catalog row, regression có cấu hình cụ thể và bản ghi kết quả từng ID.

### A. Kiểm tra source cho từng ID

- [ ] Từ registry XML lấy class, từ annotation lấy class trong chính file Java; kiểm tra alias dùng chung class. Không lấy cả chuỗi ID chứa dấu phẩy làm một XML type.
- [ ] Đọc `getXML()`, `loadXML()`, `setDefault()` và method được gọi để lập bảng `XML path → kiểu/default → bắt buộc/điều kiện → source method`.
- [ ] Xác định các list lặp, enum, escaping, Y/N so với true/false, tham chiếu step, DB connection, artifact và result-file/row behavior.
- [ ] Với component có tham chiếu, đọc cách validator/editor hiện xử lý. Nếu có trường hợp rename/remove/validate chưa hỗ trợ, ghi thành task giới hạn cụ thể; chỉ thêm rule khi có source và regression chứng minh.
- [ ] Ghi commit và đường dẫn class/method trong reference. Mỗi field có khác biệt đáng kể cần giải thích, không chỉ dán một URL source chung.

### B. Test trước khi thêm catalog/reference

- [ ] Tạo case kiểm tra `findByXmlType(kind,id)` tồn tại, `getReference()` trả template đúng root và đúng direct-child `<type>`, `isGeneratorEligible()` khớp mức bằng chứng dự kiến. Chạy để thấy fail vì ID chưa có.
- [ ] Thêm case chèn template thật bằng `addElement()` vào bản sao artifact tối thiểu; kiểm tra tên có `&`/`<` được escape đúng và ID đúng, không chỉ kiểm tra file Markdown tồn tại.
- [ ] Thêm một cấu hình không mặc định phù hợp mỗi ID để kiểm tra array/group mapping. Ví dụ `MappingInput`: ít nhất hai field khác kiểu và `select_unspecified`; `RowsFromResult`: hai field theo cấu trúc source. `MappingOutput` không tự khai báo danh sách field XML trong class này: kiểm tra template dùng serialization kế thừa và cấu hình rename từ step Mapping bên gọi; không bịa block fields trên MappingOutput.
- [ ] Với step nhiều nhánh hoặc lookup, fixture phải có các target/source step được tham chiếu; với entry result filenames, kiểm tra các option xử lý file theo source. Không thực thi I/O để test template.
- [ ] Test template bằng XML parser; kiểm tra direct-child type, không nhầm nested field `<type>`. Đối với SPECIAL/alias đọc chính file của catalog row để tránh chỉ kiểm tra reference đầu tiên dùng chung xml_type.

### C. Viết reference và catalog

- [ ] Viết Markdown: mô tả, XML template đầu tiên là một `<step>`/`<entry>` đầy đủ, bảng field, mapping cấu hình, precondition, ví dụ và bẫy, version evidence.
- [ ] Giữ placeholder dùng cho tên theo conventions editor. Ghi rõ các placeholder cấu hình người dùng cần điền; template mặc định không được quảng cáo là sẵn sàng chạy nghiệp vụ.
- [ ] Thêm dòng catalog với design alias duy nhất, XML ID đã xác minh, đường dẫn file và evidence đúng. Cập nhật timestamps nếu nội dung catalog thay đổi.
- [ ] Với alias, chứng minh serializer/load behavior trước khi chọn chia sẻ reference hay reference riêng. Không tự nhân bản implementation chỉ vì registry có hai tên.
- [ ] Không tìm được đủ XML evidence: ghi lý do deferred vào backlog; không thêm một canonical template phỏng đoán.

### D. Nghiệm thu và handoff gói

- [ ] Chạy `node --test test/knowledge-components.test.js test/knowledge.test.js test/knowledge-coverage.test.js test/knowledge-intake.test.js`.
- [ ] Chạy coverage trên fixture mới; các ID hoàn thành không còn missing và không bị tính nhầm nested field types.
- [ ] Chạy `npm test` tại môi trường cho phép child-process; nếu bị giới hạn, ghi rõ phần chưa kiểm tra thay vì gọi test suite pass.
- [ ] Cập nhật evidence report theo catalog thực tế; tích checklist chỉ khi các gate tương ứng đã đạt.
- [ ] Nếu đã có PDI 9.4 và loadcheck được phép sau static validation, lưu bằng chứng load; nếu chưa có, giữ `source_reviewed`. Không tự chuyển sang runtime_passed.
- [ ] Bàn giao bảng `ID | reference | evidence | tests | limitations`; review diff trước khi chuyển gói tiếp. Chỉ commit theo quy ước của phiên làm việc, không push/deploy từ kế hoạch này.

## 5. Thứ tự các đợt

Danh sách đầy đủ từng ID nằm trong inventory, mỗi ID có class và nguồn đăng ký. Làm B1 → B2 → B3 → B4; B5 phải hoàn tất phân loại alias trước khi tính tổng coverage cuối. B6 chia theo category và dependency, B7 xử lý cuối trừ khi workload thực tế cần sớm hơn.

| Đợt | Kết quả cần kiểm tra |
|---|---|
| B1 | Truyền result rows/files, mapping input/output, append/block/detect stream; references và số trường khớp source |
| B2 | Lookup/DB procedure/SCD/synchronize, aggregate/window/sorted merge; ghi điều kiện sort, key và connection |
| B3 | Null/string/split/pivot/dedup/validator/formula; kiểm tra enum, nhiều field và hành vi null |
| B4 | JSON/XML/YAML/file/API/FTP và điều kiện job; ghi path, encoding, grouping, authentication bằng biến |
| B5 | ScriptValue/ScriptValuesMod, Flattener/Flatterner, TeraFast/TeraFastPlugin, MAIL_VALIDATOR và ID localization bất thường; kiểm tra class/registry/serializer, phân biệt alias thật với khác implementation |
| B6 | Các component còn lại: lập gói riêng cho streaming, bulk loader, crypto, external services, scripting; ghi rõ dependency và khả năng có mặt trên runtime |
| B7 | Component được source xếp Deprecated: reference bảo trì và replacement có nguồn; quyết định generation riêng, không đánh đồng với scope ETL mới |

## 6. Task cuối — Đối chiếu và đóng kế hoạch

- [ ] Đọc lại JSON inventory và catalog, diff theo `(kind,xml_type)`; ghi riêng alias và row SPECIAL.
- [ ] Kiểm tra 198 ID baseline đều có trạng thái kết thúc: canonical có evidence, observed có lý do, alias đã chứng minh, hoặc deferred/excluded có phạm vi rõ.
- [ ] Điều tra `SetSessionVariableStep` như gap có sẵn; chỉ nâng nếu tìm thấy bằng chứng đúng plugin/PDI 9.4. Các test đang dùng ID này để đại diện observed cần chuyển sang catalog tạm nếu nó được nâng.
- [ ] Kiểm tra file reference không orphan, aliases không trùng, mọi template đầu tiên đúng type; không chỉ rely vào test đọc reference theo xml_type dùng chung.
- [ ] Cập nhật evidence report, số liệu catalog và backlog; không sửa báo cáo lịch sử khác nếu chúng ghi rõ snapshot riêng.
- [ ] Chạy test cuối, báo phạm vi còn thiếu và tách coverage source khỏi runtime installed/load/runtime execution.

## Prompt giao agent

> Đọc `docs/superpowers/plans/2026-09-15-expand-pdi94-component-catalog.md` và `docs/inventory/2026-09-15-pdi94-components.md`. Thực hiện Task 0 rồi gói đầu B1: RowsFromResult, MappingInput, MappingOutput. Dùng source pentaho-kettle commit đã ghim để xác minh getXML/loadXML/setDefault, thêm reference + catalog + regression theo task lặp. Giữ policy PDI 9.4, không bịa XML/evidence, không chạy I/O nghiệp vụ. Kết thúc bằng diff, test results, mức evidence và các ID còn thiếu. Không nhận toàn bộ 198 ID trong một lượt.

## Bổ sung: quy trình lấy tri thức trực tiếp từ source (theo yêu cầu người dùng)

Nguồn bắt buộc: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch 9.4 và commit đã ghim. Không chỉ lấy danh sách từ registry. JSON inventory đã bổ sung `implementationSources` cho 288/288 ID và `xmlEvidenceReview: pending`; đây là bản đồ source, chưa phải xác nhận toàn bộ XML.

Với **từng ID**, trước khi sửa catalog, agent phải ghi vào reference:

1. Registration: ID/alias → class, source file và commit.
2. Serialization: getXML và superclass/helper → từng XML path, kiểu, thứ tự/list, điều kiện xuất.
3. Deserialization: loadXML/readData và helper → default khi tag thiếu/rỗng, parser boolean/enum, backward compatibility.
4. Initialization: setDefault/constructor → default cho component mới, tách khỏi fallback khi load.
5. Wrapper: StepMeta hoặc JobEntryCopy/JobEntryBase → name/type/GUI và phần metadata chung. getXML của plugin có thể chỉ trả fragment.
6. Semantics: runtime class, getFields/check/stream metadata khi cần mô tả hành vi, điều kiện input/sort và references.
7. Evidence: file + method + dòng tại commit ghim; kết quả static test, loadcheck/round-trip nếu đã thực hiện. Chỉ sau đó chuyển xmlEvidenceReview sang reviewed và xét eligibility.

### Ví dụ kiểm tra source ở gói đầu

- `RowsFromResultMeta.java`: loadXML tại dòng 130 gọi readData; getXML tại 152; setDefault tại 184. Theo tiếp helper serialize thay vì suy field XML từ tên property Java.
- `MappingInputMeta.java`: loadXML tại 143; getXML tại 195; setDefault tại 220. XML fields có name/type/length/precision và select_unspecified; fallback load và default mới cần ghi riêng.
- `MappingOutputMeta.java`: kế thừa BaseStepMeta, không override getXML/loadXML trong class; setDefault tại 72. getFields giải thích rename được điều khiển bởi Mapping. Không sao chép XML fields của MappingInput sang MappingOutput.

Các đường dẫn trên nằm dưới `engine/src/main/java/org/pentaho/di/trans/steps/` trong folder tương ứng của component. Đây là ví dụ đọc source ban đầu; agent vẫn phải hoàn thành checklist bằng chứng cho từng component trước khi thêm template.
