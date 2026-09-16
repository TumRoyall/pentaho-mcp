# B7c source notes — deprecated: Palo (4 trans) + SAPINPUT + 2 job entries

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no DB/mail/shell/network run by this agent.

**B7 status (applies to ALL 7 IDs):** each component is marked Deprecated in
source 9.4 (annotation category `...Category.Deprecated` + icon
`ui/images/deprecated.svg`, or registry equivalent). Proposed catalog state:
`status: observed`, `generator_eligible: false`,
`verification: source_reviewed`, `source_version`/`verified_versions` 9.4.
No canonical replacement is named by any source file — default: NO
canonical proposal.

**Wrapper (trans):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): wrapper emits
`<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the plugin
fragment via `stepMetaInterface.getXML()` (lines 228-230). Each plugin
`getXML()` returns only its own config tags.

**Wrapper (job):** `engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java`
`getXML()` (lines 415-424): emits `name`, `description`, `type` (= configId)
plus `attributes`; the plugin appends its own tags after `super.getXML()`.
`JobEntryCopy` then wraps with `parallel`, `draw`, `nr`, `xloc`, `yloc`,
`attributes_kjc` (see `src/knowledge/pentaho/job/TABLE_EXISTS.md`).

**DB-connection note:** PaloCellInput / PaloCellOutput / PaloDimInput /
PaloDimOutput / SAPINPUT all carry `<connection>` = DatabaseMeta NAME looked
up via `DatabaseMeta.findDatabase` — the B2a fixture pitfall APPLIES:
test fixtures MUST declare
`<connection><name>${CONN}</name></connection>`.
MS_ACCESS_BULK_LOAD has NO `<connection>` tag (`target_db` is an `.mdb` FILE
PATH string, not a DatabaseMeta ref). TALEND_JOB_EXEC has NO `<connection>`.

## Kết luận Palo thuộc B6 hay B7c (bắt buộc)

**Kết luận: Palo thuộc B7c (observed), ĐỀ NGHỊ BỎ KHỎI B6.**

Bằng chứng: cả 4 Meta class mang annotation Deprecated tại commit ghim:

- `PaloCellInputMeta.java` dòng 55–59: `image = "ui/images/deprecated.svg"`,
  `categoryDescription = "...BaseStep.Category.Deprecated"`.
- `PaloCellOutputMeta.java` dòng 54–58: tương tự.
- `PaloDimInputMeta.java` dòng 54–58: tương tự.
- `PaloDimOutputMeta.java` dòng 57–61: tương tự.

Hiện trạng xung đột: 4 file reference Palo + 4 catalog row đã tồn tại ở
`status: canonical` + `generator_eligible: true` (do B6-2, file
`test/knowledge-b6-2-services-scripting.test.js` dòng 64–67 và 165–177
assert canonical/eligible, dòng 578–666 kiểm template). Kiro cần:

1. Chuyển 4 catalog row Palo sang `status: observed`,
   `generator_eligible: false` (giữ `verification: source_reviewed`,
   `verified_versions: "9.4"`).
2. Sửa `test/knowledge-b6-2-services-scripting.test.js`: gỡ 4 ID Palo khỏi
   `BATCH` (36 → 32 IDs, dòng 166 `assert.equal(BATCH.length, 36, ...)`),
   gỡ/xoay test Palo ở dòng 578–666 (template assertions đã được B7c bao
   phủ ở observed).
3. Thêm 3 catalog row mới (SAPINPUT, MS_ACCESS_BULK_LOAD, TALEND_JOB_EXEC)
   theo "Catalog row đề xuất" bên dưới.

## 1. trans PaloCellInput — `PaloCellInputMeta`

- Class: `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/cellinput/PaloCellInputMeta.java` (347 dòng).
- Registry: annotation `@Step(id="PaloCellInput", ...)` (dòng 55–59):
  `image="ui/images/deprecated.svg"`,
  `categoryDescription="...BaseStep.Category.Deprecated"`. **DEPRECATED.**
- `getXML()` (dòng 150–169): `connection` (null-guarded, 154), `cube`
  (155), `cubemeasurename` (156), `cubemeasuretype` (157), wrapper
  `<fields>` (159–167) với mỗi `<field>`: `dimensionname` (162),
  `fieldname` (163), `fieldtype` (164).
- `loadXML` (86–89) → `readData` (97–122): connection qua
  `DatabaseMeta.findDatabase` (100); measure bọc `DimensionField("Measure",
  name, type)` (104); đếm `<field>` (108–109). Không boolean/enum parser;
  mọi exception → `KettleXMLException` (119–121).
- `setDefault()` (125–126): RỖNG.
- `getFields()` (129–147): NÉM `KettleStepException` khi
  `databaseMeta == null` (132–134); ngược lại nối PaloHelper qua server thật.
- `getUsedDatabaseConnections()` (301–307) trả `[databaseMeta]`.
- Replacement: KHÔNG có trong source.

Emitted tag order: `[<connection>, <cube>, <cubemeasurename>, <cubemeasuretype>, <fields>]`.

## 2. trans PaloCellOutput — `PaloCellOutputMeta`

- Class: `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/celloutput/PaloCellOutputMeta.java` (459 dòng).
- Registry: `@Step(id="PaloCellOutput", ...)` (54–58): deprecated.svg +
  Deprecated. **DEPRECATED.**
- Mặc định field: `updateMode="SET"` (64), `splashMode="DISABLED"` (65),
  `commitSize=1000` (69), cache true/true (70–71). `setDefault()` (77–84)
  chỉ vá null updateMode/splashMode.
- `getXML()` (169–211): `connection` (172–173), `cube` (174), `measuretype`
  (175), `updateMode` (176), `splashMode` (177), `clearcube` Y/N (178),
  `enableDimensionCache` (179), `preloadDimensionCache` (180), `commitSize`
  số (181), `<fields>` (183–191: `dimensionname` 186, `fieldname` 187,
  `fieldtype` 188), `<measures>` (193–208; chỉ emit khi measure name `!= ""`
  — so sánh tham chiếu dòng 197; rỗng → `"CHOOSE FIELD"` 200–204; mỗi
  `<measure>`: `measurename` 199, `measurefieldname` 201/203,
  `measurefieldtype` 205).
- `readData()` (110–167) qua `loadXML()` (100–103): `clearcube`
  `.equals("Y")` **KHÔNG null-guard (dòng 118 — thiếu tag → NPE)**; 3 tag
  cache/commit trong try tương thích (121–131, thiếu → false/false/1000);
  chỉ `<measure>` ĐẦU được đọc (`break` dòng 159); cuối gọi `setDefault()`
  (162).
- Không override `getFields()` (output step). `check()` (285–352).
- `getUsedDatabaseConnections()` (368–374).
- Replacement: KHÔNG có.

Emitted tag order: `[<connection>, <cube>, <measuretype>, <updateMode>, <splashMode>, <clearcube>, <enableDimensionCache>, <preloadDimensionCache>, <commitSize>, <fields>, <measures>]`.

## 3. trans PaloDimInput — `PaloDimInputMeta`

- Class: `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/diminput/PaloDimInputMeta.java` (325 dòng).
- Registry: `@Step(id="PaloDimInput", ...)` (54–58): deprecated.svg +
  Deprecated. **DEPRECATED.**
- `getXML()` (146–165): `connection` (149–150), `dimension` (151),
  `baseElementsOnly` Y/N (152), `<levels>` (154–163: `levelname` 157,
  `levelnumber` 158, `fieldname` 159, `fieldtype` 160).
- `readData()` (94–120) qua `loadXML()` (84–87): `baseElementsOnly`
  null-guard (99–101, thiếu → false); `levelnumber` qua
  `Integer.parseInt` **KHÔNG null-guard (115 — thiếu/không số → load FAIL)**.
- `setDefault()` (122–123): RỖNG.
- `getFields()` (125–144): ném lỗi khi thiếu connection.
- `getUsedDatabaseConnections()` (287–293).
- Replacement: KHÔNG có.

Emitted tag order: `[<connection>, <dimension>, <baseElementsOnly>, <levels>]`.

## 4. trans PaloDimOutput — `PaloDimOutputMeta`

- Class: `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/dimoutput/PaloDimOutputMeta.java` (408 dòng).
- Registry: `@Step(id="PaloDimOutput", ...)` (57–61): deprecated.svg +
  Deprecated. **DEPRECATED.**
- `getXML()` (148–182): `connection` (151–152), `dimension` (153),
  `elementtype` (155), `createdimension` (157), `cleardimension` (159),
  `clearconsolidations` (161), `recreatedimension` (163),
  `enableElementCache` (165), `preloadElementCache` (167), `<levels>`
  (169–179: `levelname` 172, `levelnumber` 173, `fieldname` 174,
  `consolidationfieldname` 175–176 — **KHÔNG có `fieldtype`**).
- `readData()` (105–143) qua `loadXML()` (95–98): `createdimension` và
  `cleardimension` `.equals("Y")` **KHÔNG null-guard (111–112 — thiếu →
  NPE)**; 4 cờ sau null-guard (113–124); `levelnumber` parseInt (137).
- `setDefault()` (145–146): RỖNG.
- Không override `getFields()`. `check()` (239–306).
- `getUsedDatabaseConnections()` (322–328).
- Replacement: KHÔNG có.

Emitted tag order: `[<connection>, <dimension>, <elementtype>, <createdimension>, <cleardimension>, <clearconsolidations>, <recreatedimension>, <enableElementCache>, <preloadElementCache>, <levels>]`.

## 5. trans SAPINPUT — `SapInputMeta`

- Class: `plugins/sap/core/src/main/java/org/pentaho/di/trans/steps/sapinput/SapInputMeta.java` (408 dòng).
- Registry: annotation `@Step(id="SAPINPUT", ...)` (dòng 61–63):
  `image="ui/images/deprecated.svg"`,
  `categoryDescription="...BaseStep.Category.Deprecated"`. **DEPRECATED.**
  Không có `@Deprecated` Java, không replacement trong Javadoc (chỉ
  `Created on 2-jun-2003`).
- Hằng tag (65–73): `parameters` / `parameter` / `fields` / `field` /
  `function`.
- Field `databaseMeta` (78, "The connection to the database"), `function`
  (83), `parameters` (88), `outputFields` (93); ctor (95–100) `new
  ArrayList` cho 2 list.
- `getXML()` (156–199): `connection` (160, rỗng khi null); `<function>`
  LUÔN emit (162–170; 5 sub-tag chỉ khi function non-null + tên non-empty,
  163–169); `<parameters>` LUÔN emit (172–183; mỗi `<parameter>`:
  `field_name` 175, `sap_type` = code `SINGLE`/`STRUCTURE`/`TABLE` 176,
  `table_name` 177, `parameter_name` 178, `target_type` = tên value-meta
  chuỗi 179–180); `<fields>` LUÔN emit (185–196; mỗi `<field>`:
  `field_name` 188, `sap_type` 189, `table_name` 190, `new_name` 191,
  `target_type` 192–193).
- `loadXML()` (124–126) → `readData()` (201–245): connection qua
  `findDatabase` (203, thiếu → null); function 5 sub-tag, tên rỗng →
  `function = null` (211–216); `<parameters>` đếm `<parameter>` (218–219),
  `sap_type` qua `SapType.findTypeForCode` (223, lạ → null),
  `target_type` qua `ValueMeta.getType` (225, lạ → `TYPE_NONE`); `<fields>`
  tương tự + `new_name` (238). BẪY: không clear 2 list trước khi add —
  load lặp append trùng. `getSapType().getCode()` ở getXML (176/189) NPE
  nếu sap_type lạ đã load thành null.
- `setDefault()` (133–137): `databaseMeta = null`, `function = null`.
- `getFields()` (139–154): `row.clear()` rồi append mỗi output field theo
  `new_name`. `check()` (325–347): ERROR khi thiếu connection (330) hoặc
  function (340).
- `getUsedDatabaseConnections()` (363–369).
- `SapType` enum (`SapType.java` 24): `Single("SINGLE")`,
  `Structure("STRUCTURE")`, `Table("TABLE")`.
- Replacement: KHÔNG có.

Emitted tag order: `[<connection>, <function>, <parameters>, <fields>]`.

## 6. job MS_ACCESS_BULK_LOAD — `JobEntryMSAccessBulkLoad`

- Class: `plugins/ms-access/impl/src/main/java/org/pentaho/di/job/entries/msaccessbulkload/JobEntryMSAccessBulkLoad.java` (575 dòng).
- Registry: annotation `@JobEntry(id="MS_ACCESS_BULK_LOAD", ...)` (dòng
  72–76): `image="ui/images/deprecated.svg"`,
  `categoryDescription="...JobCategory.Category.Deprecated"`. **KHÔNG có
  trong `engine/src/main/resources/kettle-job-entries.xml`** (grep
  MS_ACCESS = 0 hit). **DEPRECATED.**
- Hằng success (92–94): `success_when_at_least`, `success_if_errors_less`,
  `success_if_no_errors`.
- `getXML()` (148–173): `super.getXML()` (151) rồi `include_subfolders`
  (152), `is_args_from_previous` (153), `add_result_filenames` (155),
  `limit` chuỗi (156), `success_condition` mã (157), `<fields>` LUÔN emit
  (159–171; mỗi `<field>`: `source_filefolder` 163, `source_wildcard` 164,
  `delimiter` 165, `target_db` 166 — đọc từ field `target_Db` —,
  `target_table` 167).
- `loadXML()` (175–209): `super.loadXML()` (178); 3 boolean
  `"Y".equalsIgnoreCase` (179–181, thiếu → false); `limit`/`success_condition`
  đọc thô (183–184, thiếu → null GHI ĐÈ default ctor); `<fields>` đếm
  `<field>` (185–188). BẪY repo: `saveRep` lưu `"target_Db"` (D hoa, dòng
  303) nhưng `loadRep`/`loadXML` đọc `"target_db"`.
- Ctor (102–113): `limit="10"`, `success_condition=success_if_no_errors`,
  2 flag false, 5 mảng null. Không `setDefault()`.
- Runtime `execute()` (465–540): 2 mode (args-previous 493–510;
  tĩnh 511–523); thư mục → regex `Pattern.matcher().matches()` (319) +
  đệ quy khi `include_subfolders` (365); file → Jackcess `importFile`
  (385). `getSuccessStatus` (542): 3 mã như trên.
  `source_wildcard` là regex full-match — `*.csv` SAI, phải `.*\.csv`.
- `target_db` là ĐƯỜNG DẪN `.mdb`, KHÔNG phải connection → fixture KHÔNG
  cần `<connection>`.
- Replacement: KHÔNG có.

Emitted tag order (sau super.getXML): `[<include_subfolders>, <is_args_from_previous>, <add_result_filenames>, <limit>, <success_condition>, <fields>]`.

## 7. job TALEND_JOB_EXEC — `JobEntryTalendJobExec`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/talendjobexec/JobEntryTalendJobExec.java` (355 dòng).
- Registry: `engine/src/main/resources/kettle-job-entries.xml` dòng 60:
  `<job-entry id="TALEND_JOB_EXEC">` → class trên, category
  `...JobCategory.Category.Deprecated`, icon `ui/images/deprecated.svg`.
  **Không có annotation `@JobEntry` trong class. DEPRECATED.**
- `getXML()` (95–103): `super.getXML()` (98) rồi `filename` (99),
  `class_name` (100). CHỈ 2 tag.
- `loadXML()` (105–115): `super.loadXML()` (108), `filename` (109),
  `className` (110); thiếu → null; lỗi → `KettleXMLException ERROR_0001`.
  Không boolean/enum/list.
- Ctor (81–88): `super(n, "")`, `filename = null`. Không `setDefault()`.
- Runtime `execute()` (150–174): null → `NrErrors=1`; file missing →
  chỉ log; ngược lại classloader + `runJobInTOS` (176–226), giải nén jar
  ra `${java.io.tmpdir}` (`prepareJarFiles`, 228).
- `check()` (279–283) chỉ đòi `filename` non-blank. `evaluates() = true`
  (263).
- Replacement: KHÔNG có.

Emitted tag order (sau super.getXML): `[<filename>, <class_name>]`.

## Catalog row đề xuất (để Kiro thêm vào catalog.yaml)

```yaml
# 4 Palo: CHUYỂN từ canonical/true sang observed/false (giữ file/type/versions):
- {type: PALO_CELL_INPUT, xml_type: PaloCellInput, file: trans/PaloCellInput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PALO_CELL_OUTPUT, xml_type: PaloCellOutput, file: trans/PaloCellOutput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PALO_DIM_INPUT, xml_type: PaloDimInput, file: trans/PaloDimInput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PALO_DIM_OUTPUT, xml_type: PaloDimOutput, file: trans/PaloDimOutput.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
# 3 ID mới (deprecated in source 9.4):
- {type: SAP_INPUT, xml_type: SAPINPUT, file: trans/SAPINPUT.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: MS_ACCESS_BULK_LOAD, xml_type: MS_ACCESS_BULK_LOAD, file: job/MS_ACCESS_BULK_LOAD.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: TALEND_JOB_EXEC, xml_type: TALEND_JOB_EXEC, file: job/TALEND_JOB_EXEC.md, status: observed, generator_eligible: false, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
```

Ghi chú: cả 7 dòng kèm ghi chú "deprecated in source 9.4".
Không ID nào deferred — cả 7 đều có đủ getXML/loadXML evidence line-level.
