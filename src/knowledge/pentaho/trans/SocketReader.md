# SocketReader — Step đọc dòng qua socket

Đọc các dòng qua socket TCP (`hostname` + `port` chuỗi) với buffer
`<buffer_size>` và cờ nén `<compressed>`. Step BẮT BUỘC có input
(`check()` ERROR khi không có — socket gắn vào luồng đang chạy);
`getFields()` là no-op (giữ nguyên schema input).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SocketReader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <hostname>${SOCKET_HOST}</hostname>
    <port>${SOCKET_PORT}</port>
    <buffer_size>3000</buffer_size>
    <compressed>Y</compressed>
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
| `<hostname>` | Y | Host socket; luôn dùng `${VAR}`, không embed host thật. |
| `<port>` | Y | Port socket (chuỗi, cho phép `${VAR}`). |
| `<buffer_size>` | N | Kích thước buffer (chuỗi); mặc định `"3000"`. |
| `<compressed>` | N | `Y` (mặc định) = nén; `N` = không nén. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SOCKET_READER` | `<type>` | `SocketReader`. |
| `configuration.hostname` | `<hostname>` | Placeholder `${VAR}`. |
| `configuration.port` | `<port>` | Chuỗi, cho phép `${VAR}`. |
| `configuration.buffer_size` | `<buffer_size>` | Chuỗi số. |
| `configuration.compressed` | `<compressed>` | Boolean → Y/N (mặc định Y). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 5 —
  `<step id="SocketReader">` →
  `org.pentaho.di.trans.steps.socketreader.SocketReaderMeta` (category
  Inline). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SocketReaderMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/socketreader/SocketReaderMeta.java`
  dòng 75–84) — đúng thứ tự `hostname` (string), `port` (string),
  `buffer_size` (string), `compressed` (boolean → Y/N qua
  `addTagValue(boolean)`).
- Deserialization: `readData()` (dòng 86–91) — strings `getTagValue`
  (thiếu → null); `compressed="Y".equalsIgnoreCase(tag)` (thiếu/`"true"`/
  `"N"` → false). **BẪY**: file cũ ghi `true` chữ sẽ load thành false —
  chỉ `Y` (hoa/thường) mới true.
- Khởi tạo: `setDefault()` (dòng 93–96) — `bufferSize="3000"`,
  `compressed=true`; hostname/port null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 112–115) là no-op (giữ schema
  input). `check()` (dòng 117–145) ERROR khi `input.length==0` (đòi có
  input stream).
- Không có `<connection>`: host/port là strings thuần — template không
  mang `<connection>`, fixture test không cần khai báo connection.

Cấu hình không mặc định (không nén, buffer lớn):

```xml
<hostname>${SOCKET_HOST}</hostname>
<port>${SOCKET_PORT}</port>
<buffer_size>65536</buffer_size>
<compressed>N</compressed>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Bắt buộc có input stream**: step đứng một mình fail `check()` — phải
  nối hop từ step trước.
- **`compressed` chỉ nhận Y**: `true`/`1` đều load thành false — khi viết
  tay XML chỉ dùng `Y`/`N`.
- **`port`/`buffer_size` là chuỗi** — không parse int khi load; `${VAR}`
  substitute lúc runtime.
- **Host luôn `${VAR}`** — không embed host/port thật.
- Cặp với `SocketWriter` (port/buffer/compressed phải khớp hai đầu).
- Template mặc định là khung cấu hình — cần socket peer lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
