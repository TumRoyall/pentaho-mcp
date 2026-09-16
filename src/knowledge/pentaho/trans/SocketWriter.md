# SocketWriter — Step ghi dòng qua socket

Ghi các dòng ra socket TCP (`port` chuỗi + `buffer_size` + khoảng flush
`<flush_interval>`) với cờ nén `<compressed>`. Step BẮT BUỘC có input
(`check()` ERROR khi không có); `getFields()` là no-op (giữ nguyên
schema input). Cặp với `SocketReader` ở đầu bên kia (port/buffer/
compressed khớp nhau).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SocketWriter</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <port>${SOCKET_PORT}</port>
    <buffer_size>2000</buffer_size>
    <flush_interval>5000</flush_interval>
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
| `<port>` | Y | Port socket (chuỗi, cho phép `${VAR}`). |
| `<buffer_size>` | N | Kích thước buffer (chuỗi); mặc định `"2000"`. |
| `<flush_interval>` | N | Khoảng flush (chuỗi); mặc định `"5000"`. |
| `<compressed>` | N | `Y` (mặc định) = nén; `N` = không nén. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SOCKET_WRITER` | `<type>` | `SocketWriter`. |
| `configuration.port` | `<port>` | Chuỗi, cho phép `${VAR}`. |
| `configuration.buffer_size` | `<buffer_size>` | Chuỗi số. |
| `configuration.flush_interval` | `<flush_interval>` | Chuỗi số. |
| `configuration.compressed` | `<compressed>` | Boolean → Y/N (mặc định Y). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 6 —
  `<step id="SocketWriter">` →
  `org.pentaho.di.trans.steps.socketwriter.SocketWriterMeta` (category
  Inline). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `SocketWriterMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/socketwriter/SocketWriterMeta.java`
  dòng 75–84) — đúng thứ tự `port` (string), `buffer_size` (string),
  `flush_interval` (string), `compressed` (boolean → Y/N). Khác
  SocketReader ở tag `flush_interval` thay cho `hostname`.
- Deserialization: `readData()` (dòng 86–91) — strings `getTagValue`
  (thiếu → null); `compressed="Y".equalsIgnoreCase` (thiếu → false;
  `true` chữ cũng thành false).
- Khởi tạo: `setDefault()` (dòng 93–97) — `bufferSize="2000"`,
  `flushInterval="5000"`, `compressed=true`; port null.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 113–116) là no-op. `check()`
  (dòng 118–146) ERROR khi không có input — giống SocketReader.
- Không có `<connection>`: port là string thuần — template không mang
  `<connection>`, fixture test không cần khai báo connection.

Cấu hình không mặc định (không nén, flush nhanh):

```xml
<port>${SOCKET_PORT}</port>
<buffer_size>65536</buffer_size>
<flush_interval>1000</flush_interval>
<compressed>N</compressed>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Bắt buộc có input stream** — đứng một mình fail `check()`.
- **Đừng nhầm với SocketReader**: Writer có `flush_interval`, KHÔNG có
  `hostname` — copy template Reader sang là sai tag.
- **`compressed` chỉ nhận Y** — `true` chữ load thành false.
- **Port luôn `${VAR}`** — không embed port thật.
- **Hai đầu phải khớp**: port/buffer/compressed của Writer và Reader phải
  tương thích, nếu không kết nối fail lúc runtime.
- Template mặc định là khung cấu hình — cần socket peer lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
