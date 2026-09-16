# Script — Step JavaScript thế hệ cũ (DEPRECATED)

> **DEPRECATED** — chỉ dùng để đọc/bảo trì workload cũ. Không phát sinh
> step mới loại này; catalog giữ `status: observed`,
> `generator_eligible: false`. Replacement có nguồn: `ScriptValueMod`
> (registry `suggestion ... TypeLongDesc.JavaScriptMod`).

Step JavaScript đời đầu (Rhino, trước `ScriptValueMod`): một hay nhiều
tab script trong `<jsScripts>/<jsScript>` (`jsScript_type` SỐ nguyên:
`0` = transform, `1` = start, `2` = end) và danh sách output field trong
`<fields>/<field>` (`name`, `rename`, `type` chuỗi, `length`,
`precision`, `replace` Y/N). `getFields()` thêm cột mới, hoặc THAY THẾ
cột tại chỗ khi `replace = Y` (ném lỗi khi field cần replace không tồn
tại và không có rename).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Script</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <jsScripts>
      <jsScript>
        <jsScript_type>0</jsScript_type>
        <jsScript_name>{{SCRIPT_NAME}}</jsScript_name>
        <jsScript_script>{{JS_CODE}}</jsScript_script>
      </jsScript>
    </jsScripts>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <rename>{{OUTPUT_NAME}}</rename>
        <type>Number</type>
        <length>-1</length>
        <precision>-1</precision>
        <replace>N</replace>
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
| `<jsScripts>/<jsScript>/<jsScript_type>` | Y | SỐ nguyên: `0` transform, `1` start, `2` end (`Integer.parseInt`, thiếu/không số → NÉM `KettleXMLException`). |
| `<jsScripts>/<jsScript>/<jsScript_name>` | Y | Tên tab script. |
| `<jsScripts>/<jsScript>/<jsScript_script>` | Y | Mã JavaScript (escape XML khi chứa `&`/`<`). |
| `<fields>/<field>/<name>` | Y | Tên field script dùng; khi `replace = Y` là field bị thay thế. |
| `<fields>/<field>/<rename>` | N | Tên output (rỗng → dùng `name`). |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta CHUỖI (`Number`, `String`, ...; load qua `getIdForValueMeta`). |
| `<fields>/<field>/<length>` / `<precision>` | N | Thiếu → `-1` (`Const.toInt(..., -1)`). |
| `<fields>/<field>/<replace>` | N | `Y` = thay thế cột tại chỗ; so khớp `equalsIgnoreCase`, thiếu → false. |

`<jsScripts>` và `<fields>` đều là paired list — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SCRIPT_DEPRECATED` | `<type>` | `Script` (alias `SCRIPT` đã thuộc `ScriptValueMod`). |
| `configuration.scripts[].type` | `<jsScripts>/<jsScript>/<jsScript_type>` | Số 0/1/2. |
| `configuration.scripts[].name` | `<jsScripts>/<jsScript>/<jsScript_name>` | Tên tab. |
| `configuration.scripts[].script` | `<jsScripts>/<jsScript>/<jsScript_script>` | Mã nguồn. |
| `configuration.outputs[].field` | `<fields>/<field>/<name>` | Field. |
| `configuration.outputs[].rename` | `<fields>/<field>/<rename>` | Output. |

Hai list khác itemTag — fill riêng: `set_fields`
(`listTag=jsScripts`, `itemTag=jsScript`) và (`listTag=fields`,
`itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 102 —
  `<step id="Script">` →
  `org.pentaho.di.trans.steps.script.ScriptMeta` (category Deprecated,
  icon deprecated, `suggestion ... TypeLongDesc.JavaScriptMod` =
  replacement có nguồn). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/script/ScriptMeta.java`
  dòng 328–358) — block `<jsScripts>` (dòng 331–341), mỗi `<jsScript>`
  có `jsScript_type` SỐ (dòng 335), `jsScript_name` (dòng 337),
  `jsScript_script` (dòng 338; hằng tên tag dòng 76–78); rồi block
  `<fields>` (dòng 343–355), mỗi `<field>` có `name`/`rename`/`type`
  (chuỗi qua `getValueMetaName`, dòng 348–349)/`length`/`precision`/
  `replace` Y/N (dòng 350–352).
- Deserialization: `loadXML()` (dòng 193–195) gọi `readData()` (dòng
  223–259) — `jsScript_type` qua `Integer.parseInt` (dòng 231–234):
  **thiếu/không phải số → NÉM** (bọc `KettleXMLException`, dòng 255–258);
  `length`/`precision` thiếu → `-1` (dòng 251–252); `replace` qua
  `"Y".equalsIgnoreCase` (dòng 253, thiếu → false); `type` qua
  `getIdForValueMeta` (dòng 247).
- Khởi tạo: `setDefault()` (dòng 261–279) — MỘT script type
  `TRANSFORM_SCRIPT = 0` (`ScriptValuesScript.java` dòng 30) và 0 output
  field.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 281–326) — `replace = Y` thì
  thay kiểu tại chỗ (`row.setValueMeta`, dòng 317), ném
  `KettleStepException` khi field cần replace không tồn tại và rename
  rỗng (dòng 292–295); ngược lại thêm cột mới (tên = `rename` nếu có,
  dòng 305–309). `check()` (dòng 420+) biên dịch script bằng engine JS.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (start + transform, 2 output):

```xml
<jsScripts>
  <jsScript>
    <jsScript_type>1</jsScript_type>
    <jsScript_name>StartScript</jsScript_name>
    <jsScript_script>var factor = 1.1;</jsScript_script>
  </jsScript>
  <jsScript>
    <jsScript_type>0</jsScript_type>
    <jsScript_name>TransformScript</jsScript_name>
    <jsScript_script>var gross = net * factor;</jsScript_script>
  </jsScript>
</jsScripts>
<fields>
  <field>
    <name>gross</name>
    <rename>GROSS_TOTAL</rename>
    <type>Number</type>
    <length>12</length>
    <precision>2</precision>
    <replace>N</replace>
  </field>
  <field>
    <name>net</name>
    <rename>net</rename>
    <type>Number</type>
    <length>12</length>
    <precision>2</precision>
    <replace>Y</replace>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED** (category + icon deprecated, dòng registry 102): chỉ
  đọc/bảo trì; step mới dùng `ScriptValueMod` (alias `SCRIPT`) hoặc
  `UserDefinedJavaClass`.
- **Đừng nhầm alias `SCRIPT`**: nó đã thuộc `ScriptValueMod` trong
  catalog — ID này dùng alias `SCRIPT_DEPRECATED`.
- **`<jsScript_type>` là SỐ, `<type>` của field là CHUỖI** — đảo hai kiểu
  này làm load fail (`parseInt`) hoặc sai kiểu lặng lẽ.
- **`<jsScript_type>` thiếu → NÉM khi load** (dòng 231–234). Không bao
  giờ lược tag này.
- **`replace = Y` thay kiểu tại chỗ** và fail khi field gốc không tồn
  tại (dòng 292–295) — kiểm tra hop trước.
- Template mặc định là khung cấu hình — người dùng phải điền mã JS và
  output field tồn tại/thay thế đúng; không chạy I/O nghiệp vụ để test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
