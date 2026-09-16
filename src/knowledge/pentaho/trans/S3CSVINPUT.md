# S3CSVINPUT — Step đọc CSV từ S3

Đọc file CSV trên Amazon S3 (`bucket` + `filename`, hỗ trợ `${VAR}`) và
phát mỗi dòng thành một row. Credential AWS nằm ở 2 field password mã
hóa (`aws_access_key`, `aws_secret_key`) — template chỉ dùng placeholder
`${VAR}`, không embed thật. Schema output do người dùng khai báo qua
list `<fields>/<field>`; `getFields()` XÓA row cũ (`rowMeta.clear()`) rồi
dựng lại từ fields khai báo, cộng thêm cột filename/rownum tùy chọn.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>S3CSVINPUT</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <aws_access_key>Encrypted ${AWS_ACCESS_KEY}</aws_access_key>
    <aws_secret_key>Encrypted ${AWS_SECRET_KEY}</aws_secret_key>
    <bucket>${S3_BUCKET}</bucket>
    <filename>${S3_KEY}</filename>
    <filename_field/>
    <rownum_field/>
    <include_filename>N</include_filename>
    <separator>,</separator>
    <enclosure>"</enclosure>
    <header>Y</header>
    <max_line_size>5000</max_line_size>
    <lazy_conversion>Y</lazy_conversion>
    <parallel>N</parallel>
    <fields>
      <field>
        <name>FIELD1</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
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
| `<aws_access_key>` | Y | AWS access key (mã hóa); luôn dùng `${VAR}`. |
| `<aws_secret_key>` | Y | AWS secret key (mã hóa); luôn dùng `${VAR}`. |
| `<bucket>` | Y | Tên S3 bucket; cho phép `${VAR}`. |
| `<filename>` | Y | Key/prefix file CSV trong bucket; cho phép `${VAR}`. |
| `<filename_field>` | N | Tên field động chứa key (thay cho `<filename>` tĩnh). |
| `<rownum_field>` | N | Tên cột số thứ tự dòng (Integer 10) thêm vào output. |
| `<include_filename>` | N | `Y` = thêm cột filename (String) vào output. |
| `<separator>` | N | Ký tự phân cột; mặc định `,`. |
| `<enclosure>` | N | Ký tự bao chuỗi; mặc định `"`. |
| `<header>` | N | `Y` (mặc định) = dòng đầu là header. |
| `<max_line_size>` | N | Chuỗi kích thước dòng tối đa; mặc định `"5000"`. |
| `<lazy_conversion>` | N | `Y` (mặc định) = lazy conversion (binary-string storage). |
| `<parallel>` | N | `Y` = đọc song song; mặc định `N`. |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên cột output. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta DƯỚI DẠNG TÊN CHUỖI. |
| `<fields>/<field>/<trim_type>` | N | Code trim: `none`, `left`, `right`, `both`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: S3_CSV_INPUT` | `<type>` | `S3CSVINPUT` (ID giữ nguyên hoa). |
| `configuration.aws_access_key` | `<aws_access_key>` | Placeholder `${VAR}` (mã hóa). |
| `configuration.aws_secret_key` | `<aws_secret_key>` | Placeholder `${VAR}` (mã hóa). |
| `configuration.bucket` | `<bucket>` | Cho phép `${VAR}`. |
| `configuration.filename` | `<filename>` | Cho phép `${VAR}`. |
| `configuration.separator` | `<separator>` | Mặc định `,`. |
| `configuration.enclosure` | `<enclosure>` | Mặc định `"`. |
| `configuration.header` | `<header>` | Boolean → Y/N (mặc định Y). |
| `configuration.lazy_conversion` | `<lazy_conversion>` | Boolean → Y/N (mặc định Y). |
| `configuration.parallel` | `<parallel>` | Boolean → Y/N (mặc định N). |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Tên cột. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="S3CSVINPUT", ...)`
  (`plugins/s3csvinput/core/src/main/java/org/pentaho/di/trans/steps/s3csvinput/S3CsvInputMeta.java`
  dòng 82–84). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `S3CsvInputMeta.getXML()` (dòng 201–240) — đúng thứ tự
  `aws_access_key` (mã hóa qua `Encr.encryptPasswordIfNotUsingVariables`,
  dòng 204–205), `aws_secret_key` (mã hóa), `bucket`, `filename`,
  `filename_field`, `rownum_field`, `include_filename` (Y/N),
  `separator`, `enclosure`, `header` (Y/N), `max_line_size` (chuỗi
  `"5000"`), `lazy_conversion` (Y/N), `parallel` (Y/N), rồi wrapper
  `<fields>` LUÔN emit kể cả rỗng (dòng 220, 237) chứa các `<field>` với
  `name`, `type` (tên), `format`, `currency`, `decimal`, `group`,
  `length` (int), `precision` (int), `trim_type` (code).
- Deserialization: `loadXML()` (dòng 136–139) gọi `readData()` (dòng
  156–194) — keys giải mã qua `Encr.decryptPasswordOptionallyEncrypted`
  (dòng 158–159, null-safe); 4 boolean parse bằng
  `"Y".equalsIgnoreCase(...)` (thiếu → false);
  `length/precision=Const.toInt(..., -1)` (dòng 187–188);
  **BẪY**: `<fields>` vắng mặt → `countNodes(null, ...)` có thể NPE, bọc
  thành `KettleXMLException` (dòng 191–193) — template LUÔN giữ
  `<fields>` paired.
- Khởi tạo: `setDefault()` (dòng 148–154) — `delimiter=","`,
  `enclosure="\""`, `headerPresent=true`, `lazyConversionActive=true`,
  `maxLineSize="5000"`; keys/bucket/filename null;
  `includingFilename/runningInParallel=false`; `allocate(0)`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 323–375) `rowMeta.clear()`
  (nuốt input) rồi dựng lại từ fields khai báo (lazy → binary-string
  storage); append String `filenameField` chỉ khi non-empty VÀ
  `includingFilename`; append Integer(10) `rowNumField` khi non-empty.
  `check()` (dòng 384–411) chỉ kiểm tra nối input, không kiểm tra file.
- Không có `<connection>`: credential AWS là password fields + strings —
  template không mang `<connection>`, fixture test không cần khai báo
  connection.

Cấu hình không mặc định (2 field + filename/rownum, semicolon):

```xml
<bucket>${S3_BUCKET}</bucket>
<filename>exports/orders.csv</filename>
<include_filename>Y</include_filename>
<filename_field>SRC_KEY</filename_field>
<rownum_field>ROW_NR</rownum_field>
<separator>;</separator>
<header>Y</header>
<parallel>Y</parallel>
<fields>
  <field>
    <name>ORDER_ID</name>
    <type>Integer</type>
    <format/>
    <currency/>
    <decimal>.</decimal>
    <group>,</group>
    <length>10</length>
    <precision>0</precision>
    <trim_type>none</trim_type>
  </field>
  <field>
    <name>ORDER_DATE</name>
    <type>Date</type>
    <format>yyyy-MM-dd</format>
    <currency/>
    <decimal/>
    <group/>
    <length>-1</length>
    <precision>-1</precision>
    <trim_type>none</trim_type>
  </field>
</fields>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Credential luôn `${VAR}`**: không bao giờ embed key thật vào XML —
  2 field này được mã hóa khi Spoon lưu (`encryptPasswordIfNotUsingVariables`).
- **`<fields>` luôn paired**: `getXML()` emit cả khi 0 field — template
  giữ `<fields></fields>` paired, không viết self-closing `<fields/>`
  (`setFields` từ chối list self-closing).
- **`<field>/<type>` là tên chuỗi**: `String`, `Integer`, `Date`, ... —
  không ghi id số.
- **`getFields()` nuốt input**: step này xóa sạch row cũ — mọi cột từ
  stream trước biến mất, chỉ còn fields khai báo + filename/rownum.
- **`max_line_size` là chuỗi `"5000"`**, không phải int — giữ nguyên dạng
  chuỗi trong XML.
- Template mặc định là khung cấu hình — người dùng phải điền bucket/key
  và credential (qua biến); cần dependency AWS/S3 lúc runtime.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
