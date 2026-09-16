# GetSlaveSequence — Step lấy sequence từ slave server

Xin một khối giá trị sequence tiếp theo từ một slave server
(`<slave>` là TÊN slave-server, chuỗi thuần — không phải `<connection>`
DB) và gắn vào mỗi dòng ra dưới dạng cột Integer `<valuename>`.
`<increment>` là chuỗi số lượng xin mỗi lần (mặc định `"10000"`), không
phải int.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetSlaveSequence</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <valuename>ID</valuename>
    <slave>${SLAVE_SERVER}</slave>
    <seqname>${SEQUENCE_NAME}</seqname>
    <increment>10000</increment>
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
| `<valuename>` | Y | Tên cột Integer gắn vào dòng ra. |
| `<slave>` | Y | TÊN slave server (chuỗi, cho phép `${VAR}`) — không phải connection DB. |
| `<seqname>` | Y | Tên sequence trên slave; cho phép `${VAR}`. |
| `<increment>` | N | Số lượng xin mỗi lần, DƯỚI DẠNG CHUỖI; mặc định `"10000"`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_SLAVE_SEQUENCE` | `<type>` | `GetSlaveSequence`. |
| `configuration.value_field` | `<valuename>` | Tên cột Integer output. |
| `configuration.slave_server` | `<slave>` | Tên slave-server (`${VAR}`). |
| `configuration.sequence` | `<seqname>` | Tên sequence (`${VAR}`). |
| `configuration.increment` | `<increment>` | Chuỗi số, mặc định `"10000"`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 12 —
  `<step id="GetSlaveSequence">` →
  `org.pentaho.di.trans.steps.getslavesequence.GetSlaveSequenceMeta`
  (category Transform). Registry presence không phải XML evidence,
  evidence là serializer dưới đây.
- Serialization: `GetSlaveSequenceMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/getslavesequence/GetSlaveSequenceMeta.java`
  dòng 105–114) — đúng thứ tự `valuename`, `slave`, `seqname`,
  `increment`, cả 4 là string vô điều kiện (`increment` KHÔNG phải int).
- Deserialization: `readData()` (dòng 76–86, qua `loadXML`) — 4×
  `getTagValue`, không default (thiếu → null); bọc try →
  `KettleXMLException`.
- Khởi tạo: `setDefault()` (dòng 89–94) — `valuename="id"`,
  `slaveServerName="slave server name"`,
  `sequenceName="Slave Sequence Name -- To be configured"`,
  `increment="10000"`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 97–102) thêm một
  `ValueMetaInteger(valuename)`. `check()` (dòng 143–159) chỉ kiểm tra có
  input hay không.
- Không có `<connection>`: `<slave>` là tên slave-server chuỗi thuần —
  template không mang `<connection>`, fixture test không cần khai báo
  connection (đừng nhầm với DB connection).

Cấu hình không mặc định (sequence đơn hàng, khối 500):

```xml
<valuename>ORDER_SEQ</valuename>
<slave>${SLAVE_SERVER}</slave>
<seqname>SEQ_ORDER_ID</seqname>
<increment>500</increment>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<slave>` không phải DB connection**: là tên slave-server — đừng thêm
  `<connection>` vào template, đừng khai báo connection fixture cho step
  này.
- **`<increment>` là chuỗi**: giữ dạng text số; `${VAR}` được substitute
  lúc runtime.
- **Thiếu tag → null** (không fallback): file thiếu `valuename` load
  thành null rồi fail lúc runtime — template luôn emit đủ 4 tag.
- Template mặc định là khung cấu hình — người dùng phải điền slave
  server và sequence có thật; cần clustering/slave lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
