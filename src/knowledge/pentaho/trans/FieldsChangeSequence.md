# FieldsChangeSequence — Step đánh số thứ tự khi nhóm field đổi giá trị

Theo dõi các cột liệt kê trong `<fields>/<field>/<name>`; MỖI khi tổ hợp
giá trị đổi so với dòng trước, tăng sequence (`start` + n×`increment`,
parse `Const.toInt(...,1)` lúc chạy) và ghi vào cột mới
`<resultfieldName>` (Integer). Dòng đầu tiên luôn lấy `start`. Output =
input + 1 cột sequence.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FieldsChangeSequence</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <start>1</start>
    <increment>1</increment>
    <resultfieldName>SEQ</resultfieldName>
    <fields>
      <field>
        <name>{{WATCH_FIELD_1}}</name>
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
| `<start>` | N | Giá trị khởi đầu, chuỗi số; mặc định `"1"`. Parse `Const.toInt(...,1)` lúc chạy. |
| `<increment>` | N | Bước tăng, chuỗi số; mặc định `"1"`. |
| `<resultfieldName>` | Y | Tên cột sequence (Integer). Mặc định mới null — phải điền mới có cột. `check()` ERROR khi rỗng. |
| `<fields>/<field>/<name>` | Y (≥1) | Cột theo dõi thay đổi. Mỗi `<field>` CHỈ có `<name>` (không type/length). |

`<fields>` paired list name-only — giữ paired (self-closing làm
`setFields` ném lỗi theo bẫy chung).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FIELDS_CHANGE_SEQUENCE` | `<type>` | `FieldsChangeSequence`. |
| `configuration.start` | `<start>` | Chuỗi số. |
| `configuration.increment` | `<increment>` | Chuỗi số. |
| `configuration.result_field` | `<resultfieldName>` | Cột sequence. |
| `configuration.watch_fields[]` | `<fields>/<field>/<name>` | Cột theo dõi. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 103 —
  `<step id="FieldsChangeSequence">` → `...fieldschangesequence.FieldsChangeSequenceMeta`
  (category Transform).
- Serialization: `getXML()` (dòng 161–176) — `start` (163),
  `increment` (164), `resultfieldName` camelCase N hoa (165), block
  `<fields>` (167–173; mỗi `<field>` chỉ `<name>` 170).
- Deserialization: `readData()` (dòng 140–158) — đọc nguyên văn 3 tag,
  đếm `<field>` (146–147).
- Khởi tạo: `setDefault()` (dòng 179–190) — start/increment `"1"`,
  result null, 0 field.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker `FieldsChangeSequence` (dòng 101–136) —
  `startAt`/`incrementBy` qua `Const.toInt(...,1)` (101–102);
  `seq = startAt` dòng đầu (103), reset khi đổi nhóm (123), `+=
  incrementBy` khi đổi (136). `getFields()` (227–228) append Integer
  khi result không rỗng. `check()` đòi result + field tồn tại trong prev
  (242–280).
- Không có `<connection>`.

Cấu hình không mặc định (2 cột theo dõi, bước 10):

```xml
<start>100</start>
<increment>10</increment>
<resultfieldName>CUSTOMER_SEQ</resultfieldName>
<fields>
  <field>
    <name>CUSTOMER_ID</name>
  </field>
  <field>
    <name>REGION</name>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Mỗi `<field>` chỉ có `<name>`** — đừng bịa thêm `<type>` (load bỏ
  qua, nhưng template sai evidence).
- **Tag `resultfieldName` camelCase** (f thường, N hoa — đúng như
  `getXML()` dòng 165) — viết `resultFieldName` hoa F load null.
- Dữ liệu nên SORT trước theo cột theo dõi — đổi thứ tự làm sequence
  nhảy sai.
- Không có `<connection>`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
