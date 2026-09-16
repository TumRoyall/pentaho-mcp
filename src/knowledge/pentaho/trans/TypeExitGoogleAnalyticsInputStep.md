# TypeExitGoogleAnalyticsInputStep — Step đọc Google Analytics

Step nguồn truy vấn Google Analytics API (OAuth service account +
key file, chuỗi thuần — không `<connection>` DB): dimensions/metrics/
filters/sort/date range/segment (`useSegment` thiếu tag → **true**,
ngoại lệ duy nhất) và list `<feedField>` lặp TRỰC TIẾP (không wrapper:
`feedFieldType`, `feedField`, `outField` — rename từ `outputField`,
`type` — rename từ `outputType`, tên value-meta, `conversionMask`).
`getFields()` XÓA row (`r.clear()`) rồi add mỗi `outputField[i]`/
`outputType[i]` (fallback String). Auth luôn `${VAR}`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TypeExitGoogleAnalyticsInputStep</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <oauthServiceAccount>${GA_SERVICE_ACCOUNT}</oauthServiceAccount>
    <appName>pdi-google-analytics-app</appName>
    <oauthKeyFile>${GA_KEY_FILE}</oauthKeyFile>
    <profileName/>
    <profileTableId/>
    <customTableId/>
    <useCustomTableId>N</useCustomTableId>
    <startDate>2026-09-01</startDate>
    <endDate>2026-09-15</endDate>
    <dimensions>ga:browser</dimensions>
    <metrics>ga:visits</metrics>
    <filters/>
    <sort>-ga:visits</sort>
    <useSegment>Y</useSegment>
    <useCustomSegment>N</useCustomSegment>
    <customSegment/>
    <segmentId>gaid::-1</segmentId>
    <segmentName>All Visits</segmentName>
    <samplingLevel>DEFAULT</samplingLevel>
    <rowLimit>0</rowLimit>
    <feedField>
      <feedFieldType>dimension</feedFieldType>
      <feedField>ga:browser</feedField>
      <outField>BROWSER</outField>
      <type>String</type>
      <conversionMask/>
    </feedField>
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
| `<oauthServiceAccount>` | Y | Service account OAuth; luôn `${VAR}`. |
| `<appName>` | N | Tên app (map `gaAppName`); mặc định `pdi-google-analytics-app`. |
| `<oauthKeyFile>` | Y | Key file OAuth (.p12); luôn `${VAR}`. |
| `<profileName>`/`<profileTableId>` | N | Profile GA (tên/bảng id). |
| `<customTableId>`/`<useCustomTableId>` | N | Bảng tùy chỉnh + cờ Y/N. |
| `<startDate>`/`<endDate>` | N | Khoảng ngày (`yyyy-MM-dd`); mặc định mới = hôm nay. |
| `<dimensions>` | N | Dimensions GA; mặc định `ga:browser`. |
| `<metrics>` | N | Metrics GA; mặc định `ga:visits`. |
| `<filters>`/`<sort>` | N | Filter/sort GA; sort mặc định `-ga:visits`. |
| `<useSegment>` | N | `Y` = dùng segment — NGOẠI LỆ: thiếu tag → **true** (dòng 492–494). |
| `<useCustomSegment>` | N | `Y` = segment tùy chỉnh (thiếu → false). |
| `<customSegment>`/`<segmentId>`/`<segmentName>` | N | Segment: mặc định `gaid::-1` / `All Visits`. |
| `<samplingLevel>` | N | `DEFAULT` (mặc định), `FASTER`, `HIGHER_PRECISION` (không validate khi load). |
| `<rowLimit>` | N | Giới hạn dòng (int, `<0→0` ở setter); mặc định `0` = ALL. |
| `<feedField>/<feedFieldType>` | Y (mỗi feed) | Loại feed (dimension/metric). |
| `<feedField>/<feedField>` | Y | Tên field GA (ví dụ `ga:browser`). |
| `<feedField>/<outField>` | Y | Tên cột output (rename từ `outputField` khi ghi). |
| `<feedField>/<type>` | Y | Kiểu value-meta TÊN CHUỖI (rename từ `outputType`); lạ → String. |
| `<feedField>/<conversionMask>` | N | Mask convert. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GOOGLE_ANALYTICS_INPUT` | `<type>` | `TypeExitGoogleAnalyticsInputStep` (giữ nguyên ID dài). |
| `configuration.oauth_account` | `<oauthServiceAccount>` | `${VAR}`. |
| `configuration.oauth_key` | `<oauthKeyFile>` | `${VAR}`. |
| `configuration.app_name` | `<appName>` | Map `gaAppName`. |
| `configuration.dimensions` | `<dimensions>` | Chuỗi GA. |
| `configuration.metrics` | `<metrics>` | Chuỗi GA. |
| `configuration.start_date` | `<startDate>` | `yyyy-MM-dd`. |
| `configuration.end_date` | `<endDate>` | `yyyy-MM-dd`. |
| `configuration.use_segment` | `<useSegment>` | Boolean → Y/N. |
| `configuration.row_limit` | `<rowLimit>` | Số; `0` = ALL. |
| `configuration.feeds[].feed_field` | `<feedField>/<feedField>` | Field GA. |
| `configuration.feeds[].output_field` | `<feedField>/<outField>` | Rename khi ghi. |
| `configuration.feeds[].type` | `<feedField>/<type>` | Tên value-meta chuỗi. |

Các `<feedField>` lặp TRỰC TIẾP dưới `<step>`, KHÔNG có wrapper —
không dùng `set_fields` với `listTag`; mỗi `<feedField>` là block con
độc lập (giữ đúng thứ tự con: feedFieldType, feedField, outField, type,
conversionMask). Chú ý 3 rename khi ghi: `gaAppName→appName`,
`outputField→outField`, `outputType→type`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id="TypeExitGoogleAnalyticsInputStep",
  ...)` + `@InjectionSupported(groups={"OUTPUT_FIELDS"})`
  (`plugins/google-analytics/core/src/main/java/org/pentaho/di/trans/steps/googleanalytics/GaInputStepMeta.java`
  dòng 61, 69; category Input, image `GAN.svg`). Registry presence không
  phải XML evidence, evidence là serializer dưới đây.
- Serialization: `GaInputStepMeta.getXML()` (dòng 427–462) — đúng thứ tự
  `oauthServiceAccount`, `appName` (=`gaAppName`!), `oauthKeyFile`,
  `profileName`, `profileTableId`, `customTableId`,
  `useCustomTableId` (Y/N), `startDate`, `endDate`, `dimensions`,
  `metrics`, `filters`, `sort`, `useSegment` (Y/N),
  `useCustomSegment` (Y/N), `customSegment`, `segmentId`,
  `segmentName`, `samplingLevel`, `rowLimit` (int), rồi lặp
  `<feedField>` trực tiếp (`feedFieldType`, `feedField`,
  `outField` (=`outputField`!), `type` (tên value-meta qua
  `ValueMetaFactory.getValueMetaName`), `conversionMask`). Booleans qua
  `addTagValue(boolean)`; còn lại strings.
- Deserialization: `loadXML()` (dòng 465–526) — strings `getTagValue`
  (thiếu → null); booleans qua `getBooleanAttributeFromNode` (dòng
  420–424, chỉ `Y` = true); **ngoại lệ `useSegment` thiếu tag →
  `true`** (dòng 492–494); `rowLimit=Const.toInt(...,0)` (dòng 500);
  `allocate(0)` rồi `allocate(countNodes(feedField))`;
  `outputType=getIdForValueMeta(type)`, `<0` → `TYPE_STRING` (dòng
  513–518). Legacy `user/pass/apiKey` không oauth → chỉ `logError`
  (dòng 477–480).
- Khởi tạo: `setDefault()` (dòng 346–364) —
  `oauthServiceAccount="service.account@developer.gserviceaccount.com"`,
  `oauthKeyFile=""`, `useSegment=true`, `segmentId="gaid::-1"`,
  `segmentName="All Visits"`, `dimensions="ga:browser"`,
  `metrics="ga:visits"`, start/end = hôm nay (`yyyy-MM-dd`),
  `sort="-ga:visits"`, `gaAppName="pdi-google-analytics-app"`,
  `rowLimit=0`, `samplingLevel="DEFAULT"`, `allocate(0)`.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (dòng 377–396) `r.clear()` rồi add mỗi
  `outputField[i]`/`outputType[i]` (fallback String khi plugin thiếu);
  bỏ qua feed/conversionMask. Injection normalize mảng ở
  `afterInjectionSynchronization` (dòng 699–712).
  `setRowLimit<0→0` (dòng 153–158).
- Không có `<connection>` DB; auth là 2 strings
  `oauthServiceAccount`/`oauthKeyFile` — fixture không khai báo
  connection.

Cấu hình không mặc định (2 feeds + filter + giới hạn):

```xml
<dimensions>ga:browser,ga:country</dimensions>
<metrics>ga:visits,ga:pageviews</metrics>
<filters>ga:country==Vietnam</filters>
<sort>-ga:visits</sort>
<useSegment>N</useSegment>
<samplingLevel>HIGHER_PRECISION</samplingLevel>
<rowLimit>1000</rowLimit>
<feedField>
  <feedFieldType>dimension</feedFieldType>
  <feedField>ga:country</feedField>
  <outField>COUNTRY</outField>
  <type>String</type>
  <conversionMask/>
</feedField>
<feedField>
  <feedFieldType>metric</feedFieldType>
  <feedField>ga:visits</feedField>
  <outField>VISITS</outField>
  <type>Integer</type>
  <conversionMask>#</conversionMask>
</feedField>
```

## 5. Lưu ý / bẫy — CRITICAL

- **KHÔNG có wrapper cho feeds**: `<feedField>` lặp trực tiếp dưới
  `<step>` — không bọc `<fields>`/`<feeds>`.
- **3 rename khi ghi**: `gaAppName→appName`, `outputField→outField`,
  `outputType→type` — đọc code theo tên Java sẽ tìm sai tag.
- **Ngoại lệ `useSegment`**: thiếu tag → true (ngược mọi flag khác) —
  luôn emit tường minh.
- **`samplingLevel` không validate khi load** — giá trị lạ giữ nguyên đến
  runtime mới fail; chỉ dùng 3 code hợp lệ.
- **Legacy user/pass/apiKey bị lờ** (chỉ `logError`) — file cổ không
  oauth sẽ chạy với auth rỗng; kiểm tra lại auth khi migrate.
- **Auth luôn `${VAR}`** — không embed service account/key thật.
- Template mặc định là khung cấu hình — cần GA API + OAuth key thật lúc
  runtime; không gọi network trong test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
