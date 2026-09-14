# Ngoài repository: học từ source PDI để nâng cấp MCP

Ngày 2026-09-11. Source: `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch 9.4, commit `1a939ab5cabe4517867879684aeca2a526bcc638`, pom `9.4.0.0-SNAPSHOT`.

Đây là nghiên cứu source, chưa build/run Java hoặc kiểm chứng trên binary đang cài. Các API/tool mới trong báo cáo là đề xuất, chưa triển khai và chưa thuộc scope plan repository. Không chỉnh file implementation đang được agent khác làm.

## Kết luận

Giá trị lớn nhất không phải thêm nhiều thao tác sửa XML: đó là giúp AI biết thay đổi XML có làm sai luồng dữ liệu hay không. PDI có sẵn metadata propagation, plugin checks, serialization, variable scope và runtime counters để MCP khai thác. Nên kết hợp kiểm tra offline của Node với một Java helper dùng chính thư viện PDI cho những trường hợp cần engine semantics.

## 1. Field schema trước/sau mỗi step

**Nguồn:** `engine/src/main/java/org/pentaho/di/trans/TransMeta.java`: getStepFields (:1714 trở đi), getPrevStepFields (:1891), checkRowMixingStatically (:5613). `trans/steps/selectvalues/SelectValuesMeta.java`: getFields/getSelectFields/getMetadataFields và các check indexOfValue. `core/.../row/RowMetaInterface.java`, `ValueMetaInterface.java` mô tả row và field metadata.

**MCP có thể trả:** tên, kiểu, length/precision, thứ tự field ở đầu vào/đầu ra; field bị rename/remove/convert; origin do PDI cung cấp; issue gắn với step và field.

Ví dụ: upstream đã rename USER_ID thành CUSTOMER_ID nhưng TableOutput/SelectValues phía sau vẫn dùng USER_ID. XML hợp lệ và hop không lỗi, nhưng semantic field check có thể tìm ra.

Đề xuất `kettle_step_fields {artifact,step,mode}` và `kettle_validate_fields`. Dùng supplied/cached source schema cho offline. Phase đầu hỗ trợ SelectValues, AddConstants, Calculator và một số step phổ biến có fixture; gặp JavaScript, dynamic SQL hoặc unsupported plugin phải trả unknown/partial, không đoán schema.

**Giới hạn quan trọng:** TableInputMeta.getFields (:216-277) gọi getQueryFields và có nhánh db.connect; schema propagation không mặc định offline. Không gọi engine getStepFields trên graph tùy ý rồi quảng cáo không chạm database. Origin field không đủ để tuyên bố full column lineage qua SQL tùy ý.

**Kiểm thử:** rename/drop/type conversion, duplicate names, nhiều input khác layout, unknown source schema và dynamic fields. So sánh kết quả Node với PDI trên fixture không có I/O.

## 2. Validation theo plugin, giống logic Spoon hơn

**Nguồn:** TransMeta.checkSteps (:4493) lấy prev/info streams, gọi StepMeta.check và Before/AfterCheck extension points; JobMeta.checkJobEntries (:2449). `core/.../CheckResultInterface.java:27-35` có NONE/OK/COMMENT/WARNING/ERROR.

Validator MCP hiện tập trung cấu trúc XML, hops, references và catalog. PDI plugin có logic riêng mà XML schema đơn thuần không diễn đạt: cấu hình cần có, input streams, metadata mapping, connection và resource checks.

Đề xuất `kettle_engine_check` với output `{step,severity,message,checkSource,complete}`; giữ riêng với static lint. Có timeout, process isolation, giới hạn output và danh sách checks không chạy được.

**Không gọi mọi check như read-only/offline:** TableInputMeta.check (:409,423) kết nối DB; extension point cũng là code plugin. Phân loại offline-known vs external-metadata và yêu cầu đúng quyền của thao tác. Một flag `offline=true` không tự chặn plugin Java kết nối mạng; cần allowlist adapter/probe cùng execution isolation hoặc từ chối check chưa phân loại.

Không nuốt lỗi propagation để rồi kết luận không có vấn đề. Source checkRowMixingStatically có catch bỏ qua KettleStepException khi đang thiết kế; MCP nên giữ issue incomplete rõ ràng.

## 3. Hiểu parameter, variable và thời điểm có giá trị

**Nguồn:** `core/.../parameters/NamedParamsDefault.java`, `core/.../variables/VariableSpace.java`; `trans/steps/setvariable/SetVariable.java:141-213`; JobExecutorMeta.loadJobMeta và StepWithMappingMeta xử lý inheritance; KitchenCommandExecutor activateParameters.

SetVariable có scope JVM, parent job, grandparent job, root job. Parameter value và default được lưu riêng. Không nên suy ra value hiệu lực chỉ bằng quét `${...}` và xem tên có được khai báo không.

Đề xuất `kettle_explain_variables`: mỗi biến/parameter trả declaration/default, caller mapping, scope, nơi set, nơi dùng, trạng thái known/unresolved và nguồn quyết định. Mask giá trị nhạy cảm. Theo dõi các caller cụ thể; không suy diễn một value duy nhất khi có nhiều đường gọi.

Thêm cảnh báo khi dùng SetVariable rồi trông chờ step khác trong cùng transformation chắc chắn thấy giá trị mới. `Trans.java` khởi tạo/chạy steps theo threads; vị trí trái-phải hoặc nối hop không bảo đảm thứ tự init/đọc biến. Chỉ báo potential timing problem trừ khi chứng minh được thời điểm resolution của consumer.

Ví dụ hữu ích: PRD_ID có default nhưng caller gửi rỗng; DIRECT chỉ được set trong một nhánh; job con không inherit biến; JVM-scoped variable ảnh hưởng lần chạy khác. Cần fixture cho empty/default precedence theo từng loader, không dùng quy tắc tự nghĩ.

## 4. Giải thích nhánh job và semantics hop của transformation

**Nguồn:** `engine/.../job/Job.java:798` kiểm tra unconditional hoặc evaluation phù hợp Result; xử lý launchingInParallel và resetErrorsBeforeExecution. `trans/step/BaseStep.java:1511` có custom row distribution, round-robin/copy behavior; StepIOMeta mô tả info/target streams. StepMetaInterface.supportsErrorHandling (:559).

Đề xuất `kettle_explain_flow` và semantic lint:

- Job: hiển thị nhánh success/failure/unconditional, entry có khả năng evaluates, các nhánh chạy song song và result propagation.
- Transformation: phân biệt distribute/copy/custom distribution và info stream; không gọi mọi hop là "chạy step sau".
- Error stream: kiểm plugin có hỗ trợ error handling, cấu hình fields/target và route phù hợp; giữ rules riêng cho từng kiểu stream.

Ví dụ: hai output hops có thể chia dòng hoặc copy dòng tùy cấu hình; MCP cần giải thích trước khi AI thêm nhánh output và làm số dòng thay đổi. Tránh suy luận cardinality chính xác khi step có filter/join/script chưa biết.

Kiểm thử với fixture hai output, copies>1, custom distribution, disabled hop, success/failure job branches và parallel result aggregation.

## 5. Plugin catalog thực tế + template có bằng chứng round-trip

**Nguồn:** `core/.../plugins/PluginRegistry.java` getPlugins/loadClass; `engine/.../core/injection/bean/BeanInjectionInfo.java:53-108`; `trans/steps/selectvalues/SelectValuesMeta.java:70` InjectionSupported và :918-930 field annotations; `engine/src/test/java/org/pentaho/di/trans/LoadSaveTester.java:51-86` testXmlRoundTrip/testRepoRoundTrip.

MCP knowledge markdown hữu ích cho giải thích nhưng không chứng minh plugin đang cài tồn tại, đúng version hoặc template đủ trường. Source có hàng trăm plugin không nhất thiết có trong runtime người dùng.

Đề xuất:

- `kettle_plugin_inventory`: plugin ID, class, available runtime, source/runtime version và capabilities; phân biệt known-in-source với installed.
- `kettle_describe_step`: fields/options và injection groups có nguồn; injection property names không nhất thiết là XML tags và annotation không bao phủ toàn bộ metadata.
- Công cụ phát triển catalog: tạo metadata bằng setDefault, lấy getXML, load lại và so sánh semantic fields; dùng pattern LoadSaveTester. Không tự upgrade knowledge thành verified chỉ vì class load được.

Sử dụng PDI serializer trên bản tạm để xác minh, giữ surgical byte-preserving edit cho artifact người dùng; round-trip toàn file có thể tạo diff lớn và không được dùng làm silent rewrite.

Đây là cách mở rộng coverage bền vững hơn việc AI tự thêm XML theo phỏng đoán. Cần plugin isolation: class loading/init cũng có thể chạy code.

## 6. Chẩn đoán lần chạy và nút thắt hiệu năng

**Nguồn:** `trans/step/StepStatus.java:updateAll` có linesRead/Written/Input/Output/Updated/Rejected/errors/runtime; `trans/performance/StepPerformanceSnapShot.java` có per-copy counters, delta và input/output buffer size; log tables ở `engine/.../core/logging` gồm TransLogTable, JobLogTable, StepLogTable, PerformanceLogTable, ChannelLogTable.

Đề xuất `kettle_analyze_run` đọc log/counters từ lần chạy đã được phép hoặc file người dùng cung cấp. Trả lỗi theo step/copy/channel, message có bằng chứng, rows rejected, thời gian và các khả năng nghẽn.

Không đồng nhất linesRead với số dòng DB đọc hay linesWritten với số dòng DB ghi. Không cộng cumulative snapshots nhiều lần. Liên kết child/parent log channels và phân biệt lỗi gốc với lỗi downstream/cleanup. Nếu chỉ có textual tail thì ghi rõ thiếu dữ liệu, không tự nhận xác định nguyên nhân đầu tiên.

Buffer đầy/throughput thấp chỉ là dấu hiệu, chưa chứng minh DB chậm. Không tự tăng copies, commit size hoặc rowset size: có thể thay đổi ordering, transaction và tải DB. Performance suggestions cần giải thích tradeoff và bằng chứng.

## 7. DDL/schema drift preview theo database dialect

**Nguồn:** TransMeta.getSQLStatements (:4345-4377); TableOutputMeta.getSQLStatements (:869). API plugin hỗ trợ đề xuất SQL dựa trên metadata.

MCP có thể tạo preview schema change giữa output fields và target table theo dialect, báo field thiếu/sai kiểu. Đây là phase sau vì có thể cần database metadata, driver và permission.

Không biến API này thành "execute SQL" mặc định. Preview DDL không chứng minh migration không mất dữ liệu; cần scope rõ, mask connection credentials và không chạy DDL trong metadata check. Offline mode chỉ so với supplied schema và phải ghi kết quả là dự kiến.

## 8. Fixture testing cho transformation logic

**Nguồn:** TransPreviewFactory dựng transformation preview từ một step và Dummy; LoadSaveTester xác minh serialization, không xác minh business result. Các engine step tests cung cấp mẫu row-level fixtures.

Đề xuất `kettle_test_fixture`: input rows/schema -> một đoạn transform đã xác định -> expected output/schema/assertions. Giai đoạn đầu chỉ allowlist các step không I/O và fixture generated riêng; không preview trực tiếp cả job sản xuất.

Ví dụ: kiểm SelectValues đổi tên đúng, FilterRows xử lý null, Calculator tính đúng, conversion ngày lỗi được route thế nào. Sau đó thêm golden tests cho đoạn mapping.

Giới hạn output N dòng không có nghĩa các upstream steps chỉ đọc/chạy N dòng hay không có tác dụng phụ. Preview vẫn thực thi code. Không lấy tên "preview" làm bằng chứng an toàn; phải kiểm dependency và isolate execution.

## Kiến trúc khuyến nghị

Giữ Node MCP cho filesystem boundary, schemas, surgical edits, offline analysis và orchestration. Một Java helper tùy chọn dùng classpath/plugin của PDI đã chọn, cung cấp các operation tách biệt:

```text
inspect-plugins -> versioned capability inventory
load-metadata -> structured load result (no execute/prepareExecution)
describe-fields -> typed schema, completeness, external dependencies
check-metadata -> plugin checks with declared capability policy
roundtrip-fixture -> semantic serialization comparison
```

Result envelope đề xuất `{operation,pdiVersion,artifactHash,complete,findings,data}`. Runtime evidence phải gắn với artifact hash, parameter context, plugin version và connection context; đổi một trong các yếu tố này thì không tái dùng kết quả như còn đúng. Log đi stderr; stdout structured JSON, có timeout/cancel/output cap. Không xây bản sao toàn bộ PDI engine bằng JavaScript.

Một helper dùng cùng installation không tự bảo đảm metadata-only/offline: các plugin/extension points có thể I/O. Chỉ quảng cáo guarantees thực sự được thực thi. Helper này cần spec riêng, không thêm vội vào task repository đang chạy.

## Ưu tiên và tiêu chí nhận

| Thứ tự | Hạng mục | Công sức tương đối | Kết quả hữu ích |
|---|---|---|---|
| 1 | Field validation với source schema supplied | Vừa, tăng theo số adapter | Bắt field mất/rename/type mismatch mà XML lint bỏ sót |
| 2 | Flow + parameter/variable explanation | Vừa | AI hiểu điều kiện chạy, scope và timing trước khi sửa |
| 3 | Java helper + runtime plugin inventory/round-trip | Cao nhưng dùng lại rộng | Xác minh bằng PDI thật, mở coverage có bằng chứng |
| 4 | Run diagnostics có structured counters | Vừa | Giảm đọc log thủ công; không phán đoán root cause vô căn cứ |
| 5 | Fixture logic testing | Cao | Chứng minh output nghiệp vụ cho các đoạn transform cô lập |
| 6 | Connected schema/DDL preview | Cao và phụ thuộc DB | Giảm mismatch giữa luồng ETL và bảng đích |

Với nhu cầu tạo/sửa ETL hiện tại, chọn 1 và 2 làm đợt kế tiếp sau repository. Nếu ưu tiên hỗ trợ nhiều plugin và giảm bảo trì knowledge, chọn 3 trước. Không triển khai cả bảng trong một đợt.

## Trạng thái kiểm chứng

Đã đọc source các API và nhánh hành vi được nêu; chưa chạy PDI/Maven, không kết nối database và không chạy preview. Repository MCP đang có thay đổi triển khai song song; chỉ tạo báo cáo này, không sửa implementation hoặc mở rộng plan repository. Các tên tool là thiết kế gợi ý, chưa phải tool callable.
