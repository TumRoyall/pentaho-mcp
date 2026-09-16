# SalesforceDelete — Step xóa record Salesforce

Với MỖI dòng đầu vào, xóa một record trong `module` theo ID lấy từ cột
dòng chỉ bởi `<DeleteField>`. Step KHÔNG có block `<fields>` — chỉ một tag
duy nhất trỏ tới cột chứa ID. `getFields()` RỖNG (passthrough).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SalesforceDelete</type>
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
    <DeleteField>{{ID_FIELD}}</DeleteField>
    <batchSize>10</batchSize>
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
| `<DeleteField>` | Y | Tên CỘT DÒNG chứa Salesforce ID cần xóa. Tag viết hoa `D`/`F`. Mặc định mới (setDefault) là null. |
| `<batchSize>` | N | Chuỗi số; mặc định `"10"`. |
| `<rollbackAllChangesOnError>` | N | Y/N; mặc định N. |

Không có `<fields>` block — đừng bịa theo họ Insert/Update/Upsert.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SALESFORCE_DELETE` | `<type>` | `SalesforceDelete`. |
| `configuration.delete_field` | `<DeleteField>` | Cột chứa ID (case-sensitive). |
| `configuration.batch_size` | `<batchSize>` | `"10"`. |
| `configuration.rollback_all_changes_on_error` | `<rollbackAllChangesOnError>` | Y/N. |

Không có list lặp — không dùng `set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SalesforceDelete", ...)`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforcedelete/SalesforceDeleteMeta.java`
  dòng 50–57, category Output).
- Superclass: `SalesforceStepMeta.getXML()` (dòng 76–86),
  `setDefault()` (dòng 121–128).
- Serialization: `SalesforceDeleteMeta.getXML()` (dòng 133–140) —
  CHỈ 3 tag nối tiếp super: `DeleteField` viết hoa (135), `batchSize`
  (136), `rollbackAllChangesOnError` (137). Không emit `<fields>`.
- Deserialization: `readData()` (dòng 142–152) — `DeleteField` (144,
  case-sensitive), batch (146), rollback `"Y"` (147–148). Không có
  fallback list.
- Khởi tạo: `setDefault()` (dòng 154–160) — module `"Account"` (156),
  `DeleteField` null (157), batch `"10"` (158), rollback false. Step mới
  chưa chạy được cho tới khi điền cột ID.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230).
- Ngữ nghĩa runtime: `getFields()` RỖNG (dòng 163–166) — output =
  input. Worker đọc cột `DeleteField` từng dòng để xóa.
- Không có `<connection>` — fixture không cần khai báo connection.

Cấu hình không mặc định:

```xml
<DeleteField>SF_ID</DeleteField>
<batchSize>200</batchSize>
<rollbackAllChangesOnError>Y</rollbackAllChangesOnError>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<DeleteField>` viết hoa D và F** (dòng 135/144) — viết
  `<deletefield>`/`<deleteField>` sẽ load thành null lặng lẽ.
- **Không có `<fields>`**: đừng copy block mapping từ Insert/Upsert sang.
- **Mặc định `DeleteField` null**: step mới phải điền cột ID mới chạy.
- Credential luôn `${VAR}`.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
