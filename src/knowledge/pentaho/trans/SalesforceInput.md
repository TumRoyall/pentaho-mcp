# SalesforceInput — Step đọc dữ liệu từ Salesforce

Đọc record từ một Salesforce module (Account mặc định) bằng query tự ghi
(`specifyQuery=Y`) hoặc query do step tự build từ `module` + `condition` +
`fields` + `read_from`/`read_to` + `records_filter`. Kết nối qua
`targeturl`/`username`/`password` của chính step (KHÔNG dùng `<connection>`
DB). `getFields()` phát schema từ `<fields>/<field>` rồi append các cột phụ
(`targeturl_field`, `module_field`, `sql_field`, `timestamp_field`,
`rownum_field`, `deletion_date_field`) khi cờ `include_*` tương ứng bật và
tên field không rỗng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SalesforceInput</type>
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
    <condition/>
    <specifyQuery>N</specifyQuery>
    <query/>
    <include_targeturl>N</include_targeturl>
    <targeturl_field/>
    <include_module>N</include_module>
    <module_field/>
    <include_rownum>N</include_rownum>
    <include_deletion_date>N</include_deletion_date>
    <deletion_date_field/>
    <rownum_field/>
    <include_sql>N</include_sql>
    <sql_field/>
    <include_Timestamp>N</include_Timestamp>
    <timestamp_field/>
    <read_from/>
    <read_to/>
    <records_filter>all</records_filter>
    <queryAll>N</queryAll>
    <fields>
      <field>
        <name>{{FIELD_NAME_1}}</name>
        <field>Id</field>
        <idlookup>N</idlookup>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
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
| `<targeturl>` | Y | Salesforce SOAP endpoint. Mặc định `https://login.salesforce.com/services/Soap/u/47.0`. Dùng `${SALESFORCE_URL}`, không embed URL thật. |
| `<username>` / `<password>` | Y | Credential Salesforce. Dùng `${VAR}`; `<password>` lưu dạng mã hóa khi không phải biến (`Encr.encryptPasswordIfNotUsingVariables`). |
| `<timeout>` | N | Timeout ms dạng chuỗi; mặc định `"60000"`. |
| `<useCompression>` | N | Y/N; mặc định N. |
| `<module>` | Y | Salesforce module (ví dụ `Account`); `check()` ERROR khi rỗng. |
| `<condition>` | N | Điều kiện WHERE khi không dùng query tự ghi. |
| `<specifyQuery>` | N | Y = dùng `<query>` tự ghi; N (mặc định) = step tự build query. |
| `<query>` | N (Y khi specifyQuery=Y) | SOQL tự ghi. |
| `<include_targeturl>` + `<targeturl_field>` | N | Bật + đặt tên để phát thêm cột URL (String 250). `check()` ERROR khi bật mà thiếu tên. |
| `<include_module>` + `<module_field>` | N | Tương tự cho cột module (String 250). |
| `<include_rownum>` + `<rownum_field>` | N | Cột số thứ tự (Integer). |
| `<include_deletion_date>` + `<deletion_date_field>` | N | Cột ngày xóa (Date). |
| `<include_sql>` + `<sql_field>` | N | Cột chứa SQL đã sinh (String 250). |
| `<include_Timestamp>` + `<timestamp_field>` | N | Cột timestamp server (Date). Chú ý chữ `T` hoa trong `include_Timestamp`. |
| `<read_from>` / `<read_to>` | N | Lọc theo khoảng ngày (định dạng `yyyy-MM-dd HH:mm:ss`). |
| `<records_filter>` | N | Mã chuỗi: `all` (0) / `updated` (1) / `deleted` (2). Mã lạ hoặc thiếu → 0 = `all`. |
| `<queryAll>` | N | Y = query cả record đã xóa; N mặc định. |
| `<fields>/<field>` | Y (ít nhất 1 khi chạy) | Danh sách cột đọc. Mỗi `<field>`: xem bảng field dưới. Paired list — giữ paired, không self-closing. |
| `<limit>` | N | Giới hạn số dòng dạng chuỗi; mặc định `"0"` = không giới hạn. |

Mỗi `<fields>/<field>` (theo `SalesforceInputField.getXML()`):

| Tag | Kiểu | Ghi chú |
|---|---|---|
| `<name>` | chuỗi | Tên cột output. |
| `<field>` | chuỗi | Tên field Salesforce nguồn. |
| `<idlookup>` | Y/N | Mặc định N. |
| `<type>` | chuỗi value-meta (`String`, `Integer`, `Date`, ...) | Lạ/null → `getIdForValueMeta` fallback, `getFields()` ép về String khi TYPE_NONE. |
| `<format>` / `<currency>` / `<decimal>` / `<group>` | chuỗi | Mask/ký hiệu convert. |
| `<length>` / `<precision>` | số | Mặc định -1/-1. |
| `<trim_type>` | `none`/`left`/`right`/`both` | Thiếu/lạ → `none`. |
| `<repeat>` | Y/N | BẪY: load là `!"N".equalsIgnoreCase(...)` — THIẾU tag mặc định TRUE. Luôn emit `<repeat>`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SALESFORCE_INPUT` | `<type>` | `SalesforceInput`. |
| `configuration.target_url` | `<targeturl>` | `${SALESFORCE_URL}`. |
| `configuration.username` / `password` | `<username>` / `<password>` | `${VAR}`. |
| `configuration.module` | `<module>` | Ví dụ `Account`. |
| `configuration.specify_query` | `<specifyQuery>` | Boolean → Y/N. |
| `configuration.query` | `<query>` | SOQL khi specify. |
| `configuration.condition` | `<condition>` | WHERE khi tự build. |
| `configuration.records_filter` | `<records_filter>` | `all`/`updated`/`deleted`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Cột output. |
| `configuration.fields[].field` | `<fields>/<field>/<field>` | Field Salesforce nguồn. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="SalesforceInput", ...)`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforceinput/SalesforceInputMeta.java`
  dòng 59–66, category Input). Không có trong `kettle-steps.xml`
  (registry presence không phải XML evidence).
- Superclass: `SalesforceStepMeta.getXML()`
  (`plugins/salesforce/core/src/main/java/org/pentaho/di/trans/steps/salesforce/SalesforceStepMeta.java`
  dòng 76–86) emit `targeturl` (78), `username` (79), `password` mã hóa
  khi không phải biến (80–81), `timeout` (82), `useCompression` Y/N (83),
  `module` (84). `loadXML` dòng 88–95; `setDefault` dòng 121–128:
  URL mặc định `TARGET_DEFAULT_URL`
  (`SalesforceConnectionUtils.java` dòng 34:
  `https://login.salesforce.com/services/Soap/u/47.0`), timeout `"60000"`,
  compression false, module `"Account"`.
- Serialization: `SalesforceInputMeta.getXML()` (dòng 496–529) — nối tiếp
  super: `condition` (498), `specifyQuery` (499), `query` (500),
  `include_targeturl` (501), `targeturl_field` (502), `include_module`
  (503), `module_field` (504), `include_rownum` (505),
  `include_deletion_date` (506), `deletion_date_field` (508),
  `rownum_field` (509), `include_sql` (510), `sql_field` (511),
  `include_Timestamp` — chữ T hoa (512), `timestamp_field` (513),
  `read_from` (514), `read_to` (515), `records_filter` dạng mã qua
  `getRecordsFilterCode` (516–518), `queryAll` (519), block `<fields>`
  paired (521–525, mỗi field qua `SalesforceInputField.getXML()`),
  `limit` cuối (526).
- Field item: `SalesforceInputField.getXML()`
  (`.../salesforceinput/SalesforceInputField.java` dòng 119–137) — thứ tự:
  `name` (123), `field` (124), `idlookup` Y/N (125), `type` chuỗi
  value-meta (126), `format` (127), `currency` (128), `decimal` (129),
  `group` (130), `length` (131), `precision` (132), `trim_type` mã
  `none/left/right/both` (133), `repeat` Y/N (134).
- Deserialization: `readData()` (dòng 531–571) — boolean parse
  `"Y".equalsIgnoreCase(...)` (thiếu tag → false, an toàn) cho mọi cờ;
  `records_filter` qua `getRecordsFilterByCode(NVL(tag,""))`
  (`SalesforceConnectionUtils.java` dòng 78–89: null/lạ → 0 = all);
  `<fields>` đếm `<field>` (556–557), `allocate(n)` (559). Field
  `readData` (`SalesforceInputField.java` dòng 139–152): `repeat` là
  `!"N".equalsIgnoreCase(...)` (dòng 151) — THIẾU tag thành TRUE;
  `trim_type` lạ/thiếu → 0 = none (dòng 186–197).
- Khởi tạo: `setDefault()` (dòng 582–606) — mọi cờ false, chuỗi rỗng,
  `allocate(0)`, `rowLimit "0"` (605). Tách khỏi fallback khi load.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–230) bao fragment bằng `name`, `type` (= step ID), `description`,
  `distribute`, `custom_distribution`, `copies`, `partitioning`, rồi
  `attributes`, `cluster_schema`, `remotesteps`, `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 608–674) phát cột từ
  `inputFields[]` (type NONE → String, dòng 614–617) rồi append cột phụ theo
  từng cờ (targeturl/module/sql String 250; timestamp/deletion Date;
  rownum Integer). `check()` (dòng 759–826): không nhận input (có input nối
  vào → ERROR), yêu cầu ≥1 field, cờ nào bật phải có tên field.
- Không có `<connection>`: step dùng credential Salesforce riêng —
  template không mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (query tự ghi + lọc updated + cột phụ):

```xml
<specifyQuery>Y</specifyQuery>
<query>SELECT Id, Name FROM Account WHERE LastModifiedDate &gt; LAST_N_DAYS:7</query>
<include_rownum>Y</include_rownum>
<rownum_field>ROW_NR</rownum_field>
<records_filter>updated</records_filter>
<queryAll>N</queryAll>
<fields>
  <field>
    <name>ACCOUNT_ID</name>
    <field>Id</field>
    <idlookup>N</idlookup>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
  <field>
    <name>ACCOUNT_NAME</name>
    <field>Name</field>
    <idlookup>N</idlookup>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>255</length>
    <precision>-1</precision>
    <trim_type>both</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
<limit>1000</limit>
```

Fill `<fields>` bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<repeat>` thiếu → TRUE**: `readData` dùng phủ định (`!"N"...`) —
  luôn emit `<repeat>N</repeat>` tường minh, không được lược.
- **`<include_Timestamp>` viết hoa T**: đúng như `getXML()` dòng 512 —
  viết `include_timestamp` thường sẽ load thành false lặng lẽ.
- **`<records_filter>` là mã chuỗi** `all`/`updated`/`deleted`
  (`recordsFilterCode`, dòng 49), không phải số 0/1/2.
- **Credential luôn `${VAR}`**: không embed username/password/URL thật;
  `<password>` production được mã hóa khi không phải biến.
- Template mặc định là khung cấu hình — người dùng phải điền credential,
  module và fields tồn tại trong Salesforce org.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
