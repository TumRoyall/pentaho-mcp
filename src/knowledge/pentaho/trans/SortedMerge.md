# SortedMerge — Step trộn các luồng đã sort

Trộn NHIỀU luồng đầu vào đã được sort sẵn thành một luồng ra duy nhất
giữ nguyên thứ tự. Step KHÔNG sort lại dữ liệu — mọi luồng vào phải sort
trước theo đúng các key/direction khai báo (dùng `SortRows`). `getFields()`
KHÔNG thêm/bớt cột: nó chỉ gắn cờ direction (`setSortedDescending`) lên
các cột input đã tồn tại — output schema = input schema.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SortedMerge</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <name>{{SORT_KEY_1}}</name>
        <ascending>Y</ascending>
      </field>
      <field>
        <name>{{SORT_KEY_2}}</name>
        <ascending>N</ascending>
      </field>
    </fields>
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
| `<fields>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Tên cột sort key — phải tồn tại trong MỌI luồng đầu vào (`check()` ERROR `SortKeysNotFound` nếu thiếu). |
| `<fields>/<field>/<ascending>` | Y — LUÔN phải có | `Y` = tăng dần, `N` = giảm dần cho key đó. `readData()` gọi `asc.equalsIgnoreCase("Y")` KHÔNG null-guard (thiếu tag → NPE). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SORTED_MERGE` | `<type>` | `SortedMerge`. |
| `configuration.sort_keys[].field` | `<fields>/<field>/<name>` | Key sort theo thứ tự ưu tiên. |
| `configuration.sort_keys[].ascending` | `<fields>/<field>/<ascending>` | Boolean → Y/N. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 50 —
  `<step id="SortedMerge">` →
  `org.pentaho.di.trans.steps.sortedmerge.SortedMergeMeta` (category
  Joins). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SortedMergeMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/sortedmerge/SortedMergeMeta.java`
  dòng 125–138) — chỉ emit DUY NHẤT một block `<fields>` (dòng 128–135);
  mỗi `<field>` có `<name>` (dòng 131) và `<ascending>` boolean Y/N qua
  `XMLHandler.addTagValue` (dòng 132). Không có tag nào khác.
- Deserialization: `loadXML()` (dòng 71–73) gọi `readData()` (dòng
  102–123) — đếm `<field>` trong sub-node `<fields>` (dòng 104–105),
  `allocate(nrfields)` (dòng 107), mỗi `<field>` đọc `name` (dòng 112)
  và `ascending` (dòng 113); `asc.equalsIgnoreCase("Y")` (dòng 114)
  KHÔNG null-guard — `<field>` thiếu `<ascending>` NÉM NPE (bọc thành
  `KettleXMLException`, dòng 120–122).
- Khởi tạo: `setDefault()` (dòng 80–88) — `nrfields = 0` rồi
  `allocate(0)`: step mới có 0 sort key (phải cấu hình mới chạy được;
  `check()` ERROR `NoSortKeysEntered` khi rỗng, dòng 213–220).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 166–179) duyệt
  `fieldName[]`, tìm từng key trong input row và gọi
  `valueMeta.setSortedDescending(!ascending[i])` (dòng 170–177) — chỉ
  gắn cờ direction, không thêm/bớt cột. Worker `SortedMerge` (runtime)
  hợp nhất các luồng vào đã sort; nếu luồng vào chưa sort đúng thứ tự
  thì kết quả SAI mà không báo lỗi. `check()` (dòng 181–241) yêu cầu có
  input (`ExpectedInputError` khi không có, dòng 230–240) và mọi key tồn
  tại trong row trước đó.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 key sort ngược chiều):

```xml
<fields>
  <field>
    <name>CUSTOMER_ID</name>
    <ascending>Y</ascending>
  </field>
  <field>
    <name>ORDER_DATE</name>
    <ascending>N</ascending>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Mọi luồng vào phải sort trước**: SortedMerge không sort — mỗi luồng
  vào phải qua `SortRows` với ĐÚNG key và ĐÚNG direction đã khai báo.
  Sai thứ tự → output sai lặng lẽ.
- **`<ascending>` bắt buộc trên MỌI `<field>`**: thiếu tag → NPE khi load
  (dòng 114). Không bao giờ lược `<ascending>` kể cả khi chỉ có 1 key.
- **Không bịa thêm tag**: `getXML()` chỉ emit `<fields>` — không có
  `<group>`, `<connection>`, `<give_back_row>` hay cờ case-sensitivity
  (TODO dòng 175 trong `getFields()` ghi rõ case-insensitivity chưa làm).
- **Layout cột các luồng vào phải khớp**: merge theo vị trí schema —
  luồng vào thiếu key hoặc khác kiểu sẽ fail hoặc cho kết quả sai.
- Template mặc định là khung cấu hình — người dùng phải điền sort key
  tồn tại trong stream trước và đảm bảo các luồng vào đã sort; step 0 key
  (mặc định `setDefault()`) không chạy được.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
