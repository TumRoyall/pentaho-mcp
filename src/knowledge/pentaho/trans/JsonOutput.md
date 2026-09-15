# JsonOutput — Step xuất trường thành JSON

Với MỖI dòng vào, gom các trường đã chọn thành một bloc JSON
(`<jsonBloc>`, gom `<nrRowsInBloc>` dòng) và — tùy `<operation_type>` — ghi
vào trường String mới (`<outputValue>`), ra file, hoặc cả hai.
`getFields()` chỉ thêm trường output khi KHÔNG ở mode ghi-file thuần.
Step kế thừa `BaseFileOutputMeta` (các trường `fileName`, `extension`,
`stepNrInFilename`, … nằm ở superclass nhưng serialize cùng fragment).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>JsonOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <outputValue>{{OUTPUT_FIELD}}</outputValue>
    <jsonBloc>data</jsonBloc>
    <nrRowsInBloc>1</nrRowsInBloc>
    <operation_type>outputvalue</operation_type>
    <compatibility_mode>N</compatibility_mode>
    <encoding>UTF-8</encoding>
    <addtoresult>N</addtoresult>
    <file>
      <name>${JSON_FILE}</name>
      <extention>js</extention>
      <append>N</append>
      <split>N</split>
      <haspartno>N</haspartno>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <create_parent_folder>N</create_parent_folder>
      <DoNotOpenNewFileInit>N</DoNotOpenNewFileInit>
      <servlet_output>N</servlet_output>
    </file>
    <fields>
      <field>
        <name>{{SOURCE_FIELD}}</name>
        <element>{{ELEMENT_NAME}}</element>
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
| `<outputValue>` | Điều kiện | Tên trường String mới chứa JSON — bắt buộc trừ mode `writetofile` (`check()` ERROR khi rỗng ở 2 mode còn lại). |
| `<jsonBloc>` | N | Tên bloc JSON bao các dòng; mặc định step mới là `data`. |
| `<nrRowsInBloc>` | N | Số dòng gom trong một bloc, DẠNG CHUỖI; mặc định `"1"`. |
| `<operation_type>` | Y | Một trong `outputvalue` (ra trường), `writetofile` (ra file), `both` (cả hai). Chuỗi lạ/rỗng load thành `outputvalue`. |
| `<compatibility_mode>` | N | `Y` = JSON tương thích pre-4.3.0; `N` (mặc định). |
| `<encoding>` | N | Encoding; mặc định step mới là `UTF-8`. |
| `<addtoresult>` | N | `Y` = thêm file ra vào result; `N` (mặc định). CHÚ Ý chữ thường hết. |
| `<file>/<name>` | Điều kiện | Path file ra (dùng `${VAR}`) — `check()` LUÔN đòi non-blank kể cả mode `outputvalue`. |
| `<file>/<extention>` | N | Đuôi file, mặc định `js`. CHÚ Ý thiếu chữ `s` (`extention`). |
| `<file>/<append>` … `<servlet_output>` | N | 8 cờ Y/N (nối file, tách theo step/part, thêm ngày/giờ, tạo thư mục cha, servlet). |
| `<fields>/<field>/<name>` | Y | Tên trường NGUỒN — phải tồn tại trong stream vào (`check()` ERROR nếu thiếu). |
| `<fields>/<field>/<element>` | Y | Tên key trong JSON ra. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: JSON_OUTPUT` | `<type>` | `JsonOutput`. |
| `configuration.output_field` | `<outputValue>` | Trường JSON mới. |
| `configuration.json_block` | `<jsonBloc>` | Mặc định `data`. |
| `configuration.operation` | `<operation_type>` | `outputvalue`/`writetofile`/`both`. |
| `configuration.file` | `<file>/<name>` | Dùng `${VAR}`; luôn cần dù mode nào. |
| `configuration.fields[].source_field` | `<fields>/<field>/<name>` | Trường nguồn. |
| `configuration.fields[].element` | `<fields>/<field>/<element>` | Key JSON. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "JsonOutput", ...)`
  (`plugins/json/core/src/main/java/org/pentaho/di/trans/steps/jsonoutput/JsonOutputMeta.java`
  dòng 62–64, category `JsonOutput.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin JSON) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `JsonOutputMeta.getXML()`
  (`.../jsonoutput/JsonOutputMeta.java` dòng 337–373) — thứ tự
  `outputValue`, `jsonBloc`, `nrRowsInBloc`, `operation_type` (code qua
  `getOperationTypeCode`, dòng 343), `compatibility_mode`, `encoding`,
  `addtoresult` (chữ thường, dòng 346), wrapper `<file>` với `name`,
  `extention` (thiếu `s`, dòng 349), `append`, `split`, `haspartno`,
  `add_date`, `add_time`, `create_parent_folder`, `DoNotOpenNewFileInit`,
  `servlet_output` (dòng 348–357), rồi `<fields>` LUÔN emit paired (dòng
  360/371) chứa `<field>` chỉ có `name` + `element` (dòng 366–367). Field
  rỗng tên bị skip lặng lẽ (dòng 364).
- Deserialization: `loadXML()` (dòng 241–243) gọi `readData()` (dòng
  270–306) — `operation_type` parse bằng `getOperationTypeByCode` (chuỗi lạ
  → 0 = `outputvalue`, dòng 213–224); các cờ file lồng trong `<file>`
  (dòng 280–289); `readData()` đọc `AddToResult` (F hoa, dòng 279) trong
  khi `getXML()` ghi `addtoresult` (thường, dòng 346) — VÔ HẠI vì match
  case-insensitive (`XMLHandler.getTagValue`, dòng 153).
- Khởi tạo: `setDefault()` (dòng 308–324) — `encoding = "UTF-8"`,
  `outputValue = "outputValue"`, `jsonBloc = "data"`, `nrRowsInBloc = "1"`,
  **`operationType = WRITE_TO_FILE`**, `extension = "js"`, 0 field.
  (`fileName`/`extension`/`stepNrInFilename`/… là field của superclass
  `BaseFileOutputMeta` nhưng serialize cùng fragment.)
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 326–335) thêm trường
  `outputValue` String TRỪ khi ở mode `writetofile` — mode ghi-file thuần
  không đổi schema. `check()` (dòng 478–545): `outputValue` bắt buộc trừ
  mode file (dòng 483–491); **filename LUÔN bắt buộc kể cả mode
  `outputvalue`** (dòng 492–497); field nguồn phải tồn tại (dòng 509–515);
  cần input (dòng 529–539).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (ra cả trường lẫn file, bloc 100 dòng):

```xml
<outputValue>ORDER_JSON</outputValue>
<jsonBloc>orders</jsonBloc>
<nrRowsInBloc>100</nrRowsInBloc>
<operation_type>both</operation_type>
<compatibility_mode>N</compatibility_mode>
<encoding>UTF-8</encoding>
<addtoresult>N</addtoresult>
<file>
  <name>${JSON_DIR}/orders</name>
  <extention>js</extention>
  <append>N</append>
  <split>N</split>
  <haspartno>N</haspartno>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <create_parent_folder>Y</create_parent_folder>
  <DoNotOpenNewFileInit>N</DoNotOpenNewFileInit>
  <servlet_output>N</servlet_output>
</file>
<fields>
  <field>
    <name>ORDER_ID</name>
    <element>id</element>
  </field>
  <field>
    <name>ORDER_TOTAL</name>
    <element>total</element>
  </field>
</fields>
```

Fill bằng `set_field_path` cho scalar + `set_fields`
(`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<file>/<name>` luôn bắt buộc**: `check()` đòi filename non-blank NGAY
  CẢ ở mode `outputvalue` thuần (dòng 492–497) — đừng để trống vì "chỉ ra
  trường".
- **Tag `extention` thiếu `s`**: cả `getXML()` (dòng 349) lẫn `readData()`
  (dòng 282) đều dùng `extention` — viết `extension` đúng chính tả lại là
  SAI (tag lạ bị bỏ qua, extension thành null).
- **Tag `addtoresult` thường hết** (`getXML()` dòng 346) vs `AddToResult`
  trong `readData()` (dòng 279) — nhờ match case-insensitive nên an toàn;
  template giữ spelling của `getXML()`.
- **`operation_type` lạ → `outputvalue` lặng lẽ** (dòng 213–224) — sai
  chính tả (ví dụ `write_to_file`) đổi mode mà không báo lỗi.
- **Field rỗng tên bị skip lặng lẽ** (`getXML()` dòng 364) — như AddXML.
- Template mặc định là khung cấu hình — người dùng phải điền trường nguồn
  có thật và file ra (`${VAR}`); step mới mặc định mode ghi-file.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
