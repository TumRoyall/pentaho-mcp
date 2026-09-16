# SAPINPUT — Step đọc dữ liệu SAP qua RFC function (DEPRECATED)

> **Trạng thái B7:** component bị source PDI 9.4 xếp **DEPRECATED**
> (`@Step` category `BaseStep.Category.Deprecated`, icon `deprecated.svg`).
> Reference này phục vụ **đọc/bảo trì workload cũ** — `status: observed`,
> `generator_eligible: false`, KHÔNG phát sinh step mới. Không có replacement
> canonical nào được source chỉ định.

Gọi một SAP RFC/BAPI `function` (`<function>` với `name`/`description`/
`group`/`application`/`host`) trên connection SAP (`<connection>` —
THAM CHIẾU tên DatabaseMeta, fixture PHẢI khai báo), truyền tham số đầu
vào qua `<parameters>/<parameter>` (`field_name`/`sap_type`/`table_name`/
`parameter_name`/`target_type`) và nhận bảng kết quả thành các dòng qua
`<fields>/<field>` (`field_name`/`sap_type`/`table_name`/`new_name`/
`target_type`). `getFields()` XÓA row hiện tại (`row.clear()`) rồi append
mỗi output field (đổi tên thành `new_name`) — output = CHỈ các cột SAP.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SAPINPUT</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <function>
      <name>{{SAP_FUNCTION}}</name>
      <description/>
      <group>{{SAP_GROUP}}</group>
      <application>{{SAP_APPLICATION}}</application>
      <host>${SAP_HOST}</host>
    </function>
    <parameters>
      <parameter>
        <field_name>{{INPUT_FIELD}}</field_name>
        <sap_type>SINGLE</sap_type>
        <table_name>{{SAP_TABLE}}</table_name>
        <parameter_name>{{SAP_PARAM}}</parameter_name>
        <target_type>String</target_type>
      </parameter>
    </parameters>
    <fields>
      <field>
        <field_name>{{SAP_FIELD}}</field_name>
        <sap_type>TABLE</sap_type>
        <table_name>{{SAP_TABLE}}</table_name>
        <new_name>{{OUTPUT_FIELD}}</new_name>
        <target_type>String</target_type>
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
| `<connection>` | Y | Tên connection SAP (DatabaseMeta). `check()` ERROR khi null; fixture phải khai báo. |
| `<function>/<name>` | Y | Tên RFC/BAPI function. `check()` ERROR khi null; function rỗng → emit `<function></function>` trống (getXML 163–169). |
| `<function>/<description>` | N | Mô tả function. |
| `<function>/<group>` | N | Nhóm function SAP. |
| `<function>/<application>` | N | Application SAP. |
| `<function>/<host>` | N | Host SAP; dùng `${VAR}`, không embed thật. |
| `<parameters>/<parameter>/<field_name>` | Y (mỗi param) | Tên field dòng đầu vào làm tham số. |
| `<parameters>/<parameter>/<sap_type>` | Y | Mã SapType: `SINGLE`, `STRUCTURE`, `TABLE` (enum `SapType`, code qua `getCode()`). Lạ → load thành null. |
| `<parameters>/<parameter>/<table_name>` | N | Bảng SAP của tham số. |
| `<parameters>/<parameter>/<parameter_name>` | Y | Tên tham số trong signature function. |
| `<parameters>/<parameter>/<target_type>` | Y | Kiểu value-meta chuỗi (`String`, `Integer`, ...) qua `ValueMeta.getTypeDesc`; lạ → `TYPE_NONE`. |
| `<fields>/<field>/<field_name>` | Y | Tên field SAP nguồn. |
| `<fields>/<field>/<sap_type>` | Y | Mã SapType như trên. |
| `<fields>/<field>/<table_name>` | N | Bảng SAP của field. |
| `<fields>/<field>/<new_name>` | Y | Tên cột output (rename); `getFields()` tạo value-meta theo tên này. |
| `<fields>/<field>/<target_type>` | Y | Kiểu value-meta chuỗi như trên. |

`<parameters>`/`<parameter>` và `<fields>`/`<field>` là paired list —
giữ paired (self-closing làm setFields ném lỗi). CHÚ Ý: `<parameter>`
(trong `<parameters>`) khác `<parameter>` của DBJoin — ở đây mỗi item có
`field_name`/`sap_type`/`table_name`/`parameter_name`/`target_type`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SAP_INPUT` | `<type>` | `SAPINPUT`. |
| `configuration.connection` | `<connection>` | Tên connection SAP. |
| `configuration.function` | `<function>/<name>` | RFC/BAPI. |
| `configuration.parameters[].field` | `<parameters>/<parameter>/<field_name>` | Field input. |
| `configuration.parameters[].sap_type` | `<parameters>/<parameter>/<sap_type>` | `SINGLE`/`STRUCTURE`/`TABLE`. |
| `configuration.parameters[].parameter` | `<parameters>/<parameter>/<parameter_name>` | Tên tham số. |
| `configuration.fields[].sap_field` | `<fields>/<field>/<field_name>` | Field SAP. |
| `configuration.fields[].rename` | `<fields>/<field>/<new_name>` | Cột output. |
| `configuration.fields[].type` | `<fields>/<field>/<target_type>` | Tên value-meta chuỗi. |

Mỗi list → MỘT lần `set_fields` (`parameters`/`parameter`,
`fields`/`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SAPINPUT", ...)`
  (`plugins/sap/core/src/main/java/org/pentaho/di/trans/steps/sapinput/SapInputMeta.java`
  dòng 61–63, category `...BaseStep.Category.Deprecated`, icon
  `ui/images/deprecated.svg`). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Hằng tag: `XML_TAG_PARAMETERS="parameters"` (65),
  `XML_TAG_PARAMETER="parameter"` (67), `XML_TAG_FIELDS="fields"` (69),
  `XML_TAG_FIELD="field"` (71), `XML_TAG_FUNCTION="function"` (73).
- Serialization: `getXML()` (dòng 156–199) — `connection` = tên
  DatabaseMeta (rỗng khi null, 160), block `<function>` LUÔN emit
  (162–170; `name`/`description`/`group`/`application`/`host` chỉ khi
  function non-null và tên non-empty, 163–169), `<parameters>` LUÔN emit
  (172–183; mỗi `<parameter>`: `field_name` 175, `sap_type` = code
  `SINGLE`/`STRUCTURE`/`TABLE` 176, `table_name` 177, `parameter_name`
  178, `target_type` = tên value-meta chuỗi 179–180), `<fields>` LUÔN
  emit (185–196; mỗi `<field>`: `field_name` 188, `sap_type` 189,
  `table_name` 190, `new_name` 191, `target_type` 192–193).
- Deserialization: `loadXML()` (dòng 124–126) gọi `readData()` (dòng
  201–245) — connection qua `DatabaseMeta.findDatabase` (203, thiếu →
  null); function đọc 5 sub-tag, tên rỗng → `function = null` (211–216);
  `<parameters>` đếm `<parameter>` (218–219), mỗi item đọc `field_name`
  (222), `sap_type` qua `SapType.findTypeForCode` (223, lạ → null),
  `table_name` (224), `target_type` qua `ValueMeta.getType` (225, lạ →
  `TYPE_NONE`), `parameter_name` (226); `<fields>` tương tự (230–240)
  thêm `new_name` (238). Mọi exception → `KettleXMLException` (242–244).
- Khởi tạo: `setDefault()` (dòng 133–137) — `databaseMeta = null`,
  `function = null` (không đụng 2 list, ctor đã `new ArrayList` dòng
  98–99).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 139–154) `row.clear()` rồi
  append mỗi output field (`createValueMeta(new_name, targetType)`,
  146–149) — output CHỈ gồm cột SAP. `check()` (dòng 325–347) ERROR khi
  thiếu connection (330) hoặc function (340).
- `getUsedDatabaseConnections()` (dòng 363–369) trả connection SAP.
- BẪY B2: `<connection>` tham chiếu theo tên — fixture test PHẢI có
  `<connection><name>${CONN}</name></connection>`.

Cấu hình không mặc định (param STRUCTURE + 2 output field):

```xml
<function>
  <name>BAPI_CUSTOMER_GETLIST</name>
  <description/>
  <group>SD</group>
  <application>R3</application>
  <host>${SAP_HOST}</host>
</function>
<parameters>
  <parameter>
    <field_name>CUSTOMER_ID</field_name>
    <sap_type>SINGLE</sap_type>
    <table_name/>
    <parameter_name>CUSTOMERNO</parameter_name>
    <target_type>String</target_type>
  </parameter>
</parameters>
<fields>
  <field>
    <field_name>NAME1</field_name>
    <sap_type>TABLE</sap_type>
    <table_name>ADDRESSDATA</table_name>
    <new_name>CUSTOMER_NAME</new_name>
    <target_type>String</target_type>
  </field>
  <field>
    <field_name>CITY</field_name>
    <sap_type>TABLE</sap_type>
    <table_name>ADDRESSDATA</table_name>
    <new_name>CUSTOMER_CITY</new_name>
    <target_type>String</target_type>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED trong source 9.4** — chỉ đọc/bảo trì. Không có replacement
  nào được source chỉ định (Javadoc chỉ ghi `Created on 2-jun-2003`).
- **`<sap_type>` là mã enum**: `SINGLE`/`STRUCTURE`/`TABLE` (không phải
  kiểu value-meta). Mã lạ → `findTypeForCode` trả null → NPE ở lần
  `getXML()` sau (dòng 176/189 gọi `getSapType().getCode()` không
  null-guard).
- **`<target_type>` là tên value-meta chuỗi** (`String`, `Integer`,
  ...), KHÔNG phải số id. Kiểu lạ → `TYPE_NONE`.
- **Load lặp append trùng**: `readData()` không clear 2 list trước khi
  add (list chỉ init ở ctor) — gọi load 2 lần trên cùng instance sẽ nhân
  đôi param/field.
- **`<function>` luôn emit** kể cả khi function null (block rỗng) —
  template giữ `<function>` paired với `<name>` bên trong.
- Fixture phải khai báo connection; host/credential chỉ `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Trạng thái đề xuất: `status: observed`, `generator_eligible: false`
  (deprecated in source 9.4 — đọc/bảo trì, không phát sinh mới).
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
