# ParallelGzipCsvInput — Step đọc CSV trong GZIP song song

Step nguồn đọc file CSV nén GZIP (đơn luồng đọc + giải nén song song):
file tĩnh (`filename`) hoặc động (`filename_field`), rownum
(`rownum_field`), `separator` (map từ `delimiter`), `enclosure`,
`header` (map `headerPresent`), `buffer_size` (map `bufferSize`, string),
`lazy_conversion` (map `lazyConversionActive`), `parallel` (map
`runningInParallel`), `encoding`, `add_filename_result` (map
`isaddresult`), `include_filename`. `getFields()` XÓA row cũ, dựng lại
từ `<fields>/<field>` (lazy → binary-string + encoding), cộng filename
String (khi non-empty VÀ `includingFilename`) và rownum Integer(10).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ParallelGzipCsvInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename>${GZIP_FILE}</filename>
    <filename_field/>
    <rownum_field/>
    <include_filename>N</include_filename>
    <separator>,</separator>
    <enclosure>"</enclosure>
    <header>Y</header>
    <buffer_size>50000</buffer_size>
    <lazy_conversion>Y</lazy_conversion>
    <add_filename_result>N</add_filename_result>
    <parallel>N</parallel>
    <encoding>UTF-8</encoding>
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
| `<filename>` | Y (khi không dùng field) | Đường dẫn file `.gz` tĩnh; cho phép `${VAR}`. |
| `<filename_field>` | N | Tên field chứa đường dẫn file (động). |
| `<rownum_field>` | N | Tên cột rownum Integer(10) thêm vào output. |
| `<include_filename>` | N | `Y` = thêm cột filename — nhưng `getFields()` chỉ add khi field non-empty VÀ `includingFilename` (2 điều kiện). |
| `<separator>` | N | Ký tự phân cột (map `delimiter`); mặc định `,`. |
| `<enclosure>` | N | Ký tự bao chuỗi; mặc định `"`. |
| `<header>` | N | `Y` (mặc định, map `headerPresent`) = dòng đầu là header. |
| `<buffer_size>` | N | Buffer đọc (string, map `bufferSize`); mặc định `"50000"`. Không `toInt` khi load. |
| `<lazy_conversion>` | N | `Y` (mặc định, map `lazyConversionActive`). |
| `<add_filename_result>` | N | `Y` = thêm file vào result (map `isaddresult`). |
| `<parallel>` | N | `Y` = giải nén song song (map `runningInParallel`); mặc định `N`. |
| `<encoding>` | N | Encoding đọc (ví dụ `UTF-8`); null = mặc định. |
| `<fields>/<field>/*` | Y | Như TextFileInput field: `name`, `type` (tên), `format`, `currency`, `decimal`, `group`, `length`/`precision` (int, thiếu → -1), `trim_type` (code). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: PARALLEL_GZIP_CSV_INPUT` | `<type>` | `ParallelGzipCsvInput` (ID `Parallel...`, class prefix `Par...`). |
| `configuration.filename` | `<filename>` | Cho phép `${VAR}`. |
| `configuration.separator` | `<separator>` | Map `delimiter`. |
| `configuration.enclosure` | `<enclosure>` | Mặc định `"`. |
| `configuration.header` | `<header>` | Map `headerPresent`, Boolean → Y/N. |
| `configuration.buffer_size` | `<buffer_size>` | Map `bufferSize`, chuỗi. |
| `configuration.lazy_conversion` | `<lazy_conversion>` | Map `lazyConversionActive`. |
| `configuration.parallel` | `<parallel>` | Map `runningInParallel`. |
| `configuration.encoding` | `<encoding>` | Ví dụ `UTF-8`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Tên cột. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 97 —
  `<step id="ParallelGzipCsvInput">` →
  `org.pentaho.di.trans.steps.parallelgzipcsv.ParGzipCsvInputMeta` (ID
  `Parallel...`, class prefix `Par...`). Registry presence không phải XML
  evidence, evidence là serializer dưới đây.
- Serialization: `ParGzipCsvInputMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/parallelgzipcsv/ParGzipCsvInputMeta.java`
  dòng 178–215) — đúng thứ tự `filename`, `filename_field`,
  `rownum_field`, `include_filename` (Y/N), `separator` (↔delimiter),
  `enclosure`, `header` (Y/N ↔headerPresent), `buffer_size` (string
  ↔bufferSize), `lazy_conversion` (Y/N ↔lazyConversionActive),
  `add_filename_result` (Y/N ↔isaddresult), `parallel` (Y/N
  ↔runningInParallel), `encoding`, rồi wrapper `<fields>` lặp `<field>`
  (`name`, `type` tên qua `ValueMetaFactory`, `format`, `currency`,
  `decimal`, `group`, `length`/`precision` int, `trim_type` code).
- Deserialization: `loadXML()` (dòng 108–110) gọi `readData()` (dòng
  133–171) — booleans `"Y"`-only (thiếu → false); `bufferSize` string
  (không `toInt` khi load); per-field `type=getIdForValueMeta`,
  `length/precision=Const.toInt(val,-1)`,
  `trimType=getTrimTypeByCode`; `<fields>` thiếu → `countNodes(null)` →
  0/`allocate(0)` (bọc try → `KettleXMLException` nếu parser lỗi).
- Khởi tạo: `setDefault()` (dòng 124–131) + constructor (dòng 102–105)
  — `delimiter=","`, `enclosure="\""`, `headerPresent=true`,
  `lazyConversionActive=true`, `isaddresult=false`,
  `bufferSize="50000"`, `allocate(0)`; `filename/filenameField/
  rowNumField/encoding=null`, `includingFilename/runningInParallel=false`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 293–351) `rowMeta.clear()`,
  mỗi field → ValueMeta (lazy → `STORAGE_TYPE_BINARY_STRING` +
  storageMetadata String, `setStringEncoding(env(encoding))`); +
  filename String chỉ khi non-empty VÀ `includingFilename`; + rownum
  Integer(len 10) khi non-empty. `check()` (dòng 354–382) mong KHÔNG
  input (`prev` rỗng = OK, `input.length>0` = ERROR).
- Không có `<connection>`: step chỉ đọc file — template không mang tag
  này, fixture test không cần khai báo connection.

Cấu hình không mặc định (semicolon + song song + 2 field):

```xml
<filename>${GZIP_DIR}/orders.csv.gz</filename>
<separator>;</separator>
<enclosure>"</enclosure>
<header>Y</header>
<parallel>Y</parallel>
<encoding>UTF-8</encoding>
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

Fill fields bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Map tên Java ↔ XML**: `delimiter→separator`, `headerPresent→header`,
  `bufferSize→buffer_size`, `lazyConversionActive→lazy_conversion`,
  `isaddresult→add_filename_result`, `runningInParallel→parallel` — đọc
  code theo tên Java sẽ tìm sai tag.
- **Cột filename cần 2 điều kiện** (non-empty VÀ `includingFilename`) —
  chỉ set tên field mà quên bật cờ là mất cột lặng lẽ.
- **`getFields()` nuốt input** — step nguồn, không nhận input
  (`check()` ERROR khi có).
- **`<fields>` luôn paired** — self-closing làm `setFields` ném lỗi.
- Template mặc định là khung cấu hình — người dùng phải điền file
  `.gz` có thật (qua biến).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
