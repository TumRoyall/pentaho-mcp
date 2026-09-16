# FuzzyMatch — Step so khớp mờ với lookup stream

Với MỖI dòng chính, so `mainstreamfield` với cột `lookupfield` của lookup
stream (hop thông tin từ step `<from>`) bằng thuật toán `<algorithm>`,
rồi append cột match (`outputmatchfield`, String) + cột giá trị
(`outputvaluefield`, kiểu theo thuật toán: Integer cho
Levenshtein/Damerau, Number cho Jaro/Jaro-Winkler/PairSimilarity, String
cho phonetic) + các cột `<lookup>/<value>` (đổi tên theo `rename`). Step
cần HAI hop vào (main + lookup) — `<from>` là THAM CHIẾU STEP (tên step,
phải có hop tương ứng).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FuzzyMatch</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <from>{{LOOKUP_STEP}}</from>
    <lookupfield>{{LOOKUP_FIELD}}</lookupfield>
    <mainstreamfield>{{MAIN_FIELD}}</mainstreamfield>
    <outputmatchfield>match_value</outputmatchfield>
    <outputvaluefield>match_distance</outputvaluefield>
    <caseSensitive>N</caseSensitive>
    <closervalue>Y</closervalue>
    <minimalValue>0</minimalValue>
    <maximalValue>1</maximalValue>
    <separator>,</separator>
    <algorithm>levenshtein</algorithm>
    <lookup>
      <value>
        <name>{{RETURN_FIELD}}</name>
        <rename>{{RETURN_FIELD}}</rename>
      </value>
    </lookup>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<from>` | Y | TÊN STEP lookup (info hop — phải tồn tại + có hop tới step này). |
| `<lookupfield>` | Y | Cột trong lookup stream đem so. |
| `<mainstreamfield>` | Y | Cột trong main stream đem so. |
| `<outputmatchfield>` | Y | Tên cột kết quả match (String). |
| `<outputvaluefield>` | N | Tên cột giá trị/độ gần (kiểu theo thuật toán). |
| `<caseSensitive>` | N | `Y` = phân biệt hoa/thường; mặc định `N`. Chữ S hoa. |
| `<closervalue>` | N | `Y` (mặc định) = trả thêm giá trị gần nhất + cột lookup. |
| `<minimalValue>` / `<maximalValue>` | N | Ngưỡng khoảng cách (chuỗi số); mặc định `"0"`/`"1"`. Chữ V hoa. |
| `<separator>` | N | Phân tách khi so nhiều token; mặc định `,`. |
| `<algorithm>` | N | Mã thuật toán (thường): `levenshtein` (mặc định), `dameraulevenshtein`, `needlemanwunsch`, `jaro`, `jarowinkler`, `pairsimilarity`, `metaphone`, `doublemataphone` (typo gốc — 1 "e"), `soundex`, `refinedsoundex`; lạ → `levenshtein`. |
| `<lookup>/<value>/<name>` | Y (mỗi cột trả về) | Cột lookup cần mang theo. |
| `<lookup>/<value>/<rename>` | N | Tên mới; thiếu → giữ `name`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FUZZY_MATCH` | `<type>` | `FuzzyMatch`. |
| `configuration.lookup_step` | `<from>` | Tên step — cần hop info. |
| `configuration.lookup_field` / `main_field` | `<lookupfield>` / `<mainstreamfield>` | Cột hai phía. |
| `configuration.algorithm` | `<algorithm>` | Mã thường (giữ typo `doublemataphone`). |
| `configuration.return_fields[].name` / `rename` | `<lookup>/<value>/<name>` / `<rename>` | `set_fields` (`listTag=lookup`, `itemTag=value`). |

`<lookup>` chứa list `<value>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=lookup`, `itemTag=value`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 112 —
  `<step id="FuzzyMatch">` →
  `org.pentaho.di.trans.steps.fuzzymatch.FuzzyMatchMeta`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `FuzzyMatchMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/fuzzymatch/FuzzyMatchMeta.java`
  dòng 515–543) — thứ tự `from` (tên info-step, dòng 519), `lookupfield`,
  `mainstreamfield`, `outputmatchfield`, `outputvaluefield` (dòng
  520–523), `caseSensitive`, `closervalue`, `minimalValue`, `maximalValue`,
  `separator` (dòng 525–529), `algorithm` mã (dòng 531), rồi block
  `<lookup>` LUÔN emit (dòng 533–540) với `<value>` có `name` + `rename`
  (dòng 536–537).
- Mã thuật toán: `algorithmCode` (dòng 87–89) — 10 mã thường, chú ý
  `doublemataphone` thiếu "e" (typo gốc, giữ nguyên); parse
  case-insensitive, lạ → index 0 `levenshtein` (dòng 369+).
- Deserialization: `loadXML()` (dòng 331+) gọi `readData()` (dòng
  377–417) — `<from>` nạp vào info-stream subject (dòng 380–382);
  `rename` thiếu → giữ `name` (dòng 408–410).
- Khởi tạo: `setDefault()` (dòng 426–448) — `separator=","`,
  `closervalue=true`, `minimalValue="0"`, `maximalValue="1"`,
  `caseSensitive=false`, 0 value. (`outputmatchfield`/`outputvaluefield`
  default từ i18n — template ghi tên cụ thể.)
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 450–513) — LUÔN thêm cột match
  String; thêm cột giá trị (Integer/Number/String theo thuật toán) khi
  `closervalue`; thêm cột lookup (`rename`, lỗi `ReturnValueCanNotBeFound`
  nếu thiếu trong info khi chạy).
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection. Nhưng `<from>` tham chiếu step — test chèn cần
  hop? Validator chỉ check hop tồn tại cho hop đã khai báo; template đơn
  lẻ không hop vẫn 0-error (reachability là warning).

Cấu hình không mặc định (Jaro-Winkler + case-sensitive + 2 cột trả về):

```xml
<caseSensitive>Y</caseSensitive>
<algorithm>jarowinkler</algorithm>
<lookup>
  <value>
    <name>CUST_NAME</name>
    <rename>CUSTOMER_NAME</rename>
  </value>
  <value>
    <name>CUST_ID</name>
    <rename>CUSTOMER_ID</rename>
  </value>
</lookup>
```

Fill bằng `set_fields` (`listTag=lookup`, `itemTag=value`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<from>` là tên step, cần hop info thật**: khác field thường — khi
  dùng production phải nối hop từ step lookup, nếu không runtime thiếu
  info stream.
- **`doublemataphone` giữ nguyên typo**: 1 chữ "e" (dòng 88) — sửa thành
  `doublemetaphone` sẽ rơi về `levenshtein` lặng lẽ.
- **Kiểu cột giá trị theo thuật toán** (dòng 461–476): Levenshtein/
  Damerau → Integer; Jaro/Jaro-Winkler/PairSimilarity → Number; phonetic
  → String. Downstream phải dùng đúng kiểu.
- **`<lookup>` luôn paired**: `getXML()` emit wrapper kể cả 0 value —
  giữ paired, không self-closing.
- Template mặc định là khung cấu hình — người dùng phải nối 2 hop có cột
  tồn tại; không chạy I/O khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan) — không tuyên bố hai mức này.
