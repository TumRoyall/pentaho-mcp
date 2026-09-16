# RuleAccumulator — Step tích lũy dòng rồi chạy rule Drools

Gom MỌI dòng đầu vào thành một collection, chạy rule Drools (file
`<rule-file>` hoặc định nghĩa inline `<rule-definition>`), rồi phát MỘT
dòng kết quả gồm các cột khai báo trong `<fields>/<field>` (`column-name`
GẠCH NGANG + `column-type` chuỗi). Khác RuleExecutor: Accumulator gom toàn
bộ input trước khi bắn rule một lần.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RuleAccumulator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <column-name>{{RESULT_COLUMN}}</column-name>
        <column-type>String</column-type>
      </field>
    </fields>
    <rule-file>${RULES_FILE}</rule-file>
    <rule-definition/>
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
| `<fields>/<field>/<column-name>` | Y | Tên cột kết quả rule (GẠCH NGANG, không phải underscore). |
| `<fields>/<field>/<column-type>` | N | Chuỗi value-meta (`String`, `Number`, ...). |
| `<rule-file>` | N (1 trong 2) | Path file rule `.drl`. GẠCH NGANG. `${VAR}`. |
| `<rule-definition>` | N (1 trong 2) | Rule inline (DRL nguyên văn, escape XML). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RULE_ACCUMULATOR` | `<type>` | `RuleAccumulator`. |
| `configuration.result_columns[].name` | `<fields>/<field>/<column-name>` | Gạch ngang. |
| `configuration.result_columns[].value_type` | `<fields>/<field>/<column-type>` | Chuỗi value-meta. |
| `configuration.rule_file` | `<rule-file>` | `${VAR}`. |
| `configuration.rule_definition` | `<rule-definition>` | DRL inline. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="RuleAccumulator", ...)`
  (`plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesAccumulatorMeta.java`
  dòng 53+, category Scripting).
- Tên tag: enum `StorageKeys` (dòng 64–67): `fields`, `field`,
  `column-name`, `column-type`, `rule-file`, `rule-definition` — GẠCH
  NGANG.
- Serialization: `getXML()` (dòng 157–175) — `<fields>` TRƯỚC
  (160–169; `column-name` 163–164, `column-type` 165–166), `rule-file`
  (170), `rule-definition` (171–172).
- Deserialization: `loadXML()` (dòng 133–154) — đọc fields qua enum
  (135–147), rule file/definition nguyên văn (149–150).
- Khởi tạo: `setDefault()` RỖNG (dòng 211–212); `keepInputFields`
  khởi tạo true (dòng 87) nhưng KHÔNG serialize — state dialog-only.
- Ngữ nghĩa runtime: `getFields()` (dòng 215+) — `row.clear()` khi
  `!keepInputFields` (217–219), rồi append cột rule (221+). Worker
  `RulesAccumulator` gom input rồi bắn rule một lần.
- Không có `<connection>`.

Cấu hình không mặc định (rule inline + 2 cột):

```xml
<fields>
  <field>
    <column-name>TOTAL</column-name>
    <column-type>Number</column-type>
  </field>
  <field>
    <column-name>VERDICT</column-name>
    <column-type>String</column-type>
  </field>
</fields>
<rule-file/>
<rule-definition>rule "sum" when then end</rule-definition>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag gạch ngang**: `column-name`, `column-type`, `rule-file`,
  `rule-definition` — viết underscore load null.
- **Phân biệt Executor**: cùng serializer nhưng Executor bắn rule theo
  từng dòng, Accumulator gom hết rồi bắn một lần — output Accumulator
  thường chỉ 1 dòng.
- `keepInputFields` không có trong XML — template không mang tag này.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
