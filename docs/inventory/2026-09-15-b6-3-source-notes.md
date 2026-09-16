# B6-3 source notes — input/misc/external/utility/job (34 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Wrapper (all trans):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): the wrapper
emits `<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the
plugin fragment via `stepMetaInterface.getXML()` (lines 228-230). So each
plugin `getXML()` returns only its own config tags — no `<name>`/`<type>`.

**Wrapper (all 4 job):** `engine/.../job/entry/JobEntryCopy.java:102-119`
`getXML()`: `<entry>` = `entry.getXML()` + `parallel,draw,nr,xloc,yloc`
(Y/N for parallel/draw). Load `JobEntryCopy:135-162` dispatches on `<type>`
via `PluginRegistry` (missing → `MissingEntry`); `parallel/draw` =
`"Y".equalsIgnoreCase`, `nr/xloc/yloc` = `Const.toInt(...,0)`.
`engine/.../job/entry/JobEntryBase.java:415-424` `getXML()`:
`name,description,type(+attributes)`; `loadXML:440-452` reads only
`name,description`.

**DB-connection note:** only `MondrianInput` (`<connection>`) and
`TableCompare` (`<reference_connection>`, `<compare_connection>`) reference
DB connections by name. Their test fixtures MUST declare
`<connection><name>${CONN}</name></connection>` (MondrianInput) and both
`${REF_CONN}`/`${CMP_CONN}` (TableCompare) or the validator reports
"undefined connection" (B2a pitfall). All other 32 IDs carry NO
`<connection>` tag — templates must not add one. All credentials/hosts use
`${VAR}` placeholders, never real values.

---

## Batch 1 — input connectors (7)

### 1. trans XBaseInput — `XBaseInputMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/xbaseinput/XBaseInputMeta.java`
  (L66, `extends BaseStepMeta`).
- Registry: NO `@Step`. Legacy `engine/src/main/resources/kettle-steps.xml:55`:
  `<step id="XBaseInput">...XBaseInputMeta...`.
- `getXML()` (L362-383, all unconditional `XMLHandler.addTagValue`; booleans
  Y/N, int as number): `[file_dbf(string), limit(int), add_rownr(Y/N),
  field_rownr, include(Y/N), include_field, charset_name,
  accept_filenames(Y/N), accept_field, accept_stepname]`. L376-380: null
  `acceptingStepName` backfilled from object before emit.
- `loadXML` (L249-252) → `readData` (L260-279): strings `getTagValue` (null
  if missing); `limit=Const.toInt(...,0)`; 3 booleans
  `"Y".equalsIgnoreCase(...)` (missing/empty→false). try/catch →
  `KettleXMLException`. No backward-compat aliases.
- `setDefault` (L282-287): `dbfFileName=null, rowLimit=0, rowNrAdded=false,
  rowNrField=null`. Does NOT reset include/accept/charset fields (stale risk).
- PITFALLS: `charset_name` can go stale on reuse; `accept_stepname` needs
  `searchInfoAndTargetSteps` (L297-299) to re-resolve `acceptingStep`.
- Connection: NO. File DBF + optional accepting step.
- Semantics: `getFields` L349-359 throws if `fileList.nrOfFiles()==0`;
  appends `getOutputFields` (L333-344: DBF schema + Integer rowNr + String(100)
  filename). `check` L434-491 errors if `dbfFileName==null` without dynamic
  accept.

### 2. trans SASInput — `SasInputMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/sasinput/SasInputMeta.java` (L58).
- Registry: NO `@Step`. `kettle-steps.xml:126`: `<step id="SASInput">...
  SasInputMeta...`.
- `getXML` (L122-133): `[accept_field(string)]` + N×`<field>` DIRECTLY under
  step (const `XML_TAG_FIELD="field"` L61) — NO `<fields>` wrapper.
  Per-field order from `SasInputField.getXML` (`SasInputField.java:87-101`):
  `[name, rename, type(name string), length(int), precision(int),
  conversion_mask, decimal, grouping, trim_type(code)]`.
- `loadXML` (L77-90): `accept_field=getTagValue` (null); `nrFields=
  countNodes(stepnode,"field")`; per field `new SasInputField(fieldNode)`
  (`SasInputField.java:129-139`): `length/precision=Const.toInt(...,-1)`;
  `type=getIdForValueMeta`; `trimType=getTrimTypeByCode` (null→none/0).
- `setDefault` (L73-75): `outputFields=new ArrayList<>()` (empty non-null).
- PITFALLS: no `<fields>` wrapper — `setFields()` (requires a list block)
  does NOT apply; insert bare `<field>` blocks in fixed child order.
  `<type>` is a NAME string, never a numeric id.
- Connection: NO. Filename comes from incoming-row field `accept_field`.
- Semantics: `getFields` L102-120 appends one ValueMeta per outputField
  (origin=name). `check` L162-174 errors only if `acceptingField` empty.

### 3. trans S3CSVINPUT — `S3CsvInputMeta`
- Class: `plugins/s3csvinput/core/src/main/java/org/pentaho/di/trans/steps/s3csvinput/S3CsvInputMeta.java` (L86).
- Registry: `@Step(id="S3CSVINPUT",...)` L82-84.
- `getXML` (L201-240, unconditional): `[aws_access_key(encrypted via
  Encr.encryptPasswordIfNotUsingVariables L204-205), aws_secret_key
  (encrypted), bucket, filename, filename_field, rownum_field,
  include_filename(Y/N), separator, enclosure, header(Y/N),
  max_line_size(string "5000"), lazy_conversion(Y/N), parallel(Y/N),
  fields/N×field/[name, type(name), format, currency, decimal, group,
  length(int), precision(int), trim_type(code)]]`. `<fields>` ALWAYS emitted
  even if empty (L220,237).
- `loadXML` (L136-139) → `readData` (L156-194): keys via
  `Encr.decryptPasswordOptionallyEncrypted` (L158-159, null-safe);
  `includingFilename/header/lazyConversion/runningInParallel` =
  `"Y".equalsIgnoreCase` (missing→false); `length/precision=Const.toInt(
  ...,-1)` (L187-188); `trimType=getTrimTypeByCode`.
- PITFALL: missing `<fields>` → `countNodes(null,..)` may NPE → wrapped as
  `KettleXMLException` (L191-193). Template keeps `<fields>` paired.
- `setDefault` (L148-154): `delimiter=",", enclosure="\"", headerPresent=
  true, lazyConversionActive=true, maxLineSize="5000"`; keys/bucket/filename
  null; `includingFilename/runningInParallel=false`; `allocate(0)`.
- Connection: NO `<connection>`. AWS creds are password fields.
- Semantics: `getFields` L323-375 `rowMeta.clear()` (eats input); per-field
  ValueMeta (+binary-string storage if lazy); String filenameField only if
  non-empty AND includingFilename; Integer(10) rowNumField if non-empty.
  `check` L384-411 only validates wiring.

### 4. trans RssInput — `RssInputMeta`
- Class: `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssinput/RssInputMeta.java` (L61).
- Registry: `@Step(id="RssInput",...)` L55-60.
- `getXML` (L263-286): `[url_in_field(Y/N), url_field_name, rownum(Y/N),
  rownum_field, include_url(Y/N), url_Field(sic capital F!), read_from,
  urls/N×url, fields/N×field, limit(long)]`.
- Per-field order (`RssInputField.java:105-124 getXML`; each item carries its
  own `<field>` wrapper): `[name, column(code), type(name), format, currency,
  decimal, group, length(int), precision(int), trim_type(code), repeat(Y/N)]`.
- `loadXML` (L242-244) → `readData` (L288-319): 3 booleans
  `"Y".equalsIgnoreCase`; `rowLimit=Const.toLong(...,0L)` (L315);
  `allocate(nrUrls,nrFields)`; fields via `new RssInputField(fnode)`
  (`RssInputField.java:126-139`): `length/precision=Const.toInt(...,-1)`,
  `column=getColumnByCode` (unknown→0=title), `trim=getTrimTypeByCode`.
- PITFALL (`repeat` inverted-N): `!"N".equalsIgnoreCase(getTagValue(
  "repeat"))` → missing/empty repeat = **true** (opposite of every other
  boolean). Always emit `<repeat>` explicitly.
- PITFALL (`url_Field` case): output-URL tag is `url_Field` (capital F),
  distinct from `url_field_name`. Wrong case silently drops config.
- `setDefault` (L326-350): all flags false, strings `""`, `allocate(0,0)`,
  `rowLimit=0`.
- Connection: NO.
- Semantics: `getFields` L352-387 (per-field TYPE_NONE→STRING, +String(100)
  urlField if includeUrl, +Integer rowNumberField if includeRowNumber).
  `check` L479-510: urlInField→require urlFieldname else require url.length>0.

### 5. trans RssOutput — `RssOutputMeta`
- Class: `plugins/rss/impl/src/main/java/org/pentaho/di/trans/steps/rssoutput/RssOutputMeta.java` (L68).
- Registry: `@Step(id="RssOutput",...)` L61-66.
- `getXML` (L757-830): 25 flat tags `[displayitem, customrss,
  channel_title, channel_description, channel_link, channel_pubdate,
  channel_copyright, channel_image_title, channel_image_link,
  channel_image_url, channel_image_description, channel_language,
  channel_author, version, encoding, addimage, item_title, item_description,
  item_link, item_pubdate, item_author, addgeorss, usegeorssgml, geopointlat,
  geopointlong]` (booleans Y/N), then `<file>/[filename_field, name,
  extention(sic one s), split, haspartno, add_date, add_time,
  is_filename_in_field, create_parent_folder]` + `addtoresult`
  (lowercase-t INSIDE `<file>`, L802), then `<fields>/N×
  <channel_custom_fields>/[tag,field]` + N×`<Item_custom_fields>` (sic
  capital I)/[tag,field], then `<namespaces>/N×<namespace>/
  [namespace_tag,namespace_value]`.
- `loadXML` (L156-158) → `readData` (L620-701): booleans
  `"Y".equalsIgnoreCase`; file group via 3-arg `getTagValue(stepnode,
  "file",...)` (L655-667).
- PITFALLS (case mismatches, tag lookup case-sensitive): emit `addtoresult`
  vs read `AddToResult` (capital A) — round-trip may lose the flag; emit
  `Item_custom_fields` vs read `item_custom_fields` (lowercase i) — written
  items may not be re-read. Template keeps EMIT case; reference documents both.
- `setDefault` (L703-755): `displayitem=true, customrss=false,
  version="rss_2.0", encoding="iso-8859-1", createparentfolder=false,
  isfilenameinfield=false`; 3 arrays `allocate(0)`.
- Connection: NO.
- Semantics: no `getFields` override (pass-through). `check` L972-1005
  errors if no/empty input.

### 6. trans MondrianInput — `MondrianInputMeta`
- Class: `plugins/mondrianinput/impl/src/main/java/org/pentaho/di/trans/steps/mondrianinput/MondrianInputMeta.java` (L70).
- Registry: `@Step(id="MondrianInput",...)` L64-69.
- `getXML` (L193-204): `[connection(db name or "" if null), sql, catalog,
  role, variables_active(Y/N)]` — all unconditional.
- `loadXML` (L127-129) → `readData` (L136-146): `databaseMeta=
  DatabaseMeta.findDatabase(databases, getTagValue("connection"))` (unknown
  name→null, no throw); `sql/catalog/role=getTagValue` (null if missing).
- PITFALL (strict equals): `variableReplacementActive="Y".equals(
  getTagValue("variables_active"))` — case-SENSITIVE, NOT equalsIgnoreCase:
  lowercase `y`→false, unlike most steps.
- `setDefault` (L148-157): `databaseMeta=null`, `sql=<Sample Sales MDX>`,
  `variableReplacementActive=false`; catalog/role untouched (null).
- Connection: YES — `<connection>` by reference (`findDatabase` on load;
  `getUsedDatabaseConnections` L269-275; rep uses `id_connection` L208/221).
  Fixture MUST declare `${CONN}`.
- Semantics: `getFields` L159-191 returns silently if `databaseMeta==null`;
  else `MondrianHelper` cached/openQuery rectangular output with origin set.
  `check` L236-252 errors without connection.

### 7. trans OlapInput — `OlapInputMeta`
- Class: `engine/src/main/java/org/pentaho/di/trans/steps/olapinput/OlapInputMeta.java` (L59).
- Registry: NO `@Step`. `kettle-steps.xml:57`: `<step id="OlapInput">...
  OlapInputMeta...`.
- `getXML` (L160-172): `[url, username, password(encrypted via
  Encr.encryptPasswordIfNotUsingVariables L165-166), mdx, catalog,
  variables_active(Y/N)]`. NOTE emit order is mdx-then-catalog while read
  order differs (catalog before mdx).
- `loadXML` (L90-92) → `readData` (L100-112): `password=
  Encr.decryptPasswordOptionallyEncrypted(...)`; `variableReplacementActive=
  "Y".equals(...)` — strict equals (same pitfall as MondrianInput). Driver
  is hardcoded const `olap4jDriver="org.olap4j.driver.xmla.XmlaOlap4jDriver"`
  (L64) — NEVER serialized; do not invent a driver tag.
- `setDefault` (L115-133): `url="http://localhost:8080/pentaho/Xmla"`,
  `username="joe"`, `password="password"`, `catalog="SampleData"`,
  `mdx=<Quadrant Analysis MDX>`, `variableReplacementActive=false`.
- Connection: NO `<connection>`. Connection = url/username/password/catalog
  strings + fixed driver.
- Semantics: `getFields` L136-157 runs a live query via `initData(space)`
  (L305-339: env-substitute url/user/pass/catalog, mdx only if flag on).
  `createRowMeta` L235-252 names columns from header or `Column+i`, all
  String. `check` L206-214 is a TODO no-op.

---

## Batch 2 — inline/socket/misc (7)

Registry (all legacy, no `@Step`; `engine/src/main/resources/kettle-steps.xml`):
L5 `SocketReader`, L6 `SocketWriter`, L12 `GetSlaveSequence`, L15 `Injector`,
L66 `StepMetastructure`, L117 `PrioritizeStreams`, L119 `GetRepositoryNames`.

### 8. trans Injector — `InjectorMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/injector/InjectorMeta.java`, 274 L)
- `getXML` L151-166: `<fields>` wrapper, repeat `<field>` × N, per-item
  `[name(str), type(str ValueMetaName via ValueMetaFactory.getValueMetaName),
  length(int), precision(int)]`. Unconditional.
- `loadXML` L135-137 → `readData` L168-182: `fieldname=null` if `<name>`
  missing; `type=getIdForValueMeta(...)`; `length/precision=Const.toInt(
  tag,-2)` (missing/empty/non-numeric → `-2`, NOT -1). Missing `<fields>` →
  `countNodes(null)`→0 → `allocate(0)`, no crash.
- `setDefault` L184-186: `allocate(0)` (empty).
- Connection: NO.
- Semantics: `getFields` L222-233 appends
  `createValueMeta(fieldname[i],type[i],length[i],precision[i])` per i.
  `check` L242-257 ERRORs if `input.length>0` (expects NO input).

### 9. trans SocketReader — `SocketReaderMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/socketreader/SocketReaderMeta.java`, 208 L)
- `getXML` L75-84: `[hostname(str), port(str), buffer_size(str),
  compressed(bool Y/N via addTagValue(boolean))]`.
- `readData` L86-91: strings `getTagValue` (missing→null);
  `compressed="Y".equalsIgnoreCase(tag)` (missing/`"true"`/`"N"`→false —
  PITFALL: legacy `true` text loads as false).
- `setDefault` L93-96: `bufferSize="3000", compressed=true`;
  hostname/port null.
- Connection: NO.
- Semantics: `getFields` L112-115 no-op. `check` L117-145 ERRORs if
  `input.length==0` (requires input).

### 10. trans SocketWriter — `SocketWriterMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/socketwriter/SocketWriterMeta.java`, 203 L)
- `getXML` L75-84: `[port(str), buffer_size(str), flush_interval(str),
  compressed(bool Y/N)]`. NOTE: `flush_interval` INSTEAD of `hostname` —
  do not copy the Reader template.
- `readData` L86-91: same Y-parse as Reader (missing→false).
- `setDefault` L93-97: `bufferSize="2000", flushInterval="5000",
  compressed=true`; port null.
- Connection: NO.
- Semantics: `getFields` L113-116 no-op. `check` L118-146 requires input.

### 11. trans PrioritizeStreams — `PrioritizeStreamsMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/prioritizestreams/PrioritizeStreamsMeta.java`, 217 L)
- `getXML` L120-132: `<steps>` wrapper, repeat `<step>` → single child
  `<name>(str)`. Template order: `steps/step/name`.
- `loadXML` L66-68 → `readData` L104-118: `getSubNode("steps")` →
  `countNodes(...,"step")` → `getSubNodeByNr` → `getTagValue(fnode,"name")`.
  PITFALL: missing `<steps>` → getSubNode null; wrapped in try→
  `KettleXMLException` (weak backward-compat — always keep `<steps>` paired).
- `setDefault` L134-142: `allocate(0)`.
- Connection: NO.
- Semantics: `getFields` L99-102 no-op. `check` L169-206 WARNING if `prev`
  empty or `stepName.length==0`; ERROR if no input. Each `<name>` is a STEP
  REFERENCE — needs a real hop.
- Test note: `setFields(..., 'steps', 'step', ...)` is safe (search is scoped
  inside `<steps>`, so itemTag `step` never matches the root `<step>`).

### 12. trans GetSlaveSequence — `GetSlaveSequenceMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/getslavesequence/GetSlaveSequenceMeta.java`, 232 L)
- `getXML` L105-114: `[valuename(str), slave(str slave-server NAME),
  seqname(str), increment(str — NOT int)]`.
- `readData` L76-86: 4× `getTagValue`, no defaults (missing→null); try→
  KettleXMLException.
- `setDefault` L89-94: `valuename="id", slaveServerName="slave server name",
  sequenceName="Slave Sequence Name -- To be configured", increment="10000"`.
- Connection: NO `<connection>` — `<slave>` is a slave-server NAME string.
- Semantics: `getFields` L97-102 adds `ValueMetaInteger(valuename)`.
  `check` L143-159 only checks input presence.

### 13. trans GetRepositoryNames — `GetRepositoryNamesMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/getrepositorynames/GetRepositoryNamesMeta.java`, 420 L)
- `getXML` L205-223: `[object_type(str enum name), rownum(bool Y/N),
  rownum_field(str), <file> wrapper (SINGULAR "file", NOT "files") + per-i
  flat quadruple: directory, name_mask, exclude_name_mask,
  include_subfolders(Y/N)]`. NO item wrapper — 4 flat repeating tags in one
  `<file>`; use `setFieldPath` (`file/directory`, ...), NOT `set_fields`.
- `loadXML` L225-255: `object_type` null→keep ctor default; unknown string →
  `valueOf` throws `IllegalArgumentException` → wrapped `KettleXMLException`
  (compat PITFALL — only `All`/`Transformation`/`Job` exact case);
  `rownum` Y-parse (missing→false); `rownum_field` null if missing. List:
  `getSubNode("file")` + `countNodes(filenode,"directory")` +
  `getSubNodeByNr(...,"directory"|"name_mask"|"exclude_name_mask"|
  "include_subfolders",i)` — count follows `directory`; unbalanced children
  misalign/null, so always keep the full set of 4.
- `setDefault` L115-129: `All, includeRowNumber=true, rowNumberField="rownr"`,
  one row `("/",".*","",true)`. ctor L80-84: `objectTypeSelection=All`.
- Connection: NO.
- Semantics: `getFields` L131-203 fixed 8 columns (object, directory, name,
  object_type, object_id, modified_by String 500, modified_date Date,
  description String 500) + optional Integer rownr. `check` L304-319 ERRORs
  if input present (source step, no input).

### 14. trans StepMetastructure — `StepMetastructureMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/stepmeta/StepMetastructureMeta.java`, 215 L)
- `getXML` L78-86: `[outputRowcount(bool Y/N), rowcountField(str)]`. NOTE: 7
  display-name fields do NOT serialize — do not invent them.
- `readData` L88-95: `outputRowcount` Y-parse (missing→false);
  `rowcountField=getTagValue` (missing→null).
- `setDefault` L188-197: only sets 7 i18n names; `outputRowcount/rowcountField`
  keep Java defaults (false/null) — PITFALL: a new component has NO rowcount.
- Connection: NO.
- Semantics: `getFields` L142-185 (KEY): `r.clear()` + `this.setDefault()` on
  EVERY call (resets names), then 7 columns (position:Integer, fieldName/
  comments/type/length/precision/origin + length/precision Integer) +
  optional Integer rowcountField if outputRowcount. `check` L131-139 always OK.

---

## Batch 3 — external services/output (7)

### 15. trans SSH — `SSHMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/ssh/SSHMeta.java`, L64,
`extends BaseStepMeta`, no `@Step`; registry `kettle-steps.xml:113`)
- `getXML` L377-402 (all unconditional): `[dynamicCommandField(Y/N),
  command, commandfieldname, port(string!), servername(lowercase),
  userName(camel), password(encrypted Encr.encryptPasswordIfNotUsingVariables
  L387-388), usePrivateKey(Y/N), keyFileName, passPhrase(encrypted),
  stdOutFieldName, stdErrFieldName, timeOut, proxyHost, proxyPort,
  proxyUsername, proxyPassword(encrypted L399-400)]`.
- `loadXML` L95-98 → `readData` L404-430: bools `"Y".equalsIgnoreCase`
  (missing→false, L406,414); strings `getTagValue` (missing→null); passwords
  `Encr.decryptPasswordOptionallyEncrypted` (null/`${VAR}`-safe). No int
  parsing. Catch-all→`KettleXMLException` L427-429.
- `setDefault` L108-125: `dynamicCommandField=false, command/commandfieldname=
  null, port="22"` (`String.valueOf(DEFAULT_PORT)`, `DEFAULT_PORT=22` L66),
  `serverName/userName/password=null, usePrivateKey=true(!), keyFileName=null,
  stdOutFieldName="stdOut", stdErrFieldName="stdErr", timeOut="0", proxy*=null`
  (`passPhrase` unset→null).
- PITFALLS: `servername` vs `userName` case pair — wrong case silently drops
  config. `usePrivateKey` new-default true vs load-missing false — always emit
  explicitly. stderr column is **Boolean**, not String.
- Connection: NO `<connection>`. Host/port/user/pass are strings + variables.
- Semantics: `getFields` L554-572 — static command → `row.clear()` (eats
  input); appends stdOut `ValueMetaString` (env-substituted name) + stdErr
  `ValueMetaBoolean` if non-empty (L566-571). `check` L494-552 requires
  non-empty serverName; usePrivateKey → non-empty keyFileName + KettleVFS
  exists; requires `input.length>0`.

### 16. trans SFTPPut — `SFTPPutMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/sftpput/SFTPPutMeta.java`
L59, no `@Step`; registry `kettle-steps.xml:128`)
- `getXML` L161-196 (unconditional): `[servername, serverport, username,
  password(enc L167-168), sourceFileFieldName, remoteDirectoryFieldName,
  inputIsStream(Y/N), addFilenameResut(typo! Y/N), usekeyfilename(Y/N),
  keyfilename, keyfilepass(enc L176-177), compression, proxyType, proxyHost,
  proxyPort, proxyUsername, proxyPassword(enc L183-184),
  createRemoteFolder(Y/N), aftersftpput(code string via
  JobEntrySFTPPUT.getAfterSFTPPutCode L186-187), destinationfolderFieldName,
  createdestinationfolder(lowercase d Y/N), remoteFilenameFieldName]`.
- `readData` L100-138 (via `loadXML` L91-93): bools Y-check (missing→false);
  passes decryptPasswordOptionallyEncrypted; `aftersftpput=Const.NVL(...)→
  getAfterSFTPPutByCode` L126-127; backward-compat legacy `<remove>Y`
  upgrades NOTHING→DELETE L125,128-130 (repeated in `readRep` L223-228).
  `createdestinationfolder` must be lowercase (L132-133). Catch-all→
  KettleXMLException L135-137.
- `setDefault` L140-159: `serverPort="22", inputIsStream/addFilenameResut/
  usekeyfilename=false, compression="none"`, proxy null,
  `createRemoteFolder=false, afterFTPS=AFTER_FTPSPUT_NOTHING,
  createDestinationFolder=false`; user/pass/source/remote null.
- PITFALLS: keep typos `addFilenameResut` (missing l) and lowercase
  `createdestinationfolder` — "fixing" them breaks load. Legacy `<remove>Y`
  still deletes the source after upload. Do not confuse with job `SFTPPUT`
  (different kind/XML).
- Connection: NO.
- Semantics: `getFields` L273-276 no-op. `check` L278-306 warns on empty prev
  + errors on `input.length==0`; no server validation.

### 17. trans HL7Input — `HL7InputMeta`
(`plugins/hl7/core/src/main/java/org/pentaho/di/trans/steps/hl7input/HL7InputMeta.java`
L51; `@Step(id="HL7Input",...)` L47-50)
- `getXML` L71-74: `[message_field]` ONLY (string, unconditional).
- `readData` L76-78 (via `loadXML` L60-63): `messageField=getTagValue(
  stepnode,"message_field")` (missing→null); no bool/int, no try/catch.
  `readRep` L84-88 / `saveRep` L90-94 same key.
- `setDefault` L80-82: empty — `messageField` stays null.
- Connection: NO.
- Semantics: `getFields` L96-139 appends 10 fixed `ValueMetaString` (no clear:
  ParentGroup, Group, HL7Version, StructureName, StructureNumber, FieldName,
  Coordinates, HL7DataType, FieldDescription, Value). `check` L141-170 warns
  on empty prev, errors on `input.length==0`.

### 18. trans ShapeFileReader — `ShapeFileReaderMeta`
(`plugins/shapefilereader/core/src/main/java/org/pentaho/di/shapefilereader/ShapeFileReaderMeta.java`
L68, package `org.pentaho.di.shapefilereader`; `@Step(id="ShapeFileReader",...)`
L61-67)
- `getXML` L248-256: `[shapefilename, dbffilename, encoding]` — all lowercase,
  strings, unconditional (L251-253).
- `readData` L142-150 (via old-signature `loadXML` L131-134): 3×`getTagValue`
  (missing→null); try→KettleXMLException L147-149.
- `setDefault` L152-156: `"",""," "` (empty-strings, NOT null).
- Connection: NO.
- Semantics: `getFields` L158-246 (old signature) adds 10 fixed columns
  (filename String255, filetype String50, shapenr/partnr/nrparts/pointnr/
  nrpointS int — keep capital S L193, x/y/measure number) then opens the DBF
  via `XBase` (L222-242; applies `encoding` if `StringUtils.isNotBlank`
  L228-230; strips `file:` prefix L217-219); `dbFilename==null`→
  `KettleStepException` ("no filename specfied"[sic] L244). `check` L280-301
  errors if `input.length>0` (no input), errors if shape/dbf null/empty.
- PITFALLS: all-lowercase tags (camelCase is a wrong tag). Source step, no
  input. Needs the MATCHED .shp+.dbf pair.

### 19. trans PentahoReportingOutput — `PentahoReportingOutputMeta`
(`plugins/pentaho-reporting/impl/src/main/java/org/pentaho/di/trans/steps/pentahoreporting/PentahoReportingOutputMeta.java`
L68; `@Step(id="PentahoReportingOutput",...)` L61-66; tag consts L110-121)
- `getXML` L195-220: `[input_file_field, output_file_field,
  create_parent_folder(Y/N Boolean object!), input_file, output_file,
  use_values_from_fields(Y/N), parameters(N×parameter/[name,field], openTag
  L204 + closeTag L215 ALWAYS emitted even when empty, sorted by name
  L205-207, addTagValue(...,false) no CDATA L210-213), processor_type(code:
  PDF/PagedHtml/StreamingHtml/CSV/Excel/Excel 2007/RTF from enum L71-108 via
  getCode() L217)]`.
- `readData` L161-187 (via `loadXML` L151-153): strings null if missing;
  `use_values_from_fields` L167-168 `"Y".equals(val)||val==null` →
  **missing/null defaults TRUE** (backward-compat, case-sensitive `equals`,
  NOT IgnoreCase!); `create_parent_folder` `"Y".equals`→missing=false (L169);
  params `getSubNode(parameters)→getNodes(parameter)` L171-172, skips empty
  pairs L176; `outputProcessorType=getProcessorTypeByCode(...)`→null if
  missing/unknown (L181-182).
- `setDefault` L189-193: `outputProcessorType=PDF, createParentFolder=false,
  useValuesFromFields=true` (`parameterFieldMap` new in ctor L146-149, NOT
  reset in setDefault).
- PITFALL (NPE): L217 `outputProcessorType.getCode()` NPEs if a tag-missing
  load left it null and setDefault never ran — template ALWAYS emits
  `<processor_type>`.
- Connection: NO.
- Semantics: no `getFields` override (pass-through). `check` L274-293
  OK/Comment only, never errors.

### 20. trans CubeInput — `CubeInputMeta`
(`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeinput/CubeInputMeta.java`
L69; `@Step(id="CubeInput",...)` L66-68)
- `getXML` L198-208: literal `<file>` wrapper (L201,203) + `[name(filename
  string — NOT filename tag), limit(rowLimit STRING! L202,204-205),
  addfilenameresult(bool Y/N)]`.
- `readData` L144-154 (via `loadXML` L80-83): `filename=getTagValue(stepnode,
  "file","name")` (nested, missing→null); `rowLimit=getTagValue(stepnode,
  "limit")` (missing→null, kept String for `${VAR}`, NO int parse);
  `addfilenameresult="Y".equalsIgnoreCase` (missing→false, L148).
- `setDefault` L156-160: `filename="file", rowLimit="0",
  addfilenameresult=false`.
- PITFALL: child is `<name>`, not `<filename>`; `<limit>` is a STRING
  (variables allowed). Do not confuse with CubeOutput's different `<file>`
  children.
- Connection: NO.
- Semantics: `getFields` L162-196 OPENS THE REAL .cube gzip file
  (`KettleVFS.getInputStream(environmentSubstitute(filename))` L168, `new
  RowMeta(dis)` L172, `mergeRowMeta` L176) — missing file→
  `KettleStepException`, so NO runtime test here. `check` L241-250 comment
  only. `readRep` L210-226 PDI-12897 backward-compat: tries
  `getStepAttributeString(limit)` then falls back to
  `getStepAttributeInteger` L214-219.

### 21. trans CubeOutput — `CubeOutputMeta`
(`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/cubeoutput/CubeOutputMeta.java`
L62; `@Step(id="CubeOutput",...)` L59-61)
- `getXML` L151-162: one `<file>` wrapper (L154,159) with `[name,
  add_to_result_filenames(Y/N), do_not_open_newfile_init(Y/N)]` (L155-157),
  unconditional.
- `readData` L131-143 (via `loadXML` L76-78): all 3 nested under `"file"`:
  `getTagValue(stepnode,"file","name")` (missing→null, L133); 2 bools
  `"Y".equalsIgnoreCase` (missing→false, L134-137).
- `setDefault` L145-149: `filename="file.cube",
  addToResultFilenames=false, doNotOpenNewFileInit=false`.
- PITFALL: different `<file>` children from CubeInput (`limit`/
  `addfilenameresult` vs `add_to_result_filenames`/
  `do_not_open_newfile_init`) — copying across breaks config silently.
- Connection: NO.
- Semantics: no `getFields` override (pass-through). `check` L188-205 OK if
  `prev>0` + comment, never errors.

---

## Batch 4 — utility trans/misc (7)

### 22. trans AutoDoc — `AutoDocMeta`
(`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/autodoc/AutoDocMeta.java`;
`@Step(id="AutoDoc",...)` L60-62)
- `getXML` L154-175: `[filename_field, file_type_field, target_file,
  output_type(outputType.name() enum KettleReportBuilder.OutputType — NPE if
  outputType==null), include_name, include_description,
  include_extended_description, include_creation, include_modification,
  include_image, include_logging_config, include_last_exec_result,
  include_image_area_list]` — 3 strings (null→empty tag) + 10 booleans Y/N,
  all unconditional.
- `loadXML` L96-98 → `readData` L121-148: strings `getTagValue` (missing→
  null); booleans `"Y".equalsIgnoreCase` (missing→false); `output_type`:
  `OutputType.valueOf(getTagValue)` in try/catch → ANY exception
  (null/bad name) falls back to `PDF` L140-144.
- `setDefault` L107-119: `outputType=PDF; targetFilename=
  "${Internal.Entry.Current.Directory}/kettle-autodoc.pdf";
  includingName/Description/ExtendedDescription/Created/Modified/Image/
  LoggingConfiguration=true; includingLastExecutionResult=true` then
  **overwritten `=false` L118** → final FALSE (template keeps N).
  `filenameField/fileTypeField` null; `includingImageAreaList` false.
- Connection: NO.
- Semantics: `getFields` L225-290 two modes — METADATA keeps input +
  appends meta(Serializable) + conditional columns; else `rowMeta.clear()` +
  1 `filename:String`. `check` L293-321 requires NO input (`input.length>0`=
  ERROR).

### 23. trans ClosureGenerator — `ClosureGeneratorMeta`
(`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/closure/ClosureGeneratorMeta.java`;
`@Step(id="ClosureGenerator",...)` L58-60)
- `getXML` L129-138: `[parent_id_field, child_id_field, distance_field,
  is_root_zero]` — 3 strings + 1 boolean Y/N, always emitted.
- `loadXML` L73-75 → `readData` L83-92: strings null if missing;
  `rootIdZero="Y".equalsIgnoreCase` (missing→false). No int parsing.
- `setDefault` L95-96: no-op; ctor L68-70 only `super()` — all null/false.
  A new component has NO field names (template is a must-fill frame).
- Connection: NO.
- Semantics: `getFields` L99-126 `row.clear()` + rebuild (parentId/childId
  reuse input ValueMeta if `searchValueMeta` finds them, else skipped;
  distance Integer DEFAULT_INTEGER_LENGTH ALWAYS added even with null name).
  **INVERTED check logic** L167-199: `searchValueMeta(...)!=null` reports
  ERROR "could not be found" — do not trust this message as proof of a
  missing field.

### 24. trans CreditCardValidator — `CreditCardValidatorMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/creditcardvalidator/CreditCardValidatorMeta.java`;
registry `kettle-steps.xml:73`, no `@Step`)
- `getXML` L184-194: `[fieldname, resultfieldname, cardtype,
  onlydigits(bool Y/N), notvalidmsg]` — 4 strings + 1 boolean, always emitted.
- `loadXML` L145-147 → `readData` L196-208: strings null if missing;
  `onlydigits="Y".equalsIgnoreCase` (missing→false).
- `setDefault` L155-160: `resultfieldname="result"; onlydigits=false;
  cardtype="card type"; notvalidmsg="not valid message"; fieldname` unset
  (=null).
- Connection: NO.
- Semantics: `getFields` L162-182 appends resultfieldname:Boolean +
  cardtype:String + notvalidmsg:String, each only if `!Utils.isEmpty(...)`
  after `environmentSubstitute` — BUG L177 checks the RAW `notvalidmsg`
  instead of `realnotvalidmsg`, so a `${VAR}` name still appends the column
  when the variable resolves empty. `check` L239-277: empty resultfieldname=
  ERROR, empty fieldname=ERROR, `input.length==0`=ERROR.

### 25. trans RandomCCNumberGenerator — `RandomCCNumberGeneratorMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/randomccnumber/RandomCCNumberGeneratorMeta.java`;
registry `kettle-steps.xml:114`)
- `getXML` L250-268: `<fields>` wrapper + repeat `<field>/[cctype, cclen,
  ccsize]` (3 strings, fixed order), then `[cardNumberFieldName,
  cardLengthFieldName, cardTypeFieldName]` (camelCase, NOT snake_case).
- `loadXML` L167-169 → `readData` L190-211: `getSubNode(stepnode,"fields")` +
  `countNodes(fields,"field")` → `allocate(count)` L171-175; per item
  cctype/cclen/ccsize null if missing; 3 card*FieldName null if missing.
- PITFALL: `clone()` L177-188 derefs `fieldCCType.length` → NPE if never
  allocated (XML missing `<fields>` without readData/setDefault) — template
  always keeps `<fields>` paired.
- `setDefault` L213-226: `allocate(0)` (dead loop), 3 column names = i18n
  `RandomCCNumberGeneratorMeta.CardNumberField/CardLengthField/CardTypeField`.
- Connection: NO.
- Semantics: `getFields` L228-248 ALWAYS adds cardNumberFieldName:String
  (even null/empty), +cardTypeFieldName:String if non-empty, +cardLengthField
  Name:Integer if non-empty. `check` L306-340: `Const.toInt(env(cclen),-1)<0`
  =ERROR WrongLen; `Const.toInt(env(ccsize),-1)<0` =ERROR WrongSize;
  empty cardNumberFieldName=ERROR. `getStepIOMeta` L354-356 output-only.
  TEST-DATA ONLY — never real PANs.

### 26. trans SyslogMessage — `SyslogMessageMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/syslog/SyslogMessageMeta.java`;
registry `kettle-steps.xml:108`)
- `getXML` L219-232: `[messagefieldname, port, servername(lowercase — differs
  from field serverName), facility, priority, addTimestamp, datePattern
  (camelCase), addHostName]`. port/facility/priority strings; 2 booleans Y/N.
- `loadXML` L68-70 → `readData` L234-249: strings null if missing;
  `addTimestamp/addHostName` Y-only (missing→false).
- NOTE `readRep` L251-267 reads servername/port/... via
  `getJobEntryAttribute*` (job-entry API!) while `saveRep` L269-284 saves
  messagefieldname via `saveStepAttribute` and the rest via
  `saveJobEntryAttribute` — repository round-trip differs from XML
  round-trip; trust XML here.
- `setDefault` L78-87: `messagefieldname=null; port=String.valueOf(
  SyslogDefs.DEFAULT_PORT); serverName=null; facility=FACILITYS[0];
  priority=PRIORITYS[0]; datePattern=DEFAULT_DATE_FORMAT; addTimestamp=true;
  addHostName=true`.
- Connection: NO (serverName/port plain strings).
- Semantics: no `getFields` override (passthrough). `check` L286-316:
  empty messagefieldname=ERROR, `input.length==0`=ERROR.

### 27. trans TableCompare — `TableCompareMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/tablecompare/TableCompareMeta.java`;
registry `kettle-steps.xml:127`; `@Step` commented out L54-61)
- `getXML` L469-503 (17 tags): `[reference_connection,
  reference_schema_field, reference_table_field, compare_connection,
  compare_schema_field, compare_table_field, key_fields_field,
  exclude_fields_field, nr_errors_field, nr_records_reference_field,
  nr_records_compare_field, nr_errors_left_join_field,
  nr_errors_inner_join_field, nr_errors_right_join_field,
  key_description_field, value_reference_field, value_compare_field]`.
  Connections emit the NAME (`ref==null?null:getName()`), not the object. No
  booleans/ints.
- `loadXML` L365-367 → `readData` L437-466: `DatabaseMeta.findDatabase(
  databases, getTagValue(...))` → null on missing/name-mismatch (no throw);
  rest null if missing.
- `setDefault` L506-513: only the 6 nr* fields (`nrErrors="nrErrors";
  nrRecordsReferenceField="nrRecordsReferenceTable";
  nrRecordsCompareField="nrRecordsCompareTable"; nrErrorsLeftJoinField=
  "nrErrorsLeftJoin"; nrErrorsInnerJoinField="nrErrorsInnerJoin";
  nrErrorsRightJoinField="nrErrorsRightJoin"`); connections + schema/table/
  key/exclude/keyDescription/value* = null.
- Connection: YES, TWO — `referenceConnection`, `compareConnection`;
  `getUsedDatabaseConnections` L197-212 (adds compare FIRST, reference
  second). Rep uses `reference_connection_id/compare_connection_id`
  L519/523/548/553. Fixture MUST declare BOTH `${REF_CONN}` and `${CMP_CONN}`.
- Semantics: `getFields` L377-435 throws `KettleStepException` if ANY of the
  6 nr* is empty; then appends 6 Integer(len 9) in order nrErrors,
  nrRecordsReference, nrRecordsCompare, nrErrorsLeft, nrErrorsInner,
  nrErrorsRight. keyDescription/valueReference/valueCompare are NOT output.
  Schema/table/key values are DYNAMIC FIELD NAMES from the input row, not
  static table names.

### 28. trans ParallelGzipCsvInput — `ParGzipCsvInputMeta`
(`engine/src/main/java/org/pentaho/di/trans/steps/parallelgzipcsv/ParGzipCsvInputMeta.java`;
registry `kettle-steps.xml:97`, ID `Parallel...` vs class prefix `Par...`)
- `getXML` L178-215: `[filename, filename_field, rownum_field,
  include_filename(Y/N), separator(↔delimiter), enclosure, header(Y/N ↔
  headerPresent), buffer_size(string ↔bufferSize), lazy_conversion(Y/N ↔
  lazyConversionActive), add_filename_result(Y/N ↔isaddresult), parallel(Y/N ↔
  runningInParallel), encoding]` + `<fields>` repeat `<field>/[name,
  type(name via ValueMetaFactory), format, currency, decimal, group,
  length(int), precision(int), trim_type(code)]`.
- `loadXML` L108-110 → `readData` L133-171: booleans Y-only (missing→false);
  `bufferSize` string (NO toInt on load); per-field `type=
  ValueMetaFactory.getIdForValueMeta()`, `length/precision=Const.toInt(val,
  -1)`, `trimType=getTrimTypeByCode()`; missing `<fields>` → `countNodes(
  null)`→0/`allocate(0)` (try→KettleXMLException on parser errors).
- `setDefault` L124-131 + ctor L102-105: `delimiter=","; enclosure="\"";
  headerPresent=true; lazyConversionActive=true; isaddresult=false;
  bufferSize="50000"; allocate(0)`; filename/filenameField/rowNumField/
  encoding=null; includingFilename/runningInParallel=false.
- Connection: NO.
- Semantics (Java↔XML name map — read code by Java name finds the WRONG tag
  if unmapped): delimiter→separator, headerPresent→header, bufferSize→
  buffer_size, lazyConversionActive→lazy_conversion, isaddresult→
  add_filename_result, runningInParallel→parallel. `getFields` L293-351
  `rowMeta.clear()`; per-field ValueMeta (lazy→STORAGE_TYPE_BINARY_STRING +
  storageMetadata String, `setStringEncoding(env(encoding))`); +filenameField:
  String only if non-empty AND includingFilename (TWO conditions);
  +rowNumField:Integer(len 10) if non-empty. `check` L354-382 expects NO input.

---

## Batch 5 — remaining jobs + edi/GA (6)

### 29. job CONNECTED_TO_REPOSITORY — `JobEntryConnectedToRepository`
(`engine/src/main/java/org/pentaho/di/job/entries/connectedtorepository/JobEntryConnectedToRepository.java:49`;
registry `kettle-job-entries.xml:47`, no `@JobEntry`)
- `getXML` L106-116: `[isspecificrep(Y/N), repname(str), isspecificuser(Y/N),
  username(str)]` **THEN** `super.getXML()=[name,description,type]` —
  REVERSED vs most entries (super usually first). Order assertions must put
  the 4 custom tags BEFORE name/description/type.
- `loadXML` L118-131: `super.loadXML` first; bools `"Y".equalsIgnoreCase`;
  strings `getTagValue` (missing→null).
- NO setDefault. Ctor L57-63: `isspecificrep=false, repname=null,
  isspecificuser=false, username=null`.
- Connection: NO `<connection>`.
- Semantics: `evaluates()=true:219`, `isUnconditional()=false:223`.
  `execute:172-217`: `rep==null`→fail; isspecificrep compares
  `environmentSubstitute(repname)` vs `rep.getName()`; isspecificuser vs
  `rep.getUserInfo().getLogin()`; pass → `result=true, nrErrors=0`.
- PITFALL: bool-missing = false (no N/missing distinction).

### 30. job DOS_UNIX_CONVERTER — `JobEntryDosToUnix`
(`engine/src/main/java/org/pentaho/di/job/entries/dostounix/JobEntryDosToUnix.java:70`;
registry `kettle-job-entries.xml:61`)
- `getXML` L155-178: `super.getXML()` first, then `[arg_from_previous(Y/N),
  include_subfolders(Y/N), nr_errors_less_than(str number),
  success_condition(str), resultfilenames(str), <fields><field>[
  source_filefolder, wildcard, ConversionType]]>` (ConversionType capital C,
  code value). Null-guard at L165 (missing list safe on write).
- Codes: `ConversionType ∈ {guess, dostounix, unixtodos}` (L80), int
  `0/1/2` (L82-84); `success_condition ∈ {success_if_no_errors,
  success_if_error_files_less, success_when_at_least}` (L90-93);
  `resultfilenames ∈ {all_filenames, only_processed_filenames,
  only_error_filenames}` (L95-97).
- `loadXML` L222-254: bool Y-check (L227-228); 3 strings nullable (L230-232);
  `allocate(nrFields)` on `countNodes(fields,"field")` (L238; missing→empty
  array); `ConversionType` via `getConversionTypeByCode(Const.NVL(...,""))`
  (L246-247) → unknown/null → `0=guess` (L209-220).
- NO setDefault. Ctor L121-131: `resultfilenames=all_filenames,
  arg_from_previous=false, source/wildcard/conversionTypes=null,
  include_subfolders=false, nr_errors_less_than="10", success_condition=
  success_if_no_errors`.
- Connection: NO.
- Semantics/PITFALLS: `success_condition/resultfilenames==null` (missing
  tags) NPEs at `resultfilenames.equals(...)` (L687-698) and
  `getSuccessCondition().equals(...)` (L414-431) — ALWAYS emit both.
  `wildcard` is a Java regex (L740-753), empty = match all.
  `arg_from_previous=true` ignores the static list, reads row[0]=path,
  row[1]=wildcard, row[2]=conversionCode (L337-364).

### 31. job EVAL — `JobEntryEval`
(`engine/src/main/java/org/pentaho/di/job/entries/eval/JobEntryEval.java:59`;
registry `kettle-job-entries.xml:17`)
- `getXML` L78-85: `super.getXML()` + `[script(str, CDATA-escaped by
  XMLHandler)]`.
- `loadXML` L87-95: `script=getTagValue(entrynode,"script")` (missing→null).
  `loadRep/saveRep` L97-116 same key.
- NO setDefault. Ctor L64-71: `JobEntryEval("","")` → `script=""`.
- Connection: NO.
- Semantics: `evaluates()=true:219`, `isUnconditional()=false:224`,
  `resetErrorsBeforeExecution()=false:213`. `evaluate:137-198` runs Rhino
  `cx.evaluateString(script)` with scope vars (errors, lines_input/output/
  updated/rejected/read/written, exit_status, files_retrieved, nr, is_windows,
  `_entry_`, rows, parent_job, previous_result); `Context.toBoolean(res)`;
  exception → `nrErrors=1`, false; success resets `nrErrors=0`.
  `execute:208-211` assigns `prev_result.result=evaluate(...)`.
- PITFALL: null script (missing tag) → `evaluateString` throws → entry
  fail-closed (false). `check` L227-230 requires non-blank script. Rhino JS
  (ES5-era), not Node.

### 32. job MSGBOX_INFO — `JobEntryMsgBoxInfo`
(`engine/src/main/java/org/pentaho/di/job/entries/msgboxinfo/JobEntryMsgBoxInfo.java:56`;
registry `kettle-job-entries.xml:25`)
- `getXML` L75-83: `super.getXML()` + `[bodymessage(str), titremessage(str)]`
  — body BEFORE title.
- `loadXML` L85-94: both `getTagValue` (missing→null). `loadRep/saveRep`
  L96-118 same keys.
- NO setDefault. Ctor L60-64: both `=null`; but null-safe getters:
  `getTitleMessage:181-186`, `getBodyMessage:188-194` return `""` on null;
  `getReal*:173-179` environmentSubstitute.
- Connection: NO.
- Semantics: `evaluates()=true:165`, `isUnconditional()=false:170`,
  `resetErrorsBeforeExecution()=false:159`. `evaluate:123-144` shows via
  `GUIFactory.getThreadDialogs().threadMessageBox(...INFO)`; headless
  (`dialogs==null`) → default `response=true`. `execute:154-157` assigns result.
- PITFALL: keep `titremessage` (French `titre`) — `titlemessage` is a wrong
  tag (null-safe → silent `""`). Headless always passes — not a stop gate.

### 33. trans TypeExitEdi2XmlStep — `Edi2XmlMeta`
(`plugins/edi2xml/impl/src/main/java/org/pentaho/di/trans/steps/edi2xml/Edi2XmlMeta.java:59`;
`@Step(id="TypeExitEdi2XmlStep":53, name BaseStep.TypeLongDesc.Edi2Xml,
category Utility, image EDI2XML.svg)`)
- `getXML` L87-94: `[inputfield(str), outputfield(str)]` lowercase. No Y/N,
  no repeating `<fields>`.
- `loadXML` L97-106: `getNodeValue(getSubNode(stepnode,"inputfield"/
  "outputfield"))` (missing→null). `readRep/saveRep` L109-129 same keys.
- `setDefault` L201-204: `outputField="edi_xml", inputField=""`.
- Connection: NO.
- Semantics: `getFields` L132-151 — non-empty outputField → `addValueMeta(
  ValueMetaString(outputField))`, else only looks up inputField (no add);
  always STORAGE_TYPE_NORMAL.
- PITFALL: lowercase tags (`inputField` camel is a wrong tag); empty
  outputfield = no column appended.

### 34. trans TypeExitGoogleAnalyticsInputStep — `GaInputStepMeta`
(`plugins/google-analytics/core/src/main/java/org/pentaho/di/trans/steps/googleanalytics/GaInputStepMeta.java:70`;
`@Step(id="TypeExitGoogleAnalyticsInputStep":61, category Input, image GAN.svg)`
+ `@InjectionSupported(groups={"OUTPUT_FIELDS"}):69`)
- `getXML` L427-462: `[oauthServiceAccount, appName(=gaAppName!),
  oauthKeyFile, profileName, profileTableId, customTableId,
  useCustomTableId(Y/N), startDate, endDate, dimensions, metrics, filters,
  sort, useSegment(Y/N), useCustomSegment(Y/N), customSegment, segmentId,
  segmentName, samplingLevel, rowLimit(int)]` + repeat `<feedField>` DIRECTLY
  under step (NO wrapper): `[feedFieldType, feedField, outField(=outputField!),
  type(valueMetaName =outputType!), conversionMask]`. 3 write-time renames:
  gaAppName→appName, outputField→outField, outputType→type(name).
- Types: bools `addTagValue(boolean)` Y/N; rowLimit int; `type` is a
  ValueMeta NAME (`ValueMetaFactory.getValueMetaName`); rest strings.
- `loadXML` L465-526: strings `getTagValue` (missing→null); bools via
  `getBooleanAttributeFromNode:420-424` (only `Y`=true); EXCEPTION
  `useSegment` missing tag → **true** (L492-494); `rowLimit=Const.toInt(
  ...,0)` (L500); `allocate(0)` then `allocate(countNodes(feedField))`;
  `outputType=getIdForValueMeta(type)`, `<0→TYPE_STRING` (L513-518). Legacy
  user/pass/apiKey without oauth → only `logError` (L477-480).
- `setDefault` L346-364: `oauthServiceAccount=
  "service.account@developer.gserviceaccount.com", oauthKeyFile="",
  useSegment=true, segmentId="gaid::-1", segmentName="All Visits",
  dimensions="ga:browser", metrics="ga:visits", startDate=today(yyyy-MM-dd),
  endDate=startDate, sort="-ga:visits", gaAppName="pdi-google-analytics-app",
  rowLimit=0, samplingLevel="DEFAULT", allocate(0)`.
- Connection: NO `<connection>` DB; auth is 2 strings
  oauthServiceAccount/oauthKeyFile (always `${VAR}`).
- Semantics: `getFields` L377-396 `r.clear()` then adds each outputField[i]/
  outputType[i] (String fallback); ignores feed/conversionMask.
  `setRowLimit<0→0` (L153-158). Injection normalizes arrays at
  `afterInjectionSynchronization:699-712`.
- PITFALLS: NO feeds wrapper (no `<fields>`/`<feeds>` — `set_fields` with a
  listTag does NOT apply; each `<feedField>` is an independent child block).
  `samplingLevel ∈ {DEFAULT,FASTER,HIGHER_PRECISION}` (L132) unvalidated on
  load — bad values fail only at runtime. Legacy non-oauth auth silently
  ignored.

---

## Proposed catalog rows (for Kiro to add to catalog.yaml — DO NOT edit here)

transformation:
- {type: XBASE_INPUT, xml_type: XBaseInput, file: trans/XBaseInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SAS_INPUT, xml_type: SASInput, file: trans/SASInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: S3_CSV_INPUT, xml_type: S3CSVINPUT, file: trans/S3CSVINPUT.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: RSS_INPUT, xml_type: RssInput, file: trans/RssInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: RSS_OUTPUT, xml_type: RssOutput, file: trans/RssOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: MONDRIAN_INPUT, xml_type: MondrianInput, file: trans/MondrianInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: OLAP_INPUT, xml_type: OlapInput, file: trans/OlapInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: INJECTOR, xml_type: Injector, file: trans/Injector.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SOCKET_READER, xml_type: SocketReader, file: trans/SocketReader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SOCKET_WRITER, xml_type: SocketWriter, file: trans/SocketWriter.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PRIORITIZE_STREAMS, xml_type: PrioritizeStreams, file: trans/PrioritizeStreams.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: GET_SLAVE_SEQUENCE, xml_type: GetSlaveSequence, file: trans/GetSlaveSequence.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: GET_REPOSITORY_NAMES, xml_type: GetRepositoryNames, file: trans/GetRepositoryNames.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: STEP_METASTRUCTURE, xml_type: StepMetastructure, file: trans/StepMetastructure.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SSH, xml_type: SSH, file: trans/SSH.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SFTP_PUT, xml_type: SFTPPut, file: trans/SFTPPut.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: HL7_INPUT, xml_type: HL7Input, file: trans/HL7Input.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SHAPE_FILE_READER, xml_type: ShapeFileReader, file: trans/ShapeFileReader.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PENTAHO_REPORTING_OUTPUT, xml_type: PentahoReportingOutput, file: trans/PentahoReportingOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: CUBE_INPUT, xml_type: CubeInput, file: trans/CubeInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: CUBE_OUTPUT, xml_type: CubeOutput, file: trans/CubeOutput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: AUTO_DOC, xml_type: AutoDoc, file: trans/AutoDoc.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: CLOSURE_GENERATOR, xml_type: ClosureGenerator, file: trans/ClosureGenerator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: CREDIT_CARD_VALIDATOR, xml_type: CreditCardValidator, file: trans/CreditCardValidator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: RANDOM_CC_NUMBER_GENERATOR, xml_type: RandomCCNumberGenerator, file: trans/RandomCCNumberGenerator.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: SYSLOG_MESSAGE, xml_type: SyslogMessage, file: trans/SyslogMessage.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: TABLE_COMPARE, xml_type: TableCompare, file: trans/TableCompare.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: PARALLEL_GZIP_CSV_INPUT, xml_type: ParallelGzipCsvInput, file: trans/ParallelGzipCsvInput.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: EDI_2_XML, xml_type: TypeExitEdi2XmlStep, file: trans/TypeExitEdi2XmlStep.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: GOOGLE_ANALYTICS_INPUT, xml_type: TypeExitGoogleAnalyticsInputStep, file: trans/TypeExitGoogleAnalyticsInputStep.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}

job:
- {type: CONNECTED_TO_REPOSITORY, xml_type: CONNECTED_TO_REPOSITORY, file: job/CONNECTED_TO_REPOSITORY.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: DOS_UNIX_CONVERTER, xml_type: DOS_UNIX_CONVERTER, file: job/DOS_UNIX_CONVERTER.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: EVAL, xml_type: EVAL, file: job/EVAL.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}
- {type: MSGBOX_INFO, xml_type: MSGBOX_INFO, file: job/MSGBOX_INFO.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}

Evidence level for all rows: `source_reviewed` (no spoon_loaded/runtime).
No ID deferred — all 34 have full getXML/loadXML/setDefault evidence above.
