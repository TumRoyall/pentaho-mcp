# LDAPInput — Step đọc dữ liệu từ LDAP

Tìm kiếm trên LDAP server (`host`/`port`, bind `username`/`password` khi
`<useauthentication>=Y`) theo `<filterstring>` + `<searchbase>` +
`<searchScope>` (`object`/`onelevel`/`subtree`), trả về các attribute liệt
kê trong `<fields>/<field>` thành cột dòng. Hỗ trợ phân trang
(`usepaging`/`pagesize`), tìm kiếm động từ cột dòng (`dynamicsearch`,
`dynamicfilter`) và TLS (`protocol`, truststore).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>LDAPInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <usepaging>N</usepaging>
    <pagesize>1000</pagesize>
    <useauthentication>Y</useauthentication>
    <rownum>N</rownum>
    <rownum_field/>
    <host>${LDAP_HOST}</host>
    <username>${LDAP_USERNAME}</username>
    <password>${LDAP_PASSWORD}</password>
    <port>389</port>
    <filterstring>objectclass=*</filterstring>
    <searchbase>${LDAP_SEARCH_BASE}</searchbase>
    <fields>
      <field>
        <name>{{FIELD_NAME_1}}</name>
        <attribute>cn</attribute>
        <attribute_fetch_as>string</attribute_fetch_as>
        <sorted_key>N</sorted_key>
        <type>String</type>
        <format/>
        <length>-1</length>
        <precision>-1</precision>
        <currency/>
        <decimal/>
        <group/>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <timelimit>0</timelimit>
    <multivaluedseparator>;</multivaluedseparator>
    <dynamicsearch>N</dynamicsearch>
    <dynamicseachfieldname/>
    <dynamicfilter>N</dynamicfilter>
    <dynamicfilterfieldname/>
    <searchScope>subtree</searchScope>
    <protocol>LDAP</protocol>
    <trustStorePath/>
    <trustStorePassword>${LDAP_TRUSTSTORE_PASSWORD}</trustStorePassword>
    <trustAllCertificates>N</trustAllCertificates>
    <useCertificate>N</useCertificate>
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
| `<usepaging>` / `<pagesize>` | N | Phân trang; pagesize mặc định `"1000"` (chuỗi). |
| `<useauthentication>` | N | Y = bind username/password; N mặc định. |
| `<rownum>` + `<rownum_field>` | N | Cột số thứ tự. |
| `<host>` / `<port>` | Y | Host `${LDAP_HOST}`, port mặc định `"389"`. |
| `<username>` / `<password>` | N (Y khi auth) | `${VAR}`; password mã hóa khi không phải biến. |
| `<filterstring>` | N | Filter LDAP; mặc định `"objectclass=*"` (`DEFAUL_FILTER_STRING`). |
| `<searchbase>` | Y | DN gốc tìm kiếm. `${VAR}` được. |
| `<fields>/<field>` | Y (≥1 khi chạy) | Mỗi item: `name`, `attribute`, `attribute_fetch_as` (`string`/`binary`), `sorted_key` Y/N, `type` chuỗi value-meta, `format`, `length`, `precision`, `currency`, `decimal`, `group`, `trim_type`, `repeat`. |
| `<limit>` / `<timelimit>` | N | SỐ nguyên (int, không phải Y/N); mặc định 0 = không giới hạn. |
| `<multivaluedseparator>` | N | Phân tách attribute đa trị; mặc định `";"`. |
| `<dynamicsearch>` + `<dynamicseachfieldname>` | N | Y = lấy search base động từ cột. Tag đúng typo `dynamicseachfieldname` (thiếu r). |
| `<dynamicfilter>` + `<dynamicfilterfieldname>` | N | Y = lấy filter động từ cột. |
| `<searchScope>` | N | Mã `object`/`onelevel`/`subtree`; thiếu/lạ → `subtree`. |
| `<protocol>` | N | Loại kết nối (mặc định entry đầu của `LdapProtocolFactory`, thường `LDAP`). |
| `<trustStorePath>` / `<trustStorePassword>` / `<trustAllCertificates>` / `<useCertificate>` | N | TLS/client-cert; password `${VAR}` mã hóa. |

`<fields>` paired list — giữ paired.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: LDAP_INPUT` | `<type>` | `LDAPInput`. |
| `configuration.host` / `port` | `<host>` / `<port>` | `${LDAP_HOST}` / `389`. |
| `configuration.search_base` | `<searchbase>` | DN gốc. |
| `configuration.filter` | `<filterstring>` | `objectclass=*`. |
| `configuration.search_scope` | `<searchScope>` | Mã chuỗi. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Cột output. |
| `configuration.fields[].attribute` | `<fields>/<field>/<attribute>` | Attribute LDAP. |
| `configuration.fields[].fetch_as` | `<fields>/<field>/<attribute_fetch_as>` | `string`/`binary`. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="LDAPInput", ...)`
  (`plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapinput/LDAPInputMeta.java`
  dòng 55–60, category Input).
- Mã scope: `searchScopeCode = {"object","onelevel","subtree"}` (dòng
  131); `searchScope` thiếu → `subtree` (dòng 662–665). Mã fetch:
  `FetchAttributeAsCode = {"string","binary"}`
  (`LDAPInputField.java` dòng 46).
- Serialization: `getXML()` (dòng 531–592) — `usepaging` (534),
  `pagesize` (535), `useauthentication` (536), `rownum` (537),
  `rownum_field` (538), `host` (539), `username` (540), `password` mã
  hóa (541–542), `port` (544), `filterstring` (545), `searchbase`
  (546), block `<fields>` (551–572; thứ tự item: `name` 554,
  `attribute` 555, `attribute_fetch_as` 556–557, `sorted_key` 558,
  `type` 559, `format` 560, `length` 561, `precision` 562, `currency`
  564, `decimal` 565, `group` 566, `trim_type` 567, `repeat` 568),
  `limit` (574), `timelimit` (575), `multivaluedseparator` (576),
  `dynamicsearch` (577), `dynamicseachfieldname` TYPO thiếu r (578),
  `dynamicfilter` (579), `dynamicfilterfieldname` (580), `searchScope`
  mã (581), `protocol` (583), `trustStorePath` (584),
  `trustStorePassword` mã hóa (585–587), `trustAllCertificates` (588),
  `useCertificate` (589).
- Deserialization: `readData()` (dòng 601–677) — `sorted_key` null →
  false (630–635); `repeat` null → false (639–644, AN TOÀN — khác họ
  Salesforce); `limit`/`timelimit` int qua `Const.toInt(...,0)`
  (655–656); scope NVL → subtree (662–665).
- Khởi tạo: `setDefault()` (dòng 698–731) — paging/auth/rownum false,
  pagesize `"1000"`, port `"389"`, filter `"objectclass=*"`
  (`LDAPConnection.java` dòng 69), separator `";"`, limit/time 0,
  scope subtree, allocate 0.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 734+) phát cột từ fields (NONE
  → String) + cột rownum.
- Không có `<connection>` DB — kết nối LDAP riêng; fixture không cần
  khai báo connection.

Cấu hình không mặc định (auth + scope onelevel + binary attribute):

```xml
<useauthentication>Y</useauthentication>
<host>${LDAP_HOST}</host>
<filterstring>(objectClass=person)</filterstring>
<searchbase>ou=people,dc=example,dc=com</searchbase>
<fields>
  <field>
    <name>FULL_NAME</name>
    <attribute>cn</attribute>
    <attribute_fetch_as>string</attribute_fetch_as>
    <sorted_key>N</sorted_key>
    <type>String</type>
    <format/>
    <length>255</length>
    <precision>-1</precision>
    <currency/>
    <decimal/>
    <group/>
    <trim_type>both</trim_type>
    <repeat>N</repeat>
  </field>
  <field>
    <name>PHOTO</name>
    <attribute>jpegPhoto</attribute>
    <attribute_fetch_as>binary</attribute_fetch_as>
    <sorted_key>N</sorted_key>
    <type>Binary</type>
    <format/>
    <length>-1</length>
    <precision>-1</precision>
    <currency/>
    <decimal/>
    <group/>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
<limit>500</limit>
<searchScope>onelevel</searchScope>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Tag `dynamicseachfieldname` thiếu chữ r** (dòng 578) — viết đúng
  chính tả `dynamicsearchfieldname` sẽ load thành null.
- **`<limit>`/`<timelimit>` là SỐ**, không phải Y/N.
- **`<repeat>` thiếu an toàn** (→ false), nhưng luôn emit tường minh.
- Host/password/truststore dùng `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
