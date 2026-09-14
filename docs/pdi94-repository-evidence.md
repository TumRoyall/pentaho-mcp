# Repository source review and MCP opportunities

Ngày: 2026-09-11. Source đọc tại `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`.
Branch `9.4`, commit `1a939ab5cabe4517867879684aeca2a526bcc638`; root pom version `9.4.0.0-SNAPSHOT`.
`git describe` trả tag tổ tiên 8.3 cộng 2296 commit, **không có nghĩa checkout là PDI 8.3**. Chưa xác nhận commit này trùng binary PDI đang cài. Không build Java, không chạy Maven/integration test và không chạy ETL trong lượt nghiên cứu này.

Các đường dẫn source bên dưới tương đối với checkout Pentaho trên; số dòng gắn với commit đã ghi. Đây là khảo sát các lớp repository chính, call loaders, runtime, shared objects và import/export; không tuyên bố kiểm chứng mọi plugin hoặc mọi nhánh thực thi. Nhãn `source-reviewed` không đồng nghĩa `runtime-verified`.

## 1. Kiến trúc: interface repository không phải capability thực tế

`engine/src/main/java/org/pentaho/di/repository/Repository.java` là abstraction; triển khai File Repository nằm ở `repository/filerep`, database repository ở `repository/kdr`, Pentaho Unified Repository ở `plugins/pur`.

`KettleFileRepositoryMeta.java:55` khai báo không hỗ trợ users, revisions, metadata capability, locking, version registry, ACL và reference capability. `PurRepositoryMeta.java:83` khai báo các capability này có hỗ trợ. MCP cần báo capability theo backend, không suy ra rằng có method trong interface thì File Repository triển khai đầy đủ.

Đặc biệt `supportsMetadata=false` không có nghĩa không có `.meta`: File Repository vẫn khởi tạo XmlMetaStore. Đây là hai khái niệm khác nhau.

Khuyến nghị: vẫn tập trung File Repository trong phiên bản đầu. Không đưa user/role/ACL/version-history của PUR vào API File Repository. Lock/journal/rollback do MCP tự xây phải ghi rõ là cơ chế MCP; không ngăn được Spoon hoặc chương trình khác ghi file.

## 2. Định danh và lưu trữ

`KettleFileRepository.java:87` định nghĩa:

| Đuôi | Object | Phạm vi nạp shared object |
|---|---|---|
| .ktr | Transformation | Thư mục repository |
| .kjb | Job | Thư mục repository |
| .kdb | Database connection | Root repository |
| .ksl | Slave server/Carte definition | Root repository |
| .kcs | Cluster schema | Root repository |
| .kps | Partition schema | Root repository |

`calcObjectId` (:223) ghép directory/name/extension; object ID của File Repository là chuỗi đường dẫn có extension, không phải UUID bền vững qua rename. `loadJob(ObjectId,...)` và `loadTransformation(ObjectId,...)` (:1540 trở đi, tìm theo method) resolve qua `getObjectInformation`.

`loadJob` (:943) và `loadTransformation` (:1104) lấy filename từ directory + requested name + extension; sau load gọi `setName(requestedName)`, `setFilename(null)`, gán repository/metastore và `readDatabases(...,true)`.

**Sửa spec cũ:** internal XML name lệch filename stem không tự chứng minh load thất bại; PDI đặt lại tên theo lookup. MCP có thể cảnh báo name drift và đồng bộ khi tạo/rename, nhưng không nên chặn mọi artifact hiện hữu vì điều này.

`save` (:307) serialize XMLInterface và lưu MetaStore objects; nếu object ID thay đổi thì xóa object cũ. Không dùng trực tiếp hành vi này để thiết kế migration không có preview.

## 3. Registry: thứ tự đọc và thư mục chạy thực tế

`RepositoriesMeta.readData` (:187):

1. Đọc `repositories.xml` tại working directory của Java nếu tồn tại và là file.
2. Nếu không có, đọc file user trả bởi `Const.getKettleUserRepositoriesFile()`.
3. Nếu cả hai không có, trả về thành công với danh sách rỗng.
4. XML lỗi phát sinh exception; không tự đổi sang một repo khác.

`RepositoriesMeta.writeData` (:378) lại ghi user repositories file. Vì vậy ghi `.kettle/repositories.xml` chưa chắc thay đổi registry đang được đọc nếu local registry đang che nó.

`Const.java:2406`: env KETTLE_HOME -> Java property KETTLE_HOME -> Java user.home. `getUserBaseDir` (:2437) lấy property `userBaseDir`, mặc định `.kettle`.

**Điểm quan trọng trên Windows:** `assemblies/core/static/src/main/resources-filtered/Kitchen.bat` và `Pan.bat` giữ `initialDir`, rồi `pushd %~dp0`, gọi Spoon.bat. `Spoon.bat:27` chuyển tới thư mục script; :39-42 dùng KETTLE_DIR và đổi cwd. `initialDir` không phải Java cwd dùng để tìm local registry. Node `spawn({cwd:artifactDir})` không đủ để xác định registry hiệu lực.

Registry XML File Repository được xác nhận ở `KettleFileRepositoryMeta.getXML/loadXML`: `base_directory`, `read_only`, **`hides_hidden_files`**. Không phải `hide_hidden`.

Khuyến nghị tool `kettle_repository_detect` trả `launcherDirectory`, `effectiveJavaCwd`, `localRegistry`, `userRegistry`, `selectedRegistry`, `shadowedRegistry`, selected name/base và lý do chọn. Nếu launcher tùy chỉnh không xác định được, báo incomplete thay vì đoán. Registration preview phải hiển thị file thật sẽ ghi và shadowing. Không tự sửa PDI installation registry để vượt quyền.

## 4. Database connections: nguồn hiệu lực và case

`getDatabaseIDs` (:546) quét `.kdb` tại root. `loadDatabaseMeta` (:917) đọc root `<connection>`. `getDatabaseID` (:526) thử exact filename rồi tìm tên không phân biệt hoa thường. MCP phải phát hiện name collisions theo quy tắc này, không chỉ so sánh filename case-sensitive.

`readJobMetaSharedObjects` (:1188) và `readTransSharedObjects` (:1210) đọc shared objects bình thường trước, sau đó nạp objects từ repo. `JobMeta.loadXML` (:965) và `TransMeta.loadXML` (:3008) còn có import từ metastore, xử lý embedded connections và shared flags.

Đối với đường load **File Repository chuẩn bằng tên**: cả loadJob/loadTransformation gọi `readDatabases(meta,true)` sau bước parse XML; method (:1132) dùng addOrReplaceDatabase, nên root `.kdb` có tên khớp được nạp đè vào danh sách metadata cuối. Không nên báo tất cả trường hợp embedded/root trùng tên là mơ hồ. Tuy nhiên cần test runtime cách step/entry giữ reference tới DatabaseMeta sau parse; chưa có runtime test chứng minh mọi consumer rebinding. Nhánh đọc file trực tiếp, ignoreRepositorySharedObjects, metastore và shared flags không nên bị gộp vào một quy tắc precedence đơn giản.

Khuyến nghị `kettle_connection_explain`: hiển thị definition nguồn, precedence theo load mode, định nghĩa bị che, biến chưa resolve, các consumer và độ đầy đủ bằng chứng. Không hiển thị password hoặc secret attributes.

**PDI File Repository không cung cấp usage index hữu ích:** `getJobsUsingDatabase` (:612), `getTransformationsUsingDatabase` (:808) trả array rỗng. Không được dùng kết quả này để kết luận connection không ai dùng. MCP cần scan XML riêng, gồm log tables và nested/multi-connection fields.

## 5. Tất cả chỗ gọi job/trans: mở rộng hơn sáu adapter

`core/.../ObjectLocationSpecificationMethod.java:26` xác nhận `filename`, `rep_name`, `rep_ref`.

| Type/family | XML/source | Kết luận |
|---|---|---|
| JOB entry | JobEntryJob.getXML :274; loadXML :381 | jobname + directory |
| TRANS entry | JobEntryTrans.getXML/loadXML | transname + directory |
| JobExecutor | JobExecutorMeta.getXML :203; loadXML :289 | job_name + directory_path |
| TransExecutor | TransExecutorMeta.getXML :247; loadXML :329 | trans_name + directory_path |
| Mapping | MappingMeta.getXML :236; loadXML :129 | trans_name + directory_path |
| SimpleMapping | SimpleMappingMeta.getXML :182 | trans_name + directory_path |
| SingleThreader | SingleThreaderMeta.getXML :152; loadXML :98 | Cũng có rep method/name/directory; thêm adapter |
| MetaInject | plugins/meta-inject/.../MetaInjectMeta constants :88; getXML/loadXML | Cũng có specification_method/trans_name/directory_path; thêm adapter, giữ nguyên injection mapping |
| Streaming subclasses | BaseStreamStepMeta extends StepWithMappingMeta; loadReferencedObject :255 | Có sub-trans; phải inventory subtype và kiểm tra serializer riêng, không ghi trường theo adapter thường một cách mù quáng |

`MetaFileLoaderImpl` (:65) dùng chung cho JOB/TRANS, StepWithMappingMeta và JobExecutor; :175 và :402 là các nhánh repo-by-name. Nó resolve variables, normalize directory, dùng cache và truyền repository. Một số nhánh legacy có file-to-repo fallback. MCP nên đọc/giải thích được nhưng output mới nên dùng rep_name chuẩn, có directory rõ kể cả `/`.

Không chỉ parse getXML: `JobEntryJob.loadXML` có chọn lại specification method theo context/repository và các trường có sẵn. Cần fixture kiểm tra loadXML + getXML và sự khác nhau giữa XML declared mode với effective mode.

`rep_ref` dùng object ID đường dẫn với File Repository; vì vậy rename/move phải cập nhật incoming references bằng ID nữa, hoặc chuyển có kiểm chứng sang rep_name. Không coi ID là bất biến.

## 6. Runtime: phát hiện lỗi loadcheck hiện hữu

`KitchenCommandExecutor.java:228-236`: listparam in parameter rồi thoát trước job.start; trả COULD_NOT_LOAD_JOB. `PanCommandExecutor.java:188-193` tương tự với COULD_NOT_LOAD_TRANS. `CommandExecutorCodes.java:42,93` xác nhận cả hai là **7**.

Do đó `exitCode===0 ? PASS : FAIL` của MCP hiện tại sai cho nhánh listparam của source này; nhưng **code 7 cũng là lỗi load thật**, không được đổi thành `0 hoặc 7 => PASS`. Job không có parameter có thể không cho bằng chứng output đủ phân biệt.

Giải pháp: giữ INDETERMINATE nếu không có tín hiệu chắc chắn; sau đó bổ sung Java loadcheck helper/versioned probe trả structured result sau khi load metadata thành công. Helper không gọi execute/start/prepareExecution. Smoke test phải kiểm cả job hợp lệ zero-parameter và job/repo không tồn tại. Chưa chạy binary để xác nhận mã cuối qua batch launcher.

`connect` File Repository (:111) có thể tạo `<root>/.meta` nếu thiếu và repo không readonly. Loadcheck không chạy ETL nhưng không nên hứa tuyệt đối không có filesystem side effect. Dùng repo/config tạm cho kiểm thử tự động.

## 7. Rename, move, history và read_only

`renameObject` (:1242) move file; không quét và sửa tất cả incoming references. `moveJob` (:1162), `moveTransformation` (:1166) có thân rỗng. MCP phải có logic riêng cho reference-aware rename/move, không gọi một method tồn tại rồi mặc định thành công.

`repository.log` và insertLogEntry chỉ là log, không phải version history có restore. File Repository không có native ACL/locking/revisions. `KettleFileRepositorySecurityProvider.validateAction` có kiểm readOnly cho các operation sửa; direct filesystem writes của MCP phải tự enforce, không dựa vào flags tự bảo vệ file.

MCP optimistic hashes/lock chỉ phối hợp các thao tác MCP. Spoon có thể ghi ngoài cơ chế này, nên recheck ngay trước replace và báo rõ giới hạn concurrency; không hứa transaction toàn repo atomic.

## 8. Shared infrastructure và metastore

`.ksl` chứa định nghĩa SlaveServer/Carte; `.kcs` cluster schema; `.kps` partition schema. readTransSharedObjects nạp cả bốn nhóm shared object; job loader nạp database/slave servers. `connect` tạo XmlMetaStore dưới `.meta`; save gọi saveMetaStoreObjects.

Có thể thêm inventory/validate dependencies cho các loại này trước CRUD. Không nên sửa `.meta` bằng generic XML patch: namespace/type/element và serializer phụ thuộc plugin. Read-only inventory + missing-dependency checks là bước đầu phù hợp. Định nghĩa server không đồng nghĩa cho phép gọi remote execute.

Quan sát cần thận trọng: getClusterID/getPartitionSchemaID dùng EXT_SLAVE_SERVER trong source hiện tại, trong khi ID enumeration dùng .kcs/.kps. Đây là bất nhất source cần regression test, chưa kết luận tác động runtime. MCP không nên sao chép mù các nhánh này.

## 9. Import/export: ba việc khác nhau

`KettleFileRepository.getExporter/getImporter` trả RepositoryExporter/RepositoryImporter. `RepositoryExporter.exportAllObjects` hỗ trợ export nội dung; `RepositoryImporter` có rules, xử lý overwrite và patch repository directories.

`ResourceUtil.serializeResourceExportInterface` (:90) gọi exportResources để đóng gói resource definitions vào ZIP. Đây không tự động là backup toàn bộ root, `.meta`, registry, drivers, secrets và external data.

Tách rõ khả năng tương lai:

1. Repository content export/import tương thích PDI XML với preview collision và connection conflicts.
2. Bundle một job + dependency closure để chuyển môi trường, có manifest dependencies chưa resolve.
3. Snapshot thư mục repository phục hồi được, bao gồm shared objects/metastore có policy rõ; registry/driver nằm ngoài root cần cấu hình riêng, không âm thầm copy.

## 10. Đề xuất ưu tiên cho MCP

| Ưu tiên | Khả năng | Giá trị và phạm vi |
|---|---|---|
| P0 | Detect registry hiệu lực + shadowing + root match | Ngăn test nhầm repo; sửa plan hiện tại |
| P0 | Source-aware adapters, gồm SingleThreader/MetaInject; streaming scan | Bảo đảm caller coverage không false clean |
| P0 | Sửa loadcheck classifier | Không báo sai FAIL/PASS từ mã 7 |
| P0 | Connection source/usage/case collision | Đúng .kdb; rename/delete đáng tin hơn API repo gốc |
| P1 | Dependency graph và impact preview | Job nào gọi gì, thay connection ảnh hưởng đâu; đã nằm trong plan |
| P1 | Repository health report | Tổng hợp missing refs, unsupported plugins, duplicate names, shadowed config và shared definitions |
| P1 | Read-only inventory .ksl/.kcs/.kps/.meta | Phát hiện thiếu dependency trước chạy; chưa mở remote execute |
| P2 | Shared-object CRUD | Cần fixture và contract riêng cho từng loại |
| P2 | Export/bundle + import preview | Phục vụ DEV/UAT, cần source/target mapping và secret policy |
| P2 | Snapshot/restore và semantic diff | Hiển thị đổi SQL/connection/call; không giả lập native PDI revisions |

Các P1/P2 mới ở bảng là đề xuất để user chọn, **không tự thêm vào phạm vi implementation đã giao**. Các P0 là sửa correctness của thiết kế hiện có. Không thêm PUR ACL/users hoặc tự động triển khai lên Carte trong phiên bản File Repository này.

## 11. Kiểm thử tiếp theo và điểm chưa chứng minh

- Xác nhận installed binary version/revision; không gắn nhãn binary 9.4.0.0-343 chỉ dựa vào source snapshot.
- XML round-trip cho tám adapters; inventory serializer streaming subtypes; source-declared/effective mode regression.
- Java cwd có KETTLE_DIR và local registry shadowing; user registry write không sửa hiệu lực khi bị che.
- Root .kdb vs embedded/shared/metastore, step-level object rebinding và case collisions.
- Kitchen/Pan listparam zero-parameter, invalid registry, missing artifact, batch exit propagation.
- Shared infrastructure root resolution, including cluster/partition ID inconsistency.
- Export/import round-trip nếu user chọn phase tiếp theo.

Tham khảo test source sẵn có: `engine/src/test/java/org/pentaho/di/repository/RepositoriesMetaTest.java`, `integration/src/it/java/org/pentaho/di/repository/KettleFileRepositoryIT.java`, JobEntryJobTest/JobEntryTransTest, JobExecutorMetaTest và các test StepWithMappingMeta/MetaFileLoader. Chỉ đọc test code trong lượt này; chưa chạy chúng.
