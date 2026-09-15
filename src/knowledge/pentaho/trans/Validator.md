# Validator — Step kiểm tra dữ liệu theo quy tắc

Với MỖI dòng vào, kiểm tra một hoặc nhiều trường theo list quy tắc
`<validator_field>` (độ dài, null, kiểu số, kiểu dữ liệu, khoảng giá trị,
tiền tố/hậu tố, regex, giá trị cho phép, tra cứu từ step khác). Dòng lỗi đi
vào luồng error-handling của step (`supportsErrorHandling() = true`); cờ
`<validate_all>` quyết định dừng ở lỗi đầu hay gom mọi lỗi, `<concat_errors>`
gom thông báo lỗi thành một chuỗi với `<concat_separator>`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Validator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <validate_all>N</validate_all>
    <concat_errors>N</concat_errors>
    <concat_separator>|</concat_separator>
    <validator_field>
      <name>{{SOURCE_FIELD}}</name>
      <validation_name>{{RULE_NAME}}</validation_name>
      <max_length/>
      <min_length/>
      <null_allowed>Y</null_allowed>
      <only_null_allowed>N</only_null_allowed>
      <only_numeric_allowed>N</only_numeric_allowed>
      <data_type>String</data_type>
      <data_type_verified>N</data_type_verified>
      <conversion_mask/>
      <decimal_symbol/>
      <grouping_symbol/>
      <max_value/>
      <min_value/>
      <start_string/>
      <end_string/>
      <start_string_not_allowed/>
      <end_string_not_allowed/>
      <regular_expression/>
      <regular_expression_not_allowed/>
      <error_code/>
      <error_description/>
      <is_sourcing_values>N</is_sourcing_values>
      <sourcing_step/>
      <sourcing_field/>
      <allowed_value>
        <value>{{ALLOWED_VALUE_1}}</value>
      </allowed_value>
    </validator_field>
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
| `<validate_all>` | N | `Y` = kiểm mọi quy tắc và gom mọi lỗi; `N` (mặc định) = dừng ở lỗi đầu. Y/N, thiếu tag → false. |
| `<concat_errors>` | N | `Y` = nối mọi thông báo lỗi thành một chuỗi; `N` (mặc định). Y/N, thiếu tag → false. |
| `<concat_separator>` | N | Chuỗi nối lỗi; mặc định step mới là `\|`. |
| `<validator_field>/<name>` | Y | Tên TRƯỜNG được kiểm tra (chú ý: nằm trong tag `<name>`). |
| `<validator_field>/<validation_name>` | N | Tên quy tắc; rỗng load thành tên trường (backward-compat). |
| `<max_length>` / `<min_length>` | N | Giới hạn độ dài chuỗi; rỗng = không kiểm. |
| `<null_allowed>` | N | `Y` (mặc định ctor) = cho phép null; `N` = null là lỗi. Y/N, thiếu tag → false. |
| `<only_null_allowed>` | N | `Y` = chỉ cho phép null. Y/N, thiếu tag → false. |
| `<only_numeric_allowed>` | N | `Y` = chỉ cho phép giá trị số. Y/N, thiếu tag → false. |
| `<data_type>` | N | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Integer`, …); chỉ kiểm khi `<data_type_verified>=Y`. |
| `<data_type_verified>` | N | `Y` = bật kiểm kiểu dữ liệu. Y/N, thiếu tag → false. |
| `<conversion_mask>` / `<decimal_symbol>` / `<grouping_symbol>` | N | Định dạng số/ngày khi kiểm kiểu. |
| `<max_value>` / `<min_value>` | N | Khoảng giá trị cho phép (so sánh chuỗi); rỗng = không kiểm. |
| `<start_string>` / `<end_string>` | N | Tiền tố/hậu tố BẮT BUỘC. |
| `<start_string_not_allowed>` / `<end_string_not_allowed>` | N | Tiền tố/hậu tố BỊ CẤM. |
| `<regular_expression>` / `<regular_expression_not_allowed>` | N | Regex bắt buộc / bị cấm. |
| `<error_code>` / `<error_description>` | N | Mã + mô tả lỗi ghi vào luồng error khi quy tắc này fail. |
| `<is_sourcing_values>` | N | `Y` = lấy danh sách giá trị cho phép từ step khác; `N` (mặc định) = dùng `<allowed_value>` tĩnh. |
| `<sourcing_step>` / `<sourcing_field>` | Điều kiện | Tên step + tên trường nguồn khi `is_sourcing_values=Y` — step nguồn phải tồn tại (info stream, cần hop). |
| `<allowed_value>/<value>` | N | Danh sách giá trị cho phép (tĩnh), mỗi giá trị một tag `<value>`; wrapper LUÔN paired. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: VALIDATOR` | `<type>` | `Validator`. |
| `configuration.validate_all` | `<validate_all>` | Boolean → Y/N. |
| `configuration.concatenate_errors` | `<concat_errors>` | Boolean → Y/N. |
| `configuration.concatenation_separator` | `<concat_separator>` | Chuỗi nối, mặc định `\|`. |
| `configuration.validations[].field` | `<validator_field>/<name>` | Trường được kiểm tra. |
| `configuration.validations[].rule_name` | `<validator_field>/<validation_name>` | Tên quy tắc. |
| `configuration.validations[].null_allowed/...` | các cờ Y/N tương ứng | Boolean → Y/N. |
| `configuration.validations[].allowed_values[]` | `<allowed_value>/<value>` | Mỗi giá trị một `<value>`. |

Các `<validator_field>` là tag lặp TRỰC TIẾP dưới `<step>` (KHÔNG có
wrapper `<fields>`/`<validations>`) — mỗi rule là một block
`<validator_field>` riêng. Scalar đổi bằng `set_field_path`; rule mới
sửa trực tiếp block `<validator_field>` (`validator_field/<tag>`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 59 —
  `<step id="Validator">` →
  `org.pentaho.di.trans.steps.validator.ValidatorMeta` (category
  Validation). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `ValidatorMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/validator/ValidatorMeta.java`
  dòng 107–119) — thứ tự `validate_all`, `concat_errors`,
  `concat_separator` (dòng 110–112), rồi mỗi validation emit nguyên block
  của `Validation.getXML()` (dòng 114–116). `Validation.getXML()`
  (`.../validator/Validation.java` dòng 132–183) mở tag `validator_field`
  (`XML_TAG`, dòng 43/135) và emit theo thứ tự: `name` (= TÊN TRƯỜNG,
  dòng 137), `validation_name` (= tên quy tắc, dòng 138), `max_length`,
  `min_length`, 3 cờ null/numeric, `data_type` (tên value-meta chuỗi qua
  `ValueMetaFactory.getValueMetaName`, dòng 146), `data_type_verified`,
  `conversion_mask`, `decimal_symbol`, `grouping_symbol`, rồi
  `max_value` TRƯỚC `min_value` (dòng 152–153), các cặp start/end
  (allowed rồi not-allowed), 2 regex, `error_code`, `error_description`,
  `is_sourcing_values`, `sourcing_step`, `sourcing_field`, cuối cùng
  wrapper `<allowed_value>` LUÔN emit paired (dòng 171–178) chứa các
  `<value>`. Không có tag nào khác.
- Deserialization: `ValidatorMeta.loadXML()` (dòng 94–105) đếm
  `validator_field` TRỰC TIẾP dưới stepnode (dòng 95 — không qua wrapper);
  2 cờ parse bằng `"Y".equalsIgnoreCase(...)` (thiếu tag → false, dòng
  97–98). `Validation(Node)` (dòng 185–232): `validation_name` rỗng load
  thành tên trường (backward-compat, dòng 190–192); mọi cờ Y/N thiếu tag →
  false; `data_type` map chuỗi→id (dòng 201); danh sách cho phép đọc từ
  sub-node `allowed_value`/`value` (dòng 225–231).
- Khởi tạo: `setDefault()` (dòng 149–152) — list rỗng,
  `concatenationSeparator = "|"` (2 cờ giữ false mặc định Java). Ctor
  `Validation()` (dòng 106–112): `nullAllowed = true`, còn lại false/rỗng.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `supportsErrorHandling()` (dòng 215–217) = true —
  dòng lỗi đi vào luồng error của step. `getStepIOMeta()` (dòng 286–305)
  đăng ký một INFO stream cho mỗi validation có `sourcingStep` — khi
  `is_sourcing_values=Y`, step nguồn phải tồn tại (tham chiếu tên step,
  cần hop; xem `searchInfoAndTargetSteps`, dòng 307–316).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (gom mọi lỗi, nối bằng `;`, cấm null + regex
email):

```xml
<validate_all>Y</validate_all>
<concat_errors>Y</concat_errors>
<concat_separator>;</concat_separator>
<validator_field>
  <name>EMAIL</name>
  <validation_name>email_format</validation_name>
  <max_length/>
  <min_length/>
  <null_allowed>N</null_allowed>
  <only_null_allowed>N</only_null_allowed>
  <only_numeric_allowed>N</only_numeric_allowed>
  <data_type>String</data_type>
  <data_type_verified>N</data_type_verified>
  <conversion_mask/>
  <decimal_symbol/>
  <grouping_symbol/>
  <max_value/>
  <min_value/>
  <start_string/>
  <end_string/>
  <start_string_not_allowed/>
  <end_string_not_allowed/>
  <regular_expression>.*@.*\..*</regular_expression>
  <regular_expression_not_allowed/>
  <error_code>ERR_EMAIL</error_code>
  <error_description>Invalid email address</error_description>
  <is_sourcing_values>N</is_sourcing_values>
  <sourcing_step/>
  <sourcing_field/>
  <allowed_value>
  </allowed_value>
</validator_field>
```

Scalar đổi bằng `set_field_path`; nội dung rule đổi qua
`validator_field/<tag>`.

## 5. Lưu ý / bẫy — CRITICAL

- **`<name>` = TÊN TRƯỜNG, `<validation_name>` = tên quy tắc**: bị đảo so
  với trực giác (`Validation.getXML()` dòng 137–138) — đừng điền tên rule
  vào `<name>`.
- **Thứ tự `max_value` TRƯỚC `min_value`**: `getXML()` emit max trước min
  (dòng 152–153) — giữ đúng order khi viết tay.
- **Không có wrapper list**: các rule là `<validator_field>` trực tiếp dưới
  `<step>` (`loadXML()` đếm trực tiếp, dòng 95) — đừng bịa
  `<fields>`/`<validations>` bao ngoài.
- **`<allowed_value>` luôn paired**: `getXML()` luôn emit cả mở lẫn đóng
  (dòng 171–178) — giữ `<allowed_value></allowed_value>` paired kể cả khi
  rỗng, không viết self-closing.
- **Y/N chứ không phải true/false**: mọi cờ parse bằng
  `"Y".equalsIgnoreCase(...)` — ghi `true` load thành false lặng lẽ.
- **`is_sourcing_values=Y` đòi step nguồn thật**: `sourcing_step` là tham
  chiếu tên step (info stream, cần hop tới step đó) — template mặc định để
  `N` với danh sách tĩnh.
- Template mặc định là khung cấu hình — người dùng phải điền trường có
  thật trong stream trước; list rỗng (mặc định `setDefault()`) không kiểm
  gì.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
