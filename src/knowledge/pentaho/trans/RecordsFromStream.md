# RecordsFromStream — Step đọc result rows (bản streaming)

Step đọc các dòng mà transformation/job trước đã đặt vào result rows và
phát nguyên vẹn ra stream — XML và runtime KẾ THỪA 100% từ
`RowsFromResult` (`RecordsFromStreamMeta extends RowsFromResultMeta`,
không override gì). Chỉ khác ID đăng ký (`RecordsFromStream`, category
Streaming) và mục đích: nhận record từ streaming sub-trans thay vì result
thường. Mọi bảng field/mapping xem reference `RowsFromResult`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RecordsFromStream</type>
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
        <name>{{FIELD_1}}</name>
        <type>String</type>
        <length>-2</length>
        <precision>-2</precision>
      </field>
      <field>
        <name>{{FIELD_2}}</name>
        <type>Integer</type>
        <length>10</length>
        <precision>0</precision>
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
| `<fields>/<field>/<name>` | Y | Tên field khai báo metadata (xem `RowsFromResult` mục 2 — khai báo, không convert runtime). |
| `<fields>/<field>/<type>` | Y | Tên kiểu ValueMeta (`String`, `Integer`, …). |
| `<fields>/<field>/<length>` / `<precision>` | Y | Số nguyên; thiếu tag khi load → `-2`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RECORDS_FROM_STREAM` | `<type>` | `RecordsFromStream` (không phải `RowsFromResult`). |
| `configuration.fields[].name` / `type` / `length` / `precision` | `<fields>/<field>/…` | Giống `RowsFromResult`; `set_fields` (`listTag=fields`, `itemTag=field`). |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 40 —
  `<step id="RecordsFromStream">` →
  `org.pentaho.di.trans.steps.recordsfromstream.RecordsFromStreamMeta`
  (category Streaming). Registry presence không phải XML evidence,
  evidence là kế thừa dưới đây.
- Implementation: `engine/src/main/java/org/pentaho/di/trans/steps/recordsfromstream/RecordsFromStreamMeta.java`
  toàn file 28 dòng — class `extends RowsFromResultMeta`, KHÔNG override
  method nào (dòng 27). Mọi `getXML()`/`loadXML()`/`setDefault()`/
  `getFields()`/`processRow()` đều là của `RowsFromResultMeta`
  (`engine/src/main/java/org/pentaho/di/trans/steps/rowsfromresult/RowsFromResultMeta.java`):
  fragment duy nhất `<fields>` (getXML dòng 152–166), load qua `readData()`
  (dòng 168–182, `length`/`precision` thiếu → `-2`), `setDefault()`
  `allocate(0)` (dòng 184–186). Chi tiết xem reference `RowsFromResult`
  mục 4.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn; `<type>` = `RecordsFromStream` (ID riêng).
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (2 field khai báo như template trên). Fill bằng
`set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy

- **Đừng nhầm với `RowsFromResult` khi điền `<type>`**: XML giống hệt
  nhưng `<type>` phải là `RecordsFromStream` — sai ID là step khác.
- **Không có input hop**: kế thừa `check()` ERROR khi có input (xem
  `RowsFromResult` mục 5).
- **Khai báo ≠ convert**: `<fields>` chỉ là metadata khai báo (xem
  `RowsFromResult` mục 5).
- Template mặc định là khung cấu hình — người dùng phải điền field khớp
  result rows của streaming sub-trans; không chạy I/O khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu đăng ký + kế thừa (0
  override) + serializer của `RowsFromResultMeta` tại commit đã ghim ở
  mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan) — không tuyên bố hai mức này.
