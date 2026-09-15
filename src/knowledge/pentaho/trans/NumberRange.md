# NumberRange — Step gán nhãn theo khoảng số

Đọc một field số (`<inputField>`), so với bảng khoảng
(`<rules>/<rule>` với `lower_bound`/`upper_bound`) rồi ghi nhãn
(`<value>`) vào một cột String mới (`<outputField>`); không khoảng nào
khớp thì ghi `<fallBackValue>`. Output = input rows + 1 cột String
(length 255). Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>NumberRange</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <inputField>{{INPUT_FIELD}}</inputField>
    <outputField>range</outputField>
    <fallBackValue>unknown</fallBackValue>
    <rules>
      <rule>
        <lower_bound>0</lower_bound>
        <upper_bound>18</upper_bound>
        <value>Minor</value>
      </rule>
      <rule>
        <lower_bound>18</lower_bound>
        <upper_bound>65</upper_bound>
        <value>Adult</value>
      </rule>
    </rules>
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
| `<inputField>` | Y | Tên field số đầu vào đem so khoảng. Mặc định step mới: rỗng (phải cấu hình). |
| `<outputField>` | Y | Tên cột nhãn ghi ra (`ValueMetaString`, length 255). Mặc định step mới: `range`. |
| `<fallBackValue>` | N | Nhãn khi không khoảng nào khớp. Mặc định step mới: `unknown`. |
| `<rules>/<rule>/<lower_bound>` | Y (mỗi rule) | Biên dưới (số, parse bằng `Double.parseDouble` — thiếu/sai định dạng NÉM lỗi load). |
| `<rules>/<rule>/<upper_bound>` | Y (mỗi rule) | Biên trên (cùng parser nghiêm ngặt). |
| `<rules>/<rule>/<value>` | Y (mỗi rule) | Nhãn gán khi giá trị rơi vào khoảng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: NUMBER_RANGE` | `<type>` | `NumberRange`. |
| `configuration.input_field` | `<inputField>` | Field số trong stream. Chú ý F hoa. |
| `configuration.output_field` | `<outputField>` | Cột String mới. |
| `configuration.fallback_value` | `<fallBackValue>` | Chú ý B hoa. |
| `configuration.rules[].lower` | `<rules>/<rule>/<lower_bound>` | Số (ghi dạng thập phân). |
| `configuration.rules[].upper` | `<rules>/<rule>/<upper_bound>` | Số. |
| `configuration.rules[].label` | `<rules>/<rule>/<value>` | Nhãn output. |

`<rules>` chứa list `<rule>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=rules`, `itemTag=rule`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 81 —
  `<step id="NumberRange">` →
  `org.pentaho.di.trans.steps.numberrange.NumberRangeMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `NumberRangeMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/numberrange/NumberRangeMeta.java`
  dòng 87–105) — thứ tự `inputField`, `outputField`, `fallBackValue`,
  rồi wrapper `<rules>` LUÔN emit kể cả 0 rule (dòng 94/102) chứa các
  `<rule>` mỗi item `lower_bound` + `upper_bound` + `value` (dòng
  95–101). Không có tag nào khác trong fragment.
- Deserialization: `loadXML()` (dòng 123–150) — 3 tag đầu đọc nguyên
  văn (thiếu → null); mỗi `<rule>` parse biên bằng
  `Double.parseDouble(...)` KHÔNG null-guard (dòng 142–143) — rule
  thiếu `<lower_bound>`/`<upper_bound>` hoặc ghi non-số NÉM
  `NumberFormatException` bọc thành `KettleXMLException` (dòng 147–149).
- Khởi tạo: `setDefault()` (dòng 153–161) đặt `fallBackValue="unknown"`,
  3 rule mặc định (`-MAX_VALUE`→5 `"Less than 5"`, 5→10 `"5-10"`,
  10→`MAX_VALUE` `"More than 10"`), `inputField=""`,
  `outputField="range"`. Template giữ `outputField`/`fallBackValue`
  theo default và 2 rule ví dụ biên số gọn.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 108–114) thêm đúng MỘT
  cột `ValueMetaString(outputField)` length 255 — output luôn có thêm
  cột nhãn kể cả khi mọi dòng rơi vào fallback. `check()` (dòng
  212–237) chỉ đòi có input, không validate rule/field.
- Không có `<connection>`: step không tham chiếu DB — template không
  mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (3 nhóm tuổi + fallback riêng):

```xml
<inputField>AGE</inputField>
<outputField>age_group</outputField>
<fallBackValue>out_of_range</fallBackValue>
<rules>
  <rule>
    <lower_bound>0</lower_bound>
    <upper_bound>18</upper_bound>
    <value>Minor</value>
  </rule>
  <rule>
    <lower_bound>18</lower_bound>
    <upper_bound>65</upper_bound>
    <value>Adult</value>
  </rule>
  <rule>
    <lower_bound>65</lower_bound>
    <upper_bound>150</upper_bound>
    <value>Senior</value>
  </rule>
</rules>
```

Fill bằng `set_fields` (`listTag=rules`, `itemTag=rule`).

## 5. Lưu ý / bẫy — CRITICAL

- **Biên khoảng bắt buộc là số hợp lệ trên MỌI `<rule>`**: thiếu tag
  hoặc ghi non-số → lỗi load cả step (dòng 142–143). Không bao giờ lược
  `<lower_bound>`/`<upper_bound>` kể cả rule "mở" — rule mở phải ghi
  số cực trị một cách tường minh.
- **Case tag**: `inputField`, `outputField` (F hoa), `fallBackValue`
  (B hoa), `lower_bound`/`upper_bound` (snake_case). Sai case sẽ bị
  loader bỏ qua lặng lẽ (null).
- **Cột output LUÔN là String length 255** — nhãn số cũng thành chuỗi;
  downstream cần số phải convert thêm (vd `SelectValues`).
- **`<rules>` luôn paired**: `getXML()` emit cả khi 0 rule — template
  giữ `<rules></rules>` paired, không viết self-closing `<rules/>`
  (`setFields` từ chối list self-closing).
- **Khoảng phủ chồng/khe hở**: `check()` không validate logic khoảng —
  thiết kế rule phủ kín miền giá trị hoặc chấp nhận fallback; rule đầu
  khớp "thắng" theo thứ tự khai báo ở runtime.
- Template mặc định là khung cấu hình — người dùng phải trỏ
  `<inputField>` tới field số tồn tại trong stream trước.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
