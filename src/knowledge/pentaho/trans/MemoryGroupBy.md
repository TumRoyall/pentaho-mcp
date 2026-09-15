# MemoryGroupBy — Step gom nhóm trong bộ nhớ (không cần sort trước)

Gom nhóm và tính aggregate HOÀN TOÀN trong bộ nhớ — khác `GroupBy`
(dùng file tạm + yêu cầu input sort) và khác `GroupBy` ở chỗ KHÔNG có các
tag `all_rows`/`directory`/`prefix`/`add_linenr`. Khai báo các field group
(`<group>`) và các hàm aggregate (`<fields>`); `getFields()` XÂY LẠI row:
giữ các group field rồi thêm một value meta mới cho mỗi aggregate với kiểu
suy từ loại hàm.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MemoryGroupBy</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <give_back_row>N</give_back_row>
    <group>
      <field>
        <name>{{GROUP_FIELD}}</name>
      </field>
    </group>
    <fields>
      <field>
        <aggregate>{{OUTPUT_FIELD}}</aggregate>
        <subject>{{SUBJECT_FIELD}}</subject>
        <type>SUM</type>
        <valuefield/>
      </field>
      <field>
        <aggregate>{{LIST_FIELD}}</aggregate>
        <subject>{{TEXT_FIELD}}</subject>
        <type>CONCAT_STRING</type>
        <valuefield>{{SEPARATOR}}</valuefield>
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
| `<give_back_row>` | N | `Y` = luôn trả ít nhất một row (kể cả input rỗng — đúng semantics SQL `GROUP BY` cho COUNT); `N` = input rỗng thì không trả row. |
| `<group>/<field>/<name>` | N | Mỗi field gom nhóm — phải tồn tại trong row trước (thiếu thì group đó bị bỏ qua lặng lẽ ở `getFields()`). |
| `<fields>/<field>/<aggregate>` | Y | Tên field OUTPUT mới chứa kết quả hàm. |
| `<fields>/<field>/<subject>` | Y (trừ `COUNT_ANY`) | Tên field INPUT mà hàm tính trên; `COUNT_ANY` không cần subject tồn tại. |
| `<fields>/<field>/<type>` | Y | Mã aggregate DẠNG CHUỖI từ `typeGroupCode`: `-`, `SUM`, `AVERAGE`, `MEDIAN`, `PERCENTILE`, `MIN`, `MAX`, `COUNT_ALL`, `CONCAT_COMMA`, `FIRST`, `LAST`, `FIRST_INCL_NULL`, `LAST_INCL_NULL`, `STD_DEV`, `CONCAT_STRING`, `COUNT_DISTINCT`, `COUNT_ANY`. Mã lạ → load thành `0` = `-` (NONE). |
| `<fields>/<field>/<valuefield>` | N | CHUỖI bổ sung — separator cho `CONCAT_STRING` (ví dụ `;`); các hàm khác bỏ qua. Không phải số. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MEMORY_GROUP_BY` | `<type>` | `MemoryGroupBy`. |
| `configuration.give_back_row` | `<give_back_row>` | Boolean → Y/N. |
| `configuration.group_fields[]` | `<group>/<field>/<name>` | Danh sách group. |
| `configuration.aggregates[].output` | `<fields>/<field>/<aggregate>` | Tên field output mới. |
| `configuration.aggregates[].subject` | `<fields>/<field>/<subject>` | Field input (trừ `COUNT_ANY`). |
| `configuration.aggregates[].type` | `<fields>/<field>/<type>` | Mã chuỗi `typeGroupCode`. |
| `configuration.aggregates[].valuefield` | `<fields>/<field>/<valuefield>` | Chuỗi separator cho `CONCAT_*`. |

Hai list khác cấu trúc → fill RIÊNG: `set_fields`
(`listTag=group`, `itemTag=field`) và `set_fields` (`listTag=fields`,
`itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 48 —
  `<step id="MemoryGroupBy">` →
  `org.pentaho.di.trans.steps.memgroupby.MemoryGroupByMeta` (category
  Statistics). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `MemoryGroupByMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/memgroupby/MemoryGroupByMeta.java`
  dòng 444–469) — thứ tự `<give_back_row>` Y/N (dòng 447) ĐẦU TIÊN, rồi
  `<group>` (dòng 449–455, mỗi `<field>` có `<name>`), rồi `<fields>`
  (dòng 457–466, mỗi `<field>` có `<aggregate>` dòng 460, `<subject>`
  dòng 461, `<type>` = `getTypeDesc()` chuỗi dòng 462, `<valuefield>`
  chuỗi dòng 463).
- Mã type: `typeGroupCode` (dòng 102–105) — 17 mã chuỗi kể ở mục 2.
  `getType(String)` (dòng 298–310) match mã (dòng 299–303) rồi long-desc
  (dòng 304–308), mã lạ trả `0` = `"-"` (dòng 309): **`<type>` là chuỗi,
  không phải số**.
- Deserialization: `loadXML()` (dòng 229–231) gọi `readData()` (dòng
  256–296) — đếm `<field>` trong `<group>` (dòng 261) và `<fields>`
  (dòng 262), `allocate(sizegroup, nrfields)` (dòng 264); group đọc
  `name` (dòng 266–269); aggregate đọc `aggregate`/`subject`/`type`
  (qua `getType`, dòng 274–276) và `valuefield` chuỗi (dòng 283).
  **Fallback `give_back_row` (dòng 286–291):** tag thiếu/rỗng →
  `alwaysGivingBackOneRow = hasNumberOfValues` (true nếu CÓ aggregate
  `COUNT_ALL`/`COUNT_DISTINCT`/`COUNT_ANY`, dòng 278–281) — KHÔNG phải
  hard false. `readRep()` có fallback tương tự (dòng 496).
- Khởi tạo: `setDefault()` (dòng 327–332) — 0 group + 0 aggregate
  (`allocate(0, 0)`); cờ boolean Java mặc định false → template mới mang
  `<give_back_row>N</give_back_row>`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 335–441) XÂY LẠI row —
  group field tìm thấy được carry qua (dòng 347–353, thiếu thì bỏ qua),
  mỗi aggregate sinh một value meta mới tên = `<aggregate>` (dòng
  357–435) với kiểu theo loại hàm: `FIRST/LAST/MIN/MAX` giữ kiểu subject;
  `COUNT_*` → Integer; `CONCAT_COMMA`/`CONCAT_STRING` → String;
  `SUM`/`AVERAGE` giữ kiểu số của subject (trừ compatibility-mode thì
  Number); `MEDIAN`/`PERCENTILE`/`STD_DEV` → Number; rồi `r.clear()` +
  `r.addRowMeta(fields)` (dòng 439–440). Mọi aggregate giữ trong bộ nhớ
  — group cardinality lớn có thể tràn RAM (đó là lý do tồn tại song song
  `GroupBy` dùng file tạm).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (1 group + SUM và CONCAT_STRING có separator):

```xml
<give_back_row>Y</give_back_row>
<group>
  <field>
    <name>REGION</name>
  </field>
</group>
<fields>
  <field>
    <aggregate>TOTAL_SALES</aggregate>
    <subject>SALES</subject>
    <type>SUM</type>
    <valuefield/>
  </field>
  <field>
    <aggregate>PRODUCT_LIST</aggregate>
    <subject>PRODUCT</subject>
    <type>CONCAT_STRING</type>
    <valuefield>;</valuefield>
  </field>
</fields>
```

Fill bằng `set_field` (`give_back_row`) + `set_fields` riêng cho `group`
và `fields`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<type>` là mã chuỗi, không phải số**: ghi `5` thay vì `MIN` sẽ bị
  `getType()` match hụt → `0` = `-` (NONE) lặng lẽ, aggregate không tính.
- **`<valuefield>` là chuỗi separator, không phải int**: chỉ `CONCAT_STRING`
  (và theo dialog là `CONCAT_COMMA`) dùng tới; đừng nhầm với offset số
  của `AnalyticQuery`.
- **Thiếu `<give_back_row>` không có nghĩa là `N`**: fallback = "có COUNT_*
  aggregate không" (dòng 286–291). Muốn chắc chắn thì luôn ghi rõ Y/N.
- **Không cần sort trước** (khác `GroupBy` với `all_rows=N`), nhưng đánh
  đổi bằng RAM — group key cardinality lớn thì dùng `GroupBy`.
- **Subject thiếu thì aggregate đó bị loại lặng lẽ** (trừ `COUNT_ANY`,
  dòng 359) — kiểm tra tên subject tồn tại trong stream trước.
- Template mặc định là khung cấu hình — người dùng phải điền group field
  và aggregate có thật; step 0 group/0 aggregate (mặc định `setDefault()`)
  không làm gì.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
