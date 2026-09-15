# PDI 9.4 Catalog Evidence Report

Target PDI version (catalog `pdi_version`): **9.4**. This report records the
target-version evidence behind every catalog row after correcting the catalog
target from PDI 11 to PDI 9.4. Evidence is never invented: a row lists `9.4` in
`verified_versions` only when an existing repository source reference or a
Spoon-saved artifact in `src/knowledge/pentaho/{job,trans}/*.md` explicitly names
PDI 9.4.

## Counts

- Total catalog rows: **111** (38 job + 73 transformation)
- Rows with explicit PDI 9.4 target evidence: **110**
- Rows without PDI 9.4 evidence (downgraded/kept observed): **1**
- `status: canonical`: **110**
- `status: observed`: **1**
- Generator-eligible (canonical + eligible + 9.4 verified): **110**

> Bổ sung B2b (2026-09-15): trans `SortedMerge`, trans `MemoryGroupBy`,
> trans `AnalyticQuery` — 3/3 `source_reviewed` PDI 9.4, xem per-row cuối
> bảng. Số tổng đếm trực tiếp từ `catalog.yaml`.

> Bổ sung B2a (2026-09-15): trans `TableExists`, job `TABLE_EXISTS`, trans
> `ColumnExists`, trans `DBJoin` — 4/4 `source_reviewed` PDI 9.4, xem
> per-row cuối bảng. Số tổng đếm trực tiếp từ `catalog.yaml`.

> Bổ sung B1 gói 3 (2026-09-15): `Append`, `BlockingStep`,
> `DetectEmptyStream`, `DetectLastRow` — 4/4 `source_reviewed` PDI 9.4, xem
> per-row cuối bảng. Số tổng đếm trực tiếp từ `catalog.yaml`.

> Gap ghi nhận từ trước (không do gói B1 gây ra): 4 dòng catalog hiện có
> (`TransExecutor`, `SimpleMapping`, `SingleThreader`, `MetaInject`) chưa
> có mục per-row trong bảng dưới. Số tổng ở trên được đếm trực tiếp từ
> `catalog.yaml`; bảng per-row sẽ được bổ sung dần theo từng gói.

### Verification breakdown (rows with 9.4 evidence)

- `source_reviewed` (PDI 9.4 `getXML()` source reference): **102**
- `spoon_loaded` (Spoon PDI 9.4-saved artifact): **8**

### Rows kept observed (no target evidence, not promoted)

- trans / SetSessionVariableStep: No PDI 9.4 evidence located (not_established)

## Per-row evidence

| kind | xml_type | source_version | verified_versions | resulting_status | evidence |
|---|---|---|---|---|---|
| job | SPECIAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/START.md) |
| job | SUCCESS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SUCCESS.md) |
| job | SPECIAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FAILURE.md) |
| job | TRANS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/TRANS.md) |
| job | JOB | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/JOB.md) |
| job | SQL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SQL.md) |
| job | EVAL_TABLE_CONTENT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EVAL_TABLE_CONTENT.md) |
| job | MAIL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/MAIL.md) |
| job | SET_VARIABLES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SET_VARIABLES.md) |
| job | SIMPLE_EVAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SIMPLE_EVAL.md) |
| job | WRITE_TO_LOG | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/WRITE_TO_LOG.md) |
| job | SFTPPUT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SFTPPUT.md) |
| job | TRUNCATE_TABLES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/TRUNCATE_TABLES.md) |
| job | ABORT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/ABORT.md) |
| job | SFTP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SFTP.md) |
| job | COPY_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/COPY_FILES.md) |
| job | SHELL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SHELL.md) |
| job | DELETE_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FILE.md) |
| job | MOVE_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/MOVE_FILES.md) |
| job | FILE_EXISTS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FILE_EXISTS.md) |
| job | WAIT_FOR_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/WAIT_FOR_FILE.md) |
| job | CREATE_FOLDER | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CREATE_FOLDER.md) |
| job | ZIP_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/ZIP_FILE.md) |
| job | UNZIP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/UNZIP.md) |
| job | FTP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FTP.md) |
| job | CHECK_FILES_LOCKED | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CHECK_FILES_LOCKED.md) |
| job | EVAL_FILES_METRICS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EVAL_FILES_METRICS.md) |
| job | CHECK_DB_CONNECTIONS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CHECK_DB_CONNECTIONS.md) |
| job | FILES_EXIST | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FILES_EXIST.md) |
| job | DELETE_FOLDERS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FOLDERS.md) |
| job | DELETE_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FILES.md) |
| job | DELAY | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELAY.md) |
| job | XSLT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/XSLT.md) |
| job | EXPORT_REPOSITORY | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EXPORT_REPOSITORY.md) |
| trans | TableInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TableInput.md) |
| trans | TableOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TableOutput.md) |
| trans | Dummy | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Dummy.md) |
| trans | Abort | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Abort.md) |
| trans | SelectValues | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SelectValues.md) |
| trans | SetVariable | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SetVariable.md) |
| trans | GetVariable | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GetVariable.md) |
| trans | FilterRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/FilterRows.md) |
| trans | ScriptValueMod | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ScriptValueMod.md) |
| trans | GroupBy | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GroupBy.md) |
| trans | JsonInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JsonInput.md) |
| trans | Rest | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Rest.md) |
| trans | TextFileOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TextFileOutput.md) |
| trans | ExcelOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExcelOutput.md) |
| trans | RowGenerator | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RowGenerator.md) |
| trans | ExcelInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExcelInput.md) |
| trans | ExecSQL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExecSQL.md) |
| trans | ConcatFields | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ConcatFields.md) |
| trans | SystemInfo | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SystemInfo.md) |
| trans | JoinRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JoinRows.md) |
| trans | WriteToLog | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/WriteToLog.md) |
| trans | RowsToResult | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RowsToResult.md) |
| trans | InsertUpdate | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/InsertUpdate.md) |
| trans | Update | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Update.md) |
| trans | Delete | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Delete.md) |
| trans | DBLookup | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/DBLookup.md) |
| trans | StreamLookup | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/StreamLookup.md) |
| trans | MergeJoin | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/MergeJoin.md) |
| trans | MergeRows | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/MergeRows.md) |
| trans | Calculator | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Calculator.md) |
| trans | SortRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SortRows.md) |
| trans | Unique | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Unique.md) |
| trans | Constant | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Constant.md) |
| trans | ValueMapper | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/ValueMapper.md) |
| trans | StringOperations | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/StringOperations.md) |
| trans | NullIf | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/NullIf.md) |
| trans | SwitchCase | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SwitchCase.md) |
| trans | Mapping | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Mapping.md) |
| trans | TextFileInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TextFileInput.md) |
| trans | GetFileNames | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GetFileNames.md) |
| trans | RegexEval | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/RegexEval.md) |
| trans | BlockUntilStepsFinish | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/BlockUntilStepsFinish.md) |
| trans | CsvInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/CsvInput.md) |
| trans | PropertyInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/PropertyInput.md) |
| trans | StringCut | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/StringCut.md) |
| trans | RandomValue | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RandomValue.md) |
| trans | ProcessFiles | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ProcessFiles.md) |
| trans | DataGrid | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/DataGrid.md) |
| trans | JobExecutor | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JobExecutor.md) |
| trans | XMLOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/XMLOutput.md) |
| trans | OraBulkLoader | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/OraBulkLoader.md) |
| trans | SetSessionVariableStep | not_established | (none) | observed | No PDI 9.4 evidence located (not_established) |
| trans | TypeExitExcelWriterStep | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TypeExitExcelWriterStep.md) |
| trans | Sequence | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Sequence.md) |
| trans | RowsFromResult | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RowsFromResult.md) |
| trans | MappingInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/MappingInput.md) |
| trans | MappingOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — inherited empty serialization (see trans/MappingOutput.md) |
| trans | FilesFromResult | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — no override, inherited empty serialization (see trans/FilesFromResult.md) |
| trans | FilesToResult | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/FilesToResult.md) |
| job | ADD_RESULT_FILENAMES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — annotation-registered plugin (see job/ADD_RESULT_FILENAMES.md) |
| job | DELETE_RESULT_FILENAMES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_RESULT_FILENAMES.md) |
| job | COPY_MOVE_RESULT_FILENAMES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/COPY_MOVE_RESULT_FILENAMES.md) |
| trans | Append | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — annotation-registered plugin, head_name/tail_name info streams (see trans/Append.md) |
| trans | BlockingStep | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — annotation-registered plugin, 5-tag spool config (see trans/BlockingStep.md) |
| trans | DetectEmptyStream | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — no override, inherited empty serialization (see trans/DetectEmptyStream.md) |
| trans | DetectLastRow | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — single resultfieldname boolean flag (see trans/DetectLastRow.md) |
| trans | TableExists | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — connection/tablenamefield/resultfieldname/schemaname, dynamic table-name field (see trans/TableExists.md) |
| job | TABLE_EXISTS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — static tablename/schemaname/connection condition entry (see job/TABLE_EXISTS.md) |
| trans | ColumnExists | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — annotation-registered plugin, 7-tag order with dynamic columnnamefield (see trans/ColumnExists.md) |
| trans | DBJoin | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — sql + paired parameter/field list, outer_join/rowlimit flags (see trans/DBJoin.md) |
| trans | SortedMerge | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — fields-only block of name/ascending, merges pre-sorted streams (see trans/SortedMerge.md) |
| trans | MemoryGroupBy | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — give_back_row/group/fields order, string typeGroupCode, COUNT_* give-back fallback (see trans/MemoryGroupBy.md) |
| trans | AnalyticQuery | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference — annotation-registered plugin, group/fields order, LEAD/LAG with int valuefield offset (see trans/AnalyticQuery.md) |
