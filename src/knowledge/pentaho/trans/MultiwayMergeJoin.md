# MultiwayMergeJoin — Step join N luồng đã sort

Join NHIỀU luồng đầu vào (2+) đã sort sẵn theo cùng key thành một luồng ra
(`INNER` hoặc `FULL OUTER`). Mở rộng của `MergeJoin` (chỉ 2 luồng):
danh sách step vào là các tag ĐỘNG `<step0>`, `<step1>`, … (tên tag đổi
theo index — không phải list `<step>` lặp), số lượng trong
`<number_input>` (int, parse KHÔNG null-guard — thiếu là ném lỗi), key
chung trong `<keys>/<key>`. Mọi luồng vào phải sort trước theo đúng key.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MultiwayMergeJoin</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <join_type>INNER</join_type>
    <step0>{{INPUT_STEP_1}}</step0>
    <step1>{{INPUT_STEP_2}}</step1>
    <number_input>2</number_input>
    <keys>
      <key>{{JOIN_KEY}}</key>
    </keys>
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
| `<join_type>` | N | `INNER` (mặc định) / `FULL OUTER` (hoa, có dấu cách). |
| `<step0>`…`<stepN>` | Y | TÊN STEP đầu vào thứ i — TÊN TAG ĐỘNG theo index (`step` + số). Các step phải tồn tại + có hop tới. |
| `<number_input>` | Y | Số luồng vào (int, phải khớp số tag `<stepN>`). Parse `Integer.parseInt` KHÔNG null-guard — thiếu tag NÉM LỖI (xem bẫy). |
| `<keys>/<key>` | Y (ít nhất 1 khi chạy) | Key join chung — phải tồn tại trong MỌI luồng vào đã sort. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MULTIWAY_MERGE_JOIN` | `<type>` | `MultiwayMergeJoin`. |
| `configuration.join_type` | `<join_type>` | `INNER`/`FULL OUTER`. |
| `configuration.input_steps[]` | `<step0>`…`<stepN>` + `<number_input>` | Tag động theo index; KHÔNG phải list `set_fields` (mỗi tag tên khác nhau — fill từng `setFieldPath` hoặc thay block). |
| `configuration.keys[]` | `<keys>/<key>` | `set_fields` (`listTag=keys`, `itemTag=key`). |

`<keys>` chứa list `<key>` đồng nhất → fill bằng MỘT lần `set_fields`
(`listTag=keys`, `itemTag=key`). Riêng `<stepN>` là tag động — không dùng
`set_fields` được.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 121 —
  `<step id="MultiwayMergeJoin">` →
  `org.pentaho.di.trans.steps.multimerge.MultiMergeJoinMeta`. Registry
  presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `MultiMergeJoinMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/multimerge/MultiMergeJoinMeta.java`
  dòng 148–165) — `join_type` (dòng 152), rồi các tag ĐỘNG `step+i`
  (dòng 153–155), `number_input` = số step (dòng 157), block `<keys>`
  mở bằng `openTag`/đóng `closeTag` (dòng 158–162) với `<key>` mỗi dòng
  (dòng 160).
- Deserialization: `loadXML()` (dòng 127–129) gọi `readData()` (dòng
  167–194) — key đọc qua `getNodeValue` (text node, dòng 178);
  **`number_input` parse `Integer.parseInt` KHÔNG null-guard** (dòng
  181): thiếu tag → `NumberFormatException` (bọc `KettleXMLException`,
  dòng 190–193); step vào đọc `step+i` theo số lượng (dòng 185–187).
- Mã join: `join_types = {INNER, FULL OUTER}` (dòng 65);
  `setDefault()` (dòng 197–201) đặt `INNER` + 0 key + 0 step.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `excludeFromRowLayoutVerification() = true` (dòng
  117–120); mọi luồng vào phải sort trước theo key (class `MultiMergeJoin`
  runtime) — sai thứ tự cho kết quả sai lặng lẽ.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (3 luồng FULL OUTER + 2 key):

```xml
<join_type>FULL OUTER</join_type>
<step0>SORTED_ORDERS</step0>
<step1>SORTED_CUSTOMERS</step1>
<step2>SORTED_PRODUCTS</step2>
<number_input>3</number_input>
<keys>
  <key>REGION_ID</key>
  <key>YEAR_NO</key>
</keys>
```

`<keys>` fill bằng `set_fields` (`listTag=keys`, `itemTag=key`).

## 5. Lưu ý / bẫy — CRITICAL

- **Thiếu `<number_input>` NÉM LỖI**: `Integer.parseInt(null)` (dòng
  181) — template LUÔN ghi tag này (không bao giờ lược). Lệch số với tag
  `<stepN>` thực tế cũng sai.
- **Tag step ĐỘNG (`step0`, `step1`, …)**: không phải `<step>` lặp —
  đừng viết `<steps><step>…` wrapper; `set_fields` không xử lý được (mỗi
  tag tên khác nhau).
- **`FULL OUTER` có dấu cách**: giữ đúng `FULL OUTER` (dòng 65), không
  gạch dưới.
- **Mọi luồng vào phải sort trước**: như `SortedMerge`/`MergeJoin` —
  step không sort, sai thứ tự cho kết quả sai lặng lẽ.
- Template mặc định là khung cấu hình — người dùng phải nối hop đã sort
  với key tồn tại; không chạy I/O khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan) — không tuyên bố hai mức này.
