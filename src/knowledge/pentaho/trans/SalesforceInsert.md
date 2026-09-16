# SalesforceInsert — Step insert record vào Salesforce

Với MỖI dòng đầu vào, insert một record vào `module` Salesforce, ánh xạ cột
dòng (`<fields>/<field>/<field>`) sang field Salesforce
(`<fields>/<field>/<name>`). Sau khi chạy, append MỘT cột chứa Salesforce ID
vừa tạo (tên theo `<salesforceIDFieldName>`, String dài 18) vào dòng ra.
Hỗ trợ xử lý lỗi theo dòng (`supportsErrorHandling()=true`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SalesforceInsert</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <targeturl>${SALESFORCE_URL}</targeturl>
    <username>${SALESFORCE_USERNAME}</username>
    <password>${SALESFORCE_PASSWORD}</password>
    <timeout>60000</timeout>
    <useCompression>N</useCompression>
    <module>Account</module>
    <batchSize>10</batchSize>
    <salesforceIDFieldName>Id</salesforceIDFieldName>
    <fields>
      <field>
        <name>Name</name>
        <field>{{INPUT_FIELD_NAME}}</field>
        <useExternalId>N</useExternalId>
      </field>
    </fields>
    <rollbackAllChangesOnError>N</rollbackAllChangesOnError>
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
| `<targeturl>` / `<username>` / `<password>` / `<timeout>` / `<useCompression>` / `<module>` | Y (kế thừa) | Như SalesforceInput — credential `${VAR}`, module mặc định `Account`. |
| `<batchSize>` | N | Số record mỗi batch API, dạng chuỗi; mặc định `"10"`. Parse bằng `Const.toInt(batchSize, 10)`. |
| `<salesforceIDFieldName>` | N | Tên cột output chứa ID vừa insert; mặc định `"Id"`. Rỗng → `getFields()` không thêm cột. |
| `<fields>/<field>/<name>` | Y (mỗi mapping) | Tên field Salesforce đích. |
| `<fields>/<field>/<field>` | N | Tên cột dòng đầu vào; THIẾU → mặc định trùng `<name>` (readData). |
| `<fields>/<field>/<useExternalId>` | N | Y/N; thiếu → FALSE. |
| `<rollbackAllChangesOnError>` | N | Y/N; mặc định N. |

`<fields>` là paired list (`<fields>`/`<field>`) — giữ paired trong template.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SALESFORCE_INSERT` | `<type>` | `SalesforceInsert`. |
| `configuration.target_url` | `<targeturl>` | `${SALESFORCE_URL}`. |
| `configuration.module` | `<module>` | Ví dụ `Account`. |
| `configuration.batch_size` | `<batchSize>` | Chuỗi số, `"10"`. |
| `configuration.salesforce_id_field` | `<salesforceIDFieldName>` | `"Id"`. |
| `configuration.mappings[].salesforce_field` | `<fields>/<field>/<name>` | Field đích. |
| `configuration.mappings[].stream_field` | `<fields>/<field>/<field>` | Cột nguồn. |
| `configuration.mappings[].use_external_id` | `<fields>/<field>/<useExternalId>` | Boolean → Y/N. |
| `configuration.rollback_all_changes_on_error` | `<rollbackAllChangesOnError>` | Boolean → Y/N. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SalesforceInsert", ...)`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinsert/SalesforceInsertMeta.java`
  dòng 53–60, category Output).
- Superclass: `SalesforceStepMeta.getXML()` (dòng 76–86),
  `setDefault()` (dòng 121–128): timeout `"60000"`, module `"Account"`.
- Serialization: `SalesforceInsertMeta.getXML()` (dòng 192–211) — nối
  tiếp super: `batchSize` (194), `salesforceIDFieldName` (195), block
  `<fields>` (197–208; mỗi `<field>`: `name` 201, `field` 202,
  `useExternalId` boolean Y/N 203–204), `rollbackAllChangesOnError`
  cuối (209).
- Deserialization: `readData()` (dòng 213–249) — `<field>` thiếu
  `<field>` thì stream = lookup name (dòng 228–230); thiếu
  `<useExternalId>` → `Boolean.FALSE` (231–234); chỉ `"Y"` thành TRUE
  (236–240). `rollbackAllChangesOnError` parse `"Y"` (243–244).
- Khởi tạo: `setDefault()` (dòng 257–265) — `batchSize "10"` (259),
  `salesforceIDFieldName "Id"` (260), `allocate(0)` (262), rollback false.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment bằng wrapper chuẩn.
- Ngữ nghĩa runtime: `getFields()` (dòng 268–277) append MỘT cột String
  dài 18 tên `salesforceIDFieldName` (bỏ qua khi rỗng). `check()` (dòng
  320–350): step này KHÔNG nhận input đã nối? — thực tế check báo ERROR
  khi có input nối vào (dòng 326–331, copy mẫu Input) và yêu cầu ≥1
  mapping; khi chạy thật step ĐỌC dòng đầu vào để insert (worker
  `SalesforceInsert`). `supportsErrorHandling()` true (dòng 361–363).
- Không có `<connection>`: credential Salesforce riêng — fixture test
  không cần khai báo connection.

Cấu hình không mặc định (2 mapping + rollback):

```xml
<batchSize>200</batchSize>
<salesforceIDFieldName>NEW_ID</salesforceIDFieldName>
<fields>
  <field>
    <name>Name</name>
    <field>ACCOUNT_NAME</field>
    <useExternalId>N</useExternalId>
  </field>
  <field>
    <name>External_Id__c</name>
    <field>EXT_CODE</field>
    <useExternalId>Y</useExternalId>
  </field>
</fields>
<rollbackAllChangesOnError>Y</rollbackAllChangesOnError>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<field>` thiếu trong `<field>` item → trùng tên đích**: không phải
  lỗi load — stream mặc định = lookup name (dòng 228–230). Nên
  luôn khai báo tường minh cả hai.
- **`<useExternalId>` là Y/N**, không phải true/false.
- **`<salesforceIDFieldName>` rỗng → không có cột output** (`getFields`
  bỏ qua khi rỗng) — downstream thiếu cột ID mà không báo lỗi load.
- Credential luôn `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
