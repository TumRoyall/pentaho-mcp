# B3b source notes — transform làm sạch/biến đổi (5 trans IDs)

**Source:** `C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle`, branch `9.4`,
pinned commit `1a939ab5cabe4517867879684aeca2a526bcc638`.
All class/method/line citations below are at that commit.
Read-only review; no shell/tests/git run by this agent.

**Phạm vi DUY NHẤT batch này (không làm ID khác):** trans `SetValueField`,
trans `ReplaceString`, trans `SplitFieldToRows3`, trans `FieldSplitter`,
trans `UniqueRowsByHashSet`.

**Wrapper (cả 5):** `engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java`,
`getXML()` (dòng 206–208) → `getXML(boolean)` (dòng 210–230): wrapper emit
`<step>`, `<name>`, `<type>` = step ID (dòng 213–215), rồi splice fragment
plugin qua `stepMetaInterface.getXML()` (dòng 228–230). Mỗi plugin `getXML()`
chỉ trả tag cấu hình riêng — template reference = wrapper + fragment.

**No-DB note (cả 5):** không ID nào tham chiếu database connection — KHÔNG có
tag `<connection>` trong bất kỳ `getXML()` nào, bẫy fixture B2 KHÔNG áp dụng,
template không được thêm tag này. Fixture minimal `.ktr` không cần khai báo
connection (theo mẫu B3a).

**Mức bằng chứng đề xuất (cả 5):** `source_reviewed`,
`source_version: 9.4`, `verified_versions: 9.4` →
`canonical + generator_eligible: true`. Chưa có Spoon/runtime verification —
không nâng mức, không bịa xác minh.

**Test hồi quy:** `test/knowledge-b3b-transform.test.js` (viết trước theo
plan — hiện FAIL vì 5 ID chưa có catalog/reference; chuyển GREEN sau khi thêm
reference + dòng catalog).

## 1. trans `SetValueField` — `SetValueFieldMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/setvaluefield/SetValueFieldMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 93:
  `<step id="SetValueField">` →
  `org.pentaho.di.trans.steps.setvaluefield.SetValueFieldMeta` (category
  Transform).
- `allocate(int count)` (dòng 101–104): sizes `fieldName[]` +
  `replaceByFieldValue[]`.
- `setDefault()` (dòng 137–146): 0 fields (`allocate(0)`).
- `getXML()` (dòng 148–162): emit DUY NHẤT wrapper `<fields>` paired (dòng
  151/159); mỗi `<field>` có `<name>` (field bị ghi đè, dòng 155) +
  `<replaceby>` (field nguồn lấy giá trị, dòng 156). Không tag nào khác.
- `readData(Node, ...)` (dòng 118–135), via `loadXML` (dòng 97–99): đếm field
  từ sub-node `<fields>` (dòng 120–121); mỗi `<field>` đọc `name` + `replaceby`
  (dòng 128–129), thiếu tag → null.
- Semantics: step gán MỖI field đã khai báo bằng GIÁ TRỊ CỦA FIELD KHÁC
  (`replaceByFieldValue`) — khác `SetValueConstant` (B3a, gán hằng) và khác
  `IfNull` (B3a, chỉ thay khi null). `check()` (dòng 194–236): đòi có input;
  MỖI field phải có `replaceByFieldValue` non-empty (dòng 227–234) — thiếu là
  ERROR. `supportsErrorHandling()` = true (dòng 247–249).
- **PITFALL:** tag nguồn là `<replaceby>` (viết liền, không gạch dưới) —
  viết `<replace_by>`/`replaceBy` sẽ bị loader bỏ qua lặng lẽ (null →
  `check()` ERROR thiếu replace-by value).
- Catalog đề xuất: `{type: SET_VALUE_FIELD, xml_type: SetValueField,
  file: trans/SetValueField.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

Emitted tag order: `[<fields>(<field>(<name>, <replaceby>)*)]`.

## 2. trans `ReplaceString` — `ReplaceStringMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/replacestring/ReplaceStringMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 83:
  `<step id="ReplaceString">` →
  `org.pentaho.di.trans.steps.replacestring.ReplaceStringMeta` (category
  Transform).
- `allocate(int nrkeys)` (dòng 206–217): 5 mảng String (`fieldInStream`,
  `fieldOutStream`, `replaceString`, `replaceByString`,
  `replaceFieldByString`) + 5 mảng boolean (`useRegEx`, `setEmptyString`,
  `wholeWord`, `caseSensitive`, `isUnicode`).
- `setDefault()` (dòng 276–282): `fieldInStream/fieldOutStream = null`, 0
  fields (`allocate(0)`).
- `getXML()` (dòng 284–310): emit DUY NHẤT wrapper `<fields>` paired (dòng
  287/307); mỗi `<field>` có đúng 10 tag theo thứ tự `in_stream_name` (dòng
  291), `out_stream_name` (292), `use_regex` (293), `replace_string` (294),
  `replace_by_string` (295), `set_empty_string` (296),
  `replace_field_by_string` (297–298), `whole_word` (299),
  `case_sensitive` (300–301), `is_unicode` (302–303).
- `readData(Node, ...)` (dòng 238–270), via `loadXML` (dòng 202–204):
  string tags đọc qua `Const.NVL(..., "")` (dòng 250–251, 253–254, 258 —
  thiếu tag → `""`, không null); cờ đọc qua `getFlagFromString` (dòng
  272–274: chấp nhận `Y`/`yes`/`true`, case-insensitive); riêng
  `set_empty_string` parse bằng non-empty + `"Y".equalsIgnoreCase` (dòng
  255–257, thiếu/rỗng → false).
- **PITFALL 1 (dòng 312–315, BACKLOG-27839):** 4 cờ `use_regex`,
  `whole_word`, `case_sensitive`, `is_unicode` serialize qua
  `getFlagTagValue` thành `"yes"`/`"no"` — KHÔNG phải `Y`/`N`. Template
  PHẢI dùng `yes`/`no` cho 4 tag này; ghi `Y`/`N` vẫn load đúng (nhờ
  `getFlagFromString`) nhưng round-trip qua Spoon/ghi lại sẽ ra `yes`/`no`,
  gây diff giả và sai kỳ vọng test thứ tự/chuẩn.
- **PITFALL 2:** `set_empty_string` là Y/N chuẩn (dòng 296 dùng
  `addTagValue(String, boolean)` → `Y`/`N`), KHÁC 4 cờ `yes`/`no` trên.
  Nhầm hai họ cờ là lỗi phổ biến nhất batch này.
- **PITFALL 3:** `out_stream_name` rỗng = thay TẠI CHỖ (in-place):
  `getFields()` (dòng 367–391) — non-empty thì thêm field String MỚI
  (dòng 373–382, copy string encoding từ field nguồn, PDI-11839), rỗng thì
  giữ nguyên field nguồn (dòng 383–389). Template để `<out_stream_name/>`
  self-closing nghĩa là in-place.
- Semantics: `check()` (dòng 393–487) đòi input field tồn tại trong stream
  trước (dòng 408–429), là kiểu String (dòng 434–458), `in_stream_name`
  non-empty (dòng 460–472) và không trùng nhau (dòng 475–484).
  `supportsErrorHandling()` = true (dòng 498–500).
- Catalog đề xuất: `{type: REPLACE_STRING, xml_type: ReplaceString,
  file: trans/ReplaceString.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

Emitted tag order: `[<fields>(<field>(<in_stream_name>,
<out_stream_name>, <use_regex>, <replace_string>, <replace_by_string>,
<set_empty_string>, <replace_field_by_string>, <whole_word>,
<case_sensitive>, <is_unicode>)*)]`.

## 3. trans `SplitFieldToRows3` — `SplitFieldToRowsMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/splitfieldtorows/SplitFieldToRowsMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 61:
  `<step id="SplitFieldToRows3">` →
  `org.pentaho.di.trans.steps.splitfieldtorows.SplitFieldToRowsMeta`
  (category Transform). **PITFALL:** XML ID có hậu tố `3` (thế hệ thứ ba của
  step) trong khi tên class KHÔNG có số — template/test phải dùng
  `<type>SplitFieldToRows3</type>`, không phải `SplitFieldToRows`.
- `setDefault()` (dòng 149–157): `splitField=""`, `delimiter=";"`,
  `newFieldname=""`, `includeRowNumber=false`, `isDelimiterRegex=false`,
  `rowNumberField=""`, `resetRowNumber=true`.
- `getXML()` (dòng 175–187): emit đúng 7 tag phẳng theo thứ tự `splitfield`
  (dòng 178), `delimiter` (179), `newfield` (180), `rownum` Y/N (181),
  `rownum_field` (182), `resetrownumber` Y/N (183), `delimiter_is_regex`
  Y/N (184). Không list, không wrapper.
- `readData(Node)` (dòng 134–147), via `loadXML` (dòng 130–132): 3 cờ parse
  bằng `"Y".equalsIgnoreCase` (thiếu → false, dòng 139–140, 142); 4 string
  đọc nguyên văn (thiếu → null, dòng 136–138, 141).
- **PITFALL 1:** `resetRowNumber` default TRUE (`setDefault` dòng 156) trong
  khi file thiếu tag load thành FALSE — template PHẢI pin
  `<resetrownumber>Y</resetrownumber>` rõ ràng để giữ semantics default (reset
  số dòng cho mỗi file).
- **PITFALL 2:** đọc nhầm `resetrownumber` (XML, dòng 140/183) với
  `reset_rownumber` (repository, `readRep` dòng 196 / `saveRep` dòng 210).
  XML template chỉ dùng `resetrownumber` (không gạch dưới).
- Semantics: tách field `splitfield` theo `delimiter` (hoặc regex khi
  `delimiter_is_regex=Y`) thành NHIỀU DÒNG, giá trị mảnh ghi vào field mới
  `newfield` (kiểu String); `rownum=Y` thêm field Integer đếm mảnh
  (`rownum_field`, substitute biến, dòng 167–172). `getFields()` (dòng
  159–173) KHÔNG xóa field gốc ở mức Meta (thêm `newfield` + optional rownum;
  runtime mới phát lại dòng). `check()` (dòng 220–287): đòi input chứa
  `splitfield` (dòng 235–247), `newfield` non-empty (dòng 269–274), và khi
  `includeRowNumber` thì `rownum_field` non-empty (dòng 275–286).
- Catalog đề xuất: `{type: SPLIT_FIELD_TO_ROWS3, xml_type: SplitFieldToRows3,
  file: trans/SplitFieldToRows3.md, status: canonical,
  generator_eligible: true, source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

Emitted tag order: `[<splitfield>, <delimiter>, <newfield>, <rownum>,
<rownum_field>, <resetrownumber>, <delimiter_is_regex>]`.

## 4. trans `FieldSplitter` — `FieldSplitterMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/fieldsplitter/FieldSplitterMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 104:
  `<step id="FieldSplitter">` →
  `org.pentaho.di.trans.steps.fieldsplitter.FieldSplitterMeta` (category
  Transform).
- `allocate(int nrfields)` (dòng 312–326): 4 mảng String (`fieldName`,
  `fieldID`, `fieldFormat`, `fieldGroup`, `fieldDecimal`, `fieldCurrency`,
  `fieldNullIf`, `fieldIfNull` — thực tế 8 String) + `fieldRemoveID[]`
  boolean + `fieldType[]`/`fieldLength[]`/`fieldPrecision[]`/
  `fieldTrimType[]` int.
- `setDefault()` (dòng 392–397): `splitField=""`, `delimiter=","`,
  `enclosure=null`, 0 fields (`allocate(0)`).
- `getXML()` (dòng 452–496): emit `splitfield` (dòng 456), `delimiter`
  (457), `enclosure` (458), rồi wrapper `<fields>` (dòng 460/493, emit
  LUÔN kể cả 0 field — không có nhánh điều kiện); mỗi `<field>` có đúng 13
  tag theo thứ tự `name` (464), `id` (466), `idrem` Y/N (468), `type` tên
  value-meta chuỗi (470–471), `format` (473), `group` (475), `decimal`
  (477), `currency` (479), `length` int (481, `-1` khi rỗng), `precision`
  int (483, `-1`), `nullif` (485), `ifnull` (487), `trimtype` mã code
  (489–490).
- `readData(Node)` (dòng 352–390), via `loadXML` (dòng 308–310):
  `idrem` Y-check (thiếu → false, dòng 380); `type` map về id qua
  `getIdForValueMeta` (dòng 381 — tên chuỗi, không phải số); `length`/
  `precision` qua `Const.toInt(..., -1)` (dòng 382–383); `trimtype` qua
  `ValueMetaString.getTrimTypeByCode` (dòng 384).
- **PITFALL 1:** `<field>/<id>` là ID NHÚNG trong mảnh split (vd
  `Sales2=310.50` thì id=`Sales2`, xem class javadoc Example2 dòng 85–103) —
  KHÁC `<name>` (tên field output). `idrem=Y` thì strip ID khỏi giá trị
  mảnh. Bỏ trống `<id/>` = split vị trí thuần túy (Example1 dòng 64–83).
- **PITFALL 2:** `<trimtype>` là mã code `none`/`left`/`right`/`both`
  (`ValueMetaBase.trimTypeCode`, `core/.../row/value/ValueMetaBase.java`
  dòng 94) — không phải `Y`/`N`, không phải nhãn UI.
- **PITFALL 3:** `getFields()` (dòng 411–450) THAY field gốc TẠI CHỖ: field
  mới đầu tiên `setValueMeta(idx)` đúng vị trí split field (dòng 436–438),
  các field sau chèn tiếp (dòng 439–444); field gốc BIẾN MẤT khỏi schema
  (khác SplitFieldToRows3 giữ nguyên + thêm field). Thiếu split field trong
  row → `RuntimeException` (dòng 415–418).
- Semantics runtime (Meta-level, giữ `source_reviewed`): tách
  `splitfield` theo `delimiter` (bỏ qua delimiter trong cặp `enclosure`)
  thành N field mới có kiểu/format/độ dài riêng; số mảnh phải khớp số
  `<field>` khai báo (runtime pad/cắt theo danh sách).
- Catalog đề xuất: `{type: FIELD_SPLITTER, xml_type: FieldSplitter,
  file: trans/FieldSplitter.md, status: canonical, generator_eligible: true,
  source_version: "9.4", verified_versions: "9.4",
  verification: source_reviewed}`.

Emitted tag order: `[<splitfield>, <delimiter>, <enclosure>,
<fields>(<field>(<name>, <id>, <idrem>, <type>, <format>, <group>,
<decimal>, <currency>, <length>, <precision>, <nullif>, <ifnull>,
<trimtype>)*)]`.

## 5. trans `UniqueRowsByHashSet` — `UniqueRowsByHashSetMeta`

- Class: `engine/src/main/java/org/pentaho/di/trans/steps/uniquerowsbyhashset/UniqueRowsByHashSetMeta.java`
- Registry: `engine/src/main/resources/kettle-steps.xml`, dòng 90:
  `<step id="UniqueRowsByHashSet">` →
  `org.pentaho.di.trans.steps.uniquerowsbyhashset.UniqueRowsByHashSetMeta`
  (category Transform).
- `allocate(int nrfields)` (dòng 88–90): sizes `compareFields[]`.
- `setDefault()` (dòng 160–170): `rejectDuplicateRow=false`,
  `errorDescription=null`, 0 fields (`allocate(0)`); `storeValues` KHÔNG
  được set → false (boolean default).
- `getXML()` (dòng 176–191): emit `store_values` Y/N (dòng 179),
  `reject_duplicate_row` Y/N (180), `error_description` (181), rồi wrapper
  `<fields>` (dòng 182/188, emit LUÔN); mỗi `<field>` chỉ có `<name>` (dòng
  185). Chú ý `<fields>` mở KHÔNG có `Const.CR` sau (dòng 182 — chi tiết
  format, không ảnh hưởng semantics).
- `readData(Node)` (dòng 137–158), via `loadXML` (dòng 122–124): 2 cờ
  Y-check (thiếu → false, dòng 139–140); `error_description` nguyên văn
  (dòng 141); list đọc từ sub-node `<fields>` (dòng 143–152).
- **PITFALL 1 (dòng 252–254):** `supportsErrorHandling()` trả về
  `isRejectDuplicateRow()` — hop lỗi CHỈ hoạt động khi
  `reject_duplicate_row=Y` (kèm `error_description`). Để `N` mà vẫn vẽ error
  hop thì hop không bao giờ có dòng (khác các step luôn `return true`).
- **PITFALL 2:** `getFields()` RỖNG (dòng 172–174) — schema output = input,
  step chỉ LỌC dòng trùng, không thêm/bớt cột. Đừng khai báo output field
  mới ở step này.
- Semantics (dòng 52–59 + runtime `UniqueRowsByHashSet.java` ở mức tên
  field, giữ `source_reviewed`): dedup bằng HashSet trên các
  `compareFields` (null/rỗng = so sánh TOÀN BỘ dòng, theo comment dòng 56);
  `store_values=Y` lưu cả giá trị dòng để so bằng strict-equality thay vì
  chỉ so hash (tốn RAM hơn nhưng tránh va chạm hash); KHÔNG yêu cầu sort
  trước (khác step `Unique`/`UniqueRows` đòi sort). `check()` (dòng 225–241)
  chỉ đòi có input.
- Catalog đề xuất: `{type: UNIQUE_ROWS_BY_HASH_SET,
  xml_type: UniqueRowsByHashSet, file: trans/UniqueRowsByHashSet.md,
  status: canonical, generator_eligible: true, source_version: "9.4",
  verified_versions: "9.4", verification: source_reviewed}` (alias tách
  `HashSet` → `HASH_SET` theo đúng tên XML type, tránh nhầm với step
  `Unique`/`UniqueRows`).

Emitted tag order: `[<store_values>, <reject_duplicate_row>,
<error_description>, <fields>(<field>(<name>)*)]`.

## Ghi cho lượt implement (không làm trong phase này)

- Chỉ viết 5 reference + 5 dòng catalog + test cho 5 ID trên; không sửa B1,
  B2, B3a, handoff hay runner. Không placeholder connection (không ID nào
  có `<connection>`).
- Test assert direct-child `<type>` — đặc biệt `SplitFieldToRows3` (ID có số
  `3`) và `ReplaceString` (không có nested `<type>` nào để nhầm, nhưng vẫn
  đọc direct-child cho nhất quán).
- Không thêm 5 ID vào `EVIDENCE_BACKED_TYPES` của `test/knowledge.test.js`
  (nhất quán B2/B3a — batch test riêng đã kiểm eligibility).
