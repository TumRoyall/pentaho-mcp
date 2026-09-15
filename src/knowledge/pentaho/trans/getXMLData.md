# getXMLData — Step đọc dữ liệu từ file XML/XPath

Đọc một hoặc nhiều file XML (hoặc фрагмент XML từ trường vào), lặp theo
`<loopxpath>`, trích mỗi trường ra bằng XPath riêng (`<fields>/<field>` với
`<xpath>` + `<element_type>` + `<result_type>` + kiểu). `getFields()` thêm
một value meta cho mỗi trường khai báo cộng các trường phụ (tên file, số
dòng, metadata file) được bật. Chú ý ID viết thường chữ `g` đầu:
`getXMLData` — giữ nguyên case này trong `<type>`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>getXMLData</type>
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
    <addresultfile>N</addresultfile>
    <namespaceaware>N</namespaceaware>
    <ignorecomments>N</ignorecomments>
    <readurl>N</readurl>
    <validating>N</validating>
    <usetoken>N</usetoken>
    <IsIgnoreEmptyFile>N</IsIgnoreEmptyFile>
    <doNotFailIfNoFile>Y</doNotFailIfNoFile>
    <rownum_field/>
    <encoding>UTF-8</encoding>
    <file>
      <name>${XML_FILE}</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{OUTPUT_FIELD}}</name>
        <xpath>{{XPATH}}</xpath>
        <element_type>node</element_type>
        <result_type>valueof</result_type>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <loopxpath>{{LOOP_XPATH}}</loopxpath>
    <IsInFields>N</IsInFields>
    <IsAFile>Y</IsAFile>
    <XmlField/>
    <prunePath/>
    <shortFileFieldName/>
    <pathFieldName/>
    <hiddenFieldName/>
    <lastModificationTimeFieldName/>
    <uriNameFieldName/>
    <rootUriNameFieldName/>
    <extensionFieldName/>
    <sizeFieldName/>
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
| `<loopxpath>` | Y | XPath lặp — mỗi node khớp sinh một dòng (`check()` ERROR khi rỗng). |
| `<fields>/<field>/<name>` | Y (ít nhất 1) | Tên trường ra (`check()` ERROR khi 0 field). |
| `<fields>/<field>/<xpath>` | Y | XPath tương đối từ `<loopxpath>` tới giá trị (tiền tố `@` = attribute). |
| `<element_type>` | Y | `node` hoặc `attribute` (`GetXMLDataField.java` dòng 78). |
| `<result_type>` | Y | `valueof` (giá trị text) hoặc `singlenode` (cả node XML) (dòng 45). |
| `<type>` | Y | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Integer`, …). |
| `<trim_type>` | N | `none`, `left`, `right`, `both` (dòng 58); chuỗi lạ → `none`. |
| `<repeat>` | N | `Y` = lặp giá trị dòng trước khi node thiếu; `N` (mặc định template). CHÚ Ý: thiếu tag load thành `Y`. |
| `<length>` / `<precision>` | N | Số; thiếu tag load thành `-1`. |
| `<file>/<name>` | Điều kiện | File XML (dùng `${VAR}`); nhiều file = lặp lại BỘ 5 tag (flat, không wrapper con). Bỏ qua khi `IsInFields=Y`. |
| `<filemask>` / `<exclude_filemask>` | N | Regex lọc/bỏ file. |
| `<file_required>` / `<include_subfolders>` | N | Y/N từng file (`N`/`Y` chuỗi). |
| `<IsInFields>` | N | `Y` = đọc XML từ trường vào (`<XmlField>` tên trường, `<IsAFile>` phân biệt file/XML); `N` (mặc định) = đọc file. |
| `<limit>` | N | Số dòng tối đa; `0` (mặc định) = không giới hạn. |
| `<encoding>` | N | Encoding đọc file; mặc định `UTF-8`. |
| `<include>`/`<include_field>`, `<rownum>`/`<rownum_field>` | N | Bật + đặt tên trường phụ (tên file, số dòng). Y/N. |
| `<doNotFailIfNoFile>` | N | `Y` (mặc định step mới!) = không fail khi thiếu file. |
| `<prunePath>` | N | XPath kích hoạt thuật toán streaming cho file lớn. |
| `<shortFileFieldName>` … `<sizeFieldName>` | N | Tên các trường metadata file phụ (rỗng = không thêm). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_XML_DATA` | `<type>` | `getXMLData` (g thường đầu — giữ nguyên). |
| `configuration.loop_xpath` | `<loopxpath>` | XPath lặp, bắt buộc. |
| `configuration.limit` | `<limit>` | Số; `0` = ALL. |
| `configuration.files[].path` | `<file>/<name>` | Dùng `${VAR}`; mỗi file = 1 bộ 5 tag flat. |
| `configuration.fields[].field` | `<fields>/<field>/<name>` | Trường ra. |
| `configuration.fields[].xpath` | `<fields>/<field>/<xpath>` | XPath tương đối. |
| `configuration.fields[].element_type` | `<element_type>` | `node`/`attribute`. |
| `configuration.fields[].result_type` | `<result_type>` | `valueof`/`singlenode`. |
| `configuration.fields[].trim` | `<trim_type>` | `none`/`left`/`right`/`both`. |

`<fields>` chứa list `<field>` đồng nhất → `set_fields`
(`listTag=fields`, `itemTag=field`). `<file>` chứa các bộ 5 tag FLAT (không
wrapper con) — nhiều file viết lặp tay, KHÔNG dùng `set_fields`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "getXMLData", ...)`
  (`plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/getxmldata/GetXMLDataMeta.java`
  dòng 65–67, category `GetXMLData.category`). KHÔNG nằm trong
  `engine/.../kettle-steps.xml` (plugin XML) — annotation là evidence đăng
  ký, serializer dưới đây mới là XML evidence.
- Serialization: `GetXMLDataMeta.getXML()`
  (`.../getxmldata/GetXMLDataMeta.java` dòng 723–775) — thứ tự 11 cờ
  `include … doNotFailIfNoFile` (dòng 726–736), `rownum_field`, `encoding`,
  wrapper `<file>` LUÔN emit (dòng 741/750) chứa các BỘ 5 tag flat
  `name/filemask/exclude_filemask/file_required/include_subfolders` (dòng
  743–747, không có wrapper con cho từng file), wrapper `<fields>` (dòng
  752/757) chứa `field.getXML()`, rồi `limit`, `loopxpath`, `IsInFields`,
  `IsAFile`, `XmlField`, `prunePath` và 8 tên trường phụ (dòng 759–773).
- Field: `GetXMLDataField.getXML()` (`.../getxmldata/GetXMLDataField.java`
  dòng 121–137) — thứ tự `name`, `xpath`, `element_type` (code
  `node`/`attribute`, dòng 78/127), `result_type` (code
  `valueof`/`singlenode`, dòng 45/128), `type` (mô tả chuỗi), `format`,
  `currency`, `decimal`, `group`, `length`, `precision`, `trim_type` (code
  `none`/`left`/`right`/`both`, dòng 58/136), `repeat` (Y/N).
- Deserialization: `loadXML()` (dòng 695–697) gọi `readData()` (dòng
  799–867) — mọi cờ Y/N thiếu → false; `limit` qua `Const.toLong(..., 0L)`
  (dòng 845); file đọc bằng các sub-node song song (dòng 825–836);
  `length`/`precision` thiếu → `-1` (dòng 154–155);
  **`repeat` = `!"N".equalsIgnoreCase(...)` (dòng 157) — thiếu tag load
  thành TRUE**; `trim_type` lạ/null → `none` (dòng 160–163).
- Khởi tạo: `setDefault()` (dòng 882–929) — **`doNotFailIfNoFile = true`**,
  còn lại false/rỗng, `loopxpath = ""`, `rowLimit = 0`, 0 file/field.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 931–1022) thêm một value meta
  cho mỗi trường khai báo (kiểu fallback `String` khi `NONE`, dòng 937–940)
  cộng các trường phụ được bật (tên file dòng 956–962, số dòng dòng
  964–969, metadata file dòng 972–1021). `check()` (dòng 1180–1239) ERROR
  khi thiếu `loopxpath`, 0 field, hoặc (mode file) không resolve được file
  nào. `supportsErrorHandling()` = true (dòng 1250–1252).
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (lặp `/orders/order`, 2 trường):

```xml
<limit>0</limit>
<loopxpath>/orders/order</loopxpath>
<IsInFields>N</IsInFields>
<IsAFile>Y</IsAFile>
<XmlField/>
<fields>
  <field>
    <name>ORDER_ID</name>
    <xpath>id</xpath>
    <element_type>node</element_type>
    <result_type>valueof</result_type>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
  <field>
    <name>ORDER_STATUS</name>
    <xpath>@status</xpath>
    <element_type>attribute</element_type>
    <result_type>valueof</result_type>
    <type>String</type>
    <format/>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
    <repeat>N</repeat>
  </field>
</fields>
```

Fill bằng `set_field_path` cho `loopxpath`/`limit` + `set_fields`
(`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<repeat>` thiếu tag = TRUE**: parse `!"N".equalsIgnoreCase(...)` (dòng
  157) — template LUÔN ghi tường minh `<repeat>N</repeat>`; đừng lược tag
  này nếu muốn `N`.
- **`<file>` flat, không wrapper con**: mỗi file là 1 bộ 5 tag lặp trực
  tiếp trong `<file>` (`getXML()` dòng 742–749) — đừng bịa
  `<file>/<file>`; `set_fields` không dùng được cho file, viết lặp tay.
- **`<type>` là tên chuỗi, không phải số** — ghi số id kiểu sẽ bị
  `ValueMeta.getType` map sai.
- **Enum lặng lẽ fallback**: `element_type`/`result_type`/`trim_type` lạ →
  `node`/`valueof`/`none` mà không báo lỗi — sai chính tả cho kết quả sai
  lặng lẽ.
- **`doNotFailIfNoFile` mặc định `Y`**: ngược trực giác (`setDefault()`
  dòng 894) — template giữ `Y`; muốn fail khi thiếu file đặt `N`.
- **Case `<type>`**: ID là `getXMLData` (g thường) — `<type>getXMLData</type>`
  chính xác từng chữ; `GetXMLData` là SAI.
- Template mặc định là khung cấu hình — người dùng phải điền file (`${VAR}`)
  hoặc trường XML vào, `<loopxpath>` và ít nhất 1 field có thật.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
