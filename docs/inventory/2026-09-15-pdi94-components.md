# Danh sách mở rộng step / job entry PDI 9.4

Ngày kiểm kê: 2026-09-15. Source commit: `1a939ab5cabe4517867879684aeca2a526bcc638`, branch `9.4`.

## Phạm vi và cách đọc

Đối chiếu hai registry XML trong `engine/src/main/resources` và annotation `@Step` / `@JobEntry` có ID chuỗi literal trong `engine` và `plugins`, chỉ `src/main/java`. Tách ID ngăn bởi dấu phẩy; đối chiếu theo `(kind, xml_type)`, không theo tên hiển thị. Đây là snapshot source, không phải danh sách plugin đã cài trên máy. Không bao gồm plugin ở repository khác, annotation dùng hằng số, hoặc đăng ký động.

- Catalog: 58 dòng step (57 canonical, 1 observed), 34 dòng entry (34 canonical).
- Job có 33 XML type riêng vì START và FAILURE cùng dùng SPECIAL.
- Source tìm thấy: 215 ID step, 73 ID entry; đã có 57 ID step và 33 ID entry trong catalog.
- Backlog: **158 ID step + 40 ID entry = 198 ID**. Có alias trong số này; không diễn giải thành 198 implementation độc lập.
- `SetSessionVariableStep` đang observed và không tìm thấy trong phạm vi source này; cần xác định plugin/version trước khi nâng trạng thái.
- `docs/pdi94-evidence-report.md` còn ghi 88 dòng; catalog thực tế hiện có 92 dòng.

## Các đợt đề xuất

| Đợt | Nội dung |
|---|---|
| B1 | Truyền kết quả, mapping, điều khiển luồng |
| B2 | Database, lookup, data warehouse, aggregation |
| B3 | Làm sạch và biến đổi dữ liệu |
| B4 | File, JSON/XML/YAML, HTTP/FTP và điều kiện job |
| B5 | Xác minh alias và ID đăng ký bất thường |
| B6 | Các ID còn lại, chia tiếp theo category và dependency |
| B7 | Deprecated: phục vụ đọc/bảo trì; đánh giá riêng khả năng generation |

Mỗi đợt chia thành gói 3–5 ID có quan hệ; B6/B7 không giao thành một task lớn. Thứ tự ưu tiên là đề xuất theo chức năng, chưa dựa trên tần suất workload của bạn. Khi có cây KJB/KTR thật, dùng `kettle_knowledge_coverage` để điều chỉnh.

## B1 — 12 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [x] | job | `ADD_RESULT_FILENAMES` | FileManagement | `org.pentaho.di.job.entries.addresultfilenames.JobEntryAddResultFilenames` — `plugins/core/impl/src/main/java/org/pentaho/di/job/entries/addresultfilenames/JobEntryAddResultFilenames.java` |
| [x] | job | `COPY_MOVE_RESULT_FILENAMES` | FileManagement | `org.pentaho.di.job.entries.copymoveresultfilenames.JobEntryCopyMoveResultFilenames` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | job | `DELETE_RESULT_FILENAMES` | FileManagement | `org.pentaho.di.job.entries.deleteresultfilenames.JobEntryDeleteResultFilenames` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | trans | `Append` | Flow | `org.pentaho.di.trans.steps.append.AppendMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/append/AppendMeta.java` |
| [x] | trans | `BlockingStep` | Flow | `org.pentaho.di.trans.steps.blockingstep.BlockingStepMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockingstep/BlockingStepMeta.java` |
| [x] | trans | `DetectEmptyStream` | Flow | `org.pentaho.di.trans.steps.detectemptystream.DetectEmptyStreamMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `DetectLastRow` | Flow | `org.pentaho.di.trans.steps.detectlastrow.DetectLastRowMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `FilesFromResult` | Job | `org.pentaho.di.trans.steps.filesfromresult.FilesFromResultMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `FilesToResult` | Job | `org.pentaho.di.trans.steps.filestoresult.FilesToResultMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `MappingInput` | Mapping | `org.pentaho.di.trans.steps.mappinginput.MappingInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `MappingOutput` | Mapping | `org.pentaho.di.trans.steps.mappingoutput.MappingOutputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `RowsFromResult` | Job | `org.pentaho.di.trans.steps.rowsfromresult.RowsFromResultMeta` — `engine/src/main/resources/kettle-steps.xml` |

## B2 — 13 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | job | `COLUMNS_EXIST` | Conditions | `org.pentaho.di.job.entries.columnsexist.JobEntryColumnsExist` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | job | `TABLE_EXISTS` | Conditions | `org.pentaho.di.job.entries.tableexists.JobEntryTableExists` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `WAIT_FOR_SQL` | Utility | `org.pentaho.di.job.entries.waitforsql.JobEntryWaitForSQL` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | trans | `AnalyticQuery` | Statistics | `org.pentaho.di.trans.steps.analyticquery.AnalyticQueryMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/analyticquery/AnalyticQueryMeta.java` |
| [x] | trans | `ColumnExists` | Lookup | `org.pentaho.di.trans.steps.columnexists.ColumnExistsMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/columnexists/ColumnExistsMeta.java` |
| [ ] | trans | `CombinationLookup` | DataWarehouse | `org.pentaho.di.trans.steps.combinationlookup.CombinationLookupMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/combinationlookup/CombinationLookupMeta.java` |
| [x] | trans | `DBJoin` | Lookup | `org.pentaho.di.trans.steps.databasejoin.DatabaseJoinMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `DBProc` | Lookup | `org.pentaho.di.trans.steps.dbproc.DBProcMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `DimensionLookup` | DataWarehouse | `org.pentaho.di.trans.steps.dimensionlookup.DimensionLookupMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `MemoryGroupBy` | Statistics | `org.pentaho.di.trans.steps.memgroupby.MemoryGroupByMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `SortedMerge` | Joins | `org.pentaho.di.trans.steps.sortedmerge.SortedMergeMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SynchronizeAfterMerge` | Output | `org.pentaho.di.trans.steps.synchronizeaftermerge.SynchronizeAfterMergeMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `TableExists` | Lookup | `org.pentaho.di.trans.steps.tableexists.TableExistsMeta` — `engine/src/main/resources/kettle-steps.xml` |

## B3 — 14 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | trans | `CheckSum` | Transform | `org.pentaho.di.trans.steps.checksum.CheckSumMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/checksum/CheckSumMeta.java` |
| [ ] | trans | `CloneRow` | Utility | `org.pentaho.di.trans.steps.clonerow.CloneRowMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/clonerow/CloneRowMeta.java` |
| [ ] | trans | `Denormaliser` | Transform | `org.pentaho.di.trans.steps.denormaliser.DenormaliserMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `FieldSplitter` | Transform | `org.pentaho.di.trans.steps.fieldsplitter.FieldSplitterMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Formula` | Scripting | `org.pentaho.di.trans.steps.formula.FormulaMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `IfNull` | Utility | `org.pentaho.di.trans.steps.ifnull.IfNullMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Normaliser` | Transform | `org.pentaho.di.trans.steps.normaliser.NormaliserMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `NumberRange` | Transform | `org.pentaho.di.trans.steps.numberrange.NumberRangeMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ReplaceString` | Transform | `org.pentaho.di.trans.steps.replacestring.ReplaceStringMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SetValueConstant` | Transform | `org.pentaho.di.trans.steps.setvalueconstant.SetValueConstantMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SetValueField` | Transform | `org.pentaho.di.trans.steps.setvaluefield.SetValueFieldMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SplitFieldToRows3` | Transform | `org.pentaho.di.trans.steps.splitfieldtorows.SplitFieldToRowsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `UniqueRowsByHashSet` | Transform | `org.pentaho.di.trans.steps.uniquerowsbyhashset.UniqueRowsByHashSetMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Validator` | Validation | `org.pentaho.di.trans.steps.validator.ValidatorMeta` — `engine/src/main/resources/kettle-steps.xml` |

## B4 — 27 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | job | `CREATE_FILE` | FileManagement | `org.pentaho.di.job.entries.createfile.JobEntryCreateFile` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `DTD_VALIDATOR` | Category | `org.pentaho.di.job.entries.dtdvalidator.JobEntryDTDValidator` — `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/dtdvalidator/JobEntryDTDValidator.java` |
| [ ] | job | `FILE_COMPARE` | FileManagement | `org.pentaho.di.job.entries.filecompare.JobEntryFileCompare` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FOLDER_IS_EMPTY` | Conditions | `org.pentaho.di.job.entries.folderisempty.JobEntryFolderIsEmpty` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FOLDERS_COMPARE` | FileManagement | `org.pentaho.di.job.entries.folderscompare.JobEntryFoldersCompare` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FTP_DELETE` | FileTransfer | `org.pentaho.di.job.entries.ftpdelete.JobEntryFTPDelete` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FTP_PUT` | FileTransfer | `org.pentaho.di.job.entries.ftpput.JobEntryFTPPUT` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FTPS_GET` | FileTransfer | `org.pentaho.di.job.entries.ftpsget.JobEntryFTPSGet` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `FTPS_PUT` | FileTransfer | `org.pentaho.di.job.entries.ftpsput.JobEntryFTPSPUT` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `HTTP` | FileManagement | `org.pentaho.di.job.entries.http.JobEntryHTTP` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `WRITE_TO_FILE` | FileManagement | `org.pentaho.di.job.entries.writetofile.JobEntryWriteToFile` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `XML_WELL_FORMED` | Category | `org.pentaho.di.job.entries.xmlwellformed.JobEntryXMLWellFormed` — `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xmlwellformed/JobEntryXMLWellFormed.java` |
| [ ] | job | `XSD_VALIDATOR` | Category | `org.pentaho.di.job.entries.xsdvalidator.JobEntryXSDValidator` — `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xsdvalidator/JobEntryXSDValidator.java` |
| [ ] | trans | `AddXML` | category | `org.pentaho.di.trans.steps.addxml.AddXMLMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/addxml/AddXMLMeta.java` |
| [ ] | trans | `FixedInput` | Input | `org.pentaho.di.trans.steps.fixedinput.FixedInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GetFilesRowsCount` | Input | `org.pentaho.di.trans.steps.getfilesrowscount.GetFilesRowsCountMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GetSubFolders` | Input | `org.pentaho.di.trans.steps.getsubfolders.GetSubFoldersMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `getXMLData` | category | `org.pentaho.di.trans.steps.getxmldata.GetXMLDataMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXMLDataMeta.java` |
| [ ] | trans | `HTTP` | Lookup | `org.pentaho.di.trans.steps.http.HTTPMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `HTTPPOST` | Lookup | `org.pentaho.di.trans.steps.httppost.HTTPPOSTMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `JsonOutput` | category | `org.pentaho.di.trans.steps.jsonoutput.JsonOutputMeta` — `plugins/json/core/src/main/java/org/pentaho/di/trans/steps/jsonoutput/JsonOutputMeta.java` |
| [ ] | trans | `LoadFileInput` | Input | `org.pentaho.di.trans.steps.loadfileinput.LoadFileInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `PropertyOutput` | Output | `org.pentaho.di.trans.steps.propertyoutput.PropertyOutputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `XMLJoin` | category | `org.pentaho.di.trans.steps.xmljoin.XMLJoinMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmljoin/XMLJoinMeta.java` |
| [ ] | trans | `XSDValidator` | category | `org.pentaho.di.trans.steps.xsdvalidator.XsdValidatorMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xsdvalidator/XsdValidatorMeta.java` |
| [ ] | trans | `XSLT` | category | `org.pentaho.di.trans.steps.xslt.XsltMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xslt/XsltMeta.java` |
| [ ] | trans | `YamlInput` | Input | `org.pentaho.di.trans.steps.yamlinput.YamlInputMeta` — `plugins/yaml-input/impl/src/main/java/org/pentaho/di/trans/steps/yamlinput/YamlInputMeta.java` |

## B5 — 8 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | job | `JobCategory.Category.Mail_VALIDATOR` | Mail | `org.pentaho.di.job.entries.mailvalidator.JobEntryMailValidator` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `MAIL_VALIDATOR` | Mail | `org.pentaho.di.job.entries.mailvalidator.JobEntryMailValidator` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | trans | `Flattener` | Transform | `org.pentaho.di.trans.steps.flattener.FlattenerMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Flatterner` | Transform | `org.pentaho.di.trans.steps.flattener.FlattenerMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ScriptValue` | Scripting | `org.pentaho.di.trans.steps.scriptvalues_mod.ScriptValuesMetaMod` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ScriptValuesMod` | Scripting | `org.pentaho.di.trans.steps.scriptvalues_mod.ScriptValuesMetaMod` — `engine/src/main/java/org/pentaho/di/trans/steps/scriptvalues_mod/ScriptValuesMetaMod.java` |
| [ ] | trans | `TeraFast` | Bulk | `org.pentaho.di.trans.steps.terafastbulkloader.TeraFastMeta` — `plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java` |
| [ ] | trans | `TeraFastPlugin` | Bulk | `org.pentaho.di.trans.steps.terafastbulkloader.TeraFastMeta` — `plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java` |

## B6 — 103 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | job | `CONNECTED_TO_REPOSITORY` | Repository | `org.pentaho.di.job.entries.connectedtorepository.JobEntryConnectedToRepository` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `DOS_UNIX_CONVERTER` | FileManagement | `org.pentaho.di.job.entries.dostounix.JobEntryDosToUnix` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `EVAL` | Scripting | `org.pentaho.di.job.entries.eval.JobEntryEval` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `GET_POP` | Mail | `org.pentaho.di.job.entries.getpop.JobEntryGetPOP` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `MSGBOX_INFO` | Utility | `org.pentaho.di.job.entries.msgboxinfo.JobEntryMsgBoxInfo` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `MSSQL_BULK_LOAD` | BulkLoading | `org.pentaho.di.job.entries.mssqlbulkload.JobEntryMssqlBulkLoad` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `MYSQL_BULK_FILE` | BulkLoading | `org.pentaho.di.job.entries.mysqlbulkfile.JobEntryMysqlBulkFile` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `MYSQL_BULK_LOAD` | BulkLoading | `org.pentaho.di.job.entries.mysqlbulkload.JobEntryMysqlBulkLoad` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | job | `PGP_DECRYPT_FILES` | FileEncryption | `org.pentaho.di.job.entries.pgpdecryptfiles.JobEntryPGPDecryptFiles` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | job | `PGP_ENCRYPT_FILES` | FileEncryption | `org.pentaho.di.job.entries.pgpencryptfiles.JobEntryPGPEncryptFiles` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | job | `PGP_VERIFY_FILES` | FileEncryption | `org.pentaho.di.job.entries.pgpverify.JobEntryPGPVerify` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `PING` | Utility | `org.pentaho.di.job.entries.ping.JobEntryPing` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `SEND_NAGIOS_PASSIVE_CHECK` | Utility | `org.pentaho.di.job.entries.sendnagiospassivecheck.JobEntrySendNagiosPassiveCheck` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `SNMP_TRAP` | Utility | `org.pentaho.di.job.entries.snmptrap.JobEntrySNMPTrap` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `SYSLOG` | Utility | `org.pentaho.di.job.entries.syslog.JobEntrySyslog` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `TELNET` | Utility | `org.pentaho.di.job.entries.telnet.JobEntryTelnet` — `engine/src/main/resources/kettle-job-entries.xml` |
| [ ] | job | `WEBSERVICE_AVAILABLE` | Conditions | `org.pentaho.di.job.entries.webserviceavailable.JobEntryWebServiceAvailable` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | trans | `AccessInput` | Input | `org.pentaho.di.trans.steps.accessinput.AccessInputMeta` — `plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessinput/AccessInputMeta.java` |
| [x] | trans | `AccessOutput` | Output | `org.pentaho.di.trans.steps.accessoutput.AccessOutputMeta` — `plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessoutput/AccessOutputMeta.java` |
| [ ] | trans | `AutoDoc` | Output | `org.pentaho.di.trans.steps.autodoc.AutoDocMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/autodoc/AutoDocMeta.java` |
| [ ] | trans | `AvroInputNew` | BigData | `org.pentaho.di.trans.steps.avro.input.AvroInputMeta` — `plugins/avro-format/core/src/main/java/org/pentaho/di/trans/steps/avro/input/AvroInputMeta.java` |
| [ ] | trans | `AvroOutput` | BigData | `org.pentaho.di.trans.steps.avro.output.AvroOutputMeta` — `plugins/avro-format/core/src/main/java/org/pentaho/di/trans/steps/avro/output/AvroOutputMeta.java` |
| [x] | trans | `ChangeFileEncoding` | Utility | `org.pentaho.di.trans.steps.changefileencoding.ChangeFileEncodingMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/changefileencoding/ChangeFileEncodingMeta.java` |
| [ ] | trans | `ClosureGenerator` | Transform | `org.pentaho.di.trans.steps.closure.ClosureGeneratorMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/closure/ClosureGeneratorMeta.java` |
| [ ] | trans | `CreditCardValidator` | Validation | `org.pentaho.di.trans.steps.creditcardvalidator.CreditCardValidatorMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `CubeInput` | Input | `org.pentaho.di.trans.steps.cubeinput.CubeInputMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeinput/CubeInputMeta.java` |
| [ ] | trans | `CubeOutput` | Output | `org.pentaho.di.trans.steps.cubeoutput.CubeOutputMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeoutput/CubeOutputMeta.java` |
| [ ] | trans | `Delay` | Utility | `org.pentaho.di.trans.steps.delay.DelayMeta` — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/delay/DelayMeta.java` |
| [ ] | trans | `DynamicSQLRow` | Lookup | `org.pentaho.di.trans.steps.dynamicsqlrow.DynamicSQLRowMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `ExecProcess` | Utility | `org.pentaho.di.trans.steps.execprocess.ExecProcessMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ExecSQLRow` | Scripting | `org.pentaho.di.trans.steps.execsqlrow.ExecSQLRowMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `FieldsChangeSequence` | Transform | `org.pentaho.di.trans.steps.fieldschangesequence.FieldsChangeSequenceMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `FileExists` | Lookup | `org.pentaho.di.trans.steps.fileexists.FileExistsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `FileLocked` | Lookup | `org.pentaho.di.trans.steps.filelocked.FileLockedMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `FileStream` | Streaming | `org.pentaho.di.trans.step.filestream.FileStreamMeta` — `plugins/file-stream/src/main/java/org/pentaho/di/trans/step/filestream/FileStreamMeta.java` |
| [ ] | trans | `FuzzyMatch` | Lookup | `org.pentaho.di.trans.steps.fuzzymatch.FuzzyMatchMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GetRepositoryNames` | Input | `org.pentaho.di.trans.steps.getrepositorynames.GetRepositoryNamesMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GetSlaveSequence` | Transform | `org.pentaho.di.trans.steps.getslavesequence.GetSlaveSequenceMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GetTableNames` | Input | `org.pentaho.di.trans.steps.gettablenames.GetTableNamesMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `GPLoad` | Bulk | `org.pentaho.di.trans.steps.gpload.GPLoadMeta` — `plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java` |
| [ ] | trans | `HL7Input` | Input | `org.pentaho.di.trans.steps.hl7input.HL7InputMeta` — `plugins/hl7/core/src/main/java/org/pentaho/di/trans/steps/hl7input/HL7InputMeta.java` |
| [ ] | trans | `InfobrightOutput` | Bulk | `org.pentaho.di.trans.steps.infobrightoutput.InfobrightLoaderMeta` — `plugins/infobright-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/infobrightoutput/InfobrightLoaderMeta.java` |
| [ ] | trans | `Injector` | Inline | `org.pentaho.di.trans.steps.injector.InjectorMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `Janino` | Scripting | `org.pentaho.di.trans.steps.janino.JaninoMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `JavaFilter` | Flow | `org.pentaho.di.trans.steps.javafilter.JavaFilterMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Jms2Consumer` | Streaming | `org.pentaho.di.trans.step.jms.JmsConsumerMeta` — `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsConsumerMeta.java` |
| [ ] | trans | `Jms2Producer` | Streaming | `org.pentaho.di.trans.step.jms.JmsProducerMeta` — `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsProducerMeta.java` |
| [x] | trans | `LDAPInput` | Input | `org.pentaho.di.trans.steps.ldapinput.LDAPInputMeta` — `plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapinput/LDAPInputMeta.java` |
| [x] | trans | `LDAPOutput` | Output | `org.pentaho.di.trans.steps.ldapoutput.LDAPOutputMeta` — `plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapoutput/LDAPOutputMeta.java` |
| [x] | trans | `LDIFInput` | Input | `org.pentaho.di.trans.steps.ldifinput.LDIFInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `Mail` | Utility | `org.pentaho.di.trans.steps.mail.MailMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `MailInput` | Input | `org.pentaho.di.trans.steps.mailinput.MailInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `MailValidator` | Validation | `org.pentaho.di.trans.steps.mailvalidator.MailValidatorMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `MondrianInput` | Input | `org.pentaho.di.trans.steps.mondrianinput.MondrianInputMeta` — `plugins/mondrianinput/impl/src/main/java/org/pentaho/di/trans/steps/mondrianinput/MondrianInputMeta.java` |
| [ ] | trans | `MonetDBBulkLoader` | Bulk | `org.pentaho.di.trans.steps.monetdbbulkloader.MonetDBBulkLoaderMeta` — `plugins/monet-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/monetdbbulkloader/MonetDBBulkLoaderMeta.java` |
| [ ] | trans | `MQTTConsumer` | Streaming | `org.pentaho.di.trans.step.mqtt.MQTTConsumerMeta` — `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTConsumerMeta.java` |
| [ ] | trans | `MQTTProducer` | Streaming | `org.pentaho.di.trans.step.mqtt.MQTTProducerMeta` — `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTProducerMeta.java` |
| [ ] | trans | `MultiwayMergeJoin` | Joins | `org.pentaho.di.trans.steps.multimerge.MultiMergeJoinMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `MySQLBulkLoader` | Bulk | `org.pentaho.di.trans.steps.mysqlbulkloader.MySQLBulkLoaderMeta` — `plugins/mysql-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/mysqlbulkloader/MySQLBulkLoaderMeta.java` |
| [ ] | trans | `OlapInput` | Input | `org.pentaho.di.trans.steps.olapinput.OlapInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ParallelGzipCsvInput` | Input | `org.pentaho.di.trans.steps.parallelgzipcsv.ParGzipCsvInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `PentahoReportingOutput` | Output | `org.pentaho.di.trans.steps.pentahoreporting.PentahoReportingOutputMeta` — `plugins/pentaho-reporting/impl/src/main/java/org/pentaho/di/trans/steps/pentahoreporting/PentahoReportingOutputMeta.java` |
| [ ] | trans | `PGBulkLoader` | Bulk | `org.pentaho.di.trans.steps.pgbulkloader.PGBulkLoaderMeta` — `plugins/postgresql-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/pgbulkloader/PGBulkLoaderMeta.java` |
| [x] | trans | `PGPDecryptStream` | Cryptography | `org.pentaho.di.trans.steps.pgpdecryptstream.PGPDecryptStreamMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `PGPEncryptStream` | Cryptography | `org.pentaho.di.trans.steps.pgpencryptstream.PGPEncryptStreamMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `PrioritizeStreams` | Flow | `org.pentaho.di.trans.steps.prioritizestreams.PrioritizeStreamsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `RandomCCNumberGenerator` | Input | `org.pentaho.di.trans.steps.randomccnumber.RandomCCNumberGeneratorMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `RecordsFromStream` | Streaming | `org.pentaho.di.trans.steps.recordsfromstream.RecordsFromStreamMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `ReservoirSampling` | Statistics | `org.pentaho.di.trans.steps.reservoirsampling.ReservoirSamplingMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `RssInput` | Input | `org.pentaho.di.trans.steps.rssinput.RssInputMeta` — `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssinput/RssInputMeta.java` |
| [ ] | trans | `RssOutput` | Output | `org.pentaho.di.trans.steps.rssoutput.RssOutputMeta` — `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssoutput/RssOutputMeta.java` |
| [x] | trans | `RuleAccumulator` | Scripting | `org.pentaho.di.trans.steps.rules.RulesAccumulatorMeta` — `plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesAccumulatorMeta.java` |
| [x] | trans | `RuleExecutor` | Scripting | `org.pentaho.di.trans.steps.rules.RulesExecutorMeta` — `plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesExecutorMeta.java` |
| [ ] | trans | `S3CSVINPUT` | Input | `org.pentaho.di.trans.steps.s3csvinput.S3CsvInputMeta` — `plugins/s3csvinput/core/src/main/java/org/pentaho/di/trans/steps/s3csvinput/S3CsvInputMeta.java` |
| [x] | trans | `SalesforceDelete` | Output | `org.pentaho.di.trans.steps.salesforcedelete.SalesforceDeleteMeta` — `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforcedelete/SalesforceDeleteMeta.java` |
| [x] | trans | `SalesforceInput` | Input | `org.pentaho.di.trans.steps.salesforceinput.SalesforceInputMeta` — `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinput/SalesforceInputMeta.java` |
| [x] | trans | `SalesforceInsert` | Output | `org.pentaho.di.trans.steps.salesforceinsert.SalesforceInsertMeta` — `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinsert/SalesforceInsertMeta.java` |
| [x] | trans | `SalesforceUpdate` | Output | `org.pentaho.di.trans.steps.salesforceupdate.SalesforceUpdateMeta` — `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupdate/SalesforceUpdateMeta.java` |
| [x] | trans | `SalesforceUpsert` | Output | `org.pentaho.di.trans.steps.salesforceupsert.SalesforceUpsertMeta` — `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupsert/SalesforceUpsertMeta.java` |
| [x] | trans | `SampleRows` | Statistics | `org.pentaho.di.trans.steps.samplerows.SampleRowsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SASInput` | Input | `org.pentaho.di.trans.steps.sasinput.SasInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `SecretKeyGenerator` | Cryptography | `org.pentaho.di.trans.steps.symmetriccrypto.secretkeygenerator.SecretKeyGeneratorMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SFTPPut` | Experimental | `org.pentaho.di.trans.steps.sftpput.SFTPPutMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `ShapeFileReader` | Input | `org.pentaho.di.shapefilereader.ShapeFileReaderMeta` — `plugins/shapefilereader/core/src/main/java/org/pentaho/di/shapefilereader/ShapeFileReaderMeta.java` |
| [ ] | trans | `SocketReader` | Inline | `org.pentaho.di.trans.steps.socketreader.SocketReaderMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SocketWriter` | Inline | `org.pentaho.di.trans.steps.socketwriter.SocketWriterMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SQLFileOutput` | Output | `org.pentaho.di.trans.steps.sqlfileoutput.SQLFileOutputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SSH` | Utility | `org.pentaho.di.trans.steps.ssh.SSHMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `StepMetastructure` | Utility | `org.pentaho.di.trans.steps.stepmeta.StepMetastructureMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `StepsMetrics` | Statistics | `org.pentaho.di.trans.steps.stepsmetrics.StepsMetricsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `SymmetricCryptoTrans` | Cryptography | `org.pentaho.di.trans.steps.symmetriccrypto.symmetriccryptotrans.SymmetricCryptoTransMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `SyslogMessage` | Utility | `org.pentaho.di.trans.steps.syslog.SyslogMessageMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `TableCompare` | Name | `org.pentaho.di.trans.steps.tablecompare.TableCompareMeta` — `engine/src/main/java/org/pentaho/di/trans/steps/tablecompare/TableCompareMeta.java` |
| [ ] | trans | `TypeExitEdi2XmlStep` | Utility | `org.pentaho.di.trans.steps.edi2xml.Edi2XmlMeta` — `plugins/edi2xml/impl/src/main/java/org/pentaho/di/trans/steps/edi2xml/Edi2XmlMeta.java` |
| [ ] | trans | `TypeExitGoogleAnalyticsInputStep` | Input | `org.pentaho.di.trans.steps.googleanalytics.GaInputStepMeta` — `plugins/google-analytics/core/src/main/java/org/pentaho/di/trans/steps/googleanalytics/GaInputStepMeta.java` |
| [x] | trans | `UnivariateStats` | Statistics | `org.pentaho.di.trans.steps.univariatestats.UnivariateStatsMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `UserDefinedJavaClass` | Scripting | `org.pentaho.di.trans.steps.userdefinedjavaclass.UserDefinedJavaClassMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `VectorWiseBulkLoader` | Bulk | `org.pentaho.di.trans.steps.ivwloader.IngresVectorwiseLoaderMeta` — `plugins/ivw-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/ivwloader/IngresVectorwiseLoaderMeta.java` |
| [ ] | trans | `WebServiceAvailable` | Lookup | `org.pentaho.di.trans.steps.webserviceavailable.WebServiceAvailableMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `WebServiceLookup` | Lookup | `org.pentaho.di.trans.steps.webservices.WebServiceMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `XBaseInput` | Input | `org.pentaho.di.trans.steps.xbaseinput.XBaseInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `XMLInputStream` | category | `org.pentaho.di.trans.steps.xmlinputstream.XMLInputStreamMeta` — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmlinputstream/XMLInputStreamMeta.java` |
| [x] | trans | `ZipFile` | Utility | `org.pentaho.di.trans.steps.zipfile.ZipFileMeta` — `engine/src/main/resources/kettle-steps.xml` |

## B7 — 21 ID chưa có catalog

| Xong | Kind | XML/plugin ID | Category nguồn | Class / nguồn đăng ký |
|---|---|---|---|---|
| [ ] | job | `MS_ACCESS_BULK_LOAD` | Deprecated | `org.pentaho.di.job.entries.msaccessbulkload.JobEntryMSAccessBulkLoad` — `plugins/ms-access/impl/src/main/java/org/pentaho/di/job/entries/msaccessbulkload/JobEntryMSAccessBulkLoad.java` |
| [ ] | job | `TALEND_JOB_EXEC` | Deprecated | `org.pentaho.di.job.entries.talendjobexec.JobEntryTalendJobExec` — `engine/src/main/resources/kettle-job-entries.xml` |
| [x] | trans | `AggregateRows` | Deprecated | `org.pentaho.di.trans.steps.aggregaterows.AggregateRowsMeta` — `plugins/aggregate-rows/core/src/main/java/org/pentaho/di/trans/steps/aggregaterows/AggregateRowsMeta.java` |
| [x] | trans | `DummyStep` | Deprecated | `org.pentaho.di.be.ibridge.kettle.dummy.DummyPluginMeta` — `plugins/dummy/core/src/main/java/org/pentaho/di/be/ibridge/kettle/dummy/DummyPluginMeta.java` |
| [x] | trans | `ElasticSearchBulk` | Deprecated | `org.pentaho.di.trans.steps.elasticsearchbulk.ElasticSearchBulkMeta` — `plugins/elasticsearch-bulk-insert/core/src/main/java/org/pentaho/di/trans/steps/elasticsearchbulk/ElasticSearchBulkMeta.java` |
| [x] | trans | `GetPreviousRowField` | Deprecated | `org.pentaho.di.trans.steps.getpreviousrowfield.GetPreviousRowFieldMeta` — `plugins/get-previous-row-field/core/src/main/java/org/pentaho/di/trans/steps/getpreviousrowfield/GetPreviousRowFieldMeta.java` |
| [ ] | trans | `GPBulkLoader` | Deprecated | `org.pentaho.di.trans.steps.gpbulkloader.GPBulkLoaderMeta` — `plugins/gp-bulk-loader/core/src/main/java/org/pentaho/di/trans/steps/gpbulkloader/GPBulkLoaderMeta.java` |
| [ ] | trans | `LucidDBStreamingLoader` | Deprecated | `org.pentaho.di.trans.steps.luciddbstreamingloader.LucidDBStreamingLoaderMeta` — `plugins/lucid-db-streaming-loader/core/src/main/java/org/pentaho/di/trans/steps/luciddbstreamingloader/LucidDBStreamingLoaderMeta.java` |
| [x] | trans | `OldTextFileInput` | Deprecated | `org.pentaho.di.trans.steps.textfileinput.TextFileInputMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `OpenERPObjectDelete` | Deprecated | `org.pentaho.di.trans.steps.openerp.objectdelete.OpenERPObjectDeleteMeta` — `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectdelete/OpenERPObjectDeleteMeta.java` |
| [ ] | trans | `OpenERPObjectInput` | Deprecated | `org.pentaho.di.trans.steps.openerp.objectinput.OpenERPObjectInputMeta` — `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectinput/OpenERPObjectInputMeta.java` |
| [ ] | trans | `OpenERPObjectOutputImport` | Deprecated | `org.pentaho.di.trans.steps.openerp.objectoutput.OpenERPObjectOutputMeta` — `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectoutput/OpenERPObjectOutputMeta.java` |
| [x] | trans | `PaloCellInput` | Deprecated | `org.pentaho.di.trans.steps.palo.cellinput.PaloCellInputMeta` — `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/cellinput/PaloCellInputMeta.java` |
| [x] | trans | `PaloCellOutput` | Deprecated | `org.pentaho.di.trans.steps.palo.celloutput.PaloCellOutputMeta` — `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/celloutput/PaloCellOutputMeta.java` |
| [x] | trans | `PaloDimInput` | Deprecated | `org.pentaho.di.trans.steps.palo.diminput.PaloDimInputMeta` — `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/diminput/PaloDimInputMeta.java` |
| [x] | trans | `PaloDimOutput` | Deprecated | `org.pentaho.di.trans.steps.palo.dimoutput.PaloDimOutputMeta` — `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/dimoutput/PaloDimOutputMeta.java` |
| [ ] | trans | `SAPINPUT` | Deprecated | `org.pentaho.di.trans.steps.sapinput.SapInputMeta` — `plugins/sap/core/src/main/java/org/pentaho/di/trans/steps/sapinput/SapInputMeta.java` |
| [x] | trans | `Script` | Deprecated | `org.pentaho.di.trans.steps.script.ScriptMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [x] | trans | `TextFileOutputLegacy` | Deprecated | `org.pentaho.di.trans.steps.textfileoutputlegacy.TextFileOutputLegacyMeta` — `engine/src/main/resources/kettle-steps.xml` |
| [ ] | trans | `XMLInput` | Deprecated | `org.pentaho.di.trans.steps.xmlinput.XMLInputMeta` — `plugins/xml-input/core/src/main/java/org/pentaho/di/trans/steps/xmlinput/XMLInputMeta.java` |
| [ ] | trans | `XMLInputSax` | Deprecated | `org.pentaho.di.trans.steps.xmlinputsax.XMLInputSaxMeta` — `plugins/xml-input-stream/core/src/main/java/org/pentaho/di/trans/steps/xmlinputsax/XMLInputSaxMeta.java` |

## Hiện có trong source và catalog

- **trans**: `Abort`, `BlockUntilStepsFinish`, `Calculator`, `ConcatFields`, `Constant`, `CsvInput`, `DataGrid`, `DBLookup`, `Delete`, `Dummy`, `ExcelInput`, `ExcelOutput`, `ExecSQL`, `FilterRows`, `GetFileNames`, `GetVariable`, `GroupBy`, `InsertUpdate`, `JobExecutor`, `JoinRows`, `JsonInput`, `Mapping`, `MergeJoin`, `MergeRows`, `MetaInject`, `NullIf`, `OraBulkLoader`, `ProcessFiles`, `PropertyInput`, `RandomValue`, `RegexEval`, `Rest`, `RowGenerator`, `RowsToResult`, `ScriptValueMod`, `SelectValues`, `Sequence`, `SetVariable`, `SimpleMapping`, `SingleThreader`, `SortRows`, `StreamLookup`, `StringCut`, `StringOperations`, `SwitchCase`, `SystemInfo`, `TableInput`, `TableOutput`, `TextFileInput`, `TextFileOutput`, `TransExecutor`, `TypeExitExcelWriterStep`, `Unique`, `Update`, `ValueMapper`, `WriteToLog`, `XMLOutput`.
- **job**: `ABORT`, `CHECK_DB_CONNECTIONS`, `CHECK_FILES_LOCKED`, `COPY_FILES`, `CREATE_FOLDER`, `DELAY`, `DELETE_FILE`, `DELETE_FILES`, `DELETE_FOLDERS`, `EVAL_FILES_METRICS`, `EVAL_TABLE_CONTENT`, `EXPORT_REPOSITORY`, `FILE_EXISTS`, `FILES_EXIST`, `FTP`, `JOB`, `MAIL`, `MOVE_FILES`, `SET_VARIABLES`, `SFTP`, `SFTPPUT`, `SHELL`, `SIMPLE_EVAL`, `SPECIAL`, `SQL`, `SUCCESS`, `TRANS`, `TRUNCATE_TABLES`, `UNZIP`, `WAIT_FOR_FILE`, `WRITE_TO_LOG`, `XSLT`, `ZIP_FILE`.

## Dữ liệu cho agent

Snapshot đầy đủ: [2026-09-15-pdi94-components.json](2026-09-15-pdi94-components.json). Mỗi dòng có `kind`, `id`, `category`, `className`, `source`, `origin`, `status`, `batch`. Các đường dẫn source tính từ `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`. `status` là trạng thái lúc kiểm kê; agent cập nhật checklist và đối chiếu lại catalog khi nhận task. Các nhãn category như `category`/`Name` là hậu tố localization key gốc, chưa được dịch thành category UI.

## Bắt buộc đọc implementation PDI 9.4

Mỗi ID trong JSON đã có `implementationSources` trỏ tới file Java thực tế, tính từ sourceRoot. Đã tìm thấy đường dẫn implementation cho 288/288 ID. `xmlEvidenceReview: pending` nghĩa là chưa review đầy đủ serializer của từng ID; không được coi việc tìm thấy file là evidence XML.

Agent phải đọc class dưới đây, lần theo superclass/helper cho getXML/loadXML/setDefault, và phần wrapper StepMeta/JobEntryCopy để tạo XML đầy đủ. Đọc runtime class nếu mô tả hành vi; đọc Dialog chỉ để bổ sung UI/options, không thay serializer.

| Kind | ID thiếu | Implementation source |
|---|---|---|
| job | `ADD_RESULT_FILENAMES` | `plugins/core/impl/src/main/java/org/pentaho/di/job/entries/addresultfilenames/JobEntryAddResultFilenames.java` |
| job | `COLUMNS_EXIST` | `engine/src/main/java/org/pentaho/di/job/entries/columnsexist/JobEntryColumnsExist.java` |
| job | `CONNECTED_TO_REPOSITORY` | `engine/src/main/java/org/pentaho/di/job/entries/connectedtorepository/JobEntryConnectedToRepository.java` |
| job | `COPY_MOVE_RESULT_FILENAMES` | `engine/src/main/java/org/pentaho/di/job/entries/copymoveresultfilenames/JobEntryCopyMoveResultFilenames.java` |
| job | `CREATE_FILE` | `engine/src/main/java/org/pentaho/di/job/entries/createfile/JobEntryCreateFile.java` |
| job | `DELETE_RESULT_FILENAMES` | `engine/src/main/java/org/pentaho/di/job/entries/deleteresultfilenames/JobEntryDeleteResultFilenames.java` |
| job | `DOS_UNIX_CONVERTER` | `engine/src/main/java/org/pentaho/di/job/entries/dostounix/JobEntryDosToUnix.java` |
| job | `DTD_VALIDATOR` | `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/dtdvalidator/JobEntryDTDValidator.java` |
| job | `EVAL` | `engine/src/main/java/org/pentaho/di/job/entries/eval/JobEntryEval.java` |
| job | `FILE_COMPARE` | `engine/src/main/java/org/pentaho/di/job/entries/filecompare/JobEntryFileCompare.java` |
| job | `FOLDER_IS_EMPTY` | `engine/src/main/java/org/pentaho/di/job/entries/folderisempty/JobEntryFolderIsEmpty.java` |
| job | `FOLDERS_COMPARE` | `engine/src/main/java/org/pentaho/di/job/entries/folderscompare/JobEntryFoldersCompare.java` |
| job | `FTP_DELETE` | `engine/src/main/java/org/pentaho/di/job/entries/ftpdelete/JobEntryFTPDelete.java` |
| job | `FTP_PUT` | `engine/src/main/java/org/pentaho/di/job/entries/ftpput/JobEntryFTPPUT.java` |
| job | `FTPS_GET` | `engine/src/main/java/org/pentaho/di/job/entries/ftpsget/JobEntryFTPSGet.java` |
| job | `FTPS_PUT` | `engine/src/main/java/org/pentaho/di/job/entries/ftpsput/JobEntryFTPSPUT.java` |
| job | `GET_POP` | `engine/src/main/java/org/pentaho/di/job/entries/getpop/JobEntryGetPOP.java` |
| job | `HTTP` | `engine/src/main/java/org/pentaho/di/job/entries/http/JobEntryHTTP.java` |
| job | `JobCategory.Category.Mail_VALIDATOR` | `engine/src/main/java/org/pentaho/di/job/entries/mailvalidator/JobEntryMailValidator.java` |
| job | `MAIL_VALIDATOR` | `engine/src/main/java/org/pentaho/di/job/entries/mailvalidator/JobEntryMailValidator.java` |
| job | `MS_ACCESS_BULK_LOAD` | `plugins/ms-access/impl/src/main/java/org/pentaho/di/job/entries/msaccessbulkload/JobEntryMSAccessBulkLoad.java` |
| job | `MSGBOX_INFO` | `engine/src/main/java/org/pentaho/di/job/entries/msgboxinfo/JobEntryMsgBoxInfo.java` |
| job | `MSSQL_BULK_LOAD` | `engine/src/main/java/org/pentaho/di/job/entries/mssqlbulkload/JobEntryMssqlBulkLoad.java` |
| job | `MYSQL_BULK_FILE` | `engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkfile/JobEntryMysqlBulkFile.java` |
| job | `MYSQL_BULK_LOAD` | `engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkload/JobEntryMysqlBulkLoad.java` |
| job | `PGP_DECRYPT_FILES` | `engine/src/main/java/org/pentaho/di/job/entries/pgpdecryptfiles/JobEntryPGPDecryptFiles.java` |
| job | `PGP_ENCRYPT_FILES` | `engine/src/main/java/org/pentaho/di/job/entries/pgpencryptfiles/JobEntryPGPEncryptFiles.java` |
| job | `PGP_VERIFY_FILES` | `engine/src/main/java/org/pentaho/di/job/entries/pgpverify/JobEntryPGPVerify.java` |
| job | `PING` | `engine/src/main/java/org/pentaho/di/job/entries/ping/JobEntryPing.java` |
| job | `SEND_NAGIOS_PASSIVE_CHECK` | `engine/src/main/java/org/pentaho/di/job/entries/sendnagiospassivecheck/JobEntrySendNagiosPassiveCheck.java` |
| job | `SNMP_TRAP` | `engine/src/main/java/org/pentaho/di/job/entries/snmptrap/JobEntrySNMPTrap.java` |
| job | `SYSLOG` | `engine/src/main/java/org/pentaho/di/job/entries/syslog/JobEntrySyslog.java` |
| job | `TABLE_EXISTS` | `engine/src/main/java/org/pentaho/di/job/entries/tableexists/JobEntryTableExists.java` |
| job | `TALEND_JOB_EXEC` | `engine/src/main/java/org/pentaho/di/job/entries/talendjobexec/JobEntryTalendJobExec.java` |
| job | `TELNET` | `engine/src/main/java/org/pentaho/di/job/entries/telnet/JobEntryTelnet.java` |
| job | `WAIT_FOR_SQL` | `engine/src/main/java/org/pentaho/di/job/entries/waitforsql/JobEntryWaitForSQL.java` |
| job | `WEBSERVICE_AVAILABLE` | `engine/src/main/java/org/pentaho/di/job/entries/webserviceavailable/JobEntryWebServiceAvailable.java` |
| job | `WRITE_TO_FILE` | `engine/src/main/java/org/pentaho/di/job/entries/writetofile/JobEntryWriteToFile.java` |
| job | `XML_WELL_FORMED` | `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xmlwellformed/JobEntryXMLWellFormed.java` |
| job | `XSD_VALIDATOR` | `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xsdvalidator/JobEntryXSDValidator.java` |
| trans | `AccessInput` | `plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessinput/AccessInputMeta.java` |
| trans | `AccessOutput` | `plugins/ms-access/impl/src/main/java/org/pentaho/di/trans/steps/accessoutput/AccessOutputMeta.java` |
| trans | `AddXML` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/addxml/AddXMLMeta.java` |
| trans | `AggregateRows` | `plugins/aggregate-rows/core/src/main/java/org/pentaho/di/trans/steps/aggregaterows/AggregateRowsMeta.java` |
| trans | `AnalyticQuery` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/analyticquery/AnalyticQueryMeta.java` |
| trans | `Append` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/append/AppendMeta.java` |
| trans | `AutoDoc` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/autodoc/AutoDocMeta.java` |
| trans | `AvroInputNew` | `plugins/avro-format/core/src/main/java/org/pentaho/di/trans/steps/avro/input/AvroInputMeta.java` |
| trans | `AvroOutput` | `plugins/avro-format/core/src/main/java/org/pentaho/di/trans/steps/avro/output/AvroOutputMeta.java` |
| trans | `BlockingStep` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockingstep/BlockingStepMeta.java` |
| trans | `ChangeFileEncoding` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/changefileencoding/ChangeFileEncodingMeta.java` |
| trans | `CheckSum` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/checksum/CheckSumMeta.java` |
| trans | `CloneRow` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/clonerow/CloneRowMeta.java` |
| trans | `ClosureGenerator` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/closure/ClosureGeneratorMeta.java` |
| trans | `ColumnExists` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/columnexists/ColumnExistsMeta.java` |
| trans | `CombinationLookup` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/combinationlookup/CombinationLookupMeta.java` |
| trans | `CreditCardValidator` | `engine/src/main/java/org/pentaho/di/trans/steps/creditcardvalidator/CreditCardValidatorMeta.java` |
| trans | `CubeInput` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeinput/CubeInputMeta.java` |
| trans | `CubeOutput` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeoutput/CubeOutputMeta.java` |
| trans | `DBJoin` | `engine/src/main/java/org/pentaho/di/trans/steps/databasejoin/DatabaseJoinMeta.java` |
| trans | `DBProc` | `engine/src/main/java/org/pentaho/di/trans/steps/dbproc/DBProcMeta.java` |
| trans | `Delay` | `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/delay/DelayMeta.java` |
| trans | `Denormaliser` | `engine/src/main/java/org/pentaho/di/trans/steps/denormaliser/DenormaliserMeta.java` |
| trans | `DetectEmptyStream` | `engine/src/main/java/org/pentaho/di/trans/steps/detectemptystream/DetectEmptyStreamMeta.java` |
| trans | `DetectLastRow` | `engine/src/main/java/org/pentaho/di/trans/steps/detectlastrow/DetectLastRowMeta.java` |
| trans | `DimensionLookup` | `engine/src/main/java/org/pentaho/di/trans/steps/dimensionlookup/DimensionLookupMeta.java` |
| trans | `DummyStep` | `plugins/dummy/core/src/main/java/org/pentaho/di/be/ibridge/kettle/dummy/DummyPluginMeta.java` |
| trans | `DynamicSQLRow` | `engine/src/main/java/org/pentaho/di/trans/steps/dynamicsqlrow/DynamicSQLRowMeta.java` |
| trans | `ElasticSearchBulk` | `plugins/elasticsearch-bulk-insert/core/src/main/java/org/pentaho/di/trans/steps/elasticsearchbulk/ElasticSearchBulkMeta.java` |
| trans | `ExecProcess` | `engine/src/main/java/org/pentaho/di/trans/steps/execprocess/ExecProcessMeta.java` |
| trans | `ExecSQLRow` | `engine/src/main/java/org/pentaho/di/trans/steps/execsqlrow/ExecSQLRowMeta.java` |
| trans | `FieldsChangeSequence` | `engine/src/main/java/org/pentaho/di/trans/steps/fieldschangesequence/FieldsChangeSequenceMeta.java` |
| trans | `FieldSplitter` | `engine/src/main/java/org/pentaho/di/trans/steps/fieldsplitter/FieldSplitterMeta.java` |
| trans | `FileExists` | `engine/src/main/java/org/pentaho/di/trans/steps/fileexists/FileExistsMeta.java` |
| trans | `FileLocked` | `engine/src/main/java/org/pentaho/di/trans/steps/filelocked/FileLockedMeta.java` |
| trans | `FilesFromResult` | `engine/src/main/java/org/pentaho/di/trans/steps/filesfromresult/FilesFromResultMeta.java` |
| trans | `FilesToResult` | `engine/src/main/java/org/pentaho/di/trans/steps/filestoresult/FilesToResultMeta.java` |
| trans | `FileStream` | `plugins/file-stream/src/main/java/org/pentaho/di/trans/step/filestream/FileStreamMeta.java` |
| trans | `FixedInput` | `engine/src/main/java/org/pentaho/di/trans/steps/fixedinput/FixedInputMeta.java` |
| trans | `Flattener` | `engine/src/main/java/org/pentaho/di/trans/steps/flattener/FlattenerMeta.java` |
| trans | `Flatterner` | `engine/src/main/java/org/pentaho/di/trans/steps/flattener/FlattenerMeta.java` |
| trans | `Formula` | `engine/src/main/java/org/pentaho/di/trans/steps/formula/FormulaMeta.java` |
| trans | `FuzzyMatch` | `engine/src/main/java/org/pentaho/di/trans/steps/fuzzymatch/FuzzyMatchMeta.java` |
| trans | `GetFilesRowsCount` | `engine/src/main/java/org/pentaho/di/trans/steps/getfilesrowscount/GetFilesRowsCountMeta.java` |
| trans | `GetPreviousRowField` | `plugins/get-previous-row-field/core/src/main/java/org/pentaho/di/trans/steps/getpreviousrowfield/GetPreviousRowFieldMeta.java` |
| trans | `GetRepositoryNames` | `engine/src/main/java/org/pentaho/di/trans/steps/getrepositorynames/GetRepositoryNamesMeta.java` |
| trans | `GetSlaveSequence` | `engine/src/main/java/org/pentaho/di/trans/steps/getslavesequence/GetSlaveSequenceMeta.java` |
| trans | `GetSubFolders` | `engine/src/main/java/org/pentaho/di/trans/steps/getsubfolders/GetSubFoldersMeta.java` |
| trans | `GetTableNames` | `engine/src/main/java/org/pentaho/di/trans/steps/gettablenames/GetTableNamesMeta.java` |
| trans | `getXMLData` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXMLDataMeta.java` |
| trans | `GPBulkLoader` | `plugins/gp-bulk-loader/core/src/main/java/org/pentaho/di/trans/steps/gpbulkloader/GPBulkLoaderMeta.java` |
| trans | `GPLoad` | `plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java` |
| trans | `HL7Input` | `plugins/hl7/core/src/main/java/org/pentaho/di/trans/steps/hl7input/HL7InputMeta.java` |
| trans | `HTTP` | `engine/src/main/java/org/pentaho/di/trans/steps/http/HTTPMeta.java` |
| trans | `HTTPPOST` | `engine/src/main/java/org/pentaho/di/trans/steps/httppost/HTTPPOSTMeta.java` |
| trans | `IfNull` | `engine/src/main/java/org/pentaho/di/trans/steps/ifnull/IfNullMeta.java` |
| trans | `InfobrightOutput` | `plugins/infobright-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/infobrightoutput/InfobrightLoaderMeta.java` |
| trans | `Injector` | `engine/src/main/java/org/pentaho/di/trans/steps/injector/InjectorMeta.java` |
| trans | `Janino` | `engine/src/main/java/org/pentaho/di/trans/steps/janino/JaninoMeta.java` |
| trans | `JavaFilter` | `engine/src/main/java/org/pentaho/di/trans/steps/javafilter/JavaFilterMeta.java` |
| trans | `Jms2Consumer` | `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsConsumerMeta.java` |
| trans | `Jms2Producer` | `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsProducerMeta.java` |
| trans | `JsonOutput` | `plugins/json/core/src/main/java/org/pentaho/di/trans/steps/jsonoutput/JsonOutputMeta.java` |
| trans | `LDAPInput` | `plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapinput/LDAPInputMeta.java` |
| trans | `LDAPOutput` | `plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapoutput/LDAPOutputMeta.java` |
| trans | `LDIFInput` | `engine/src/main/java/org/pentaho/di/trans/steps/ldifinput/LDIFInputMeta.java` |
| trans | `LoadFileInput` | `engine/src/main/java/org/pentaho/di/trans/steps/loadfileinput/LoadFileInputMeta.java` |
| trans | `LucidDBStreamingLoader` | `plugins/lucid-db-streaming-loader/core/src/main/java/org/pentaho/di/trans/steps/luciddbstreamingloader/LucidDBStreamingLoaderMeta.java` |
| trans | `Mail` | `engine/src/main/java/org/pentaho/di/trans/steps/mail/MailMeta.java` |
| trans | `MailInput` | `engine/src/main/java/org/pentaho/di/trans/steps/mailinput/MailInputMeta.java` |
| trans | `MailValidator` | `engine/src/main/java/org/pentaho/di/trans/steps/mailvalidator/MailValidatorMeta.java` |
| trans | `MappingInput` | `engine/src/main/java/org/pentaho/di/trans/steps/mappinginput/MappingInputMeta.java` |
| trans | `MappingOutput` | `engine/src/main/java/org/pentaho/di/trans/steps/mappingoutput/MappingOutputMeta.java` |
| trans | `MemoryGroupBy` | `engine/src/main/java/org/pentaho/di/trans/steps/memgroupby/MemoryGroupByMeta.java` |
| trans | `MondrianInput` | `plugins/mondrianinput/impl/src/main/java/org/pentaho/di/trans/steps/mondrianinput/MondrianInputMeta.java` |
| trans | `MonetDBBulkLoader` | `plugins/monet-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/monetdbbulkloader/MonetDBBulkLoaderMeta.java` |
| trans | `MQTTConsumer` | `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTConsumerMeta.java` |
| trans | `MQTTProducer` | `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTProducerMeta.java` |
| trans | `MultiwayMergeJoin` | `engine/src/main/java/org/pentaho/di/trans/steps/multimerge/MultiMergeJoinMeta.java` |
| trans | `MySQLBulkLoader` | `plugins/mysql-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/mysqlbulkloader/MySQLBulkLoaderMeta.java` |
| trans | `Normaliser` | `engine/src/main/java/org/pentaho/di/trans/steps/normaliser/NormaliserMeta.java` |
| trans | `NumberRange` | `engine/src/main/java/org/pentaho/di/trans/steps/numberrange/NumberRangeMeta.java` |
| trans | `OlapInput` | `engine/src/main/java/org/pentaho/di/trans/steps/olapinput/OlapInputMeta.java` |
| trans | `OldTextFileInput` | `engine/src/main/java/org/pentaho/di/trans/steps/textfileinput/TextFileInputMeta.java` |
| trans | `OpenERPObjectDelete` | `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectdelete/OpenERPObjectDeleteMeta.java` |
| trans | `OpenERPObjectInput` | `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectinput/OpenERPObjectInputMeta.java` |
| trans | `OpenERPObjectOutputImport` | `plugins/openerp/core/src/main/java/org/pentaho/di/trans/steps/openerp/objectoutput/OpenERPObjectOutputMeta.java` |
| trans | `PaloCellInput` | `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/cellinput/PaloCellInputMeta.java` |
| trans | `PaloCellOutput` | `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/celloutput/PaloCellOutputMeta.java` |
| trans | `PaloDimInput` | `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/diminput/PaloDimInputMeta.java` |
| trans | `PaloDimOutput` | `plugins/palo/core/src/main/java/org/pentaho/di/trans/steps/palo/dimoutput/PaloDimOutputMeta.java` |
| trans | `ParallelGzipCsvInput` | `engine/src/main/java/org/pentaho/di/trans/steps/parallelgzipcsv/ParGzipCsvInputMeta.java` |
| trans | `PentahoReportingOutput` | `plugins/pentaho-reporting/impl/src/main/java/org/pentaho/di/trans/steps/pentahoreporting/PentahoReportingOutputMeta.java` |
| trans | `PGBulkLoader` | `plugins/postgresql-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/pgbulkloader/PGBulkLoaderMeta.java` |
| trans | `PGPDecryptStream` | `engine/src/main/java/org/pentaho/di/trans/steps/pgpdecryptstream/PGPDecryptStreamMeta.java` |
| trans | `PGPEncryptStream` | `engine/src/main/java/org/pentaho/di/trans/steps/pgpencryptstream/PGPEncryptStreamMeta.java` |
| trans | `PrioritizeStreams` | `engine/src/main/java/org/pentaho/di/trans/steps/prioritizestreams/PrioritizeStreamsMeta.java` |
| trans | `PropertyOutput` | `engine/src/main/java/org/pentaho/di/trans/steps/propertyoutput/PropertyOutputMeta.java` |
| trans | `RandomCCNumberGenerator` | `engine/src/main/java/org/pentaho/di/trans/steps/randomccnumber/RandomCCNumberGeneratorMeta.java` |
| trans | `RecordsFromStream` | `engine/src/main/java/org/pentaho/di/trans/steps/recordsfromstream/RecordsFromStreamMeta.java` |
| trans | `ReplaceString` | `engine/src/main/java/org/pentaho/di/trans/steps/replacestring/ReplaceStringMeta.java` |
| trans | `ReservoirSampling` | `engine/src/main/java/org/pentaho/di/trans/steps/reservoirsampling/ReservoirSamplingMeta.java` |
| trans | `RowsFromResult` | `engine/src/main/java/org/pentaho/di/trans/steps/rowsfromresult/RowsFromResultMeta.java` |
| trans | `RssInput` | `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssinput/RssInputMeta.java` |
| trans | `RssOutput` | `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssoutput/RssOutputMeta.java` |
| trans | `RuleAccumulator` | `plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesAccumulatorMeta.java` |
| trans | `RuleExecutor` | `plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesExecutorMeta.java` |
| trans | `S3CSVINPUT` | `plugins/s3csvinput/core/src/main/java/org/pentaho/di/trans/steps/s3csvinput/S3CsvInputMeta.java` |
| trans | `SalesforceDelete` | `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforcedelete/SalesforceDeleteMeta.java` |
| trans | `SalesforceInput` | `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinput/SalesforceInputMeta.java` |
| trans | `SalesforceInsert` | `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinsert/SalesforceInsertMeta.java` |
| trans | `SalesforceUpdate` | `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupdate/SalesforceUpdateMeta.java` |
| trans | `SalesforceUpsert` | `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupsert/SalesforceUpsertMeta.java` |
| trans | `SampleRows` | `engine/src/main/java/org/pentaho/di/trans/steps/samplerows/SampleRowsMeta.java` |
| trans | `SAPINPUT` | `plugins/sap/core/src/main/java/org/pentaho/di/trans/steps/sapinput/SapInputMeta.java` |
| trans | `SASInput` | `engine/src/main/java/org/pentaho/di/trans/steps/sasinput/SasInputMeta.java` |
| trans | `Script` | `engine/src/main/java/org/pentaho/di/trans/steps/script/ScriptMeta.java` |
| trans | `ScriptValue` | `engine/src/main/java/org/pentaho/di/trans/steps/scriptvalues_mod/ScriptValuesMetaMod.java` |
| trans | `ScriptValuesMod` | `engine/src/main/java/org/pentaho/di/trans/steps/scriptvalues_mod/ScriptValuesMetaMod.java` |
| trans | `SecretKeyGenerator` | `engine/src/main/java/org/pentaho/di/trans/steps/symmetriccrypto/secretkeygenerator/SecretKeyGeneratorMeta.java` |
| trans | `SetValueConstant` | `engine/src/main/java/org/pentaho/di/trans/steps/setvalueconstant/SetValueConstantMeta.java` |
| trans | `SetValueField` | `engine/src/main/java/org/pentaho/di/trans/steps/setvaluefield/SetValueFieldMeta.java` |
| trans | `SFTPPut` | `engine/src/main/java/org/pentaho/di/trans/steps/sftpput/SFTPPutMeta.java` |
| trans | `ShapeFileReader` | `plugins/shapefilereader/core/src/main/java/org/pentaho/di/shapefilereader/ShapeFileReaderMeta.java` |
| trans | `SocketReader` | `engine/src/main/java/org/pentaho/di/trans/steps/socketreader/SocketReaderMeta.java` |
| trans | `SocketWriter` | `engine/src/main/java/org/pentaho/di/trans/steps/socketwriter/SocketWriterMeta.java` |
| trans | `SortedMerge` | `engine/src/main/java/org/pentaho/di/trans/steps/sortedmerge/SortedMergeMeta.java` |
| trans | `SplitFieldToRows3` | `engine/src/main/java/org/pentaho/di/trans/steps/splitfieldtorows/SplitFieldToRowsMeta.java` |
| trans | `SQLFileOutput` | `engine/src/main/java/org/pentaho/di/trans/steps/sqlfileoutput/SQLFileOutputMeta.java` |
| trans | `SSH` | `engine/src/main/java/org/pentaho/di/trans/steps/ssh/SSHMeta.java` |
| trans | `StepMetastructure` | `engine/src/main/java/org/pentaho/di/trans/steps/stepmeta/StepMetastructureMeta.java` |
| trans | `StepsMetrics` | `engine/src/main/java/org/pentaho/di/trans/steps/stepsmetrics/StepsMetricsMeta.java` |
| trans | `SymmetricCryptoTrans` | `engine/src/main/java/org/pentaho/di/trans/steps/symmetriccrypto/symmetriccryptotrans/SymmetricCryptoTransMeta.java` |
| trans | `SynchronizeAfterMerge` | `engine/src/main/java/org/pentaho/di/trans/steps/synchronizeaftermerge/SynchronizeAfterMergeMeta.java` |
| trans | `SyslogMessage` | `engine/src/main/java/org/pentaho/di/trans/steps/syslog/SyslogMessageMeta.java` |
| trans | `TableCompare` | `engine/src/main/java/org/pentaho/di/trans/steps/tablecompare/TableCompareMeta.java` |
| trans | `TableExists` | `engine/src/main/java/org/pentaho/di/trans/steps/tableexists/TableExistsMeta.java` |
| trans | `TeraFast` | `plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java` |
| trans | `TeraFastPlugin` | `plugins/terafast-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/terafastbulkloader/TeraFastMeta.java` |
| trans | `TextFileOutputLegacy` | `engine/src/main/java/org/pentaho/di/trans/steps/textfileoutputlegacy/TextFileOutputLegacyMeta.java` |
| trans | `TypeExitEdi2XmlStep` | `plugins/edi2xml/impl/src/main/java/org/pentaho/di/trans/steps/edi2xml/Edi2XmlMeta.java` |
| trans | `TypeExitGoogleAnalyticsInputStep` | `plugins/google-analytics/core/src/main/java/org/pentaho/di/trans/steps/googleanalytics/GaInputStepMeta.java` |
| trans | `UniqueRowsByHashSet` | `engine/src/main/java/org/pentaho/di/trans/steps/uniquerowsbyhashset/UniqueRowsByHashSetMeta.java` |
| trans | `UnivariateStats` | `engine/src/main/java/org/pentaho/di/trans/steps/univariatestats/UnivariateStatsMeta.java` |
| trans | `UserDefinedJavaClass` | `engine/src/main/java/org/pentaho/di/trans/steps/userdefinedjavaclass/UserDefinedJavaClassMeta.java` |
| trans | `Validator` | `engine/src/main/java/org/pentaho/di/trans/steps/validator/ValidatorMeta.java` |
| trans | `VectorWiseBulkLoader` | `plugins/ivw-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/ivwloader/IngresVectorwiseLoaderMeta.java` |
| trans | `WebServiceAvailable` | `engine/src/main/java/org/pentaho/di/trans/steps/webserviceavailable/WebServiceAvailableMeta.java` |
| trans | `WebServiceLookup` | `engine/src/main/java/org/pentaho/di/trans/steps/webservices/WebServiceMeta.java` |
| trans | `XBaseInput` | `engine/src/main/java/org/pentaho/di/trans/steps/xbaseinput/XBaseInputMeta.java` |
| trans | `XMLInput` | `plugins/xml-input/core/src/main/java/org/pentaho/di/trans/steps/xmlinput/XMLInputMeta.java` |
| trans | `XMLInputSax` | `plugins/xml-input-stream/core/src/main/java/org/pentaho/di/trans/steps/xmlinputsax/XMLInputSaxMeta.java` |
| trans | `XMLInputStream` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmlinputstream/XMLInputStreamMeta.java` |
| trans | `XMLJoin` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmljoin/XMLJoinMeta.java` |
| trans | `XSDValidator` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xsdvalidator/XsdValidatorMeta.java` |
| trans | `XSLT` | `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xslt/XsltMeta.java` |
| trans | `YamlInput` | `plugins/yaml-input/impl/src/main/java/org/pentaho/di/trans/steps/yamlinput/YamlInputMeta.java` |
| trans | `ZipFile` | `engine/src/main/java/org/pentaho/di/trans/steps/zipfile/ZipFileMeta.java` |
