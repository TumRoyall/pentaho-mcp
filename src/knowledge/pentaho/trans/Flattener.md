# Flattener — Step rải một trường thành nhiều trường (pivot ngược nhẹ)

Lấy MỘT trường (`<field_name>`) của mỗi dòng vào, XOÁ nó, và phát lại N
trường đích (`<fields>/<field>/<name>`) KẾ THỪA NGUYÊN KIỂU của trường gốc
(clone value meta). Không gộp/không tính toán — chỉ tách một cột thành nhiều
cột cùng kiểu (ví dụ pivot thủ công). `Flatterner` (thiếu `e`) là ALIAS
chính tả của `Flattener`: cùng class, cùng serializer — xem mục 4.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Flattener</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <field_name>{{SOURCE_FIELD}}</field_name>
    <fields>
      <field>
        <name>{{TARGET_FIELD_1}}</name>
      </field>
      <field>
        <name>{{TARGET_FIELD_2}}</name>
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
| `<field_name>` | Y | Trường NGUỒN bị rải — phải tồn tại (`getFields()` ném lỗi khi rỗng hoặc thiếu). |
| `<fields>/<field>/<name>` | Y (ít nhất 1 khi chạy) | Tên trường ĐÍCH, cùng kiểu với trường nguồn (clone). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FLATTENER` | `<type>` | `Flattener` (alias `Flatterner` cùng file này). |
| `configuration.source_field` | `<field_name>` | Trường nguồn. |
| `configuration.target_fields[].field` | `<fields>/<field>/<name>` | Trường đích theo thứ tự. |

`<fields>` chứa list `<field>` đồng nhất → fill bằng MỘT lần
`set_fields` (`listTag=fields`, `itemTag=field`).

## 4. Ví dụ thực tế — BẰNG CHỨNG ALIAS

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 54 —
  `<step id="Flattener,Flatterner">` →
  `org.pentaho.di.trans.steps.flattener.FlattenerMeta` (category
  Transform). HAI chuỗi ID trong MỘT thẻ (phân tách dấu phẩy) trỏ CÙNG
  class — `Flatterner` là alias chính tả, KHÔNG phải implementation riêng.
  Kết luận: **alias thật → 1 reference chung** (2 catalog row cùng file
  này; `addElement()` với alias chèn `<type>Flattener</type>` chuẩn vì
  cùng serializer).
- Serialization: `FlattenerMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/flattener/FlattenerMeta.java`
  dòng 153–167) — `field_name` (dòng 156) rồi wrapper `<fields>` LUÔN
  emit paired (dòng 158/164), mỗi `<field>` CHỈ có `<name>` (dòng 161).
  Không có tag nào khác — cả hai ID serialize Y HỆT nhau (chung code).
- Deserialization: `loadXML()` (dòng 87–89) gọi `readData()` (dòng
  134–151) — `field_name` (dòng 136); đếm `<field>` trong `<fields>`
  (dòng 138–139), mỗi item đọc `name` (dòng 145).
- Khởi tạo: `setDefault()` (dòng 100–104) — 0 target (`fieldName` giữ
  null). Step mới chưa cấu hình — `getFields()` ném lỗi khi rỗng.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 107–132) XOÁ trường nguồn
  (ném `UnableToLocateFieldInInputFields` khi thiếu, dòng 115–117;
  ném `FlattenFieldRequired` khi rỗng, dòng 129–131) rồi clone KIỂU gốc
  cho mỗi target (dòng 122–128) — output = input − nguồn + N target cùng
  kiểu. `check()` (dòng 201+) yêu cầu có input.
- Không có `<connection>`: step không tham chiếu DB — template không mang
  tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (rải 1 cột thành 3):

```xml
<field_name>MONTH_VALUE</field_name>
<fields>
  <field>
    <name>JAN</name>
  </field>
  <field>
    <name>FEB</name>
  </field>
  <field>
    <name>MAR</name>
  </field>
</fields>
```

Fill bằng `set_field_path` cho `field_name` + `set_fields`
(`listTag=fields`, `itemTag=field`).

## 5. Lưu ý / bẫy — CRITICAL

- **Dùng `Flattener` chính tả đúng khi tạo mới**: `Flatterner` chỉ tồn tại
  để đọc file .ktr cũ viết sai — template và mọi generation mới dùng
  `Flattener`.
- **Mọi target CÙNG kiểu nguồn**: step clone value meta gốc — không ép kiểu
  riêng từng target; nguồn String thì mọi đích String.
- **`<field_name>` rỗng = fail mở**: `getFields()` ném lỗi — template phải
  pin tên cột có thật.
- **`<fields>` luôn paired** — giữ paired kể cả rỗng, không self-closing.
- Template mặc định là khung cấu hình — step 0 target (mặc định
  `setDefault()`) không chạy được.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` + bằng chứng alias (registry dòng 54) tại commit đã ghim
  ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
