# LDAPOutput — Step ghi dữ liệu lên LDAP

Với MỖI dòng đầu vào, thực hiện một thao tác LDAP (`<operationType>`:
`insert`/`upsert`/`update`/`add`/`delete`/`rename`, mặc định `insert`) trên
DN lấy từ cột `<dnFieldName>`, ánh xạ cột dòng (`<field>`) sang attribute
(`<name>`), chỉ ghi khi `<update>=Y`. Kết nối và TLS như họ LDAPInput.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>LDAPOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <useauthentication>Y</useauthentication>
    <host>${LDAP_HOST}</host>
    <username>${LDAP_USERNAME}</username>
    <password>${LDAP_PASSWORD}</password>
    <port>389</port>
    <dnFieldName>{{DN_FIELD}}</dnFieldName>
    <failIfNotExist>Y</failIfNotExist>
    <operationType>upsert</operationType>
    <multivaluedseparator>;</multivaluedseparator>
    <searchBase>${LDAP_SEARCH_BASE}</searchBase>
    <referralType>follow</referralType>
    <derefAliasesType>always</derefAliasesType>
    <oldDnFieldName/>
    <newDnFieldName/>
    <deleteRDN>Y</deleteRDN>
    <fields>
      <field>
        <name>cn</name>
        <field>{{INPUT_FIELD_CN}}</field>
        <update>Y</update>
      </field>
    </fields>
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
| `<useauthentication>` / `<host>` / `<username>` / `<password>` / `<port>` | Y | Như LDAPInput; `${VAR}`. |
| `<dnFieldName>` | Y | Cột dòng chứa DN thao tác. |
| `<failIfNotExist>` | N | Y (mặc định mới true) = fail khi entry không tồn tại. |
| `<operationType>` | N | Mã `insert` (mặc định) / `upsert` / `update` / `add` / `delete` / `rename`. |
| `<multivaluedseparator>` | N | `";"` mặc định. |
| `<searchBase>` | N | Base cho search (chú ý B hoa — khác `searchbase` của Input). |
| `<referralType>` | N | `follow` (mặc định) / `ignore`. |
| `<derefAliasesType>` | N | `always` (mặc định) / `never` / `searching` / `finding`. |
| `<oldDnFieldName>` / `<newDnFieldName>` | N (Y khi rename) | Cột DN cũ/mới cho operation rename. |
| `<deleteRDN>` | N | Mặc định mới true. |
| `<fields>/<field>/<name>` | Y | Attribute LDAP đích. |
| `<fields>/<field>/<field>` | N | Cột nguồn; thiếu → trùng `<name>`. |
| `<fields>/<field>/<update>` | N | Y = ghi attribute này; THIẾU → TRUE (mặc định ghi). |
| `<protocol>` / `<trustStorePath>` / `<trustStorePassword>` / `<trustAllCertificates>` / `<useCertificate>` | N | TLS như Input. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: LDAP_OUTPUT` | `<type>` | `LDAPOutput`. |
| `configuration.operation` | `<operationType>` | Mã chuỗi 6 giá trị. |
| `configuration.dn_field` | `<dnFieldName>` | Cột DN. |
| `configuration.mappings[].attribute` | `<fields>/<field>/<name>` | Attribute đích. |
| `configuration.mappings[].stream_field` | `<fields>/<field>/<field>` | Cột nguồn. |
| `configuration.mappings[].update` | `<fields>/<field>/<update>` | Y/N. |

`<fields>` → MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="LDAPOutput", ...)`
  (`plugins/ldap/impl/src/main/java/org/pentaho/di/trans/steps/ldapoutput/LDAPOutputMeta.java`
  dòng 53+, category Output).
- Mã: `operationTypeCode = {"insert","upsert","update","add","delete","rename"}`
  (dòng 117); `referralTypeCode = {"follow","ignore"}` (dòng 143);
  `derefAliasesTypeCode = {"always","never","searching","finding"}`
  (dòng 163). Out-of-range → `[0]` (dòng 628–638).
- Serialization: `getXML()` (dòng 648–691) — `useauthentication`
  (651), `host` (652), `username` (653), `password` mã hóa (654–655),
  `port` (656), `dnFieldName` (657), `failIfNotExist` (658),
  `operationType` mã (659–660), `multivaluedseparator` (661),
  `searchBase` B hoa (662), `referralType` (663), `derefAliasesType`
  (664–665), `oldDnFieldName` (667), `newDnFieldName` (668),
  `deleteRDN` (669), block `<fields>` (671–681; `name` 675, `field`
  676, `update` 677), `protocol` (682), `trustStorePath` (683),
  `trustStorePassword` (684–686), `trustAllCertificates` (687),
  `useCertificate` (688).
- Deserialization: `readData()` (dòng 693–752) — `<field>` thiếu →
  stream = lookup (726–728); `<update>` thiếu → TRUE (729–739, NGƯỢC
  với mặc định false thường gặp — luôn emit `<update>`).
- Khởi tạo: `setDefault()` (dòng 754–784) — port `"389"`,
  failIfNotExist true, separator `";"`, deleteRDN true, allocate 0,
  operation insert, referral follow, deref always.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: worker `LDAPOutput` bỏ qua fields khi DELETE/RENAME
  theo nhánh (dòng 71–72); UPSERT chỉ update các cột `<update>=Y`.
- Không có `<connection>` DB.

Cấu hình không mặc định (rename DN):

```xml
<operationType>rename</operationType>
<dnFieldName>DN</dnFieldName>
<oldDnFieldName>OLD_DN</oldDnFieldName>
<newDnFieldName>NEW_DN</newDnFieldName>
<deleteRDN>Y</deleteRDN>
<fields>
  <field>
    <name>cn</name>
    <field>COMMON_NAME</field>
    <update>Y</update>
  </field>
</fields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<update>` thiếu → TRUE**: ngược trực giác — muốn bỏ qua attribute
  phải ghi tường minh `<update>N</update>`.
- **`searchBase` (Output) vs `searchbase` (Input)**: khác case chữ B —
  copy nhầm load thành null.
- Credential `${VAR}`; không embed thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
