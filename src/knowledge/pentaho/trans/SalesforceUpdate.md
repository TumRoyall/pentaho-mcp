# SalesforceUpdate — Step update record Salesforce

Với MỖI dòng đầu vào, update một record trong `module` Salesforce, ánh xạ
cột dòng (`<field>`) sang field Salesforce (`<name>`). Khác Insert/Upsert:
KHÔNG có `<salesforceIDFieldName>` và `getFields()` RỖNG — output =
input passthrough, không thêm cột nào.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SalesforceUpdate</type>
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
| `<batchSize>` | N | Chuỗi số; mặc định `"10"`. |
| `<fields>/<field>/<name>` | Y | Field Salesforce đích. |
| `<fields>/<field>/<field>` | N | Cột nguồn; thiếu → trùng `<name>`. |
| `<fields>/<field>/<useExternalId>` | N | Y/N; thiếu → FALSE. |
| `<rollbackAllChangesOnError>` | N | Y/N; mặc định N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SALESFORCE_UPDATE` | `<type>` | `SalesforceUpdate`. |
| `configuration.module` | `<module>` | Ví dụ `Account`. |
| `configuration.batch_size` | `<batchSize>` | `"10"`. |
| `configuration.mappings[].salesforce_field` | `<fields>/<field>/<name>` | Field đích. |
| `configuration.mappings[].stream_field` | `<fields>/<field>/<field>` | Cột nguồn. |
| `configuration.mappings[].use_external_id` | `<fields>/<field>/<useExternalId>` | Y/N. |
| `configuration.rollback_all_changes_on_error` | `<rollbackAllChangesOnError>` | Y/N. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SalesforceUpdate", ...)`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceupdate/SalesforceUpdateMeta.java`
  dòng 50–57, category Output).
- Superclass: `SalesforceStepMeta.getXML()` (dòng 76–86),
  `setDefault()` (dòng 121–128).
- Serialization: `SalesforceUpdateMeta.getXML()` (dòng 179–197) —
  `batchSize` (181), block `<fields>` (183–194; `name` 187, `field` 188,
  `useExternalId` 189–190), `rollbackAllChangesOnError` (195). KHÔNG có
  `salesforceIDFieldName` (khác Insert/Upsert).
- Deserialization: `readData()` (dòng 199–234) — `<field>` thiếu →
  stream = lookup (213–215); `useExternalId` thiếu → FALSE, chỉ `"Y"`
  thành TRUE (216–226).
- Khởi tạo: `setDefault()` (dòng 242–249) — batch `"10"`, allocate 0,
  rollback false.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- Ngữ nghĩa runtime: `getFields()` RỖNG (dòng 252–255) — output giữ
  nguyên input, không thêm cột. `supportsErrorHandling()` true (theo mẫu
  họ Insert — kiểm tra worker khi dùng error hop).
- Không có `<connection>` — fixture không cần khai báo connection.

Cấu hình không mặc định (update theo external ID):

```xml
<batchSize>200</batchSize>
<fields>
  <field>
    <name>Id</name>
    <field>SF_ID</field>
    <useExternalId>N</useExternalId>
  </field>
  <field>
    <name>External_Id__c</name>
    <field>EXT_CODE</field>
    <useExternalId>Y</useExternalId>
  </field>
</fields>
<rollbackAllChangesOnError>N</rollbackAllChangesOnError>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Không nhầm với Insert/Upsert**: Update KHÔNG có
  `<salesforceIDFieldName>` — thêm tag này bị bỏ qua lặng lẽ khi load.
- **`getFields()` rỗng**: downstream chỉ thấy cột input gốc; đừng trông
  đợi cột ID mới như Insert.
- Credential luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
