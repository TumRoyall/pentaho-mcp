# WebServiceAvailable — Step kiểm tra URL theo từng dòng

Với MỖI dòng đầu vào, lấy URL từ field (`<urlField>`), mở kết nối với
timeout cho trước và append cột Boolean (`<resultfieldname>`, mặc định
`result`): nối được → `true`, ngược lại `false`. Output = input row + 1
cột Boolean. Khác job `WEBSERVICE_AVAILABLE` (đã có reference — kiểm tra
một URL TĨNH `<url>` một lần trong job): step này đọc URL ĐỘNG từ field
từng dòng. Khác `WebServiceLookup` (gọi SOAP + parse response): step này
chỉ kiểm tra kết nối được hay không.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>WebServiceAvailable</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <urlField>{{URL_FIELD}}</urlField>
    <readTimeOut>0</readTimeOut>
    <connectTimeOut>0</connectTimeOut>
    <resultfieldname>result</resultfieldname>
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
| `<urlField>` | Y | Tên FIELD chứa URL (động theo dòng — không phải URL tĩnh). `check()` ERROR khi rỗng. Step cần hop vào. |
| `<readTimeOut>` | N | Timeout đọc ms; mặc định `"0"` = vô hạn. Chữ T hoa. ĐỨNG TRƯỚC `connectTimeOut`. |
| `<connectTimeOut>` | N | Timeout kết nối ms; mặc định `"0"`. Chữ T hoa. |
| `<resultfieldname>` | Y | Tên cột Boolean kết quả; mặc định `result`. `check()` ERROR khi rỗng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WEB_SERVICE_AVAILABLE` | `<type>` | `WebServiceAvailable` (trans — khác job `WEBSERVICE_AVAILABLE`). |
| `configuration.url_field` | `<urlField>` | Field động, cần hop vào. |
| `configuration.read_timeout_ms` | `<readTimeOut>` | Chữ T hoa; đứng trước connect. |
| `configuration.connect_timeout_ms` | `<connectTimeOut>` | Chữ T hoa. |
| `configuration.result_field` | `<resultfieldname>` | Tên cột Boolean. |

Không có list lặp — toàn tag vô hướng, fill bằng `setFieldPath`. Step cần
hop vào (đọc field động) nhưng không khai báo tham chiếu step trong XML.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 110 —
  `<step id="WebServiceAvailable">` →
  `org.pentaho.di.trans.steps.webserviceavailable.WebServiceAvailableMeta`.
  Registry presence không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `WebServiceAvailableMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/webserviceavailable/WebServiceAvailableMeta.java`
  dòng 148–156) — đúng thứ tự `urlField`, `readTimeOut`, `connectTimeOut`,
  `resultfieldname` (dòng 151–154). Chú ý `readTimeOut` TRƯỚC
  `connectTimeOut` (ngược trực giác).
- Deserialization: `loadXML()` (dòng 121–123) gọi `readData()` (dòng
  158–168) — đọc thẳng 4 tag, thiếu → null (không fallback).
- Khởi tạo: `setDefault()` (dòng 131–135) — `resultfieldname="result"`,
  `connectTimeOut="0"`, `readTimeOut="0"`.
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.
- Ngữ nghĩa runtime: `getFields()` (dòng 137–146) append 1 cột
  `ValueMetaBoolean(resultfieldname)` khi non-rỗng; `check()` (dòng
  195+) ERROR khi thiếu `resultfieldname`/`urlField`. Không chạy network
  khi test template.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (timeout 10s/30s + tên cột riêng):

```xml
<urlField>ENDPOINT_URL</urlField>
<readTimeOut>30000</readTimeOut>
<connectTimeOut>10000</connectTimeOut>
<resultfieldname>IS_AVAILABLE</resultfieldname>
```

## 5. Lưu ý / bẫy

- **`readTimeOut` đứng TRƯỚC `connectTimeOut`**: cả `getXML()` (dòng
  152–153) lẫn constructor tư duy connect-trước đều dễ nhầm — giữ đúng
  thứ tự source.
- **URL động từ field**: `<urlField>` là TÊN FIELD, không phải URL —
  đừng điền URL trực tiếp (đó là job entry). Step bắt buộc có hop vào
  chứa field này.
- **Thiếu tag → null**: không fallback `"0"`/`"result"` khi load (dòng
  158–168) — template luôn ghi đủ 4 tag.
- Template mặc định là khung cấu hình — người dùng phải nối hop có field
  URL; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()`/`getFields()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/network thật) — không tuyên bố hai mức này.
