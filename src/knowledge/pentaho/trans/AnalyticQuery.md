# AnalyticQuery — Step hàm phân tích LEAD/LAG theo nhóm

Với mỗi nhóm phân hoạch (`<group>`), tính các hàm phân tích nhìn
trước/nhìn sau trên các dòng đã sắp xếp: `LEAD` lấy giá trị của dòng đứng
SAU offset N, `LAG` lấy giá trị của dòng đứng TRƯỚC offset N. Mỗi hàm append
MỘT cột mới: clone `ValueMeta` của subject field rồi đổi tên thành
`<aggregate>`. Input phải được sort theo key nghiệp vụ TRƯỚC khi vào step
(dùng `SortRows`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>AnalyticQuery</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <group>
      <field>
        <name>{{PARTITION_FIELD}}</name>
      </field>
    </group>
    <fields>
      <field>
        <aggregate>{{OUTPUT_FIELD}}</aggregate>
        <subject>{{SUBJECT_FIELD}}</subject>
        <type>LEAD</type>
        <valuefield>1</valuefield>
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
| `<group>/<field>/<name>` | N | Mỗi field phân hoạch (partition) — hàm reset khi đổi nhóm (ví dụ `CUSTOMER_ID`). |
| `<fields>/<field>/<aggregate>` | Y | Tên field OUTPUT mới chứa kết quả hàm. |
| `<fields>/<field>/<subject>` | Y | Tên field INPUT mà hàm đọc — PHẢI tồn tại trong row trước, thiếu thì step fail `SubjectFieldNotFound` khi tính metadata. |
| `<fields>/<field>/<type>` | Y | `LEAD` (dòng sau) hoặc `LAG` (dòng trước). Giá trị lạ → load thành `0` = `LEAD`. |
| `<fields>/<field>/<valuefield>` | Y — LUÔN phải có và là số | Offset N (số dòng tiến/lùi). `readData()` gọi `Integer.parseInt(...)` KHÔNG null-guard (thiếu/không số → throw khi load). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ANALYTIC_QUERY` | `<type>` | `AnalyticQuery`. |
| `configuration.partition_fields[]` | `<group>/<field>/<name>` | Danh sách partition. |
| `configuration.functions[].output` | `<fields>/<field>/<aggregate>` | Tên field output mới. |
| `configuration.functions[].subject` | `<fields>/<field>/<subject>` | Field input (phải tồn tại). |
| `configuration.functions[].type` | `<fields>/<field>/<type>` | `LEAD` hoặc `LAG`. |
| `configuration.functions[].offset` | `<fields>/<field>/<valuefield>` | Số nguyên N. |

Hai list khác cấu trúc → fill RIÊNG: `set_fields`
(`listTag=group`, `itemTag=field`) và `set_fields` (`listTag=fields`,
`itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "AnalyticQuery", ...)` trong chính
  `AnalyticQueryMeta.java` (dòng 62–64),
  `categoryDescription = "...BaseStep.Category.Statistics"` (dòng 64) —
  KHÔNG có trong `engine/src/main/resources/kettle-steps.xml` (grep
  `AnalyticQuery` trong file này không trả kết quả). Registry presence
  là annotation evidence, XML evidence là serializer dưới đây.
- Class: `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/analyticquery/AnalyticQueryMeta.java`.
- Mã hàm: `TYPE_FUNCT_LEAD = 0`, `TYPE_FUNCT_LAG = 1` (dòng 69–70);
  `typeGroupCode = { "LEAD", "LAG" }` (dòng 72–73). `getType(String)`
  (dòng 229–241) match mã rồi long-desc, lạ trả `0` = LEAD (dòng 240).
- Serialization: `AnalyticQueryMeta.getXML()` (dòng 304–327) — emit
  `<group>` (dòng 307–313, mỗi `<field>` có `<name>`) rồi `<fields>`
  (dòng 315–324, mỗi `<field>` có `<aggregate>` dòng 318, `<subject>`
  dòng 319, `<type>` = `getTypeDesc()` dòng 320, `<valuefield>` int
  dòng 321). **KHÔNG có `<give_back_row>`.**
- Deserialization: `loadXML()` (dòng 180–182) gọi `readData()` (dòng
  199–227) — đếm `<field>` trong `<group>` (dòng 205) và `<fields>`
  (dòng 206), `allocate(sizegroup, nrfields)` (dòng 208); group đọc
  `name` (dòng 210–213); hàm đọc `aggregate`/`subject`/`type` (qua
  `getType`, dòng 216–218). **PITFALL (dòng 220):**
  `valueField[i] = Integer.parseInt(XMLHandler.getTagValue(fnode,
  "valuefield"))` — KHÔNG null-guard: `<field>` thiếu `<valuefield>`
  (hoặc không phải số) NÉM exception khi load (bọc thành
  `KettleXMLException`, dòng 223–226). Template LUÔN ghi `<valuefield>`
  số.
- Khởi tạo: `setDefault()` (dòng 257–263) — 0 group + 0 hàm
  (`allocate(0, 0)`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 265–302) GIỮ toàn bộ row
  cũ (`fields.addRowMeta(r)`, dòng 272) rồi APPEND một clone `ValueMeta`
  của subject cho mỗi hàm, đổi tên thành `<aggregate>` (dòng 277–285);
  subject KHÔNG tìm thấy → ném `KettleStepException`
  `SubjectFieldNotFound` (dòng 286–296). Worker `AnalyticQuery` (runtime)
  đệm N dòng để resolve LEAD/LAG trong từng partition; dòng ở biên
  partition thiếu đối tác cho NULL.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (partition theo khách hàng, LEAD tổng đơn sau):

```xml
<group>
  <field>
    <name>CUSTOMER_ID</name>
  </field>
</group>
<fields>
  <field>
    <aggregate>NEXT_ORDER_TOTAL</aggregate>
    <subject>ORDER_TOTAL</subject>
    <type>LEAD</type>
    <valuefield>1</valuefield>
  </field>
</fields>
```

Fill bằng `set_fields` riêng cho `group` và `fields`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<valuefield>` bắt buộc và phải là số nguyên**: thiếu hoặc không số
  → throw khi load (dòng 220). Không bao giờ lược tag này; đừng nhầm với
  `<valuefield>` chuỗi separator của `MemoryGroupBy`/`GroupBy`.
- **Input phải sort trước theo key nghiệp vụ**: LEAD/LAG là hàm vị trí
  dòng — sai thứ tự → kết quả sai lặng lẽ. Partition reset theo
  `<group>` nên key sort phải bao phủ partition field trước.
- **Subject phải tồn tại**: thiếu → `SubjectFieldNotFound`, step fail.
  Tên subject/output phân biệt chữ hoa-thường theo ValueMeta.
- **Không có `<give_back_row>`**: đừng copy từ `MemoryGroupBy`/`GroupBy`
  sang — `getXML()` ở đây không emit tag đó.
- **Chỉ 2 hàm**: `LEAD`/`LAG`. Mã lạ load thành LEAD (dòng 240) — kiểm
  tra chính tả, đừng đoán thêm `FIRST_VALUE`/`ROW_NUMBER` (source 9.4
  không có).
- Template mặc định là khung cấu hình — người dùng phải điền partition
  field, subject tồn tại và offset N; step 0 group/0 hàm (mặc định
  `setDefault()`) truyền row nguyên không thêm cột.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
