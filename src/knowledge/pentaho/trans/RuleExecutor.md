# RuleExecutor — Step chạy rule Drools theo từng dòng

Chạy rule Drools (file `<rule-file>` hoặc inline `<rule-definition>`) trên
TỪNG dòng đầu vào, phát kết quả vào các cột `<fields>/<field>`
(`column-name`/`column-type` gạch ngang). Cùng serializer với
RuleAccumulator nhưng ngữ nghĩa khác: Executor bắn rule mỗi dòng (giữ số
dòng), Accumulator gom hết rồi bắn một lần.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RuleExecutor</type>
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
| `<fields>/<field>/<column-name>` | Y | Cột kết quả (gạch ngang). |
| `<fields>/<field>/<column-type>` | N | Chuỗi value-meta. |
| `<rule-file>` | N (1 trong 2) | File `.drl`. `${VAR}`. |
| `<rule-definition>` | N (1 trong 2) | DRL inline, escape XML. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: RULE_EXECUTOR` | `<type>` | `RuleExecutor`. |
| `configuration.result_columns[].name` | `<fields>/<field>/<column-name>` | Gạch ngang. |
| `configuration.result_columns[].value_type` | `<fields>/<field>/<column-type>` | Chuỗi value-meta. |
| `configuration.rule_file` | `<rule-file>` | `${VAR}`. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="RuleExecutor", ...)`
  (`plugins/drools/core/src/main/java/org/pentaho/di/trans/steps/rules/RulesExecutorMeta.java`
  dòng 62+, category Scripting).
- Tên tag: enum `StorageKeys` (dòng 72–74): `fields`, `field`,
  `column-name`, `column-type`, `rule-file`, `rule-definition`.
- Serialization: `getXML()` (dòng 164–182) — `<fields>` (167–176),
  `rule-file` (177), `rule-definition` (178–179). Y hệt Accumulator.
- Deserialization: `loadXML()` (dòng 140–161) — fields (142–154), rule
  (156–157).
- Khởi tạo: `setDefault()` RỖNG (dòng 218–219); `keepInputFields`
  true (dòng 94), không serialize.
- Ngữ nghĩa runtime: `getFields()` (dòng 222+) clear/append như
  Accumulator; worker `RulesExecutor` bắn rule MỖI dòng (giữ số dòng).
- Không có `<connection>`.

Cấu hình không mặc định (2 cột kết quả):

```xml
<fields>
  <field>
    <column-name>DISCOUNT</column-name>
    <column-type>Number</column-type>
  </field>
  <field>
    <column-name>REASON</column-name>
    <column-type>String</column-type>
  </field>
</fields>
<rule-file>${RULES_FILE}</rule-file>
<rule-definition/>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag gạch ngang** — như Accumulator.
- **Đừng lẫn Executor/Accumulator**: cùng XML, khác runtime (mỗi dòng
  vs gom một lần). Chọn sai step cho kết quả sai số dòng lặng lẽ.
- Cần engine Drools + file `.drl` thật khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
