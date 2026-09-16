# PING — Job entry ping host

Entry kiểm tra host có trả lời ping không. Ba chế độ (`pingtype`):
`classicPing` (Java `InetAddress.isReachable`), `systemPing` (lệnh ping của
OS) và `bothPings` (cả hai). Entry điều kiện (`evaluates() = true`) — host
trả lời → nhánh success.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>PING</type>
      <attributes/>
      <hostname>${PING_HOST}</hostname>
      <nbr_packets>2</nbr_packets>
      <nbrpaquets>2</nbrpaquets>
      <timeout>3000</timeout>
      <pingtype>classicPing</pingtype>
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
| `<hostname>` | Y | Host/IP cần ping (`${PING_HOST}`). |
| `<nbr_packets>` | N | Số gói ping; mặc định `2`. |
| `<nbrpaquets>` | N | Tag legacy (Kettle 2.5.0) — `getXML()` LUÔN ghi trùng giá trị `nbrPackets`; chỉ dùng khi load file cũ thiếu `nbr_packets`. |
| `<timeout>` | N | Timeout ms; mặc định `3000`. |
| `<pingtype>` | N | `classicPing` (mặc định khi thiếu/lạ), `systemPing`, `bothPings`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PING` | `<type>` | `PING`. |
| `configuration.host` | `<hostname>` | `${VAR}`. |
| `configuration.packets` | `<nbr_packets>` (+ `<nbrpaquets>` giữ đồng bộ) | Số gói. |
| `configuration.timeout_ms` | `<timeout>` | Ms, chuỗi số. |
| `configuration.mode` | `<pingtype>` | `classicPing`/`systemPing`/`bothPings`. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-job-entries.xml` dòng 30 —
  `<job-entry id="PING">` → `org.pentaho.di.job.entries.ping.JobEntryPing`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `JobEntryPing.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entries/ping/JobEntryPing.java`
  dòng 102–116) — `super.getXML()` rồi đúng thứ tự `hostname`,
  `nbr_packets`, `nbrpaquets` (legacy, ghi trùng giá trị — dòng 109–110,
  TODO giữ từ 2.5.0), `timeout`, `pingtype`.
- Deserialization: `loadXML()` (dòng 118–151) — tương thích ngược: nếu
  `nbr_packets` thiếu mà `nbrpaquets` có thì dùng `nbrpaquets` (dòng
  127–132); `pingtype` thiếu/rỗng → `classicPing`, `systemPing` →
  isystemPing(1), `bothPings` → ibothPings(2), còn lại → classic(0) (dòng
  135–147). So khớp `pingtype` phân biệt hoa/thường (`.equals`, không phải
  `equalsIgnoreCase`).
- Khởi tạo: constructor (dòng 85–91) — `pingtype=classicPing`,
  `nbrPackets="2"`, `timeout="3000"`, `hostname=null`.
- Wrapper: `JobEntryBase.getXML()` (dòng 415–419) + `JobEntryCopy.getXML()`
  (dòng 102–113) — xem reference `TABLE_EXISTS` mục 4.
- Ngữ nghĩa runtime: `execute()` (dòng 277+), `evaluates()` = true (dòng
  336). Không chạy network khi test template.

Cấu hình không mặc định (system ping, 5 gói, timeout 10s):

```xml
<hostname>${PING_HOST}</hostname>
<nbr_packets>5</nbr_packets>
<nbrpaquets>5</nbrpaquets>
<timeout>10000</timeout>
<pingtype>systemPing</pingtype>
```

## 5. Lưu ý / bẫy

- **`<nbrpaquets>` phải đi kèm `<nbr_packets>`**: `getXML()` luôn ghi cả
  hai với cùng giá trị — template giữ cả hai đồng bộ; chỉ ghi một tag thì
  vẫn load được nhưng lệch khỏi serializer.
- **`pingtype` case-sensitive khi load**: `SystemPing` (hoa S) không khớp
  `.equals("systemPing")` → rơi về `classicPing` lặng lẽ. Giữ đúng chữ
  thường đầu như code mẫu (`classicPing`, `systemPing`, `bothPings`).
- **Timeout/port là chuỗi số**: `<timeout>` lưu String (`"3000"`), không
  phải int — nhưng vẫn ghi chữ số thuần, không Y/N hay đơn vị.
- Template mặc định là khung cấu hình — người dùng phải điền host có thật;
  không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  constructor tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen/network thật) — không tuyên bố hai
  mức này.
