# UniqueRowsByHashSet — Step lọc dòng trùng bằng HashSet (không cần sort)

Với MỖI dòng đầu vào, băm các field so sánh (`<fields>/<field>/<name>`;
danh sách rỗng = so toàn bộ dòng) rồi giữ lại dòng ĐẦU TIÊN của mỗi hash,
loại các dòng trùng sau — KHÔNG yêu cầu sort trước (khác step `Unique`/
`UniqueRows` đòi sort). `store_values=Y` lưu cả giá trị dòng để so bằng
strict-equality thay vì chỉ so hash (tốn RAM hơn nhưng tránh va chạm hash).
Schema không đổi (lọc dòng, không thêm/bớt cột). Step không cần DB
connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>UniqueRowsByHashSet</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <store_values>N</store_values>
    <reject_duplicate_row>N</reject_duplicate_row>
    <error_description/>
    <fields>
      <field>
        <name>{{COMPARE_FIELD}}</name>
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
| `<store_values>` | N | `Y` = lưu giá trị dòng, so trùng bằng strict-equality (tránh va chạm hash, tốn RAM); `N` (mặc định) = chỉ so hash. |
| `<reject_duplicate_row>` | N | `Y` = đẩy dòng trùng ra error hop (kèm `<error_description>`); `N` (mặc định) = lặng lẽ loại. **Error hop CHỈ hoạt động khi `Y`.** |
| `<error_description>` | N (khi reject=Y) | Mô tả lỗi gắn cho dòng trùng đẩy ra error hop. |
| `<fields>/<field>/<name>` | N | Field tham gia so trùng. Danh sách rỗng = so TOÀN BỘ dòng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: UNIQUE_ROWS_BY_HASH_SET` | `<type>` | `UniqueRowsByHashSet`. |
| `configuration.store_values` | `<store_values>` | Boolean → Y/N. |
| `configuration.reject_duplicates` | `<reject_duplicate_row>` | Boolean → Y/N. |
| `configuration.error_description` | `<error_description>` |  |
| `configuration.compare_fields[]` | `<fields>/<field>/<name>` | Rỗng = so cả dòng. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 90 —
  `<step id="UniqueRowsByHashSet">` →
  `org.pentaho.di.trans.steps.uniquerowsbyhashset.UniqueRowsByHashSetMeta`
  (category Transform). Registry presence không phải XML evidence, evidence
  là serializer dưới đây.
- Serialization: `UniqueRowsByHashSetMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/uniquerowsbyhashset/UniqueRowsByHashSetMeta.java`
  dòng 176–191) — thứ tự `store_values` (Y/N), `reject_duplicate_row`
  (Y/N), `error_description`, rồi wrapper `<fields>` LUÔN emit (dòng
  182/188); mỗi `<field>` chỉ có `<name>` (dòng 185).
- Deserialization: `loadXML()` (dòng 122–124) gọi `readData()` (dòng
  137–158) — 2 cờ Y-check (thiếu → false, dòng 139–140);
  `error_description` nguyên văn (dòng 141); list đọc từ sub-node
  `<fields>` (dòng 143–152).
- Khởi tạo: `setDefault()` (dòng 160–170) — `rejectDuplicateRow=false`,
  `errorDescription=null`, 0 field (`allocate(0)`); `storeValues` không set
  (false).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: dedup bằng HashSet trên `compareFields` (null/rỗng =
  so toàn bộ dòng, comment dòng 56); `getFields()` RỖNG (dòng 172–174) —
  output schema = input; KHÔNG yêu cầu sort trước. `check()` (dòng 225–241)
  chỉ đòi có input.

Cấu hình không mặc định (dedup customer theo id + email, đẩy trùng ra
error hop):

```xml
<store_values>N</store_values>
<reject_duplicate_row>Y</reject_duplicate_row>
<error_description>Duplicate customer row</error_description>
<fields>
  <field>
    <name>CUST_ID</name>
  </field>
  <field>
    <name>CUST_EMAIL</name>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Error hop CHỈ hoạt động khi `reject_duplicate_row=Y`**:
  `supportsErrorHandling()` trả về `isRejectDuplicateRow()` (dòng
  252–254) — để `N` mà vẫn vẽ error hop thì hop không bao giờ có dòng
  (khác các step luôn `return true`). Template mặc định `N` + không vẽ
  error hop.
- **Không thêm/bớt cột**: `getFields()` rỗng — đừng khai báo output field
  mới ở step này; cần thêm cột thì dùng step khác sau đó.
- **Danh sách rỗng = so cả dòng**: không khai báo `<field>` nào thì hai
  dòng chỉ trùng khi MỌI cột bằng nhau — hẹp list lại khi chỉ cần dedup
  theo key.
- **Không cần sort (khác `Unique`)**: step `Unique`/`UniqueRows` chỉ phát
  hiện trùng KỀ NHAU nên đòi sort trước; HashSet này nhớ mọi hash đã thấy
  nên thứ tự bất kỳ vẫn đúng — nhưng tốn RAM theo số dòng distinct (cân
  nhắc `store_values=Y` càng tốn hơn).
- **Hash va chạm (hiếm)**: `store_values=N` so hash có thể coi hai dòng
  khác nhau là trùng khi va chạm; dữ liệu không cho phép sai sót thì bật
  `store_values=Y` để so strict-equality.
- Đừng nhầm với step `Unique`/`UniqueRows` (B6, sort + so kề nhau) khi
  chọn step và khi đặt alias (`UNIQUE_ROWS_BY_HASH_SET` tách `HashSet`
  thành `HASH_SET` đúng tên XML type).
- Template mặc định là khung cấu hình — người dùng phải điền compare field
  tồn tại trong stream trước (hoặc để rỗng có chủ ý để so cả dòng).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
