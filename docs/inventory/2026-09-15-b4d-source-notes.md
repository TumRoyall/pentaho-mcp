# B4d source notes — file-management job entries (5 IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638` (verified
`git rev-parse HEAD` in pentaho-kettle before reading).
All class/method/line citations below are at that commit.
Read-only review; no git/commit/push, no DB/mail/shell/network run by this agent.
Syntax check only: `node --check test/knowledge-b4d-filejob.test.js` (exit 0).
Full test run + review left to Kiro.

**Registration (all five):** all register in
`engine/src/main/resources/kettle-job-entries.xml` (`CREATE_FILE`,
`WRITE_TO_FILE`, `FILE_COMPARE`, `FOLDERS_COMPARE` — FileManagement;
`FOLDER_IS_EMPTY` — Conditions).

**Job wrapper (all five):** `JobEntryBase.getXML()`
(`engine/src/main/java/org/pentaho/di/job/entry/JobEntryBase.java`, lines
415-419: `name`, `description`, `type` = configId, `attributes`) +
`JobEntryCopy.getXML()` (`.../job/entry/JobEntryCopy.java`, lines 102-113:
`parallel`, `draw`, `nr`, `xloc`, `yloc`).

**No-DB note (all five):** none references a database connection. NO
`<connection>` tag anywhere. All file paths use `${VAR}` placeholders.

## 1. job CREATE_FILE — `JobEntryCreateFile`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/createfile/JobEntryCreateFile.java`
- `getXML()` (lines 88-99): `super.getXML()` then `filename`,
  `fail_if_file_exists`, `add_filename_result` (lines 92-94).
- `loadXML()` (lines 101-112): `super.loadXML()` then the same 3 tags;
  both flags via `"Y".equalsIgnoreCase` (missing → false).
- Init: constructor (lines 72-77): `filename = null`,
  **`failIfFileExists = true`**, `addfilenameresult = false`; no separate
  `setDefault()`.
- Semantics: `evaluates()` = true (lines 239-241). `check()` (lines
  265-271): `filename` non-null AND not-yet-existing
  (`fileDoesNotExistValidator`) — design-time check already assumes a fresh
  target.

Emitted order after super: `[<filename>, <fail_if_file_exists>,
<add_filename_result>]`.

## 2. job WRITE_TO_FILE — `JobEntryWriteToFile`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/writetofile/JobEntryWriteToFile.java`
- `getXML()` (lines 91-108): `super.getXML()` then `filename`,
  `createParentFolder`, `appendFile`, `content`, `encoding` (lines 95-102).
- **CR pitfall (lines 98-101, 319-321):** conforming XML parsers normalize
  CRLF/CR to LF on read, so `getXML()` encodes every CR as `&#xd;` via
  `encodeCR()` (`s.replaceAll("\r", "&#xd;")`). A multi-line `<content>`
  in a saved .kjb legitimately contains `&#xd;` — that is correct source
  behavior, not corruption.
- `loadXML()` (lines 110-122): same 5 tags in order; flags Y/N missing →
  false.
- Init: constructor (lines 73-80): all null/false; no separate `setDefault()`.
- Semantics: `evaluates()` = true (lines 281-283). `check()` (lines
  313-317): `filename` non-blank.

Emitted order after super: `[<filename>, <createParentFolder>,
<appendFile>, <content>, <encoding>]`.

## 3. job FILE_COMPARE — `JobEntryFileCompare`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/filecompare/JobEntryFileCompare.java`
- `getXML()` (lines 94-106): `super.getXML()` then `filename1`,
  `filename2`, `add_filename_result` (lines 98-100).
- `loadXML()` (lines 108-119): same 3 tags; flag Y/N missing → false.
- Init: constructor (lines 78-83): nulls + false; no separate `setDefault()`.
- Semantics: binary compare of the two files; identical ⇒ true flow,
  different ⇒ false flow (class javadoc, lines 62-64).
  `evaluates()` = true (lines 285-287).

Emitted order after super: `[<filename1>, <filename2>,
<add_filename_result>]`.

## 4. job FOLDERS_COMPARE — `JobEntryFoldersCompare`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/folderscompare/JobEntryFoldersCompare.java`
- `getXML()` (lines 113-130): `super.getXML()` then `include_subfolders`,
  `compare_filecontent`, `compare_filesize`, `compareonly`, `wildcard`,
  `filename1`, `filename2` (lines 117-124). NOTE: folder paths use the
  `filename1`/`filename2` tags.
- `loadXML()` (lines 132-143+): same order; 3 flags Y/N missing → false.
- Init: constructor (lines 84-94): 3 flags false, `compareonly = "all"`,
  rest null; no separate `setDefault()`.
- `compareonly` vocabulary (lines 537-549): `"all"` (every entry),
  `"only_files"`, `"only_folders"`, `"specify"` (combined with `wildcard`
  via `GetFileWildcard`). Anything else matches NOTHING (no fallback).
- Semantics: identical ⇒ true flow, different ⇒ false flow (javadoc,
  lines 66-67). `evaluates()` = true (lines 592-594).

Emitted order after super: `[<include_subfolders>, <compare_filecontent>,
<compare_filesize>, <compareonly>, <wildcard>, <filename1>,
<filename2>]`.

## 5. job FOLDER_IS_EMPTY — `JobEntryFolderIsEmpty`

- Class: `engine/src/main/java/org/pentaho/di/job/entries/folderisempty/JobEntryFolderIsEmpty.java`
  (category Conditions)
- `getXML()` (lines 94-106): `super.getXML()` then `foldername`,
  `include_subfolders`, `specify_wildcard`, `wildcard` (lines 98-101).
- `loadXML()` (lines 108-115+): same order; flags Y/N missing → false.
- Init: constructor (lines 77-83): nulls + false; no separate `setDefault()`.
- Semantics: `execute()` (lines 187-259): `filescount == 0` ⇒
  `result = true` (lines 228-231); path missing or not a folder ⇒
  `NrErrors = 1` (lines 232-243, 257-259); the
  `KETTLE_COMPATIBILITY_SET_ERROR_ON_SPECIFIC_JOB_ENTRIES` variable flips
  the starting error count 0/1 (lines 189-194, PDI-10270). The `wildcard`
  compiles to a `Pattern` only when non-empty (lines 200-202) — with
  `specify_wildcard=N` it is inert. `evaluates()` = true (lines 360-362).

Emitted order after super: `[<foldername>, <include_subfolders>,
<specify_wildcard>, <wildcard>]`.

## Catalog rows proposed (for Kiro to add to catalog.yaml)

- `{type: CREATE_FILE, xml_type: CREATE_FILE, file: job/CREATE_FILE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: WRITE_TO_FILE, xml_type: WRITE_TO_FILE, file: job/WRITE_TO_FILE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FILE_COMPARE, xml_type: FILE_COMPARE, file: job/FILE_COMPARE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FOLDERS_COMPARE, xml_type: FOLDERS_COMPARE, file: job/FOLDERS_COMPARE.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
- `{type: FOLDER_IS_EMPTY, xml_type: FOLDER_IS_EMPTY, file: job/FOLDER_IS_EMPTY.md, status: canonical, generator_eligible: true, source_version: "9.4", verified_versions: "9.4", verification: source_reviewed}`
