# BlockingStep — Step chặn luồng tới khi input hết

Giữ toàn bộ input lại cho tới khi stream vào kết thúc, rồi mới phát ra:
mặc định chỉ phát DÒNG CUỐI (`pass_all_rows=N`); bật `pass_all_rows=Y` thì
phát LẠI TOÀN BỘ các dòng đã giữ (buffer trong memory, đầy `cache_size`
thì spool file tạm `prefix*.tmp` dưới `directory`, nén GZIP nếu
`compress=Y`). Step không thêm field nào vào row. Không có sort-field nào
trong cấu hình — đừng nhầm với `SortRows` (`<fields>`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>BlockingStep</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <pass_all_rows>N</pass_all_rows>
    <directory>%%java.io.tmpdir%%</directory>
    <prefix>block</prefix>
    <cache_size>5000</cache_size>
    <compress>Y</compress>
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
| `<pass_all_rows>` | Y | `N` = chỉ phát dòng cuối (hành vi gốc); `Y` = giữ rồi phát lại toàn bộ dòng (chế độ spool). Mặc định `N`. |
| `<directory>` | Y | Thư mục chứa file tạm khi buffer đầy. Mặc định `%%java.io.tmpdir%%`. |
| `<prefix>` | Y | Prefix file tạm (`<prefix>*.tmp`). Mặc định `block`. |
| `<cache_size>` | Y | Số dòng giữ trong memory trước khi ghi đĩa. Mặc định `5000` (`CACHE_SIZE`); load thiếu/sai → `5000`. |
| `<compress>` | Y | `Y` = nén GZIP file tạm (đỡ I/O, tốn CPU). Mặc định `Y` — nhưng load thiếu tag → `N`, nên template pin tường minh. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: BLOCKING_STEP` | `<type>` | `BlockingStep`. |
| `configuration.pass_all_rows` | `<pass_all_rows>` | Y/N. |
| `configuration.directory` | `<directory>` | Thư mục spool. |
| `configuration.prefix` | `<prefix>` | Prefix file tạm. |
| `configuration.cache_size` | `<cache_size>` | Số nguyên. |
| `configuration.compress` | `<compress>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "BlockingStep", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockingstep/BlockingStepMeta.java`
  dòng 53–55, category Flow). KHÔNG có trong
  `engine/src/main/resources/kettle-steps.xml` — plugin core đăng ký bằng
  annotation.
- Serialization: `BlockingStepMeta.getXML()` (dòng 172–183) — ghi đúng 5
  tag theo thứ tự `pass_all_rows`, `directory`, `prefix`, `cache_size`,
  `compress`. Không có tag sort/field nào trong fragment.
- Deserialization: `readData()` (dòng 156–162) — booleans đọc Y/N (thiếu
  → false); `cache_size` qua `Const.toInt(..., CACHE_SIZE)` (thiếu/sai →
  5000).
- Khởi tạo: `setDefault()` (dòng 164–170) — `passAllRows = false`,
  `directory = "%%java.io.tmpdir%%"`, `prefix = "block"`, `cacheSize =
  CACHE_SIZE (5000, dòng 83)`, `compressFiles = true`. LƯU Ý
  LOAD-KHÁC-DEFAULT: `compress` fresh-default `Y` nhưng load thiếu tag →
  `false` — template pin `<compress>Y</compress>` tường minh.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`. `getFields()` (dòng 137–141) là no-op — step không đổi row-meta.
- Ngữ nghĩa runtime (`BlockingStep.processRow()`,
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockingstep/BlockingStep.java`
  dòng 260–311): `passAllRows = false` → chỉ giữ `lastRow`, input hết mới
  `putRow` đúng 1 dòng cuối (dòng 271–282); `passAllRows = true` → buffer
  mọi dòng (`addBuffer`, dòng 68–119), đầy `cache_size` thì spool file tạm
  `prefix*.tmp` dưới `directory` (GZIP nếu `compress`, dòng 83–109), input
  hết mới replay toàn bộ qua `getBuffer()` + vòng `putRow` (dòng 291–306).
  File tạm bị xóa ở `dispose()` (dòng 224–242).
- `check()` (Meta dòng 85–135) báo ERROR khi không có input hoặc thư mục
  spool không tồn tại — step này PHẢI có hop vào và thư mục hợp lệ.

Cấu hình không mặc định (giữ rồi phát lại toàn bộ, cache nhỏ):

```xml
<pass_all_rows>Y</pass_all_rows>
<cache_size>100</cache_size>
```

## 5. Lưu ý / bẫy

- **Phải có input hop**: step chặn và đọc toàn bộ stream vào; không nối hop
  vào là lỗi `check()`.
- **Mặc định chỉ ra 1 dòng cuối**: muốn đồng bộ rồi cho TẤT CẢ dòng đi tiếp
  phải bật `pass_all_rows=Y` (chế độ này mới dùng tới
  `directory`/`prefix`/`cache_size`/`compress`).
- **`compress` load-thiếu-tag thành `N`**: file KTR viết tay thiếu tag này
  sẽ spool không nén dù step mới mặc định nén — luôn ghi đủ 5 tag.
- **`cache_size` nhỏ = nhiều file tạm**: buffer đầy là ghi đĩa ngay; đặt quá
  nhỏ gây I/O liên tục, đặt quá lớn tốn RAM.
- **Không sort, không dedup**: step phát lại đúng thứ tự đã nhận (chế độ
  pass-all) hoặc chỉ dòng cuối — đừng nhầm với `SortRows`/`Unique`.
- Template mặc định là khung cấu hình, chưa gắn với luồng nghiệp vụ cụ
  thể.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
