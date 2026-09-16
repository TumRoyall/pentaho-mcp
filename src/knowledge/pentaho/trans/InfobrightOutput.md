# InfobrightOutput — Step bulk load Infobright (ICE)

Step load vào Infobright ICE qua `TableOutputMeta` + named pipe: phần XML
gồm TOÀN BỘ tag của `TableOutputMeta.getXML()` (`connection` … `<fields>`)
CỘNG THÊM 4 tag riêng (`data_format`, `agent_port`, `charset`,
`debug_file`) ở CUỐI. Không có `<mapping>` — ánh xạ cột dùng
`<fields>/<field>` (`column_name` + `stream_name`) kế thừa từ TableOutput.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>InfobrightOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>${CONN}</connection>
    <schema>${SCHEMA}</schema>
    <table>{{TABLE}}</table>
    <commit>1000</commit>
    <truncate>N</truncate>
    <ignore_errors>N</ignore_errors>
    <use_batch>N</use_batch>
    <specify_fields>N</specify_fields>
    <partitioning_enabled>N</partitioning_enabled>
    <partitioning_field/>
    <partitioning_daily>N</partitioning_daily>
    <partitioning_monthly>Y</partitioning_monthly>
    <tablename_in_field>N</tablename_in_field>
    <tablename_field/>
    <tablename_in_table>Y</tablename_in_table>
    <return_keys>N</return_keys>
    <return_field/>
    <fields>
      <field>
        <column_name>{{TABLE_COLUMN}}</column_name>
        <stream_name>{{STREAM_FIELD}}</stream_name>
      </field>
    </fields>
    <data_format>TXT_VARIABLE</data_format>
    <agent_port>{{AGENT_PORT}}</agent_port>
    <charset>UTF-8</charset>
    <debug_file/>
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
| `<connection>` | Y | Tên DB connection Infobright (THAM CHIẾU — fixture phải khai báo). Kế thừa TableOutput. |
| `<schema>` / `<table>` | Y | Schema/bảng đích. |
| `<commit>` | N | Commit size; mặc định TableOutput `"1000"`. |
| `<truncate>` / `<ignore_errors>` / `<use_batch>` / `<specify_fields>` | N | Cờ TableOutput (Y/N). |
| Partitioning + tablename_* + return_* | N | Tag TableOutput — giữ nguyên thứ tự `getXML()`. |
| `<fields>/<field>/<column_name>` + `<stream_name>` | N (Y khi `specify_fields=Y`) | Ánh xạ CỘT BẢNG ↔ FIELD STREAM. Chú ý thứ tự ngược với `<mapping>` của bulk loader khác: `column_name` TRƯỚC. |
| `<data_format>` | N | Enum `DataFormat` (`TXT_VARIABLE` mặc định ICE; `BINARY` cho IEE). Load bằng `Enum.valueOf` — SAI TÊN NÉM EXCEPTION (xem bẫy). |
| `<agent_port>` | N | Port agent; default từ lib ngoài (`AGENT_DEFAULT_PORT`). |
| `<charset>` | N | Charset (`Charset.forName` — sai tên ném exception); default từ lib ngoài. |
| `<debug_file>` | N | File debug (trống = không). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: INFOBRIGHT_OUTPUT` | `<type>` | `InfobrightOutput`. |
| `configuration.connection` | `<connection>` | Tham chiếu tên connection. |
| `configuration.schema` / `configuration.table` | `<schema>` / `<table>` | Cho phép `${VAR}`. |
| `configuration.fields[].column` / `[].field` | `<fields>/<field>/<column_name>` / `<stream_name>` | `set_fields` (`listTag=fields`, `itemTag=field`). |
| `configuration.data_format` | `<data_format>` | Tên enum chính xác. |
| `configuration.agent_port` / `charset` / `debug_file` | `<agent_port>` / `<charset>` / `<debug_file>` | 4 tag riêng ở CUỐI. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "InfobrightOutput", …)`
  (`plugins/infobright-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/infobrightoutput/InfobrightLoaderMeta.java`
  dòng 54, class `extends TableOutputMeta`, dòng 60). Registry presence
  không phải XML evidence, evidence là serializer dưới đây.
- Serialization: `InfobrightLoaderMeta.getXML()` (dòng 157–164) = 
  `super.getXML()` (toàn bộ `TableOutputMeta.getXML()`:
  `engine/src/main/java/org/pentaho/di/trans/steps/tableoutput/TableOutputMeta.java`
  dòng 511–547 — `connection`, `schema`, `table`, `commit`, `truncate`,
  `ignore_errors`, `use_batch`, `specify_fields`, partitioning ×4,
  tablename ×3, return ×2, rồi `<fields>` với `column_name` + `stream_name`
  mỗi item, dòng 514–544) + 4 tag riêng `data_format` (`toString()` enum,
  dòng 159), `agent_port` (dòng 160), `charset` (`.name()`, dòng 161),
  `debug_file` (dòng 162).
- Deserialization: `loadXML()` (dòng 168–182) — `super.loadXML()` rồi
  `dataFormat = Enum.valueOf(DataFormat.class, …)` (dòng 171),
  `agentPort` parse int với fallback `AGENT_DEFAULT_PORT` (dòng 172–174),
  `charset` null → default lib (dòng 175–177).
- Khởi tạo: `setDefault()` (dòng 129–134) — `dataFormat =
  DataFormat.TXT_VARIABLE` (default ICE; dòng 130), `agentPort`/`charset`
  từ `InfobrightNamedPipeLoader` (lib ngoài `com.infobright.etl`, không
  trong source — giá trị số/port không trích được, template dùng
  placeholder).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) — như reference
  `SortedMerge` mục 4.

Cấu hình không mặc định (truncate + specify fields + debug):

```xml
<truncate>Y</truncate>
<specify_fields>Y</specify_fields>
<fields>
  <field>
    <column_name>order_id</column_name>
    <stream_name>ORDER_ID</stream_name>
  </field>
</fields>
<data_format>TXT_VARIABLE</data_format>
<debug_file>${DEBUG_FILE}</debug_file>
```

Fill bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<connection>` là tham chiếu**: fixture test PHẢI khai báo
  `<connection><name>${CONN}</name></connection>` (bẫy B2).
- **`data_format` sai tên NÉM EXCEPTION**: `Enum.valueOf` (dòng 171) ném
  `IllegalArgumentException` (bọc `KettleXMLException`) khi tag thiếu
  (null) hoặc sai tên — template LUÔN ghi `TXT_VARIABLE` (không lược).
- **`charset` sai tên cũng ném**: `Charset.forName` (dòng 177) ném
  `UnsupportedCharsetException` với tên lạ.
- **Thứ tự `column_name` trước `stream_name`**: ngược với `<mapping>` của
  MySQL/PG/GPLoad (`stream_name` trước) — đừng copy mù.
- **4 tag riêng ở CUỐI, sau `<fields>`**: thứ tự `data_format`,
  `agent_port`, `charset`, `debug_file` (dòng 159–162).
- **`agent_port`/`charset` default nằm ở lib ngoài**: `com.infobright.etl`
  không có trong source 9.4 — template dùng placeholder, ghi rõ giới hạn.
- Template mặc định là khung cấu hình — người dùng phải điền connection,
  bảng, agent Infobright thật; cần Infobright ICE + agent khi chạy.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` + superclass `TableOutputMeta` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Infobright thật) — không tuyên bố hai
  mức này. Giá trị số `AGENT_DEFAULT_PORT`/`DEFAULT_CHARSET` của lib ngoài
  chưa xác minh từ source (giới hạn đã nêu).
