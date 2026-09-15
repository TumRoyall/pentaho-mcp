# PDI 9.4 catalog — Batch checklist (theo dõi tiến độ)

**Mục đích:** theo dõi toàn bộ backlog còn lại (B2c → B7). Mỗi batch = 1 sub-agent
viết reference+test+source-notes theo gói 3-5 ID; **Kiro** chạy test + review đối
chiếu source + commit; **user** push.

**Source pin:** `1a939ab5cabe4517867879684aeca2a526bcc638` (branch 9.4).
**Mức bằng chứng:** `source_reviewed` (B7 deprecated giữ `observed`).
**Nhịp commit:** 1 commit / batch (B6 chia nhiều commit theo cụm).

Trạng thái: `[ ]` chưa làm · `[~]` agent đang chạy / chờ review · `[x]` đã commit.

Đã xong trước đó (đã commit): B1 (12 ID, `34c0be5`), B2a (4 ID, `156f984`),
B2b (3 ID, `dd74186`). Catalog hiện: 111 dòng.

---

## B2 (còn lại)

- [ ] **B2c** — SCD/warehouse (2 ID) · *có DB connection → fixture phải khai báo `<connection>`*
  - [ ] trans `DimensionLookup` — `engine/.../trans/steps/dimensionlookup/DimensionLookupMeta.java`
  - [ ] trans `CombinationLookup` — `plugins/core/impl/.../trans/steps/combinationlookup/CombinationLookupMeta.java`
  - commit: ______

- [ ] **B2d** — DB proc/sync/job SQL (4 ID) · *đều có DB connection*
  - [ ] trans `DBProc` — `engine/.../trans/steps/dbproc/DBProcMeta.java`
  - [ ] trans `SynchronizeAfterMerge` — `engine/.../trans/steps/synchronizeaftermerge/SynchronizeAfterMergeMeta.java`
  - [ ] job `WAIT_FOR_SQL` — `engine/.../job/entries/waitforsql/JobEntryWaitForSQL.java`
  - [ ] job `COLUMNS_EXIST` — `engine/.../job/entries/columnsexist/JobEntryColumnsExist.java`
  - commit: ______  → **B2 HOÀN TẤT (13/13 ID)**

---

## B3 — làm sạch / biến đổi (14 ID) · *phần lớn không cần connection*

- [ ] **B3a** (5 ID)
  - [ ] trans `CheckSum` · [ ] trans `CloneRow` · [ ] trans `IfNull` · [ ] trans `NumberRange` · [ ] trans `SetValueConstant`
  - commit: ______
- [ ] **B3b** (5 ID)
  - [ ] trans `SetValueField` · [ ] trans `ReplaceString` · [ ] trans `SplitFieldToRows3` · [ ] trans `FieldSplitter` · [ ] trans `UniqueRowsByHashSet`
  - commit: ______
- [ ] **B3c** (4 ID)
  - [ ] trans `Normaliser` · [ ] trans `Denormaliser` · [ ] trans `Validator` · [ ] trans `Formula`
  - commit: ______  → **B3 HOÀN TẤT (14/14 ID)**

---

## B4 — file/JSON/XML/YAML/HTTP/FTP + job điều kiện (27 ID) · *auth bằng `${VAR}`*

- [ ] **B4a** — XML plugin trans (6 ID)
  - [ ] trans `AddXML` · [ ] trans `getXMLData` · [ ] trans `XMLJoin` · [ ] trans `XSDValidator` · [ ] trans `XSLT` · [ ] trans `XMLInputStream`
  - commit: ______
- [ ] **B4b** — XML/DTD job + JSON/YAML (5 ID)
  - [ ] job `DTD_VALIDATOR` · [ ] job `XSD_VALIDATOR` · [ ] job `XML_WELL_FORMED` · [ ] trans `JsonOutput` · [ ] trans `YamlInput`
  - commit: ______
- [ ] **B4c** — HTTP/FTP (7 ID)
  - [ ] trans `HTTP` · [ ] trans `HTTPPOST` · [ ] job `HTTP` · [ ] job `FTP_PUT` · [ ] job `FTP_DELETE` · [ ] job `FTPS_GET` · [ ] job `FTPS_PUT`
  - commit: ______
- [ ] **B4d** — file-management job (5 ID)
  - [ ] job `CREATE_FILE` · [ ] job `WRITE_TO_FILE` · [ ] job `FILE_COMPARE` · [ ] job `FOLDERS_COMPARE` · [ ] job `FOLDER_IS_EMPTY`
  - commit: ______
- [ ] **B4e** — input/output trans (4 ID)
  - [ ] trans `FixedInput` · [ ] trans `LoadFileInput` · [ ] trans `GetFilesRowsCount` · [ ] trans `GetSubFolders`
  - commit: ______
- [ ] **B4f** — còn lại (1 ID)  *(gộp nếu tiện vào B4e)*
  - [ ] trans `PropertyOutput`
  - commit: ______  → **B4 HOÀN TẤT (27/27 ID)**  *(HTTP job/trans trùng chuỗi nhưng KHÁC kind — hợp lệ)*

---

## B5 — alias / đăng ký bất thường (8 ID) · *phải xác minh alias-chung-class vs implementation khác TRƯỚC khi chọn shared vs riêng reference*

- [ ] **B5a** (8 ID — 4 cặp)
  - [ ] trans `ScriptValue` + `ScriptValuesMod` (cùng `ScriptValuesMetaMod`)
  - [ ] trans `Flattener` + `Flatterner` (cùng `FlattenerMeta`)
  - [ ] trans `TeraFast` + `TeraFastPlugin` (cùng `TeraFastMeta`)
  - [ ] job `MAIL_VALIDATOR` + `JobCategory.Category.Mail_VALIDATOR` (cùng `JobEntryMailValidator`)
  - commit: ______  → **B5 HOÀN TẤT (8/8 ID)** *(B5 phải xong phân loại alias trước khi tính coverage cuối)*

---

## B6 — phần còn lại (103 ID) · *chia theo họ plugin; credential `${VAR}`*

- [ ] **B6a** — mail/nagios/net job + mail trans (10 ID)
  - [ ] job `GET_POP` · [ ] job `PING` · [ ] job `TELNET` · [ ] job `SYSLOG` · [ ] job `SNMP_TRAP` · [ ] job `SEND_NAGIOS_PASSIVE_CHECK` · [ ] job `WEBSERVICE_AVAILABLE`
  - [ ] trans `Mail` · [ ] trans `MailInput` · [ ] trans `MailValidator`
  - commit: ______
- [ ] **B6b** — bulk loader trans (7 ID)
  - [ ] trans `MySQLBulkLoader` · [ ] trans `MonetDBBulkLoader` · [ ] trans `PGBulkLoader` · [ ] trans `InfobrightOutput` · [ ] trans `VectorWiseBulkLoader` · [ ] trans `GPLoad` · [ ] trans `OraBulkLoader`*(nếu chưa có; nếu đã có bỏ qua)*
  - commit: ______
- [ ] **B6c** — bulk loader job (5 ID)
  - [ ] job `MSSQL_BULK_LOAD` · [ ] job `MYSQL_BULK_LOAD` · [ ] job `MYSQL_BULK_FILE`
  - [ ] trans `SQLFileOutput` · [ ] trans `ExecSQLRow`
  - commit: ______
- [ ] **B6d** — streaming (6 ID)
  - [ ] trans `Jms2Consumer` · [ ] trans `Jms2Producer` · [ ] trans `MQTTConsumer` · [ ] trans `MQTTProducer` · [ ] trans `RecordsFromStream` · [ ] trans `FileStream`
  - commit: ______
- [ ] **B6e** — Salesforce (5 ID)
  - [ ] trans `SalesforceInput` · [ ] trans `SalesforceInsert` · [ ] trans `SalesforceUpdate` · [ ] trans `SalesforceUpsert` · [ ] trans `SalesforceDelete`
  - commit: ______
- [ ] **B6f** — crypto/PGP (6 ID)
  - [ ] trans `PGPEncryptStream` · [ ] trans `PGPDecryptStream` · [ ] trans `SymmetricCryptoTrans` · [ ] trans `SecretKeyGenerator`
  - [ ] job `PGP_ENCRYPT_FILES` · [ ] job `PGP_DECRYPT_FILES` · [ ] job `PGP_VERIFY_FILES`
  - commit: ______
- [ ] **B6g** — LDAP + directory input (5 ID)
  - [ ] trans `LDAPInput` · [ ] trans `LDAPOutput` · [ ] trans `LDIFInput` · [ ] trans `AccessInput` · [ ] trans `AccessOutput`
  - commit: ______
- [ ] **B6h** — Palo (4 ID)
  - [ ] trans `PaloCellInput` · [ ] trans `PaloCellOutput` · [ ] trans `PaloDimInput` · [ ] trans `PaloDimOutput`
  - commit: ______
- [ ] **B6i** — DB lookup/utility trans (6 ID)
  - [ ] trans `DynamicSQLRow` · [ ] trans `FuzzyMatch` · [ ] trans `WebServiceLookup` · [ ] trans `WebServiceAvailable` · [ ] trans `GetTableNames` · [ ] trans `MultiwayMergeJoin`
  - commit: ______
- [ ] **B6j** — file/lock/process utility trans (6 ID)
  - [ ] trans `FileExists` · [ ] trans `FileLocked` · [ ] trans `ExecProcess` · [ ] trans `ZipFile` · [ ] trans `ChangeFileEncoding` · [ ] trans `Delay`
  - commit: ______
- [ ] **B6k** — scripting/rules (5 ID)
  - [ ] trans `Janino` · [ ] trans `JavaFilter` · [ ] trans `UserDefinedJavaClass` · [ ] trans `RuleAccumulator` · [ ] trans `RuleExecutor`
  - commit: ______
- [ ] **B6l** — statistics/sampling (5 ID)
  - [ ] trans `SampleRows` · [ ] trans `ReservoirSampling` · [ ] trans `UnivariateStats` · [ ] trans `StepsMetrics` · [ ] trans `FieldsChangeSequence`
  - commit: ______
- [ ] **B6m** — input connectors (7 ID)
  - [ ] trans `XBaseInput` · [ ] trans `SASInput` · [ ] trans `S3CSVINPUT` · [ ] trans `RssInput` · [ ] trans `RssOutput` · [ ] trans `MondrianInput` · [ ] trans `OlapInput`
  - commit: ______
- [ ] **B6n** — inline/socket/misc (7 ID)
  - [ ] trans `Injector` · [ ] trans `SocketReader` · [ ] trans `SocketWriter` · [ ] trans `PrioritizeStreams` · [ ] trans `GetSlaveSequence` · [ ] trans `GetRepositoryNames` · [ ] trans `StepMetastructure`
  - commit: ______
- [ ] **B6o** — external services/output (7 ID)
  - [ ] trans `SSH` · [ ] trans `SFTPPut` · [ ] trans `HL7Input` · [ ] trans `ShapeFileReader` · [ ] trans `PentahoReportingOutput` · [ ] trans `CubeInput` · [ ] trans `CubeOutput`
  - commit: ______
- [ ] **B6p** — còn lại (dọn phần chưa gom, ~7 ID)
  - [ ] trans `AutoDoc` · [ ] trans `ClosureGenerator` · [ ] trans `CreditCardValidator` · [ ] trans `RandomCCNumberGenerator` · [ ] trans `SyslogMessage` · [ ] trans `TableCompare` · [ ] trans `ParallelGzipCsvInput`
  - [ ] job `CONNECTED_TO_REPOSITORY` · [ ] job `DOS_UNIX_CONVERTER` · [ ] job `EVAL` · [ ] job `MSGBOX_INFO`
  - [ ] trans `TypeExitEdi2XmlStep` · [ ] trans `TypeExitGoogleAnalyticsInputStep`
  - commit: ______  → **B6 HOÀN TẤT (~103 ID)** *(số gói/cụm có thể điều chỉnh khi đọc source thực tế)*

---

## B7 — deprecated (21 ID) · *giữ `observed` (không generator-eligible) trừ khi user đổi ý; đánh giá generation riêng*

- [ ] **B7a** (7 ID)
  - [ ] trans `AggregateRows` · [ ] trans `DummyStep` · [ ] trans `OldTextFileInput` · [ ] trans `Script` · [ ] trans `TextFileOutputLegacy` · [ ] trans `GetPreviousRowField` · [ ] trans `ElasticSearchBulk`
  - commit: ______
- [ ] **B7b** — OpenERP/Palo-deprecated (7 ID)
  - [ ] trans `OpenERPObjectInput` · [ ] trans `OpenERPObjectOutputImport` · [ ] trans `OpenERPObjectDelete`
  - [ ] trans `XMLInput` · [ ] trans `XMLInputSax` · [ ] trans `GPBulkLoader` · [ ] trans `LucidDBStreamingLoader`
  - commit: ______
- [ ] **B7c** — bulk/SAP + job deprecated (rest, ~7 ID)
  - [ ] trans `SAPINPUT`
  - [ ] job `MS_ACCESS_BULK_LOAD` · [ ] job `TALEND_JOB_EXEC`
  - *(Palo deprecated đã gom ở B6h nếu source không xếp Deprecated; nếu xếp Deprecated thì làm ở đây)*
  - commit: ______  → **B7 HOÀN TẤT (21/21 ID)**

---

## Đóng plan (task cuối)

- [ ] Diff `(kind,xml_type)` catalog vs inventory; mọi ID có trạng thái kết thúc (canonical/observed/alias/deprecated/deferred).
- [ ] Điều tra `SetSessionVariableStep` (observed sẵn) — chỉ nâng nếu có bằng chứng plugin/9.4.
- [ ] Cập nhật evidence report + số liệu catalog + handoff; báo cáo canonical/observed/alias/deprecated/deferred.
- [ ] Test cuối; tách coverage source khỏi runtime/Spoon.

---

### Ghi chú phân loại (đọc khi bắt đầu batch)
- Một số ID trong danh sách gom tạm theo tên; khi agent đọc source nếu category/Deprecated khác dự kiến thì di chuyển sang batch đúng và ghi lại ở đây.
- `OraBulkLoader` có thể đã nằm trong catalog (mục "Hiện có") — kiểm tra trước, nếu có thì bỏ khỏi B6b.
- Alias trùng chuỗi khác kind (HTTP job/trans; TABLE_EXISTS) là hợp lệ — catalog tách theo kind.
