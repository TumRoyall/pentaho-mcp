# B4c source notes — HTTP/FTP (7 IDs: 2 trans + 5 job)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638` (verified
`git rev-parse HEAD` in pentaho-kettle before reading).
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b4c-http-ftp.test.js` (exit 0).
Full test run + review left to Kiro.

**Registration (all seven):** all register in engine XML registries:
trans in `engine/src/main/resources/kettle-steps.xml` (`HTTP` line 42,
`HTTPPOST` line 91, both category Lookup); job in
`engine/src/main/resources/kettle-job-entries.xml` (`FTP_PUT` line 9,
`FTPS_GET` line 10, `FTPS_PUT` line 11, `FTP_DELETE` line 14 — all
FileTransfer; `HTTP` line 19 — FileManagement).

**HTTP string shared across kinds:** trans `HTTP` (`.../trans/steps/http/HTTPMeta`)
and job `HTTP` (`.../job/entries/http/JobEntryHTTP`) are DIFFERENT classes
with different XML — sharing the `"HTTP"` string across kinds is valid
(catalog separates by kind; precedent: `TABLE_EXISTS` in B2a).

**Job wrapper (5 job IDs):** `JobEntryBase.getXML()`
(`engine/.../job/entry/JobEntryBase.java`, lines 415-419) +
`JobEntryCopy.getXML()` (`.../job/entry/JobEntryCopy.java`, lines 102-113).

**Trans wrapper (2 trans IDs):** `StepMeta.getXML()` (lines 206-208) →
`getXML(boolean)` (lines 210-230) in `engine/.../trans/step/StepMeta.java`.

**No-DB note (all seven):** none references a database connection. NO
`<connection>` tag anywhere. Auth/host/port values use `${VAR}`
placeholders in every template — never real secrets.

## 1. trans HTTP — `HTTPMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/http/HTTPMeta.java`
- `allocate(int nrargs, int nrqueryparams)` (lines 282-287): parallel
  argument + header arrays.
- `setDefault()` (lines 304-331): `socketTimeout/connectionTimeout/
  closeIdleConnectionsTime` = `"10000"`/`"10000"`/`"-1"`
  (`DEFAULT_*`, lines 64/67/70), `fieldName = "result"`, others `""`,
  `encoding = "UTF-8"`, 0 args/headers.
- `readData(Node, ...)` (lines 404-447), via `loadXML` (lines 278-280):
  `httpPassword` via `decryptPasswordOptionallyEncrypted` (line 413);
  flags Y/N missing → false; `<result>/*` nested (lines 440-443).
- `getXML()` (lines 361-402): 11 scalars (`url`, `urlInField`, `urlField`,
  `encoding`, `httpLogin`, `httpPassword` via
  `encryptPasswordIfNotUsingVariables` (lines 369-370), `proxyHost`,
  `proxyPort`, 3 timeouts), then `<lookup>` (lines 377/392) with `<arg>`
  items (`name` = query param, `parameter` = row field, lines 380-384)
  then `<header>` items (`name` = header name, `parameter` = STATIC value,
  lines 385-390), then `<result>` (`name`, `code`, `response_time`,
  `response_header`, lines 394-399).
- `getFields(...)` (lines 333-359): body String (when non-empty) + Integer
  code/time + String header — each optional column empty means not added.

Emitted order: 11 scalars, `[<lookup> (<arg>* then <header>*)],
[<result>(name, code, response_time, response_header)]`.

## 2. trans HTTPPOST — `HTTPPOSTMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/httppost/HTTPPOSTMeta.java`
- `allocate(int nrargs)` (lines 324-328, +`argumentHeader[]`) and
  `allocateQuery(int nrqueryparams)` (lines 330-333).
- `setDefault()` (lines 353-382): `fieldName = "result"`,
  `encoding = "UTF-8"` (`DEFAULT_ENCODING`, line 73), `postafile = false`,
  same `"10000"`/`"10000"`/`"-1"` timeouts, 0 args/queries.
- `readData(...)` (lines 456-502), via `loadXML` (lines 320-322):
  per-arg `header` via `YES.equalsIgnoreCase` (missing → false, line 481).
- `getXML()` (lines 410-454): `postafile`, `encoding`, `url`, `urlInField`,
  `urlField`, `requestEntity`, auth/proxy/timeouts (lines 413-426), then
  `<lookup>` (lines 428/444) with `<arg>` items carrying `name`,
  `parameter`, **`header` Y/N** (lines 431-436 — written with
  `addTagValue(tag, bool, false)` where the 3rd arg is "no CR", value still
  Y/N) then `<query>` items with ONLY `name` + `parameter` (lines 437-442),
  then the same 4-tag `<result>` (lines 446-451).
- `getFields(...)` (lines 384-408): same shape as trans HTTP.

Emitted order: scalars, `[<lookup> (<arg>(name, parameter, header))*,
(<query>(name, parameter))*], [<result>]`.

## 3. job HTTP — `JobEntryHTTP`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/http/JobEntryHTTP.java`
- `getXML()` (lines 178-216): `super.getXML()` then `url`,
  `targetfilename`, `file_appended`, `date_time_added`,
  `targetfilename_extension`, `uploadfilename`, `run_every_row`, 3
  fieldnames (`url/upload/dest`), `username`, `password` (encrypted unless
  variable, lines 197-198), `proxy_host`, `proxy_port`, `non_proxy_hosts`,
  `addfilenameresult`, then PAIRED `<headers>` ALWAYS emitted (lines
  204/213) of `<header>` items (`header_name`, `header_value`, 207-210).
- `loadXML()` (lines 219-258): `targetfilename_extension` falls back to the
  typo tag `targetfilename_extention` when missing (lines 227-228);
  **`addfilenameresult` missing → TRUE** (`NVL(..., "Y")`, lines 243-244).
- Init: constructor (lines 150-154) sets only `url = null` and
  `addfilenameresult = true`.
- `evaluates()` = true (lines 707-709).

Emitted order after super: scalars listed above, then `[<headers>
(<header>(header_name, header_value))*]`.

## 4. job FTP_PUT — `JobEntryFTPPUT`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/ftpput/JobEntryFTPPUT.java`
- `getXML()` (lines 137-170): `super.getXML()` then `servername`,
  `serverport`, `username`, `password`, `remoteDirectory`,
  `localDirectory`, `wildcard`, `binary`, `timeout`, `remove`, `only_new`,
  `active`, `control_encoding`, 4 `proxy_*`, 4 `socksproxy_*` (lines
  142-167). No lists.
- `loadXML()` (lines 172-199): flags Y/N missing → false; `timeout` via
  `Const.toInt(..., 10000)` (line 184).
- Init: constructor (lines 118-126): `serverPort = "21"`,
  `socksProxyPort = "1080"`, `controlEncoding = "ISO-8859-1"`
  (`DEFAULT_CONTROL_ENCODING`, line 116).
- `evaluates()` = true (lines 820-822).

Emitted order after super: `[<servername>, <serverport>, <username>,
<password>, <remoteDirectory>, <localDirectory>, <wildcard>, <binary>,
<timeout>, <remove>, <only_new>, <active>, <control_encoding>,
<proxy_host>, <proxy_port>, <proxy_username>, <proxy_password>,
<socksproxy_host>, <socksproxy_port>, <socksproxy_username>,
<socksproxy_password>]`.

## 5. job FTP_DELETE — `JobEntryFTPDelete`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/ftpdelete/JobEntryFTPDelete.java`
- `getXML()` (lines 188-229): `super.getXML()` then `protocol`,
  `servername`, `port`, `username`, `password`, `ftpdirectory`, `wildcard`,
  `timeout`, `active`, `useproxy` + 4 `proxy_*`, `publicpublickey` (doubled
  `public`, line 210), `keyfilename`, `keyfilepass`, `nr_limit_success`,
  `success_condition`, `copyprevious`, `ftps_connection_type` (code via
  `FTPSConnection.getConnectionTypeCode`, lines 217-219), 4
  `socksproxy_*`. No lists.
- `loadXML()` (lines 231-272): `timeout` → 10000 (line 243); connection
  type by code, unknown → 0 (lines 260-262).
- Init: constructor (lines 164-177): `protocol = "FTP"`, `port = "21"`,
  `socksProxyPort = "1080"`, `nr_limit_success = "10"`,
  `success_condition = "success_is_all_files_downloaded"`,
  `FTPSConnectionType = CONNECTION_TYPE_FTP`.
- Enums: `PROTOCOL_FTP/FTPS/SFTP/SSH` (lines 124-130); success
  `success_when_at_least` / `success_if_errors_less` /
  `success_is_all_files_downloaded` (lines 132-136).
- `evaluates()` = true (lines 1140-1142).

Emitted order after super: `[<protocol>, <servername>, <port>,
<username>, <password>, <ftpdirectory>, <wildcard>, <timeout>, <active>,
<useproxy>, <proxy_host>, <proxy_port>, <proxy_username>,
<proxy_password>, <publicpublickey>, <keyfilename>, <keyfilepass>,
<nr_limit_success>, <success_condition>, <copyprevious>,
<ftps_connection_type>, <socksproxy_host>, <socksproxy_port>,
<socksproxy_username>, <socksproxy_password>]`.

## 6. job FTPS_GET — `JobEntryFTPSGet`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/ftpsget/JobEntryFTPSGet.java`
- `getXML()` (lines 161-205): `super.getXML()` then **`port` FIRST**
  (line 165), `servername`, `username`, `password`, `FTPSdirectory`,
  `targetdirectory`, `wildcard`, `binary`, `timeout`, `remove`, `only_new`,
  `active`, `movefiles`, `movetodirectory`, date/time block (`adddate`,
  `addtime`, `SpecifyFormat`, `date_time_format`, `AddDateBeforeExtension`,
  `isaddresult`, `createmovefolder`), 4 `proxy_*`, `ifFileExists` (action
  STRING, line 195), `nr_limit`, `success_condition`, `connection_type`
  (code, lines 199-200). No lists.
- `loadXML()` (lines 207-259): `timeout` → 10000 (line 219);
  **`isaddresult` empty/missing → TRUE** (lines 234-240);
  `success_condition` missing → `success_if_no_errors` (lines 252-253);
  connection by code (lines 254-256).
- Init: constructor (lines 133-150): `port = "21"`, `nr_limit = "10"`,
  `success_condition = "success_if_no_errors"`, `ifFileExists = 0`,
  `isaddresult = true`, `connectionType = CONNECTION_TYPE_FTP`.
- Enums: `FILE_EXISTS_ACTIONS = { ifFileExistsSkip, ifFileExistsCreateUniq,
  ifFileExistsFail }` (lines 108-112; unknown → 0, lines 705-711); success
  `success_when_at_least` / `success_if_errors_less` /
  `success_if_no_errors` (lines 116-118).
- `evaluates()` = true (lines 1065-1067).

Emitted order after super: `[<port>, <servername>, <username>,
<password>, <FTPSdirectory>, <targetdirectory>, <wildcard>, <binary>,
<timeout>, <remove>, <only_new>, <active>, <movefiles>, <movetodirectory>,
<adddate>, <addtime>, <SpecifyFormat>, <date_time_format>,
<AddDateBeforeExtension>, <isaddresult>, <createmovefolder>, <proxy_host>,
<proxy_port>, <proxy_username>, <proxy_password>, <ifFileExists>,
<nr_limit>, <success_condition>, <connection_type>]`.

## 7. job FTPS_PUT — `JobEntryFTPSPUT`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/ftpsput/JobEntryFTPSPUT.java`
- `getXML()` (lines 110-137): `super.getXML()` then `servername` FIRST,
  `serverport`, `username`, `password`, `remoteDirectory`,
  `localDirectory`, `wildcard`, `binary`, `timeout`, `remove`, `only_new`,
  `active`, 4 `proxy_*` (**`proxy_password` stored PLAIN — no `Encr`
  call, line 132**, unlike FTP_PUT line 160-161), `connection_type`
  (code, lines 133-134). No lists, no date block, no success condition.
- `loadXML()` (lines 139-166): `timeout` → 10000 (line 151); connection by
  code (lines 160-162).
- Init: constructor (lines 92-99): `serverPort = "21"`,
  `connectionType = CONNECTION_TYPE_FTP`.
- `evaluates()` = true (lines 612-614).

Emitted order after super: `[<servername>, <serverport>, <username>,
<password>, <remoteDirectory>, <localDirectory>, <wildcard>, <binary>,
<timeout>, <remove>, <only_new>, <active>, <proxy_host>, <proxy_port>,
<proxy_username>, <proxy_password>, <connection_type>]`.

## Shared: FTPS connection-type codes

`.../ftpsget/FTPSConnection.java`, `connection_type_Code` (lines 79-82):
`FTP_CONNECTION`, `IMPLICIT_SSL_FTP_CONNECTION`,
`AUTH_SSL_FTP_CONNECTION`, `IMPLICIT_SSL_WITH_CRYPTED_DATA_FTP_CONNECTION`,
`AUTH_TLS_FTP_CONNECTION`, `IMPLICIT_TLS_FTP_CONNECTION`,
`IMPLICIT_TLS_WITH_CRYPTED_DATA_FTP_CONNECTION`. Unknown/missing → 0 =
`FTP_CONNECTION` (`getConnectionTypeByCode`, lines 269-280). Used by
FTP_DELETE (`ftps_connection_type`), FTPS_GET and FTPS_PUT
(`connection_type`).

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: HTTP, xml_type: HTTP, file: trans/HTTP.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: HTTPPOST, xml_type: HTTPPOST, file: trans/HTTPPOST.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: HTTP, xml_type: HTTP, file: job/HTTP.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FTP_PUT, xml_type: FTP_PUT, file: job/FTP_PUT.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FTP_DELETE, xml_type: FTP_DELETE, file: job/FTP_DELETE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FTPS_GET, xml_type: FTPS_GET, file: job/FTPS_GET.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FTPS_PUT, xml_type: FTPS_PUT, file: job/FTPS_PUT.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
