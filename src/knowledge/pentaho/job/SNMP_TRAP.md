# SNMP_TRAP — Job entry gửi SNMP trap

Entry gửi một SNMP trap tới `servername:port` với OID, community/user
(`targettype`), message và thông tin SNMPv3 (`user`, `passphrase`,
`engineid`). Entry điều kiện (`evaluates() = true`).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>SNMP_TRAP</type>
      <attributes/>
      <port>162</port>
      <servername>${SNMP_HOST}</servername>
      <oid>{{OID}}</oid>
      <comstring>public</comstring>
      <message>{{MESSAGE}}</message>
      <timeout>5000</timeout>
      <nrretry>1</nrretry>
      <targettype>community</targettype>
      <user/>
      <passphrase>${SNMP_PASSPHRASE}</passphrase>
      <engineid/>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<port>` | N | Cổng SNMP; mặc định `162`. |
| `<servername>` | Y | Host SNMP (`${SNMP_HOST}`). |
| `<oid>` | Y | OID của trap. |
| `<comstring>` | N | Community string; mặc định `public`. |
| `<message>` | Y | Nội dung trap. |
| `<timeout>` | N | Timeout ms; mặc định `5000`. |
| `<nrretry>` | N | Số lần retry; mặc định `1`. |
| `<targettype>` | N | `community` (mặc định) hoặc `user` (SNMPv3). |
| `<user>` / `<passphrase>` / `<engineid>` | N (bắt buộc khi `targettype=user`) | Thông tin SNMPv3; `<passphrase>` được mã hóa khi lưu qua Spoon trừ khi dùng biến — luôn dùng `${VAR}`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SNMP_TRAP` | `<type>` | `SNMP_TRAP`. |
| `configuration.host` | `<servername>` | `${VAR}`. |
| `configuration.oid` | `<oid>` | OID. |
| `configuration.community` | `<comstring>` | Mặc định `public`. |
| `configuration.target` | `<targettype>` | `community`/`user`. |
| `configuration.user` / `configuration.passphrase` / `configuration.engine_id` | `<user>` / `<passphrase>` / `<engineid>` | SNMPv3; passphrase `${VAR}`. |
| `configuration.timeout_ms` / `configuration.retries` | `<timeout>` / `<nrretry>` | Chuỗi số. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 53 —
  `<job-entry id="SNMP_TRAP">` →
  `org.pentaho.di.job.entries.snmptrap.JobEntrySNMPTrap`. Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntrySNMPTrap.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/snmptrap/JobEntrySNMPTrap.java`
  dòng 156–172) — `super.getXML()` rồi đúng thứ tự `port`, `servername`,
  `oid`, `comstring`, `message`, `timeout`, `nrretry`, `targettype`,
  `user`, `passphrase` (mã hóa qua
  `Encr.encryptPasswordIfNotUsingVariables`, dòng 169), `engineid`.
- Deserialization: `loadXML()` (dòng 174–193) — đọc thẳng 11 tag;
  `passphrase` giải mã qua `Encr.decryptPasswordOptionallyEncrypted`
  (dòng 187); thiếu tag → null (không fallback).
- Mã target: `target_type_Code = {community, user}` (dòng 108);
  `getTargetTypeCode` null/lạ → `community` (dòng 145–154).
- Khởi tạo: constructor (dòng 110–123) — `port="162"`,
  `comstring="public"`, `nrretry="1"`, `timeout="5000"`,
  `targettype="community"`, còn lại null.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 394+), `evaluates()` = true (dòng
  520). Không chạy network khi test template.

Cấu hình không mặc định (SNMPv3 user + retry 3):

```xml
<port>162</port>
<servername>${SNMP_HOST}</servername>
<oid>1.3.6.1.4.1.8072.2.3.0.1</oid>
<comstring>public</comstring>
<message>ETL job failed</message>
<timeout>5000</timeout>
<nrretry>3</nrretry>
<targettype>user</targettype>
<user>${SNMP_USER}</user>
<passphrase>${SNMP_PASSPHRASE}</passphrase>
<engineid>${SNMP_ENGINE_ID}</engineid>
```

## 5. Lưu ý / bẫy

- **`<passphrase>` mã hóa, `<comstring>` thì KHÔNG**: `getXML()` chỉ mã
  hóa `passphrase` (dòng 169) — community string lưu plain. Cả hai đều nên
  dùng `${VAR}`.
- **`targettype=user` mới cần user/passphrase/engineid**: chế độ
  `community` (mặc định) bỏ qua 3 tag này khi chạy — đừng nhầm là bắt buộc
  luôn.
- **Tag XML viết thường**: `comstring`, `nrretry`, `targettype`,
  `engineid` — giữ đúng chính tả này (không gạch dưới, không camelCase).
- Template mặc định là khung cấu hình — người dùng phải điền host/OID có
  thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
