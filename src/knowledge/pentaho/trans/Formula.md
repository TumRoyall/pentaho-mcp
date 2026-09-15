# Formula — Step tính biểu thức libformula theo từng trường

Tính một biểu thức (powered by libformula) cho MỖI trường khai báo: mỗi
block `<formula>` mang tên trường ra (`<field_name>`), chuỗi biểu thức
(`<formula_string>`), kiểu/độ dài/độ chính xác của kết quả, và tên trường bị
thay thế (`<replace_field>` — rỗng = tạo trường MỚI, có tên = ghi đè trường
đó tại chỗ). `getFields()` thêm value meta mới hoặc thay kiểu trường cũ.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Formula</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <formula>
      <field_name>{{OUTPUT_FIELD}}</field_name>
      <formula_string>{{EXPRESSION}}</formula_string>
      <value_type>Number</value_type>
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
| `<formula>/<field_name>` | Y | Tên trường kết quả (trường mới khi `<replace_field>` rỗng). |
| `<formula>/<formula_string>` | Y | Biểu thức libformula (tham chiếu cột bằng `[TÊN_CỘT]`); XML-escape `<`/`&`. |
| `<formula>/<value_type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Number`, `Integer`, `Date`, …) — không phải số id. |
| `<formula>/<value_length>` | N | Độ dài; thiếu tag load thành `-1`. |
| `<formula>/<value_precision>` | N | Độ chính xác thập phân; thiếu tag load thành `-1`. |
| `<formula>/<replace_field>` | N | Rỗng = tạo trường mới; có tên = ghi đè TRƯỜNG ĐÓ (phải tồn tại, nếu không `getFields()` ném lỗi). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FORMULA` | `<type>` | `Formula`. |
| `configuration.formulas[].field` | `<formula>/<field_name>` | Trường kết quả. |
| `configuration.formulas[].expression` | `<formula>/<formula_string>` | Biểu thức, giữ nguyên văn + escape. |
| `configuration.formulas[].value_type` | `<formula>/<value_type>` | Tên value-meta chuỗi. |
| `configuration.formulas[].length/precision` | `<formula>/<value_length>` / `<value_precision>` | Số; `-1` = mặc định. |
| `configuration.formulas[].replace_field` | `<formula>/<replace_field>` | Rỗng = trường mới. |

Các `<formula>` là tag lặp TRỰC TIẾP dưới `<step>` (KHÔNG có wrapper
`<fields>`) — mỗi công thức là một block `<formula>` riêng. Không có scalar
cấp step; công thức mới sửa trực tiếp block `<formula>`
(`formula/<tag>`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 86 —
  `<step id="Formula">` →
  `org.pentaho.di.trans.steps.formula.FormulaMeta` (category Scripting).
  Registry presence không phải XML evidence, evidence là serializer dưới
  đây.
- Serialization: `FormulaMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/formula/FormulaMeta.java`
  dòng 91–101) — KHÔNG emit scalar nào, chỉ lặp các block
  `formula[i].getXML()` (dòng 94–98). `FormulaMetaFunction.getXML()`
  (`.../formula/FormulaMetaFunction.java` dòng 97–112) mở tag `formula`
  (`XML_TAG`, dòng 37/100) và emit theo thứ tự: `field_name` (dòng 102),
  `formula_string` (dòng 103), `value_type` (tên value-meta chuỗi qua
  `ValueMetaFactory.getValueMetaName`, dòng 104), `value_length` (dòng
  105), `value_precision` (dòng 106), `replace_field` (dòng 107). Không có
  tag nào khác.
- Deserialization: `loadXML()` (dòng 82–89) đếm `formula` TRỰC TIẾP dưới
  stepnode (dòng 83 — không qua wrapper); mỗi block parse bởi
  `FormulaMetaFunction(Node)` (dòng 114–121): `value_type` map chuỗi→id
  (dòng 117), `value_length`/`value_precision` qua
  `Const.toInt(..., -1)` (thiếu tag → `-1`, dòng 118–119).
- Khởi tạo: `setDefault()` (dòng 131–133) — 0 công thức.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 150–183) — `replace_field`
  rỗng + `field_name` có tên = THÊM trường mới với kiểu/length/precision
  đã khai báo (dòng 154–167); `replace_field` có tên = GHI ĐÈ trường đó
  tại chỗ, ném `KettleStepException` khi trường không tồn tại (dòng
  168–181).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 công thức: trường mới + ghi đè tại chỗ):

```xml
<formula>
  <field_name>TOTAL_WITH_TAX</field_name>
  <formula_string>[PRICE] * (1 + [TAX_RATE])</formula_string>
  <value_type>Number</value_type>
  <value_length>-1</value_length>
  <value_precision>2</value_precision>
  <replace_field/>
</formula>
<formula>
  <field_name>STATUS_LABEL</field_name>
  <formula_string>IF([STATUS] = "A"; "Active"; "Inactive")</formula_string>
  <value_type>String</value_type>
  <value_length>20</value_length>
  <value_precision>-1</value_precision>
  <replace_field>STATUS</replace_field>
</formula>
```

Mỗi công thức là một block `<formula>` riêng, giữ đúng thứ tự 6 tag; sửa
qua `formula/<tag>` (block đầu) hoặc thêm block thứ hai giữ nguyên shape.

## 5. Lưu ý / bẫy — CRITICAL

- **Không có wrapper list**: các công thức là `<formula>` trực tiếp dưới
  `<step>` (`loadXML()` đếm trực tiếp, dòng 83) — đừng bịa
  `<fields>`/`<formulas>` bao ngoài.
- **`<value_type>` là tên chuỗi, không phải số**: `Number`, `String`,
  `Integer`, `Date`, … (qua `ValueMetaFactory`) — ghi số id kiểu sẽ bị
  `getIdForValueMeta` map sai.
- **Phân biệt `field_name` với `replace_field`**: `field_name` rỗng +
  `replace_field` rỗng = không thêm gì (`getFields()` bỏ qua, dòng
  154–156); `replace_field` có tên mà trường không tồn tại = ném lỗi khi
  mở transformation.
- **XML-escape biểu thức**: so sánh `[A] < [B]` phải viết
  `[A] &lt; [B]`; `&` viết `&amp;` — quên → XML hỏng.
- **Tham chiếu cột tồn tại**: biểu thức dùng `[TÊN_CỘT]` của stream vào —
  sai tên chỉ fail lúc chạy, không fail lúc load.
- Template mặc định là khung cấu hình — người dùng phải điền biểu thức
  nghiệp vụ và kiểu kết quả; 0 công thức (mặc định `setDefault()`) không
  tính gì.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
