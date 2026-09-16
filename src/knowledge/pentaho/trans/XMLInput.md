# XMLInput — Step đọc file XML cũ (DEPRECATED)

> **DEPRECATED — chỉ đọc/bảo trì workload cũ. KHÔNG phát sinh mới.**
> Source xếp category Deprecated (dòng 65–68 — chú ý dùng chuỗi
> category của job, nhưng đây vẫn là trans step). Replacement có nguồn:
> **`getXMLData`** (step `GetXmlDataMeta`, id `getXMLData` tại
> `plugins/xml/core/.../getxmldata/GetXmlDataMeta.java` dòng 65).
> `status=observed`, `generator_eligible=false`.

Đọc các file XML (`<file>` — cặp `<name>`/`<filemask>` theo index),
định vị vòng lặp qua `<positions>/<position>`, trích các cột khai báo
trong `<fields>/<field>` (mỗi field có nested `<positions>` riêng chỉ
đường dẫn tới node). Cờ `<include>`/`<rownum>` gắn thêm cột tên
file/số dòng. `<limit>`/`<skip>` giới hạn/bỏ qua dòng.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XMLInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownum_field/>
    <file_base_uri/>
    <ignore_entities>N</ignore_entities>
    <namespace_aware>N</namespace_aware>
    <file>
      <name>${XML_FILE}</name>
      <filemask/>
    </file>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
        <positions>
          <position>{{XML_PATH}}</position>
        </positions>
      </field>
    </fields>
    <positions>
      <position>{{LOOP_PATH}}</position>
    </positions>
    <limit>0</limit>
    <skip>0</skip>
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
| `<include>` | N | `Y` = gắn thêm cột tên file vào dòng ra (`getFields()` dòng 425–430). Mặc định step mới `N`. |
| `<include_field>` | Y khi include=Y | Tên cột chứa tên file (String, length 100). |
| `<rownum>` | N | `Y` = gắn thêm cột số dòng. Mặc định `N`. |
| `<rownum_field>` | Y khi rownum=Y | Tên cột số dòng. |
| `<file_base_uri>` | N | Base URI giải quyết đường dẫn tương đối. Mặc định `""`. |
| `<ignore_entities>` | N | `Y` = bỏ qua external entity (dummy rỗng khi thiếu DTD). Mặc định `N`. |
| `<namespace_aware>` | N | `Y` = hỗ trợ XML namespace. Mặc định `N`. |
| `<file>/<name>` + `<filemask>` | Y (ít nhất 1 cặp khi chạy) | Đọc theo INDEX CHUNG: `name[i]` đi với `filemask[i]` (dòng 334–339). Step mới có 0 file. |
| `<fields>/<field>/...` | Y (ít nhất 1 khi chạy) | Định nghĩa cột: `name`, `type` (tên kiểu desc chuỗi — `String`, `Integer`, ...), `format`, `currency`, `decimal`, `group`, `length`/`precision` (thiếu → `-1`), `trim_type` (**CODE**: `none`/`left`/`right`/`both`), `repeat` (Y/N), nested `<positions>/<position>` (đường dẫn node của field). |
| `<positions>/<position>` | Y (ít nhất 1 khi chạy) | Đường dẫn vòng lặp (loop path) của document. KHÁC nested `<positions>` trong từng `<field>`. |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định) = không giới hạn (`Const.toLong` default 0). |
| `<skip>` | N | Số dòng bỏ qua trước khi đọc; `0` (mặc định). |

`<file>`/`<fields>`/`<positions>` LUÔN emit (kể cả rỗng, dòng
288/295/302) → giữ paired. Cặp file là `<name>`+`<filemask>` (KHÔNG
phải `<field>`) — đừng nhầm với list field.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XML_INPUT` | `<type>` | `XMLInput`. Pipeline mới dùng `getXMLData`. |
| `configuration.include_filename` | `<include>` | Boolean → Y/N. |
| `configuration.filename_field` | `<include_field>` | Tên cột tên file. |
| `configuration.include_row_number` | `<rownum>` | Boolean → Y/N. |
| `configuration.row_number_field` | `<rownum_field>` | Tên cột số dòng. |
| `configuration.file_base_uri` | `<file_base_uri>` | Base URI. |
| `configuration.ignore_entities` | `<ignore_entities>` | Boolean → Y/N. |
| `configuration.namespace_aware` | `<namespace_aware>` | Boolean → Y/N. |
| `configuration.files[]` | `<file>` (name+filemask theo index) | Không phải list `<field>` — điền thủ công từng cặp, không dùng `set_fields`. |
| `configuration.fields[]` | `<fields>/<field>/...` | MỘT lần `set_fields` (`listTag=fields`, `itemTag=field`) cho các tag PHẲNG — nhưng mỗi `<field>` còn nested `<positions>` riêng: `set_fields` flattens nested markup thành escaped text (đã kiểm chứng). Muốn giữ `<positions>` thật thì cấu hình từng field bằng `set_field_path` (`fields/field/name`, ..., `fields/field/positions/position`). Nested `<positions>` của field đi theo item chỉ khi viết XML tay. |
| `configuration.loop_path` | `<positions>/<position>` | Vòng lặp document. |
| `configuration.limit` / `configuration.skip` | `<limit>` / `<skip>` | Số; `0` = ALL/không bỏ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="XMLInput", ...,
  categoryDescription = "i18n:org.pentaho.di.job:JobCategory.Category.Deprecated")`
  (`plugins/xml-input/core/src/main/java/org/pentaho/di/trans/steps/xmlinput/XMLInputMeta.java`
  dòng 65–68). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `getXML()` (dòng 277–313) — thứ tự `include` (280,
  Y/N), `include_field` (281), `rownum` (282, Y/N), `rownum_field`
  (283), `file_base_uri` (284), `ignore_entities` (285, Y/N),
  `namespace_aware` (286, Y/N), `<file>` LUÔN emit (288–293; cặp
  `name`+`filemask` theo index), `<fields>` LUÔN emit (295–300; mỗi
  field qua `XMLInputField.getXML()`,
  `XMLInputField.java` dòng 91–115: `name`, `type` = tên kiểu desc
  96, `format` 97, `currency` 98, `decimal` 99, `group` 100, `length`
  101, `precision` 102, `trim_type` = **code** 103, `repeat` 104,
  nested `<positions>` 106–110), `<positions>` LUÔN emit (302–307),
  `limit` (309), `skip` (310).
- Deserialization: `loadXML()` (dòng 251–253) gọi `readData()` (dòng
  315–359) — 4 cờ boolean parse bằng `"Y".equalsIgnoreCase` (thiếu tag
  → false, dòng 317/319/322/323); file đọc theo index chung
  `name[i]`/`filemask[i]` (334–339); field qua `new
  XMLInputField(fnode)` (343; `length`/`precision` thiếu → `-1` qua
  `Const.toInt`, dòng 124–125 `XMLInputField.java`); `limit` qua
  `Const.toLong` default 0 (353); `skip` qua `Const.toInt` default 0
  (355).
- Khởi tạo: `setDefault()` (dòng 370–400) — mọi cờ false, chuỗi rỗng,
  0 file/field/position (`allocate(0,0,0)`), `rowLimit = 0`,
  `nrRowsToSkip = 0`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 402–431) APPEND các cột
  `inputFields` (kiểu NONE → STRING, dòng 407–410) rồi gắn thêm cột
  tên file (425–430) và cột số dòng khi cờ bật. Step không tham chiếu
  DB connection — template không mang `<connection>`.
- Replacement: step `getXMLData`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXmlDataMeta.java`
  dòng 65: `@Step(id = "getXMLData", ...)`).

Cấu hình không mặc định (include filename + 2 field):

```xml
<include>Y</include>
<include_field>FILENAME</include_field>
<fields>
  <field>
    <name>CUSTOMER_NAME</name>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>both</trim_type>
    <repeat>N</repeat>
    <positions>
      <position>customer/name</position>
    </positions>
  </field>
  <field>
    <name>ORDER_TOTAL</name>
    <type>Number</type>
    <format>#.00</format>
    <currency/>
    <decimal>.</decimal>
    <group>,</group>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
    <positions>
      <position>customer/total</position>
    </positions>
  </field>
</fields>
<positions>
  <position>orders/order</position>
</positions>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **DEPRECATED — pipeline mới dùng `getXMLData`**: reference này chỉ
  để đọc/bảo trì `.ktr` cũ.
- **Hai `<positions>` khác nhau**: nested trong từng `<field>`
  (đường dẫn node của field) vs top-level (loop path document). Đừng
  gộp/đừng lược một trong hai.
- **`<trim_type>` ở đây là CODE** (`none`/`left`/`right`/`both`) —
  ngược với `XMLInputSax` dùng DESC i18n. Đừng copy nguyên field block
  giữa hai step.
- **`<type>` của field là tên desc chuỗi** (`String`, `Number`, ...),
  không phải id số.
- **Cặp file là `<name>`+`<filemask>` theo index**, không phải
  `<field>` — `set_fields` không áp dụng cho `<file>`.
- **Boolean load-thiếu-tag → false** (`"Y".equalsIgnoreCase`) — an
  toàn lược cờ, nhưng template vẫn pin đủ để rõ nghĩa.
- **Cẩn thận `set_fields` với nested `<positions>`**: tool chỉ học
  tag con PHẲNG của `<field>` — nested `<positions>` bị escape thành
  text (`&lt;position&gt;...`, placeholder rò rỉ) thay vì markup thật.
  Đã kiểm chứng bằng mô phỏng cục bộ. Cấu hình field bằng
  `set_field_path` từng tag để giữ markup.
- Không có `<connection>` — đừng thêm.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
