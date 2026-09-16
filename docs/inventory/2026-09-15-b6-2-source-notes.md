# B6-2 source notes — services/directory/scripting/stats/file-utility (36 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Wrapper (all trans):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (lines 206-208) → `getXML(boolean)` (lines 210-230): wrapper emits
`<step>`, `<name>`, `<type>` = step ID (lines 213-215), then splices the plugin
fragment via `stepMetaInterface.getXML()` (lines 228-230). Each plugin `getXML()`
returns only its own config tags.

**Wrapper (all job):** `engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java`
`getXML()` (lines 415-424: `name`/`description`/`type` + attributes) inside
`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` `getXML()`
(lines 102-119: `<entry>`, plugin fragment, `parallel`/`draw`/`nr`/`xloc`/`yloc`).

## L1. LIMITATION — edit.js span collisions (pre-existing, out of scope to fix)

While writing `test/knowledge-b6-2-services-scripting.test.js` (scratch repros
`.superpowers/dbg{2,3,4}-b62.mjs`, since removed), three `src/core/edit.js`
span-logic collisions surfaced. They affect TEST strategy, not the references
(all templates below are source-correct). No edit.js change made (out of scope).

1. **Item tag == child tag:** `setFields(f, name, 'fields', 'field', ...)` on
   SalesforceInput/Insert/Update/Upsert matches the item CLOSE `</field>` with
   the inner child `<field>…</field>` (source column), producing malformed XML
   (`Expected closing tag 'fields' … instead of closing tag 'field'`). Same for
   LDAPOutput (`name`/`field`/`update` items contain a `<field>` child).
   `setFieldPath` with `fields/field/<leaf>` paths is equally unsafe (writes land
   inside the inner `<field>` element — observed `trim_type` nested under
   `field.field`). Tests therefore assert item mapping from the reference
   template and drive only step-level scalars via the API.
2. **Nested `<step>` in `<steps>` (StepsMetrics):** `setFields(... 'steps',
   'step' ...)` throws `Unclosed <steps> inside span` (span.js:45);
   `setFieldPath(... 'stepnamefield' ...)` silently DUPLICATES the leaf inside
   the nested `<step>` item (count goes 1 → 2) instead of updating the
   step-level tag. Tests assert the reference's non-default example block
   instead; no edit-API writes for this ID.
3. **Hyphen children:** `parseItemTemplate` (edit.js:513-522) regex
   `[A-Za-z0-9_]+` excludes `-`, so `setFields` on Rules `fields/field`
   silently renders EMPTY items (order `[]`). `setFieldPath` with hyphen leaves
   (`fields/field/column-name`) works and is used instead.

**No-DB note:** only the 4 Palo steps reference a `<connection>` (Palo/Mondrian
DatabaseMeta by name — the B2a fixture pitfall APPLIES: test fixtures MUST declare
`<connection><name>${CONN}</name></connection>`). No other B6-2 ID emits
`<connection>`; Salesforce/LDAP use their own credential tags.

## 1. Họ Salesforce (5 trans, superclass chung)

Superclass `plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforce/SalesforceStepMeta.java`:
`getXML()` (lines 76-86): `targeturl` (78), `username` (79), `password` encrypted
if not variable (80-81), `timeout` (82), `useCompression` Y/N (83), `module` (84).
`loadXML` (88-95). `setDefault()` (121-128): URL = `TARGET_DEFAULT_URL`
(`SalesforceConnectionUtils.java` line 34:
`https://login.salesforce.com/services/Soap/u/47.0`), username/password `""`,
timeout `"60000"`, compression false, module `"Account"`.
`recordsFilterCode = {"all","updated","deleted"}` (`SalesforceConnectionUtils.java`
line 49); `getRecordsFilterByCode` null/unknown → 0 = all (lines 78-89).

### 1.1 trans SalesforceInput — `salesforceinput/SalesforceInputMeta.java`

- Registry: annotation `@Step(id="SalesforceInput", ...)` (lines 59-66, category Input).
  NOT in `kettle-steps.xml`.
- `getXML()` (lines 496-529): super, then `condition` (498), `specifyQuery` (499),
  `query` (500), `include_targeturl` (501), `targeturl_field` (502), `include_module`
  (503), `module_field` (504), `include_rownum` (505), `include_deletion_date` (506),
  `deletion_date_field` (508), `rownum_field` (509), `include_sql` (510), `sql_field`
  (511), `include_Timestamp` capital-T (512), `timestamp_field` (513), `read_from`
  (514), `read_to` (515), `records_filter` code (516-518), `queryAll` (519),
  paired `<fields>` (521-525), `limit` last (526).
- Field item `SalesforceInputField.getXML()` (`salesforceinput/SalesforceInputField.java`
  lines 119-137): `name`, `field`, `idlookup`, `type` (value-meta string), `format`,
  `currency`, `decimal`, `group`, `length`, `precision`, `trim_type`
  (`none/left/right/both`, lines 52-58), `repeat`.
- `readData()` (lines 531-571): flags `"Y"` (missing → false, safe); records_filter
  via `getRecordsFilterByCode(NVL)` (551-553). Field `repeat` is `!"N".equalsIgnoreCase`
  (`SalesforceInputField.java` line 151) — MISSING tag → TRUE. `trim_type` unknown → 0.
- `setDefault()` (lines 582-606): flags false, strings `""`, `allocate(0)`, rowLimit `"0"`.
- `getFields()` (608-674): columns from fields (NONE → String, 614-617) + optional
  targeturl/module/sql (String 250), timestamp/deletion (Date), rownum (Integer).
- `check()` (759-826): no input expected, ≥1 field, enabled flags need names.

Emitted tag order: `[<targeturl>, <username>, <password>, <timeout>, <useCompression>,
<module>, <condition>, <specifyQuery>, <query>, <include_targeturl>, <targeturl_field>,
<include_module>, <module_field>, <include_rownum>, <include_deletion_date>,
<deletion_date_field>, <rownum_field>, <include_sql>, <sql_field>, <include_Timestamp>,
<timestamp_field>, <read_from>, <read_to>, <records_filter>, <queryAll>, <fields>, <limit>]`.

### 1.2 trans SalesforceInsert — `salesforceinsert/SalesforceInsertMeta.java`

- Registry: `@Step(id="SalesforceInsert", ...)` (lines 53-60, Output).
- `getXML()` (192-211): super + `batchSize` (194), `salesforceIDFieldName` (195),
  `<fields>` (197-208: `name` 201, `field` 202, `useExternalId` Y/N 203-204),
  `rollbackAllChangesOnError` (209).
- `readData()` (213-249): missing `<field>` → stream = lookup name (228-230);
  missing `useExternalId` → FALSE (231-234); only `"Y"` → TRUE.
- `setDefault()` (257-265): batch `"10"`, id field `"Id"`, allocate 0, rollback false.
- `getFields()` (268-277): appends ONE String(18) column named `salesforceIDFieldName`
  (skipped when empty). `supportsErrorHandling()` true (361-363).

Emitted tag order: super 6 + `[<batchSize>, <salesforceIDFieldName>, <fields>,
<rollbackAllChangesOnError>]`.

### 1.3 trans SalesforceUpdate — `salesforceupdate/SalesforceUpdateMeta.java`

- Registry: `@Step(id="SalesforceUpdate", ...)` (lines 50-57, Output).
- `getXML()` (179-197): super + `batchSize` (181), `<fields>` (183-194), rollback (195).
  NO `salesforceIDFieldName`.
- `readData()` (199-234): same field fallbacks as Insert (213-226).
- `setDefault()` (242-249): batch `"10"`, allocate 0, rollback false.
- `getFields()` EMPTY (252-255) — passthrough.

Emitted tag order: super 6 + `[<batchSize>, <fields>, <rollbackAllChangesOnError>]`.

### 1.4 trans SalesforceUpsert — `salesforceupsert/SalesforceUpsertMeta.java`

- Registry: `@Step(id="SalesforceUpsert", ...)` (lines 53-60, Output).
- `getXML()` (210-230): super + `upsertfield` LOWERCASE (212), `batchSize` (213),
  `salesforceIDFieldName` (214), `<fields>` (216-227), rollback (228).
- `readData()` (232-269): upsert (234), batch/id (236-237), same field fallbacks (249-262).
- `setDefault()` (277-286): upsert `"Id"` (279), batch `"10"`, id `"Id"`, allocate 0.
- `getFields()` appends String(18) like Insert (289+).

Emitted tag order: super 6 + `[<upsertfield>, <batchSize>, <salesforceIDFieldName>,
<fields>, <rollbackAllChangesOnError>]`.

### 1.5 trans SalesforceDelete — `salesforcedelete/SalesforceDeleteMeta.java`

- Registry: `@Step(id="SalesforceDelete", ...)` (lines 50-57, Output).
- `getXML()` (133-140): super + ONLY `DeleteField` capital D/F (135), `batchSize`
  (136), `rollbackAllChangesOnError` (137). NO `<fields>`.
- `readData()` (142-152): case-sensitive `DeleteField` (144).
- `setDefault()` (154-160): module `"Account"`, DeleteField null, batch `"10"`.
- `getFields()` EMPTY (163-166).

Emitted tag order: super 6 + `[<DeleteField>, <batchSize>, <rollbackAllChangesOnError>]`.

## 2. Họ crypto/PGP (4 trans + 3 job)

### 2.1 trans PGPEncryptStream — `engine/.../pgpencryptstream/PGPEncryptStreamMeta.java`

- Registry: `engine/src/main/resources/kettle-steps.xml` line 129 (Cryptography).
- `getXML()` (lines 217-226): `gpglocation` (219), `keyname` (220), `keynameInField`
  Y/N (221), `keynameFieldName` (222), `streamfield` (223), `resultfieldname` (224).
- `readData()` (228-241): `keynameInField` `"Y"` (233); rest verbatim.
- `setDefault()` (195-202): result `"result"`; rest null/false.
- `getFields()` (205-214): appends ONE String `resultfieldname` (skipped when empty).

Emitted tag order: `[<gpglocation>, <keyname>, <keynameInField>, <keynameFieldName>,
<streamfield>, <resultfieldname>]`.

### 2.2 trans PGPDecryptStream — `engine/.../pgpdecryptstream/PGPDecryptStreamMeta.java`

- Registry: `kettle-steps.xml` line 130 (Cryptography).
- `getXML()` (220-230): `gpglocation` (222), `passhrase` TYPO (one s) encrypted
  (223-224), `streamfield` (225), `resultfieldname` (226), `passphraseFromField` Y/N
  (227), `passphraseFieldName` (228).
- `readData()` (232-244): passphrase decrypted (235); flag `"Y"` (238).
- `setDefault()` (200-205): result `"result"`; rest null (boolean false by JVM default).
- `getFields()` (208-217): appends ONE String.

Emitted tag order: `[<gpglocation>, <passhrase>, <streamfield>, <resultfieldname>,
<passphraseFromField>, <passphraseFieldName>]`.

### 2.3 trans SymmetricCryptoTrans — `engine/.../symmetriccrypto/symmetriccryptotrans/SymmetricCryptoTransMeta.java`

- Registry: `kettle-steps.xml` line 122 (Cryptography).
- Codes: `operationTypeCode = {"encrypt","decrypt"}` (line 79);
  `getOperationTypeByCode` null/unknown → 0 = encrypt (102-113). Algorithms
  `TYPE_ALGORYTHM_CODE = {"DES","DESede","AES"}`
  (`symmetricalgorithm/SymmetricCryptoMeta.java` line 41).
- `getXML()` (314-328): `operation_type` code (316), `algorithm` (317), `schema`
  (318), `secretKeyField` (319), `messageField` (320), `resultfieldname` (321),
  `secretKey` encrypted (324), `secretKeyInField` (326), `readKeyAsBinary` (327),
  `outputResultAsBinary` (328).
- `readData()` (262-281): operation via `getOperationTypeByCode(NVL)` (264-265);
  secretKey decrypted (272); 3 flags `"Y"` (273-275).
- `setDefault()` (283-294): encrypt (289); algorithm = schema = `[0]` = `"DES"`
  (290-291); result `"result"`; rest null/false.
- `getFields()` (296-312): ONE column, String or Binary when outputResultAsBinary
  (300-303).

Emitted tag order: `[<operation_type>, <algorithm>, <schema>, <secretKeyField>,
<messageField>, <resultfieldname>, <secretKey>, <secretKeyInField>, <readKeyAsBinary>,
<outputResultAsBinary>]`.

### 2.4 trans SecretKeyGenerator — `engine/.../symmetriccrypto/secretkeygenerator/SecretKeyGeneratorMeta.java`

- Registry: `kettle-steps.xml` line 123 (Cryptography).
- `getXML()` (308-329): `<fields>` FIRST (311-321; per `<field>`: `algorithm` 315,
  `scheme` 316, `secretKeyLen` 317, `secretKeyCount` 318), `secretKeyFieldName` (323),
  `secretKeyLengthFieldName` (324), `algorithmFieldName` TWICE (325 AND 326 —
  source copy-paste; load reads first occurrence), `outputKeyInBinary` (327).
- `readData()` (233-258): count `<field>` (235-236), `allocate` (238); flag `"Y"` (253).
- `setDefault()` (261-277): allocate 0; 3 output names from i18n; binary false.
- `getFields()` (280-305): key column ALWAYS (String/Binary by flag, 284-290);
  algorithm (String) and key-length (Integer) only when names non-empty (292-303).

Emitted tag order: `[<fields>, <secretKeyFieldName>, <secretKeyLengthFieldName>,
<algorithmFieldName>, (<algorithmFieldName> duplicate), <outputKeyInBinary>]`.
Template keeps ONE `<algorithmFieldName>` (canonical form; Spoon re-save emits two).

### 2.5 job PGP_ENCRYPT_FILES — `engine/.../pgpencryptfiles/JobEntryPGPEncryptFiles.java`

- Registry: `engine/src/main/resources/kettle-job-entries.xml` line 63 (FileEncryption).
- Action codes: `actionTypeCodes = {"encrypt","sign","signandencrypt"}` (line 78);
  out-of-range → `[0]` (238-243).
- `getXML()` (187-236): `super.getXML()` (190), `gpglocation` (191),
  `arg_from_previous` (192), `include_subfolders` (193), `add_result_filesname`
  (194, no e in "filesname"), `destination_is_a_file` (195), `create_destination_folder`
  (196-197), `add_date` (198), `add_time` (199), `SpecifyFormat` capital S/F (200),
  `date_time_format` (201), `nr_errors_less_than` (202), `success_condition` (203),
  `AddDateBeforeExtension` (204), `DoNotKeepFolderStructure` (205-206), `iffileexists`
  (207), `destinationFolder` camel (208), `ifmovedfileexists` (209),
  `moved_date_time_format` (210), `create_move_to_folder` (211), `add_moved_date` (212),
  `add_moved_time` (213), `SpecifyMoveFormat` (214), `AddMovedDateBeforeExtension`
  (215-216), `asciiMode` (217), paired `<fields>` (219-233: `action_type` code 223-224,
  `source_filefolder` 225, `userid` 226, `destination_filefolder` 227-228, `wildcard` 229).
- Constructor (129-159): flags false; `nr_errors_less_than "10"` (150);
  `success_condition success_if_no_errors` (151); if-exists `"do_nothing"` (138/157).
- Success codes (100-102): `success_when_at_least` / `success_if_errors_less` /
  `success_if_no_errors`.

### 2.6 job PGP_DECRYPT_FILES — `engine/.../pgpdecryptfiles/JobEntryPGPDecryptFiles.java`

- Registry: `kettle-job-entries.xml` line 62 (FileEncryption).
- `getXML()` (173-220): same order as Encrypt (177-202) but NO `asciiMode`;
  `<fields>` items are `source_filefolder` (208), `passphrase` encrypted (209-210),
  `destination_filefolder` (211-212), `wildcard` (213). NO `action_type`/`userid`.
- `loadXML()` (222-274): passphrase decrypted (265); allocate by `<field>` count (257-258).
- Constructor (118-147): same defaults as Encrypt (`"10"`, `success_if_no_errors`,
  `do_nothing` x2).

### 2.7 job PGP_VERIFY_FILES — `engine/.../pgpverify/JobEntryPGPVerify.java`

- Registry: `kettle-job-entries.xml` line 64 (FileEncryption).
- `getXML()` (91-100): `super.getXML()` (94) + exactly 4 tags: `gpglocation` (95),
  `filename` (96), `detachedfilename` (97), `useDetachedSignature` Y/N (98). NO `<fields>`.
- `loadXML()` (102-115): flag `"Y"` (109).
- Constructor (74-80): all null except flag false.

## 3. Họ LDAP + Access + LDIF (5 trans)

### 3.1 trans LDAPInput — `plugins/ldap/impl/.../ldapinput/LDAPInputMeta.java`

- Registry: annotation `@Step(id="LDAPInput", ...)` (lines 55-60, Input).
- Codes: `searchScopeCode = {"object","onelevel","subtree"}` (line 131); missing →
  subtree (662-665). `FetchAttributeAsCode = {"string","binary"}`
  (`LDAPInputField.java` line 46).
- `getXML()` (531-592): `usepaging` (534), `pagesize` (535), `useauthentication`
  (536), `rownum` (537), `rownum_field` (538), `host` (539), `username` (540),
  `password` encrypted (541-542), `port` (544), `filterstring` (545), `searchbase`
  (546, lowercase b), `<fields>` (551-572: `name` 554, `attribute` 555,
  `attribute_fetch_as` 556-557, `sorted_key` 558, `type` 559, `format` 560, `length`
  561, `precision` 562, `currency` 564, `decimal` 565, `group` 566, `trim_type` 567,
  `repeat` 568), `limit` int (574), `timelimit` int (575), `multivaluedseparator`
  (576), `dynamicsearch` (577), `dynamicseachfieldname` TYPO missing-r (578),
  `dynamicfilter` (579), `dynamicfilterfieldname` (580), `searchScope` code (581),
  `protocol` (583), `trustStorePath` (584), `trustStorePassword` encrypted (585-587),
  `trustAllCertificates` (588), `useCertificate` (589).
- `readData()` (601-677): `sorted_key` null → false (630-635); `repeat` null → false
  (639-644, SAFE); `limit`/`timelimit` `Const.toInt(...,0)` (655-656).
- `setDefault()` (698-731): paging/auth/rownum false; pagesize `"1000"`; port `"389"`;
  filter `"objectclass=*"` (`LDAPConnection.java` line 69); separator `";"`;
  limit/time 0; scope subtree; allocate 0.
- `getFields()` (734+): columns from fields (NONE → String) + rownum.

### 3.2 trans LDAPOutput — `plugins/ldap/impl/.../ldapoutput/LDAPOutputMeta.java`

- Registry: annotation `@Step(id="LDAPOutput", ...)` (line 53+, Output).
- Codes: `operationTypeCode = {"insert","upsert","update","add","delete","rename"}`
  (line 117); `referralTypeCode = {"follow","ignore"}` (143);
  `derefAliasesTypeCode = {"always","never","searching","finding"}` (163);
  out-of-range → `[0]` (628-638).
- `getXML()` (648-691): `useauthentication` (651), `host` (652), `username` (653),
  `password` (654-655), `port` (656), `dnFieldName` (657), `failIfNotExist` (658)
...[truncated 20887 chars]