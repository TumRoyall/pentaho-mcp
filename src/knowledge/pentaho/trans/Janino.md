# Janino — Step tính biểu thức Java (User Defined Java Expression)

Tính một hoặc nhiều biểu thức Java (Janino) trên MỖI dòng đầu vào, ghi
kết quả vào cột mới (hoặc thay cột có sẵn khi `<replace_field>` trỏ tới
cột đó). Mỗi công thức là một block `<formula>` TRỰC TIẾP dưới `<step>`
(KHÔNG bọc trong `<fields>`): `field_name`, `formula_string`,
`value_type` (chuỗi value-meta), `value_length`, `value_precision`,
`replace_field`. Output = input + các cột công thức.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Janino</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <formula>
      <field_name>{{RESULT_FIELD}}</field_name>
      <formula_string>((String){{INPUT_FIELD}}).toUpperCase()</formula_string>
      <value_type>String</value_type>
      <value_length>-1</value_length>
      <value_precision>-1</value_precision>
      <replace_field/>
    </formula>
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
| `<formula>/<field_name>` | Y | Tên cột kết quả. |
| `<formula>/<formula_string>` | Y | Biểu thức Janino/Java (giữ nguyên văn, XML-escape `<`/`&`). |
| `<formula>/<value_type>` | N | Chuỗi value-meta (`String`, `Integer`, `Number`, ...). |
| `<formula>/<value_length>` / `<value_precision>` | N | Số; mặc định -1/-1. |
| `<formula>/<replace_field>` | N | Tên cột bị thay — để trống = thêm cột mới. |

Nhiều `<formula>` ngang hàng khi có nhiều công thức (không bọc list).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: JANINO` | `<type>` | `Janino`. |
| `configuration.formulas[].result_field` | `<formula>/<field_name>` | Cột kết quả. |
| `configuration.formulas[].expression` | `<formula>/<formula_string>` | Giữ nguyên văn. |
| `configuration.formulas[].value_type` | `<formula>/<value_type>` | Chuỗi value-meta. |

Mỗi công thức là một block `<formula>` lặp — fill từng block (không phải
`set_fields` listTag/itemTag chuẩn).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 87 —
  `<step id="Janino">` →
  `org.pentaho.di.trans.steps.janino.JaninoMeta` (category Scripting).
- Item: `JaninoMetaFunction.XML_TAG = "formula"` (dòng 37);
  `getXML()` (dòng 88–103): `field_name` (93), `formula_string` (94),
  `value_type` chuỗi qua `getValueMetaName` (95), `value_length` (96),
  `value_precision` (97), `replace_field` (98), bọc
  `<formula>` (91/100).
- Đếm khi load: `loadXML()` (dòng 84–91) đếm TRỰC TIẾP `<formula>`
  dưới step node (85), `allocate(n)` (86) — KHÔNG qua `<fields>`.
- Khởi tạo: `setDefault()` (dòng 132–134) — 0 công thức.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker biên dịch từng `formula_string` bằng Janino;
  `replace_field` trỏ cột có sẵn thì ghi đè, ngược lại append cột mới.
- Không có `<connection>`.

Cấu hình không mặc định (2 công thức, 1 thay cột):

```xml
<formula>
  <field_name>AMOUNT_NET</field_name>
  <formula_string>AMOUNT * 0.9</formula_string>
  <value_type>Number</value_type>
  <value_length>-1</value_length>
  <value_precision>2</value_precision>
  <replace_field/>
</formula>
<formula>
  <field_name>STATUS</field_name>
  <formula_string>STATUS == null ? "NEW" : STATUS</formula_string>
  <value_type>String</value_type>
  <value_length>20</value_length>
  <value_precision>-1</value_precision>
  <replace_field>STATUS</replace_field>
</formula>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Không có `<fields>`**: `<formula>` nằm trực tiếp dưới `<step>` —
  bọc trong `<fields>` sẽ load 0 công thức lặng lẽ (đếm ở step node,
  dòng 85).
- **Biểu thức XML-escape**: `<`, `>`, `&` trong Java phải escape
  (`&lt;`, `&gt;`, `&amp;`) — template/addElement tự escape khi chèn
  qua API.
- Không có `<connection>` — fixture không cần khai báo connection.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
