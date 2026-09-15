# FieldSplitter — Step tách một field thành nhiều field (cột)

Với MỖI dòng đầu vào, tách field `splitfield` theo `delimiter` (bỏ qua
delimiter nằm trong cặp `enclosure`) thành NHIỀU FIELD mới trên CÙNG dòng
(1 vào → 1 ra): mỗi `<field>` khai báo tên, kiểu, format, độ dài và (tùy
chọn) ID nhúng + strip ID. Field gốc BỊ THAY THẾ tại chỗ bởi field mới đầu
tiên. Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FieldSplitter</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <splitfield>{{FIELD_TO_SPLIT}}</splitfield>
    <delimiter>,</delimiter>
    <enclosure/>
    <fields>
      <field>
        <name>{{NEW_FIELD}}</name>
        <id/>
        <idrem>N</idrem>
        <type>String</type>
        <format/>
        <group/>
        <decimal>.</decimal>
        <currency/>
        <length>-1</length>
        <precision>-1</precision>
        <nullif/>
        <ifnull/>
        <trimtype>none</trimtype>
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
| `<splitfield>` | Y | Field cần tách (thiếu trong row → `RuntimeException` khi chạy). |
| `<delimiter>` | N | Chuỗi phân tách (mặc định step mới: `,`). |
| `<enclosure>` | N | Chuỗi bao (vd `"`); delimiter trong cặp enclosure được bỏ qua. |
| `<fields>/<field>/<name>` | Y (mỗi field) | Tên field output mới. |
| `<fields>/<field>/<id>` | N | ID nhúng trong mảnh (vd mảnh `Sales2=310.50` có id `Sales2`); trống = split vị trí thuần túy. |
| `<fields>/<field>/<idrem>` | N | `Y` = strip ID khỏi giá trị mảnh; `N` (mặc định). |
| `<fields>/<field>/<type>` | Y (mỗi field) | Kiểu value-meta DƯỚI DẠNG CHUỖI (`String`, `Number`, ...) — không phải số id. |
| `<fields>/<field>/<format>` | N | Mask format (vd `###.##`). |
| `<fields>/<field>/<group>` | N | Ký tự nhóm nghìn. |
| `<fields>/<field>/<decimal>` | N | Ký tự thập phân (vd `.`). |
| `<fields>/<field>/<currency>` | N | Ký tự tiền tệ. |
| `<fields>/<field>/<length>` | N | Độ dài (số; `-1` = không set). |
| `<fields>/<field>/<precision>` | N | Số lẻ (số; `-1` = không set). |
| `<fields>/<field>/<nullif>` | N | Giá trị coi như null. |
| `<fields>/<field>/<ifnull>` | N | Giá trị thay khi null. |
| `<fields>/<field>/<trimtype>` | N | Mã code: `none`, `left`, `right`, `both`. Không phải Y/N. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FIELD_SPLITTER` | `<type>` | `FieldSplitter`. |
| `configuration.split_field` | `<splitfield>` |  |
| `configuration.delimiter` | `<delimiter>` |  |
| `configuration.enclosure` | `<enclosure>` |  |
| `configuration.fields[].name` | `<fields>/<field>/<name>` |  |
| `configuration.fields[].id` | `<fields>/<field>/<id>` | ID nhúng; khác name. |
| `configuration.fields[].remove_id` | `<fields>/<field>/<idrem>` | Boolean → Y/N. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Tên value-meta chuỗi. |
| `configuration.fields[].format/group/decimal/currency` | `<fields>/<field>/<format>` / ... |  |
| `configuration.fields[].length/precision` | `<fields>/<field>/<length>` / ... | Số; `-1` = unset. |
| `configuration.fields[].null_if/if_null` | `<fields>/<field>/<nullif>` / `<ifnull>` |  |
| `configuration.fields[].trim` | `<fields>/<field>/<trimtype>` | Mã `none`/`left`/`right`/`both`. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`); tag đơn sửa bằng
`set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 104 —
  `<step id="FieldSplitter">` →
  `org.pentaho.di.trans.steps.fieldsplitter.FieldSplitterMeta` (category
  Transform). Registry presence không phải XML evidence, evidence là
  serializer dưới đây.
- Serialization: `FieldSplitterMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/fieldsplitter/FieldSplitterMeta.java`
  dòng 452–496) — thứ tự `splitfield`, `delimiter`, `enclosure` (dòng
  456–458), rồi wrapper `<fields>` LUÔN emit (dòng 460/493); mỗi `<field>`
  có đúng 13 tag theo thứ tự `name`, `id`, `idrem` (Y/N), `type` (tên
  value-meta chuỗi), `format`, `group`, `decimal`, `currency`, `length`
  (int), `precision` (int), `nullif`, `ifnull`, `trimtype` (mã code, dòng
  464–490).
- Deserialization: `loadXML()` (dòng 308–310) gọi `readData()` (dòng
  352–390) — `idrem` Y-check (thiếu → false, dòng 380); `type` map về id
  qua `getIdForValueMeta` (dòng 381); `length`/`precision` qua
  `Const.toInt(..., -1)` (dòng 382–383); `trimtype` qua
  `getTrimTypeByCode` (dòng 384).
- Khởi tạo: `setDefault()` (dòng 392–397) — `splitField=""`,
  `delimiter=","`, `enclosure=null`, 0 field (`allocate(0)`).
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 411–450) THAY field gốc TẠI
  CHỖ — field mới đầu tiên `setValueMeta(idx)` đúng vị trí split field
  (dòng 436–438), các field sau chèn tiếp (dòng 439–444); field gốc biến
  mất khỏi schema; thiếu split field → `RuntimeException` (dòng 415–418).
  Runtime tách theo `delimiter` (bỏ qua delimiter trong cặp `enclosure`),
  hỗ trợ ID nhúng + strip (class javadoc Example1/Example2, dòng 63–103).

Cấu hình không mặc định (tách dòng sales `;` + enclosure `"`, field 2 dùng
ID nhúng có strip):

```xml
<splitfield>SALES_LINE</splitfield>
<delimiter>;</delimiter>
<enclosure>"</enclosure>
<fields>
  <field>
    <name>SALES1</name>
    <id></id>
    <idrem>N</idrem>
    <type>Number</type>
    <format>###.##</format>
    <group></group>
    <decimal>.</decimal>
    <currency></currency>
    <length>3</length>
    <precision>0</precision>
    <nullif></nullif>
    <ifnull></ifnull>
    <trimtype>none</trimtype>
  </field>
  <field>
    <name>SALES2</name>
    <id>Sales2</id>
    <idrem>Y</idrem>
    <type>Number</type>
    <format>###.##</format>
    <group></group>
    <decimal>.</decimal>
    <currency></currency>
    <length>3</length>
    <precision>0</precision>
    <nullif></nullif>
    <ifnull></ifnull>
    <trimtype>none</trimtype>
  </field>
</fields>
```

Fill list bằng `set_fields` (`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **`<id>` là ID nhúng trong mảnh, KHÁC `<name>`**: mảnh `Sales2=310.50`
  có id `Sales2` + `idrem=Y` để strip (Example2); bỏ trống `<id/>` = split
  vị trí thuần túy (Example1). Nhầm id/name sẽ map sai mảnh.
- **`<trimtype>` là mã code, không phải Y/N**: `none`/`left`/`right`/`both`
  (`ValueMetaBase.trimTypeCode`, `core/.../row/value/ValueMetaBase.java`
  dòng 94).
- **`<type>` là tên chuỗi, không phải số**: ghi số id kiểu sẽ bị
  `getIdForValueMeta` map sai (cùng bẫy DBJoin/DBProc).
- **Field gốc BIẾN MẤT khỏi schema**: `getFields()` thay tại chỗ — step
  sau không còn thấy `splitfield`. Cần giữ gốc thì copy trước (ví dụ bằng
  `SelectValues` clone) hoặc dùng SplitFieldToRows3 (giữ nguyên + thêm
  field).
- **1 vào → 1 ra (tách ngang)**: khác SplitFieldToRows3 (1 vào → N ra,
  tách dọc). Chọn sai step sẽ vỡ cardinality downstream.
- Template mặc định là khung cấu hình — người dùng phải điền field cần tách
  tồn tại trong stream trước, delimiter/enclosure khớp dữ liệu thật và số
  `<field>` khớp số mảnh (kiểu/độ dài khớp nội dung mảnh).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
