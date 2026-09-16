# SalesforceUpsert — Step upsert record Salesforce

Với MỖI dòng đầu vào, insert hoặc update record trong `module` theo khóa
upsert (`<upsertfield>`, mặc định `"Id"`). Ánh xạ cột dòng sang field
Salesforce như họ Insert. Sau khi chạy, append MỘT cột ID (tên theo
`<salesforceIDFieldName>`, String 18) vào dòng ra.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SalesforceUpsert</type>
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
    <upsertfield>Id</upsertfield>
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
| `<targeturl>` / `<username>` / `<password>` / `<timeout>` / `<useCompression>` / `<module>` | Y (kế thừa) | Credential `${VAR}`, module mặc định `Account`. |
| `<upsertfield>` | N | Khóa upsert (field Salesforce); mặc định `"Id"`. Tag viết thường `upsertfield`. |
| `<batchSize>` | N | Chuỗi số; mặc định `"10"`. |
| `<salesforceIDFieldName>` | N | Tên cột output ID; mặc định `"Id"`. Rỗng → không thêm cột. |
| `<fields>/<field>/<name>` | Y | Field Salesforce đích. |
| `<fields>/<field>/<field>` | N | Cột nguồn; thiếu → trùng `<name>`. |
| `<fields>/<field>/<useExternalId>` | N | Y/N; thiếu → FALSE. |
| `<rollbackAllChangesOnError>` | N | Y/N; mặc định N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SALESFORCE_UPSERT` | `<type>` | `SalesforceUpsert`. |
| `configuration.upsert_field` | `<upsertfield>` | Khóa upsert, `"Id"`. |
| `configuration.batch_size` | `<batchSize>` | `"10"`. |
| `configuration.salesforce_id_field` | `<salesforceIDFieldName>` | `"Id"`. |
| `configuration.mappings[].salesforce_field` | `<fields>/<field>/<name>` | Field đích. |
| `configuration.mappings[].stream_field` | `<fields>/<field>/<field>` | Cột nguồn. |
| `configuration.mappings[].use_external_id` | `<fields>/<field>/<useExternalId>` | Y/N. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SalesforceUpsert", ...)`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupsert/SalesforceUpsertMeta.java`
  dòng 53–60, category Output).
- Superclass: `SalesforceStepMeta.getXML()` (dòng 76–86),
  `setDefault()` (dòng 121–128).
- Serialization: `SalesforceUpsertMeta.getXML()` (dòng 210–230) —
  `upsertfield` (212, tag thường), `batchSize` (213),
  `salesforceIDFieldName` (214), block `<fields>` (216–227), rollback
  cuối (228).
- Deserialization: `readData()` (dòng 232–269) — `upsertfield` (234),
  batch/id (236–237); `<field>` thiếu → stream = lookup (249–251);
  `useExternalId` thiếu → FALSE (252–262).
- Khởi tạo: `setDefault()` (dòng 277–286) — upsert `"Id"` (279), batch
  `"10"` (280), id field `"Id"` (281), allocate 0, rollback false.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 289–~300) append cột String 18
  như Insert. `check()` yêu cầu ≥1 mapping.
- Không có `<connection>` — fixture không cần khai báo connection.

Cấu hình không mặc định (upsert theo external ID):

```xml
<upsertfield>External_Id__c</upsertfield>
<batchSize>200</batchSize>
<salesforceIDFieldName>NEW_ID</salesforceIDFieldName>
<fields>
  <field>
    <name>External_Id__c</name>
    <field>EXT_CODE</field>
    <useExternalId>Y</useExternalId>
  </field>
  <field>
    <name>Name</name>
    <field>ACCOUNT_NAME</field>
    <useExternalId>N</useExternalId>
  </field>
</fields>
<rollbackAllChangesOnError>N</rollbackAllChangesOnError>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<upsertfield>` viết thường toàn bộ** (dòng 212) — khác
  `<DeleteField>` viết hoa của Delete. Sai case → load null lặng lẽ.
- **Phân biệt 3 họ**: Insert/Upsert có `salesforceIDFieldName`, Update
  không; Upsert thêm `upsertfield`, Delete không có `<fields>`.
- Credential luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
