# B6-1 source notes — connectivity / bulk / streaming / lookup (33 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no DB/mail/network/shell run by this agent.

**Wrapper (all job IDs):** `JobEntryBase.getXML()`
(`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java` lines
415–419: `name`, `description`, `type` = configId, `attributes`) +
`JobEntryCopy.getXML()`
(`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` lines
102–113: `parallel`, `draw`, `nr`, `xloc`, `yloc`).

**Wrapper (all classic trans IDs):** `StepMeta.getXML(boolean)`
(`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` lines
210–264): `name`, `type` = step ID, `description`, `distribute`,
`custom_distribution`, `copies`, `partitioning`, then the plugin fragment,
then `attributes`, `cluster_schema`, `remotesteps`, `GUI`.

**Wrapper (streaming trans IDs Jms2Consumer/Jms2Producer/MQTTConsumer/
MQTTProducer/FileStream):** NO handwritten `getXML()` — inherited from
`BaseSerializingMeta.getXML()`
(`engine/src/main/java/org/pentaho/di/core/util/serialization/BaseSerializingMeta.java`
lines 53–55) = `MetaXmlSerializer.serialize(StepMetaProps.from(this))`
(JAXB; `MetaXmlSerializer.java` lines 52–60). Fragment root is
`<step-props>` (`STEP_TAG = "step-props"`, `StepMetaProps.java` line 71)
with `<group name>` (line 87–88) / `<property group name>` + `<value>`
list (lines 280–307). Order follows injector metadata (group `""` first),
not a handwritten method — see limitations.

**XML tag matching is case-insensitive:** `XMLHandler` compares with
`equalsIgnoreCase` (`core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java`
lines 153+), so read/write case mismatches (e.g. `receiveddate1` vs
`receivedDate1`) round-trip fine.

**OraBulkLoader check:** already in catalog
(`src/knowledge/pentaho/catalog.yaml` line 109, `trans/OraBulkLoader.md`
exists) — NOT duplicated in this batch.

**"35 ID" vs 33 files:** the dispatch prompt lists 33 distinct
(kind, ID) pairs (10 + 6 + 5 + 6 + 6). No OraBulkLoader duplication was
needed. Nothing deferred.

## A. Job mail/net (7)

### A1. job GET_POP — `JobEntryGetPOP`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/getpop/JobEntryGetPOP.java`
- Registry: `engine/src/main/resources/kettle-job-entries.xml`, line 29 (`id="GET_POP"`).
- `getXML()` (lines 187–242): `super.getXML()` + 40 tags `servername`…
  `proxyusername` (lines 190–240). `<password>` encrypted via
  `Encr.encryptPasswordIfNotUsingVariables` (lines 192–193). 4 enum codes:
  `valueimaplist` (208–209), `conditionreceiveddate` (223–225), `actiontype`
  (230–231), `aftergetimap` (236–237).
- Codes: `MailConnectionMeta.java` — `actionTypeCode={get,move,delete}`
  (line 61); `conditionDateCode={ignore,equal,smaller,greater,between}`
  (74–75); `valueIMAPListCode={imaplistall,…,imaplistnotanswered}` 11 codes
  (96–98); `afterGetIMAPCode={nothing,delete,move}` (117);
  `protocolCodes={POP3,IMAP,MBOX}` (47). All `get*ByCode` return index 0 on
  null/unknown (lines 133–183). `getValueImapListCode(i)` OOB → index 0
  (126–131).
- `loadXML()` (244–320): booleans `"Y".equalsIgnoreCase` (missing→false)
  EXCEPT `savemessage`/`saveattachment` missing/empty→`true` (265–277);
  `filenamepattern` empty→`DEFAULT_FILE_NAME_PATTERN =
  "name_{SYS|hhmmss_MMddyyyy|}_#IdFile#.mail"` (126, 255–257);
  `retrievemails` `Const.toInt(…, -1)` (258); `protocol` missing→POP3 (262–263).
- Constructor (135–176): protocol=POP3, savemessage/saveattachment=true,
  imapfirstmails="0", valueimaplist=ALL, actiontype=GET, aftergetimap=NOTHING.
- Runtime: `execute()` (845+), `evaluates()` (1236).
- PITFALLS: `getXML()` writes lowercase `receiveddate1/2` (230) but
  `loadXML()` reads camelCase `receivedDate1/2` (303–304) — harmless
  (case-insensitive); enum typos silently fall back to index 0; password
  encrypted — always use `${MAIL_PASSWORD}`.

Emitted tag order: `[servername, username, password, usessl, sslport,
outputdirectory, filenamepattern, retrievemails, firstmails, delete,
savemessage, saveattachment, usedifferentfolderforattachment, protocol,
attachmentfolder, attachmentwildcard, valueimaplist, imapfirstmails,
imapfolder, sendersearch, nottermsendersearch, receipientsearch,
nottermreceipientsearch, subjectsearch, nottermsubjectsearch, bodysearch,
nottermbodysearch, conditionreceiveddate, nottermreceiveddatesearch,
receiveddate1, receiveddate2, actiontype, movetoimapfolder,
createmovetofolder, createlocalfolder, aftergetimap, includesubfolders,
useproxy, proxyusername]`.

### A2. job PING — `JobEntryPing`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/ping/JobEntryPing.java`
- Registry: `kettle-job-entries.xml` line 30.
- `getXML()` (102–116): `hostname`, `nbr_packets`, `nbrpaquets` (LEGACY
  duplicate, same value, lines 109–110, TODO from 2.5.0), `timeout`, `pingtype`.
- `loadXML()` (118–151): `nbr_packets` missing + `nbrpaquets` present →
  use legacy (127–132); `pingtype` missing/empty→classicPing, `systemPing`→1,
  `bothPings`→2, else→classic (135–147). Comparison is case-SENSITIVE `.equals`.
- Constructor (85–91): pingtype=classicPing, nbrPackets="2" (DEFAULT_PACKETS),
  timeout="3000" (DEFAULT_TIMEOUT_MS, lines 69–70).
- Runtime: `execute()` (277+), `evaluates()` (336).

Emitted tag order: `[hostname, nbr_packets, nbrpaquets, timeout, pingtype]`.

### A3. job TELNET — `JobEntryTelnet`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/telnet/JobEntryTelnet.java`
- Registry: `kettle-job-entries.xml` line 66.
- `getXML()` (88–97): `hostname`, `port`, `timeout`. Nothing else.
- `loadXML()` (99–109): straight reads, NO fallback (missing→null).
- Constructor (72–77): port="23" (DEFAULT_PORT), timeout="3000"
  (DEFAULT_TIME_OUT, lines 69–70).
- Runtime: `execute()` (171+), `evaluates()` (207).

Emitted tag order: `[hostname, port, timeout]`.

### A4. job SYSLOG — `JobEntrySyslog`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/syslog/JobEntrySyslog.java`
- Registry: `kettle-job-entries.xml` line 55.
- `getXML()` (89–103): `port` FIRST, then `servername`, `facility`,
  `priority`, `message`, `datePattern`, `addTimestamp`, `addHostname`.
- `loadXML()` (105–121): straight + 2 Y/N flags (missing→false).
- Constructor (68–78): port="514", facility=FACILITYS[0]="KERNEL",
  priority=PRIORITYS[0]="EMERGENCY", datePattern="MMM dd HH:mm:ss",
  addTimestamp/addHostname=true.
- Constants: `SyslogDefs.java` lines 48–58 — DEFAULT_PORT=514,
  DEFAULT_DATE_FORMAT, FACILITYS 18 values, PRIORITYS 8 values.
- Runtime: `execute()` (269+), `evaluates()` (328).
- PITFALL: constructor true vs load-missing false for the 2 flags.

Emitted tag order: `[port, servername, facility, priority, message,
datePattern, addTimestamp, addHostname]`.

### A5. job SNMP_TRAP — `JobEntrySNMPTrap`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/snmptrap/JobEntrySNMPTrap.java`
- Registry: `kettle-job-entries.xml` line 53.
- `getXML()` (156–172): `port`, `servername`, `oid`, `comstring`,
  `message`, `timeout`, `nrretry`, `targettype`, `user`, `passphrase`
  (encrypted, line 169), `engineid`.
- `loadXML()` (174–193): straight reads; passphrase decrypted (187);
  missing→null, no fallback.
- Codes: `target_type_Code={community,user}` (108);
  `getTargetTypeCode` null/unknown→community (145–154).
- Constructor (110–123): port="162" (DEFAULT_PORT), comstring="public",
  nrretry="1" (DEFAULT_RETRIES), timeout="5000" (DEFAULT_TIME_OUT),
  targettype="community".
- Runtime: `execute()` (394+), `evaluates()` (520).
- PITFALL: `comstring` stored PLAIN (only passphrase encrypted) — use
  `${VAR}` for both.

Emitted tag order: `[port, servername, oid, comstring, message, timeout,
nrretry, targettype, user, passphrase, engineid]`.

### A6. job SEND_NAGIOS_PASSIVE_CHECK — `JobEntrySendNagiosPassiveCheck`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/sendnagiospassivecheck/JobEntrySendNagiosPassiveCheck.java`
- Registry: `kettle-job-entries.xml` line 65.
- `getXML()` (203–221): `port`, `servername`, `password` (PLAIN, line 209 —
  NO Encr!), `responseTimeOut`, `connectionTimeOut`, `senderServerName`,
  `senderServiceName`, `message`, `encryptionMode` (code, 216–217),
  `level` (code, 218).
- `loadXML()` (249–269): codes via `getEncryptionModeByCode`/
  `getLevelByCode`, null/unknown→0 (223–247).
- Codes: `encryption_mode_Code={none,tripledes,xor}` (104);
  `level_type_Code={unknown,ok,warning,critical}` (115).
- Constructor (122–134): port="5667" (DEFAULT_PORT, 98),
  responseTimeOut="10000" (88), connectionTimeOut="5000" (93),
  encryptionMode=NONE(0), level=UNKNOWN(0).
- Runtime: `execute()` (452+), `evaluates()` (551).
- PITFALL (CRITICAL): plain-text password — `${NAGIOS_PASSWORD}` mandatory.

Emitted tag order: `[port, servername, password, responseTimeOut,
connectionTimeOut, senderServerName, senderServiceName, message,
encryptionMode, level]`.

### A7. job WEBSERVICE_AVAILABLE — `JobEntryWebServiceAvailable`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/webserviceavailable/JobEntryWebServiceAvailable.java`
- Registry: `kettle-job-entries.xml` line 58.
- `getXML()` (78–86): `url`, `connectTimeOut`, `readTimeOut`. Nothing else.
- `loadXML()` (88–99): straight reads, missing→null.
- Constructor (62–67): url=null, both timeouts "0" (= unlimited).
- Runtime: `execute()` (148+), `evaluates()` (191).

Emitted tag order: `[url, connectTimeOut, readTimeOut]`.

## B. Trans mail (3)

### B1. trans Mail — `MailMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/mail/MailMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml` line 72.
- `getXML()` (253–316): 40 scalars `server` (258)…`secureconnectiontype`
  (302), then `<embeddedimages>` ALWAYS emitted even when null (304–313),
  items with `image_name` + `content_id` (308–309). `<auth_password>`
  encrypted (292–294).
- `loadXML()` (158–160) → `readData()` (173–230): straight reads, Y/N
  flags (missing→false), auth_password decrypted (203–204), list counted
  under `<embeddedimages>` (217–221).
- `setDefault()` EMPTY (249–250) — new step all null/false.
- No `<connection>` tag (server/port are plain strings, not DB refs).

Emitted tag order: `[server, port, destination, destinationCc,
destinationBCc, replyToAddresses, replyto, replytoname, subject,
include_date, include_subfolders, zipFilenameDynamic, isFilenameDynamic,
attachContentFromField, attachContentField, attachContentFileNameField,
dynamicFieldname, dynamicWildcard, dynamicZipFilename, sourcefilefoldername,
sourcewildcard, contact_person, contact_phone, comment, include_files,
zip_files, zip_name, zip_limit_size, use_auth, use_secure_auth, auth_user,
auth_password, only_comment, use_HTML, use_Priority, encoding, priority,
importance, sensitivity, secureconnectiontype, embeddedimages/
embeddedimage(image_name, content_id)]`.

### B2. trans MailInput — `MailInputMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/mailinput/MailInputMeta.java`
- Registry: `kettle-steps.xml` line 98.
- `getXML()` (376–432): 33 scalars `servername` (379)…`stopOnError` (418;
  batch tags via `Tags` constants `useBatch/batchSize/startMsg/endMsg/
  stopOnError`, lines 367–373), then `<fields>` ALWAYS (423–430), items
  `name` + `column` code string (426–427). Password encrypted (381–382).
- `loadXML()` (113–115) → `readData()` (135–191): `retrievemails`
  `Const.toInt(…, -1)` (141: missing→-1 vs setDefault 0!); `protocol`
  missing→POP3 (145); `batchSize` parse-fail→DEFAULT_BATCH_SIZE=500
  (63, 171–175); `useBatch`/`stopOnError` Y/N (170, 178); `<fields>/<field>`
  `name` + `column`→int via `MailInputField.getColumnByCode`
  (181–190, null/unknown→0=messagenumber, `MailInputField.java` 122–133).
- Column codes: `MailInputField.java` lines 57–60 — 20 codes, note typo
  `sendeddate` (keep as-is; fixing it silently maps to messagenumber).
- `setDefault()` (194–237): protocol=POP3, retrievemails=0,
  imapfirstmails="0", rowlimit="0", batchSize=500, useBatch=false,
  stopOnError=true, 0 fields.
- `check()` (435–451): ERROR `NoInputExpected` if any input hop.
- NOTE: `recipientsearch` here (line 397) vs job GET_POP `receipientsearch`
  (typo) — different tags, do not copy across.
- NOTE: getXML writes lowercase `receiveddate1/2` (406–407), readData reads
  camelCase `receivedDate1/2` (163–164) — harmless (case-insensitive).
- No `<connection>` tag.

Emitted tag order: `[servername, username, password, usessl, sslport,
retrievemails, firstmails, delete, protocol, valueimaplist, imapfirstmails,
imapfolder, sendersearch, nottermsendersearch, recipientsearch,
notTermRecipientSearch, subjectsearch, nottermsubjectsearch,
conditionreceiveddate, nottermreceiveddatesearch, receiveddate1,
receiveddate2, includesubfolders, useproxy, proxyusername, usedynamicfolder,
folderfield, rowlimit, useBatch, batchSize, startMsg, endMsg, stopOnError,
fields/field(name, column)]`.

### B3. trans MailValidator — `MailValidatorMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/mailvalidator/MailValidatorMeta.java`
- Registry: `kettle-steps.xml` line 71.
- `getXML()` (347–366): exactly 12 tags `emailfield` (350)…
  `isdynamicDefaultSMTP` (363). No list.
- `loadXML()` (298–300) → `readData()` (368–389): 3 Y/N flags (missing→false).
- `setDefault()` (308–320): resultfieldname="result",
  emailValideMsg="email address is valid",
  emailNotValideMsg="email address is not valid", errorsFieldName="Error
  message", timeout="0", emailSender="noreply@domain.com", rest false/null.
- `getFields()` (322–345): appends result col (Boolean, or String len 100
  when ResultAsString) + error String col when errorsFieldName non-empty.
- `check()` (437+): ERROR on empty resultfieldname/emailfield (+ 2 messages
  in String mode).
- PITFALL: tag spellings `ResultAsString`, `smtpCheck`, `emailValideMsg`
  (one-L "Valide"), `isdynamicDefaultSMTP` — keep exact.
- No `<connection>` tag.

Emitted tag order: `[emailfield, resultfieldname, ResultAsString,
smtpCheck, emailValideMsg, emailNotValideMsg, errorsFieldName, timeout,
defaultSMTP, emailSender, defaultSMTPField, isdynamicDefaultSMTP]`.

## C. Trans bulk loaders (6)

All six reference `<connection>` BY NAME (B2 pitfall: fixtures declare it).
All use `${VAR}` placeholders, no real credentials.

### C1. trans MySQLBulkLoader — `MySQLBulkLoaderMeta`
- Class: `plugins/mysql-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/mysqlbulkloader/MySQLBulkLoaderMeta.java`
- Registry: `@Step(id="MySQLBulkLoader",…)` line 81.
- `getXML()` (305–332): `connection` (name or "", 308–309), `schema`,
  `table`, `encoding`, `delimiter`, `enclosure`, `escape_char`, `replace`,
  `ignore`, `local`, `fifo_file_name`, `bulk_size` (310–320), then SIBLING
  `<mapping>` items (322–329: `stream_name`, `field_name`,
  `field_format_ok` via `getFieldFormatTypeCode`, 326–327).
- Format codes: `fieldFormatTypeCodes={OK,DATE,TIMESTAMP,NUMBER,STRING_ESC}`
  (98); `getFieldFormatTypeCode(int)` (747–748).
- `readData()` (247–285): connection via `findDatabase` (249–250); 3 Y/N
  flags; `<mapping>` counted directly under step (268); `field_name`
  missing→same as `stream_name` (276–278).
- `setDefault()` (287–303): schemaName="", fifoFileName="/tmp/fifo",
  delimiter="\t", enclosure="\"", escapeChar="\\", localFile=true, rest
  false/null, 0 mappings.
- PITFALL: `stream_name` = TABLE column, `field_name` = STREAM field
  (counter-intuitive order, same as OraBulkLoader); TAB default is a real
  TAB char.

Emitted tag order: `[connection, schema, table, encoding, delimiter,
enclosure, escape_char, replace, ignore, local, fifo_file_name, bulk_size,
<mapping>(stream_name, field_name, field_format_ok)*]` (siblings, no wrapper).

### C2. trans MonetDBBulkLoader — `MonetDBBulkLoaderMeta`
- Class: `plugins/monet-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/monetdbbulkloader/MonetDBBulkLoaderMeta.java`
- Registry: `@Step(id="MonetDBBulkLoader",…)` line 69.
- `getXML()` (369–397): `connection`, `buffer_size`, `schema`, `table`,
  `log_file`, `truncate`, `fully_quote_sql`, `field_separator`,
  `field_enclosure`, `null_representation`, `encoding` (373–385), then
  SIBLING `<mapping>` (388–394: `stream_name`, `field_name`,
  `field_format_ok` boolean Y/N, 390–392).
- `readData()` (294–349): `truncate`/`fully_quote_sql` parsed with
  case-SENSITIVE `"Y".equals` (303, 309 — lowercase `y` = false!);
  load-missing fallbacks: separator→"|", enclosure→"\"",
  null_representation→"null", encoding→"UTF-8" (311–326);
  `field_name` missing→same as `stream_name` (340–342).
- `setDefault()` (351–367): bufferSize="100000", fullyQuoteSQL=true,
  separator="|", enclosure="\"", NULLrepresentation="" (EMPTY — differs
  from load fallback "null"!), encoding="UTF-8", 0 mappings.

Emitted tag order: `[connection, buffer_size, schema, table, log_file,
truncate, fully_quote_sql, field_separator, field_enclosure,
null_representation, encoding, <mapping>(stream_name, field_name,
field_format_ok)*]`.

### C3. trans PGBulkLoader — `PGBulkLoaderMeta`
- Class: `plugins/postgresql-db-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/pgbulkloader/PGBulkLoaderMeta.java`
- Registry: `@Step(id="PGBulkLoader",…)` line 67.
- `getXML()` (279–302): `connection`, `schema`, `table`, `load_action`,
  `dbname_override`, `enclosure`, `delimiter`, `stop_on_error` (282–291),
  then SIBLING `<mapping>` (293–299: `stream_name`, `field_name`,
  `date_mask`, 295–297).
- Codes: ACTION_INSERT="INSERT", ACTION_TRUNCATE="TRUNCATE" (114–115);
  DATE_MASK PASS THROUGH/DATE/DATETIME (120–122).
- `readData()` (221–264): `field_name` missing→same (244–246); `date_mask`
  kept ONLY on exact (case-sensitive `.equals`) match of the 3 codes, else
  "" (251–257).
- `setDefault()` (266–277): delimiter=";", enclosure="\"",
  stopOnError=false, dbNameOverride=""; does NOT set loadAction (null!).
- PITFALL: no loadAction default — template pins INSERT explicitly.

Emitted tag order: `[connection, schema, table, load_action,
dbname_override, enclosure, delimiter, stop_on_error,
<mapping>(stream_name, field_name, date_mask)*]`.

### C4. trans InfobrightOutput — `InfobrightLoaderMeta extends TableOutputMeta`
- Class: `plugins/infobright-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/infobrightoutput/InfobrightLoaderMeta.java`
- Registry: `@Step(id="InfobrightOutput",…)` line 54.
- `getXML()` (157–164) = `super.getXML()` (full `TableOutputMeta.getXML()`:
  `engine/.../tableoutput/TableOutputMeta.java` 511–547 — `connection`,
  `schema`, `table`, `commit`, `truncate`, `ignore_errors`, `use_batch`,
  `specify_fields`, partitioning ×4, tablename ×3, return ×2, `<fields>`
  with `column_name` + `stream_name` per item, 514–544) + 4 own tags
  `data_format` (enum toString, 159), `agent_port` (160), `charset`
  (.name(), 161), `debug_file` (162). Tag constants: data_format/
  charset/agent_port/debug_file (lines 62–65).
- `loadXML()` (168–182): `dataFormat=Enum.valueOf(…)` (171 — missing/wrong
  name THROWS); agentPort int with AGENT_DEFAULT_PORT fallback (172–174);
  charset null→lib default (175–177).
- `setDefault()` (129–134): dataFormat=TXT_VARIABLE (ICE default; BINARY
  commented for IEE, 130–131); agentPort/charset from
  `InfobrightNamedPipeLoader` (EXTERNAL `com.infobright.etl` lib — not in
  source; numeric values unverifiable, template uses placeholder).
- PITFALLS: strict enum/charset (template always pins TXT_VARIABLE);
  `column_name` BEFORE `stream_name` (opposite of `<mapping>` loaders);
  4 own tags AFTER `<fields>`.

Emitted tag order: `[connection, schema, table, commit, truncate,
ignore_errors, use_batch, specify_fields, partitioning_enabled,
partitioning_field, partitioning_daily, partitioning_monthly,
tablename_in_field, tablename_field, tablename_in_table, return_keys,
return_field, fields/field(column_name, stream_name), data_format,
agent_port, charset, debug_file]`.

### C5. trans VectorWiseBulkLoader — `IngresVectorwiseLoaderMeta`
- Class: `plugins/ivw-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/ivwloader/IngresVectorwiseLoaderMeta.java`
- Registry: `@Step(id="VectorWiseBulkLoader",…)` line 55.
- `getXML()` (209–243): `connection`, `table` (NO schema!), `fifo_file_name`,
  `sql_path`, `encoding`, `delimiter`, `continue_on_error`,
  `error_file_name`, `use_standard_conversion`, `use_authentication`,
  `use_dynamic_vnode`, `use_SSV_delimiter`, `escape_special_characters`,
  `use_vwload`, `truncate_table`, `max_errors`, `buffer_size` (212–230),
  then WRAPPED `<fields>` always (232–240) with `column_name` +
  `stream_name` (236–237).
- `loadXML()` (246–282): Y/N flags (missing→false) EXCEPT
  `escape_special_characters`: missing/empty→TRUE (261–262); list
  `<fields>/<field>` (268–278).
- `setDefault()` (173–188): sqlPath install default, delimiter="|",
  fifoFileName tmpdir pattern, escapingSpecialCharacters=true,
  maxNrErrors="50", bufferSize="5000", rest false.
- PITFALL: no `<schema>` tag — do not invent one.

Emitted tag order: `[connection, table, fifo_file_name, sql_path, encoding,
delimiter, continue_on_error, error_file_name, use_standard_conversion,
use_authentication, use_dynamic_vnode, use_SSV_delimiter,
escape_special_characters, use_vwload, truncate_table, max_errors,
buffer_size, fields/field(column_name, stream_name)]`.

### C6. trans GPLoad — `GPLoadMeta`
- Class: `plugins/gpload/core/src/main/java/org/pentaho/di/trans/steps/gpload/GPLoadMeta.java`
- Registry: `@Step(id="GPLoad",…)` line 61.
- `getXML()` (414–454): `connection`, `errors`, `schema`, `table`,
  `error_table`, `load_method`, `load_action`, `gpload_path`,
  `control_file`, `data_file`, `delimiter`, `log_file`, `null_as`,
  `erase_files`, `encoding`, `enclose_numbers` (explicit Y/N, 433),
  `localhost_port`, `update_condition` (417–435), SIBLING `<mapping>`
  (437–445: `stream_name`, `field_name`, `date_mask`, `match_column`,
  `update_column`), then `<local_hosts>` ALWAYS (447–451).
- Codes: MAX_ERRORS_DEFAULT="50" (161); ACTION_INSERT="insert"
  (LOWERCASE, 179 — unlike PG "INSERT"); METHOD_AUTO_END="AUTO_END"
  (187); DATE_MASK DATE/DATETIME only (193–194, no PASS THROUGH).
- `readData()` (324–384): **`enclose_numbers` read WITHOUT null-guard**
  (`getTagValue(…).equalsIgnoreCase("Y")`, line 353) — missing tag → NPE
  wrapped as KettleXMLException. Template MUST carry it. `date_mask` kept
  only for DATE/DATETIME (370), else ""; `local_hosts` text per
  `<local_host>` (344–350).
- `setDefault()` (386–412): maxErrors="50", loadMethod=AUTO_END,
  loadAction=insert, gploadPath default, delimiter=",", eraseFiles=true,
  0 mappings + 0 local hosts.
- PITFALL: `<local_hosts>` always paired (keep paired, not self-closing).

Emitted tag order: `[connection, errors, schema, table, error_table,
load_method, load_action, gpload_path, control_file, data_file, delimiter,
log_file, null_as, erase_files, encoding, enclose_numbers, localhost_port,
update_condition, <mapping>(stream_name, field_name, date_mask,
match_column, update_column)*, local_hosts/local_host*]`.

## D. Job/SQL bulk + SQL trans (5)

### D1. job MSSQL_BULK_LOAD — `JobEntryMssqlBulkLoad`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/mssqlbulkload/JobEntryMssqlBulkLoad.java`
- Registry: `kettle-job-entries.xml` line 41.
- `getXML()` (143–178): `super.getXML()` + 26 tags `schemaname` (147)…
  `truncate` (172), `<connection>` LAST (174–175, null→null).
- `loadXML()` (180–222): ints via `Const.toInt(…, 0)` (startfile/endfile
  201–202, maxerrors/batchsize/rowsperbatch 209–211); Y/N flags; connection
  via `findDatabase` (213–217).
- Constructor (102–132): datafiletype="char", codepage="OEM",
  orderdirection="Asc", ints 0, rest null/false.
- Runtime: `evaluates()` (351). B2 pitfall applies (fixture declares `${CONN}`).

Emitted tag order: `[schemaname, tablename, filename, datafiletype,
fieldterminator, lineterminated, codepage, specificcodepage, formatfilename,
firetriggers, checkconstraints, keepnulls, keepidentity, tablock,
startfile, endfile, orderby, orderdirection, maxerrors, batchsize,
rowsperbatch, errorfilename, adddatetime, addfiletoresult, truncate,
connection]`.

### D2. job MYSQL_BULK_LOAD — `JobEntryMysqlBulkLoad`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkload/JobEntryMysqlBulkLoad.java`
- Registry: `kettle-job-entries.xml` line 24.
- `getXML()` (115–142): 14 tags `schemaname` (119)…`addfiletoresult`
  (136), `<connection>` LAST (138–139). NOTE source typo `prorityvalue`
  (missing 2nd "o", lines 134, 161) — kept verbatim.
- `loadXML()` (144–168): replacedata/localinfile Y/N; `prorityvalue`
  `Const.toInt(…, -1)` (161: missing→-1); connection via findDatabase.
- Constructor (88–104): replacedata=true, localinfile=true,
  ignorelines="0", rest null/false (prorityvalue Java int default 0).
- PITFALL: replacedata/localinfile default Y (unusual); keep the typo.

Emitted tag order: `[schemaname, tablename, filename, separator, enclosed,
escaped, linestarted, lineterminated, replacedata, ignorelines,
listattribut, localinfile, prorityvalue, addfiletoresult, connection]`.

### D3. job MYSQL_BULK_FILE — `JobEntryMysqlBulkFile`
- Class: `engine/src/main/java/org/pentaho/di/job/entries/mysqlbulkfile/JobEntryMysqlBulkFile.java`
- Registry: `kettle-job-entries.xml` line 28.
- `getXML()` (112–133): 13 tags `schemaname` (116)…`addfiletoresult`
  (128), `<connection>` LAST (129–130).
- `loadXML()` (135–157): highpriority/optionenclosed/addfiletoresult Y/N;
  `outdumpvalue`/`iffileexists` `Const.toInt(…, -1)` (149–150:
  missing→-1). (Error text at line 155 wrongly says 'table exists' —
  cosmetic source bug, XML unaffected.)
- Constructor (86–101): limitlines="0", highpriority=true,
  optionenclosed=false, iffileexists=2, outdumpvalue Java int default 0.
- Runtime: `evaluates()` (236); `execute()` branches on
  `file.exists() && iffileexists==2/==1` (263–270).
- PITFALL: outdumpvalue/iffileexists are INT codes, not Y/N;
  highpriority defaults Y.

Emitted tag order: `[schemaname, tablename, filename, separator, enclosed,
optionenclosed, lineterminated, limitlines, listcolumn, highpriority,
outdumpvalue, iffileexists, addfiletoresult, connection]`.

### D4. trans SQLFileOutput — `SQLFileOutputMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/sqlfileoutput/SQLFileOutputMeta.java`
- Registry: `kettle-steps.xml` line 60.
- `getXML()` (491–521): `connection`, `schema`, `table`, `truncate`,
  `create`, `encoding`, `dateformat`, `addtoresult` (lowercase, 502),
  `startnewline` (lowercase, 504), `<file>` block (506–518): `name`,
  `extention` (TYPO kept both sides, 508/468), `append`, `split`,
  `haspartno`, `add_date`, `add_time`, `splitevery`, `create_parent_folder`,
  `DoNotOpenNewFileInit`.
- `readData()` (450–481): reads `AddToResult`/`StartNewLine` (capitalized,
  461/463) vs getXML lowercase — harmless; `splitevery`
  `Const.toInt(…, 0)` (474); `<file>` children via
  `getTagValue(stepnode, "file", subtag)` (465–476).
- `setDefault()` (483–489) minimal: tablename="", createparentfolder=false,
  DoNotOpenNewFileInit=false; rest null/false.
- Connection is dialect-only reference but still validated (B2 fixture rule).
- PITFALL: keep `extention` typo; keep getXML lowercase for
  addtoresult/startnewline.

Emitted tag order: `[connection, schema, table, truncate, create, encoding,
dateformat, addtoresult, startnewline, file(name, extention, append, split,
haspartno, add_date, add_time, splitevery, create_parent_folder,
DoNotOpenNewFileInit)]`.

### D5. trans ExecSQLRow — `ExecSQLRowMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/execsqlrow/ExecSQLRowMeta.java`
- Registry: `kettle-steps.xml` line 79.
- `getXML()` (298–313): `commit` FIRST (300!), then `connection`,
  `sql_field`, `insert_field`, `update_field`, `delete_field`,
  `read_field`, `sqlFromfile`, `sendOneStatement` (301–311). NO static
  `<sql>` tag (unlike ExecSQL/DBJoin) — SQL comes from the field.
- `readData()` (258–280): `commit` `Const.toInt(…, 0)` (264–265:
  missing→0 vs setDefault 1!); `sendOneStatement` NVL "Y" (missing→true,
  274–275).
- `setDefault()` (282–288): commitSize=1, sendOneStatement=true,
  sqlFromfile=false, rest null.
- `getFields()` (290–296): merges 4 stats cols from
  `ExecSQL.getResultRow` (insert/update/delete/read).
- PITFALL: commit order (before connection) + dual default (1 new vs 0
  load-missing) — template pins `1`.

Emitted tag order: `[commit, connection, sql_field, insert_field,
update_field, delete_field, read_field, sqlFromfile, sendOneStatement]`.

## E. Trans streaming (6)

Common mechanism (Jms2Consumer/Jms2Producer/MQTTConsumer/MQTTProducer/
FileStream): `BaseSerializingMeta` JAXB `<step-props>` (see header).
Real observed emissions in-repo: `plugins/streaming/impls/jms/src/test/
resources/jms-consumer.ktr` (lines 451–537), `amq-producer.ktr` (line
491+), `plugins/streaming/impls/mqtt/src/test/resources/ConsumeRows.ktr`
(451–543), `ProduceFourRows.ktr` (line 491+). These fixtures are STALE
(missing newer @Injection props) — templates list the full current set.

### E1. trans Jms2Consumer — `JmsConsumerMeta`
- Class: `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsConsumerMeta.java`
- Registry: `@Step(id="Jms2Consumer",…)` line 61. `extends
  BaseStreamStepMeta` (line 73).
- NO getXML/loadXML override — JAXB via base.
- Fields (80–113): `@InjectionDeep jmsDelegate` (delegate props
  `DESTINATION`…`AMQ_SSL_TRUST_ALL`, `JmsDelegate.java` 55–108, defaults
  connectionType=ACTIVEMQ, destinationType=QUEUE); RECEIVE_TIMEOUT="0"
  (83); messageField=message, destinationField=destination, messageId,
  jmsTimestamp, jmsRedelivered (85–113). No explicit setDefault override
  found (base-stream defaults apply where called).
- Base (`BaseStreamStepMeta.java` 56–84): TRANSFORMATION_PATH="",
  NUM_MESSAGES(batchSize)="1000", PREFETCH_COUNT="100000" (64–65),
  DURATION="1000", SUB_STEP="", PARALLELISM="1"; setDefault (119–124).
- `secure` attrs: IBMMQ_PASSWORD AMQ_PASSWORD SSL_KEYSTORE_PASSWORD
  SSL_TRUSTSTORE_PASSWORD (observed .ktr line 451).
- Output: `getRowMeta()` (129–137) — 5 String cols.
- No `<connection>` tag.

Observed property order (group `""` then `SSL_GROUP`): `[DESTINATION,
IBMMQ_URL, IBMMQ_USERNAME, IBMMQ_PASSWORD, AMQ_URL, AMQ_USERNAME,
AMQ_PASSWORD, CONNECTION_TYPE, DESTINATION_TYPE, RECEIVE_TIMEOUT,
MESSAGE_FIELD_NAME, DESTINATION_FIELD_NAME, (MESSAGE_ID, JMS_TIMESTAMP,
JMS_REDELIVERED — in source, missing from stale .ktr), TRANSFORMATION_PATH,
NUM_MESSAGES, DURATION, SUB_STEP, (PREFETCH_COUNT, PARALLELISM — in source,
missing from stale .ktr), SSL_*]`.

### E2. trans Jms2Producer — `JmsProducerMeta`
- Class: `plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsProducerMeta.java`
- Registry: `@Step(id="Jms2Producer",…)` line 68. `extends
  BaseSerializingMeta` (line 74) — NO base-stream props.
- Fields (103–139): jmsDelegate (deep); FIELD_TO_SEND="" (106–107);
  PROPERTY_NAMES/PROPERTY_VALUES group PROPERTIES, empty ArrayLists
  (109–115); DISABLE_MESSAGE_ID/TIMESTAMP, DELIVERY_MODE, PRIORITY,
  TIME_TO_LIVE, DELIVERY_DELAY, JMS_CORRELATION_ID, JMS_TYPE (117–139;
  name constants lines 90–101).
- `setDefault()` EMPTY ("no defaults", 151–153).
- Observed: `amq-producer.ktr` line 491+ (groups `""`, PROPERTIES,
  SSL_GROUP; no TRANSFORMATION_PATH).
- No `<connection>` tag.

### E3. trans MQTTConsumer — `MQTTConsumerMeta`
- Class: `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTConsumerMeta.java`
- Registry: `@Step(id="MQTTConsumer",…)` line 96. `extends
  BaseStreamStepMeta` (109).
- Fields (114–176): mqttServer/clientId/topics/MSG_OUTPUT_NAME(literal
  "MSG_OUTPUT_NAME", 127!)/TOPIC_OUTPUT_NAME(literal, 132!)/qos="0"/
  username/password(useSsl SSL group)/Paho options/…/messageDataType=String
  (176). Name constants: `MQTTConstants.java` lines 29–52 (group SSL,
  line 37). NOTE: XML names are the literals `MSG_OUTPUT_NAME`/
  `TOPIC_OUTPUT_NAME`, NOT the constant values "Message"/"Topic name"
  (lines 34–35, metaverse labels).
- `setDefault()` (183+): resets + sslKeys/sslValues from DEFAULT_SSL_OPTS.
- Observed: `ConsumeRows.ktr` 451–543 — order MQTT_SERVER…AUTOMATIC_RECONNECT,
  TRANSFORMATION_PATH, NUM_MESSAGES, DURATION, then SSL group (USE_SSL
  boolean, SSL_KEYS/SSL_VALUES 13 parallel values). Fixture lacks
  CLIENT_ID/MESSAGE_DATA_TYPE (stale).
- No `<connection>` tag.

### E4. trans MQTTProducer — `MQTTProducerMeta`
- Class: `plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTProducerMeta.java`
- Registry: `@Step(id="MQTTProducer",…)` line 86. `extends
  BaseSerializingMeta` (99) — NO base-stream props.
- Fields (106–155): mqttServer, clientId, topic, fieldTopic,
  topicInField=false (119), qos, messageField, username, password,
  useSsl=false (SSL group), sslKeys/sslValues, Paho options;
  `setDefault()` (162+).
- Observed: `ProduceFourRows.ktr` line 491+ — order MQTT_SERVER, CLIENT_ID,
  TOPIC, QOS, MESSAGE_FIELD, USERNAME, PASSWORD, Paho options, SSL group.
  Fixture lacks FIELD_TOPIC/TOPIC_IN_FIELD (stale).
- No `<connection>` tag.

### E5. trans RecordsFromStream — `RecordsFromStreamMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/recordsfromstream/RecordsFromStreamMeta.java`
  (28 lines total): `extends RowsFromResultMeta`, ZERO overrides (line 27).
- Registry: `kettle-steps.xml` line 40 (category Streaming).
- XML identical to RowsFromResult: single `<fields>` (name, type, length,
  precision); see `src/knowledge/pentaho/trans/RowsFromResult.md` §4 for
  `RowsFromResultMeta.getXML()` (152–166) / `readData()` (168–182) /
  `setDefault()` allocate(0) (184–186). Only `<type>` differs.
- No `<connection>` tag.

### E6. trans FileStream — `FileStreamMeta`
- Class: `plugins/file-stream/src/main/java/org/pentaho/di/trans/step/filestream/FileStreamMeta.java`
- Registry: `@Step(id="FileStream",…)` line 46. `extends BaseStreamStepMeta`
  (49) via `StepWithMappingMeta extends BaseSerializingMeta`
  (`engine/src/main/java/org/pentaho/di/trans/StepWithMappingMeta.java`
  line 64) — JAXB `<step-props>` confirmed by inheritance.
- Single own prop: `@Injection(name=SOURCE_PATH)` (55–56),
  `SOURCE_PATH="sourcePath"` LOWERCASE (52) — unlike UPPER JMS/MQTT props.
- `setDefault()` EMPTY and does NOT call super (68–69) — no defaults at all.
- Rest: base-stream props (TRANSFORMATION_PATH, NUM_MESSAGES, DURATION,
  SUB_STEP, …).
- No `<connection>` tag.

## F. Trans DB lookup/utility (6)

### F1. trans DynamicSQLRow — `DynamicSQLRowMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/dynamicsqlrow/DynamicSQLRowMeta.java`
- Registry: `kettle-steps.xml` line 80.
- `getXML()` (274–287): `connection`, `rowlimit` (int), `sql`,
  `outer_join`, `replace_vars`, `sql_fieldname`, `query_only_on_change`
  (277–284). NO `<parameter>` list (unlike DBJoin).
- `readData()` (197–213): connection via findDatabase; 3 Y/N flags;
  `rowLimit` `Const.toInt(…, 0)` (206).
- `setDefault()` (215–223): rowLimit=0, sql="", flags false, sqlfieldname=null.
- `getFields()` (225–272): connection null→early return (228–230); appends
  query cols (cache or live). Needs real DB — no runtime test.
- Fixture needs `<connection>` (B2).

Emitted tag order: `[connection, rowlimit, sql, outer_join, replace_vars,
sql_fieldname, query_only_on_change]`.

### F2. trans FuzzyMatch — `FuzzyMatchMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/fuzzymatch/FuzzyMatchMeta.java`
- Registry: `kettle-steps.xml` line 112.
- `getXML()` (515–543): `from` = info-step NAME (519), `lookupfield`,
  `mainstreamfield`, `outputmatchfield`, `outputvaluefield` (520–523),
  `caseSensitive`, `closervalue`, `minimalValue`, `maximalValue`,
  `separator` (525–529), `algorithm` code (531), `<lookup>` ALWAYS
  (533–540) with `<value>` = `name` + `rename` (536–537).
- Codes: `algorithmCode` 10 lowercase (87–89) — note typo
  `doublemataphone` (missing "e", keep!); parse case-insensitive,
  unknown→0=levenshtein (369+); code OOB→index 0 (419–424).
- `readData()` (377–417): `<from>` → info-stream subject (380–382);
  `rename` missing→same as `name` (408–410).
- `setDefault()` (426–448): separator="," (DEFAULT_SEPARATOR, 65),
  closervalue=true, minimalValue="0", maximalValue="1",
  caseSensitive=false, 0 values. output fields default from i18n (436–437).
- `getFields()` (450–513): always String match col; value col type by
  algorithm (Integer for Levenshtein/Damerau 463–466, Number for
  Jaro/Jaro-Winkler/PairSimilarity 467–471, String for phonetics 472–475);
  lookup cols appended (throws `ReturnValueCanNotBeFound` when missing).
- `<from>` is a STEP reference (needs info hop in production). No
  `<connection>` tag.

Emitted tag order: `[from, lookupfield, mainstreamfield, outputmatchfield,
outputvaluefield, caseSensitive, closervalue, minimalValue, maximalValue,
separator, algorithm, lookup/value(name, rename)]`.

### F3. trans WebServiceLookup — `WebServiceMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/webservices/WebServiceMeta.java`
- Registry: `kettle-steps.xml` line 95.
- `getXML()` (201–257): 17 scalars `wsURL` (206)…`reply_as_string` (226),
  then `<fieldsIn>` (232–241) and `<fieldsOut>` (245–254), items `name`,
  `wsName`, `xsdType` (236–238).
- `loadXML()` (259–300+): `callStep` `Const.toInt(…, DEFAULT_STEP=1000)`
  (57, 277); passingInputData Y/N; **`compatible`: missing/empty→TRUE**
  (279–280: `Utils.isEmpty(compat) || "Y"…`) — opposite of normal flags.
- `setDefault()` (171–173): only passingInputData=true (rest null/Java
  defaults; callStep=1000 from field init, line 101).
- `check()` (175–199): WARNING on no prev fields, ERROR on no hop when
  input fields configured.
- PITFALLS: compatible inversion; `httpPassword` PLAIN (line 220, no Encr)
  → `${WS_PASSWORD}`; In/Out `name`/`wsName` directions are OPPOSITE
  (In: field→param; Out: result→field); two independent lists (two
  set_fields calls).
- No `<connection>` tag.

Emitted tag order: `[wsURL, wsOperation, wsOperationRequest,
wsOperationNamespace, wsInFieldContainer, wsInFieldArgument,
wsOutFieldContainer, wsOutFieldArgument, proxyHost, proxyPort, httpLogin,
httpPassword, callStep, passingInputData, compatible, repeating_element,
reply_as_string, fieldsIn/field(name, wsName, xsdType),
fieldsOut/field(name, wsName, xsdType)]`.

### F4. trans WebServiceAvailable — `WebServiceAvailableMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/webserviceavailable/WebServiceAvailableMeta.java`
- Registry: `kettle-steps.xml` line 110.
- `getXML()` (148–156): `urlField` (DYNAMIC field name, 151!),
  `readTimeOut` BEFORE `connectTimeOut` (152–153), `resultfieldname` (154).
- `readData()` (158–168): straight reads, missing→null (no fallback).
- `setDefault()` (131–135): resultfieldname="result", both timeouts "0".
- `getFields()` (137–146): appends single ValueMetaBoolean(resultfieldname)
  when non-empty.
- `check()` (195+): ERROR on empty resultfieldname/urlField.
- PITFALLS: `urlField` is a FIELD name (not a static URL — that's the job
  entry); read-before-connect order; no load fallback — template pins all 4.
- No `<connection>` tag. Distinct from job WEBSERVICE_AVAILABLE.

Emitted tag order: `[urlField, readTimeOut, connectTimeOut, resultfieldname]`.

### F5. trans GetTableNames — `GetTableNamesMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/gettablenames/GetTableNamesMeta.java`
- Registry: `kettle-steps.xml` line 99.
- `getXML()` (359–380): `connection`, `schemaname`, 4 `*fieldname`
  (tablename/objecttype/issystemobject/sqlcreation, 364–367), 8 flags
  (`includeCatalog`, `includeSchema`, `includeTable`, `includeView`,
  `includeProcedure`, `includeSynonym`, `addSchemaInOutput`,
  `dynamicSchema`, 369–376), `schemaNameField` last (377).
- `readData()` (382–414): 8 Y/N flags; **7.0 back-compat**: typo tag
  `schenameNameField` (missing "m") overrides `schemaNameField` when
  present (403–409) — read-only compat, never write it.
- `setDefault()` (305–321): tablenamefieldname="tablename",
  objecttypefieldname="type", issystemobjectfieldname="is system", 4 object
  includes true, rest false/null.
- `getFields()` (323–357): up to 4 cols, each ONLY when its name non-empty
  (2× String-500 + Boolean + DDL String-500).
- Fixture needs `<connection>` (B2).

Emitted tag order: `[connection, schemaname, tablenamefieldname,
objecttypefieldname, issystemobjectfieldname, sqlcreationfieldname,
includeCatalog, includeSchema, includeTable, includeView, includeProcedure,
includeSynonym, addSchemaInOutput, dynamicSchema, schemaNameField]`.

### F6. trans MultiwayMergeJoin — `MultiMergeJoinMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/multimerge/MultiMergeJoinMeta.java`
- Registry: `kettle-steps.xml` line 121.
- `getXML()` (148–165): `join_type` (152), DYNAMIC `step+i` tags (153–155),
  `number_input` = count (157), `<keys>` via openTag/closeTag (158–162)
  with `<key>` per line (160).
- `readData()` (167–194): keys via getNodeValue (178); **`number_input`
  `Integer.parseInt` with NO null-guard** (181) — missing tag throws
  NumberFormatException wrapped as KettleXMLException (190–193); steps
  read as `step+i` (185–187); joinType last (189).
- Codes: `join_types={INNER, FULL OUTER}` (65); setDefault (197–201):
  INNER + 0 keys + 0 steps.
- `excludeFromRowLayoutVerification()=true` (117–120).
- PITFALLS: number_input mandatory (template always pins); dynamic stepN
  tags (no `<steps>` wrapper, set_fields N/A); "FULL OUTER" has a space.
- No `<connection>` tag.

Emitted tag order: `[join_type, step0..stepN, number_input, keys/key*]`.

## Proposed catalog rows (for Kiro to append to catalog.yaml)

Job rows (`components.job:`; type == xml_type per job convention):

    - {type: GET_POP, xml_type: GET_POP, file: job/GET_POP.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: PING, xml_type: PING, file: job/PING.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: TELNET, xml_type: TELNET, file: job/TELNET.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: SYSLOG, xml_type: SYSLOG, file: job/SYSLOG.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: SNMP_TRAP, xml_type: SNMP_TRAP, file: job/SNMP_TRAP.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: SEND_NAGIOS_PASSIVE_CHECK, xml_type: SEND_NAGIOS_PASSIVE_CHECK, file: job/SEND_NAGIOS_PASSIVE_CHECK.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: WEBSERVICE_AVAILABLE, xml_type: WEBSERVICE_AVAILABLE, file: job/WEBSERVICE_AVAILABLE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MSSQL_BULK_LOAD, xml_type: MSSQL_BULK_LOAD, file: job/MSSQL_BULK_LOAD.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MYSQL_BULK_LOAD, xml_type: MYSQL_BULK_LOAD, file: job/MYSQL_BULK_LOAD.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MYSQL_BULK_FILE, xml_type: MYSQL_BULK_FILE, file: job/MYSQL_BULK_FILE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}

Trans rows (`components.trans:`; UPPER_SNAKE alias per convention):

    - {type: MAIL, xml_type: Mail, file: trans/Mail.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MAIL_INPUT, xml_type: MailInput, file: trans/MailInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MAIL_VALIDATOR, xml_type: MailValidator, file: trans/MailValidator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MYSQL_BULK_LOADER, xml_type: MySQLBulkLoader, file: trans/MySQLBulkLoader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MONETDB_BULK_LOADER, xml_type: MonetDBBulkLoader, file: trans/MonetDBBulkLoader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: PG_BULK_LOADER, xml_type: PGBulkLoader, file: trans/PGBulkLoader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: INFOBRIGHT_OUTPUT, xml_type: InfobrightOutput, file: trans/InfobrightOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: VECTORWISE_BULK_LOADER, xml_type: VectorWiseBulkLoader, file: trans/VectorWiseBulkLoader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: GP_LOAD, xml_type: GPLoad, file: trans/GPLoad.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: SQL_FILE_OUTPUT, xml_type: SQLFileOutput, file: trans/SQLFileOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: EXEC_SQL_ROW, xml_type: ExecSQLRow, file: trans/ExecSQLRow.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: JMS_CONSUMER, xml_type: Jms2Consumer, file: trans/Jms2Consumer.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: JMS_PRODUCER, xml_type: Jms2Producer, file: trans/Jms2Producer.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MQTT_CONSUMER, xml_type: MQTTConsumer, file: trans/MQTTConsumer.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MQTT_PRODUCER, xml_type: MQTTProducer, file: trans/MQTTProducer.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: RECORDS_FROM_STREAM, xml_type: RecordsFromStream, file: trans/RecordsFromStream.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: FILE_STREAM, xml_type: FileStream, file: trans/FileStream.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: DYNAMIC_SQL_ROW, xml_type: DynamicSQLRow, file: trans/DynamicSQLRow.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: FUZZY_MATCH, xml_type: FuzzyMatch, file: trans/FuzzyMatch.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: WEB_SERVICE_LOOKUP, xml_type: WebServiceLookup, file: trans/WebServiceLookup.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: WEB_SERVICE_AVAILABLE, xml_type: WebServiceAvailable, file: trans/WebServiceAvailable.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: GET_TABLE_NAMES, xml_type: GetTableNames, file: trans/GetTableNames.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
    - {type: MULTIWAY_MERGE_JOIN, xml_type: MultiwayMergeJoin, file: trans/MultiwayMergeJoin.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}

Alias-collision notes for Kiro: trans `MAIL_VALIDATOR` vs existing job
`MAIL_VALIDATOR` (different kind — same pattern as `TABLE_EXISTS` in B2a,
valid); trans `WEB_SERVICE_AVAILABLE` vs job `WEBSERVICE_AVAILABLE`
(different strings, no clash); `MAIL` (trans) vs `MAIL` (job) — DIFFERENT
kinds sharing the design alias string `MAIL`: catalog splits by kind and
the B2a precedent (`TABLE_EXISTS` job+trans) allows it, but flagging
explicitly since both read `type: MAIL`. If the loader enforces global
type uniqueness, rename trans alias to `MAIL_STEP` and update the
`MAIL` alias assertion in `test/knowledge-b6-1-conn-stream.test.js`
accordingly (single line in BATCH).

## Test file

`test/knowledge-b6-1-conn-stream.test.js` — 20 test blocks:
catalog/eligibility (33) → first-block validity (33) → addElement+escape+
0-error (33) → 15 per-ID order/non-default tests → coverage (33, missing 0).
Fixtures: mkdtempSync + KETTLE_ROOT, `<connection><name>${CONN}</name></connection>`
declared in BOTH minimal .ktr and .kjb (13 DB-referencing IDs need it;
harmless for the rest). No Java imports, no business I/O. Streaming
non-defaults use a test-local `<property name>/value` splice (setFieldPath
cannot address repeated `<property>` tags by attribute).

## Verification done by this agent (no catalog rows yet — Kiro adds them)

- `node --check test/knowledge-b6-1-conn-stream.test.js` → exit 0.
- Scratch cross-check (TEMP-only, not committed):
  `C:/Users/TumRoyal/AppData/Local/Temp/opencode/crosscheck-b61.cjs` →
  33/33 first blocks parse with correct root + direct-child `<type>`;
  28/28 tag-order + 5/5 prop-order assertions replay clean against the
  references; 8/8 setFields targets paired; 117/117 setFieldPath leaves
  present; 17/17 step-prop splice names present. ALL PASS.
- Full `node --test` NOT run by this agent (catalog rows pending → tests
  are RED by design until Kiro appends the rows above, then runs +
  reviews). No test-pass claim made.

## Limitations (all documented per-reference in Version Evidence)

- `source_reviewed` only everywhere: no `spoon_loaded`, no `runtime_passed`
  (no DB/mail/broker/network run).
- Streaming order follows injector/JAXB metadata, not a handwritten
  getXML; stale in-repo `.ktr` fixtures lack newer props (documented per ID).
- Infobright `AGENT_DEFAULT_PORT`/`DEFAULT_CHARSET` live in the external
  `com.infobright.etl` jar (not in source) — template uses placeholders.
- `MAIL` trans alias collides textually with job `MAIL` (see note above).
