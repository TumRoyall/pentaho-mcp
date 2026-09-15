# RowsFromResult — Step đọc result rows vào stream

Đọc các dòng mà transformation/job trước đã đặt vào result rows
(`RowsToResult` ở chiều ngược lại) và phát NGUYÊN VẸN từng row kèm
row-meta gốc ra stream. Khối `<fields>` là metadata KHAI BÁO
(`getFields()`), không phải lệnh chọn/sắp xếp/convert ở runtime —
`processRow()` không tra cứu cấu hình này. Không có input stream —
step này là điểm bắt đầu đọc kết quả đã lưu.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RowsFromResult</type>
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
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <length>-2</length>
        <precision>-2</precision>
      </field>
    </fields>
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
| `<fields>/<field>/<name>` | Y | Tên field khai báo cho metadata output. Nên khớp tên field trong result rows đã ghi — step KHÔNG tự lookup/đổi thứ tự theo khai báo ở runtime, nên lệch tên gây hiểu sai ở downstream chứ không được sửa tại đây. |
| `<fields>/<field>/<type>` | Y | Tên kiểu ValueMeta (`String`, `Integer`, `Number`, `Date`, ... — do `ValueMetaFactory.getValueMetaName()` sinh ra). Lúc load, `getIdForValueMeta()` so sánh KHÔNG phân biệt hoa/thường (`equalsIgnoreCase`); nên dùng đúng chính tả canonical mà serializer ghi ra. |
| `<fields>/<field>/<length>` | Y | Số nguyên khai báo cho metadata. `-2` là giá trị fallback khi tag thiếu/rỗng lúc load (`Const.toInt(tag, -2)`), không phải directive runtime. `getXML()` luôn ghi số nguyên (`XMLHandler.addTagValue(tag,int)`). |
| `<fields>/<field>/<precision>` | Y | Số nguyên khai báo cho metadata; `-2` cũng chỉ là fallback load, không phải directive runtime. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ROWS_FROM_RESULT` | `<type>` | `RowsFromResult`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Thứ tự item là thứ tự metadata khai báo, không phải thứ tự đọc runtime. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Nên dùng chính tả canonical (`Integer`); load chấp nhận mọi kiểu hoa/thường. |
| `configuration.fields[].length` | `<fields>/<field>/<length>` | Số nguyên; thiếu tag khi load → `-2`. |
| `configuration.fields[].precision` | `<fields>/<field>/<precision>` | Số nguyên; thiếu tag khi load → `-2`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (`<step
  id="RowsFromResult">`,
  `classname=org.pentaho.di.trans.steps.rowsfromresult.RowsFromResultMeta`,
  category Job). Class không mang annotation `@Step`; registry XML là
  nguồn đăng ký duy nhất trong phạm vi source đã kiểm kê.
- Serialization:
  `engine/src/main/java/org/pentaho/di/trans/steps/rowsfromresult/RowsFromResultMeta.java
  :: getXML()` (dòng 152–166) — ghi đúng một khối `<fields>` chứa 0..n
  item `<field>`, mỗi item đúng thứ tự `name`, `type` (qua
  `ValueMetaFactory.getValueMetaName(type[i])`), `length`, `precision`.
  Không có tag nào khác trong fragment (đặc biệt không có
  `select_unspecified`).
- Kiểu/hàm phụ trợ: `XMLHandler.addTagValue(String,String)`
  (`core/src/main/java/org/pentaho/di/core/xml/XMLHandler.java` dòng
  835–836) cho `name`/`type`; `addTagValue(String,int)` (dòng 916–930)
  cho `length`/`precision`. Giá trị `&`/`<` trong tên field được escape
  bởi `Encode.forXml`.
- Deserialization: `loadXML()` (dòng 130–132) gọi `readData()` (dòng
  168–182) — đếm `field` dưới `<fields>` qua `XMLHandler.countNodes`,
  đọc `name`, `type` (qua `ValueMetaFactory.getIdForValueMeta`, so
  sánh tên plugin bằng `equalsIgnoreCase` —
  `core/src/main/java/org/pentaho/di/core/row/value/ValueMetaFactory.java`
  dòng 149–151, nên load
  không phân biệt hoa/thường), rồi `length`/`precision` qua
  `Const.toInt(tag, -2)`: tag thiếu hoặc rỗng → `-2`. Đây là fallback
  khi đọc XML, không phải một nhánh runtime diễn giải `-2` thành
  "kế thừa metadata gốc".
- Khởi tạo: `setDefault()` (dòng 184–186) chỉ `allocate(0)` — step mới
  có danh sách fields RỖNG, khác với fallback `-2` khi load tag thiếu.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`. `getXML()` của plugin chỉ trả fragment `<fields>`.
- Ngữ nghĩa runtime — phân biệt metadata khai báo với row truyền qua:
  `RowsFromResultMeta.getFields()` (dòng 222–234) chỉ tạo ValueMeta
  khai báo (`fieldname[i]`, `type[i]`, `length[i]`, `precision[i]`) cho
  design-time/downstream tham khảo; còn `RowsFromResult.processRow()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/rowsfromresult/RowsFromResult.java`
  dòng 55–72) lấy từng row từ
  `getTrans().getPreviousResult()`, dùng TRỰC TIẾP `row.getRowMeta()`
  và `row.getData()` rồi `putRow` — không chọn/đổi thứ tự/convert field
  theo cấu hình `<fields>`. `check()` (dòng 236–251) báo ERROR nếu step
  có input (`input.length > 0`) — step này không nhận input stream.

Cấu hình 2 field theo đúng thứ tự source (`name`, `type`, `length`,
`precision`):

```xml
<fields>
  <field>
    <name>order_id</name>
    <type>Integer</type>
    <length>10</length>
    <precision>0</precision>
  </field>
  <field>
    <name>order_date</name>
    <type>Date</type>
    <length>-2</length>
    <precision>-2</precision>
  </field>
</fields>
```

## 5. Lưu ý / bẫy

- **Không có input hop tới step này**: `check()` coi mọi input stream là
  lỗi. Đặt step ở đầu luồng đọc result, không nối hop vào.
- **Schema khai báo lệch không được step này sửa**: vì `processRow()`
  truyền nguyên row/meta gốc, khai báo sai tên/kiểu/thứ tự không gây lỗi
  tại đây mà gây hiểu sai ở step downstream (tên field tra cứu lệch,
  kiểu metadata khai báo khác kiểu thực). Đối chiếu với step
  `RowsToResult` phía ghi và giữ khai báo đồng nhất.
- `-2` ở `length`/`precision` chỉ là fallback khi load thiếu tag — đừng
  diễn giải thành "giữ nguyên metadata gốc" như một tính năng runtime,
  và đừng copy `-2` sang `MappingInput` (ở đó fallback là `-1`).
- Cặp đôi với `RowsToResult`: trans A `RowsToResult` → result, trans B
  `RowsFromResult` → stream. Dữ liệu result nằm trong memory của
  transformation cha/job — không dùng cho dataset lớn.
- Template mặc định là khung cấu hình, chưa gắn với result rows nghiệp
  vụ cụ thể — người dùng phải điền đúng tên/kiểu field trước khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
