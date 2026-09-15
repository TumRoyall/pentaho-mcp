# CloneRow — Step nhân bản mỗi dòng đầu vào

Với MỖI dòng đầu vào, phát ra dòng gốc cộng thêm N bản sao
(`1 + nrclones` dòng ra cho mỗi dòng vào). Tùy chọn gắn cờ boolean đánh
dấu dòng clone (`<addcloneflag>` + `<cloneflagfield>`) và/hoặc số thứ tự
bản sao (`<addclonenum>` + `<clonenumfield>`), và lấy N động từ một field
(`<nrcloneinfield>` + `<nrclonefield>`). Schema output = input schema
cộng tối đa 2 cột mới. Step không cần DB connection.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CloneRow</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <nrclones>1</nrclones>
    <addcloneflag>Y</addcloneflag>
    <cloneflagfield>is_clone</cloneflagfield>
    <nrcloneinfield>N</nrcloneinfield>
    <nrclonefield/>
    <addclonenum>N</addclonenum>
    <clonenumfield/>
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
| `<nrclones>` | Y | Số bản sao thêm cho mỗi dòng (CHUỖI — hỗ trợ biến như `${N}`; mặc định step mới: `"0"`). `check()` báo ERROR khi rỗng. |
| `<addcloneflag>` | N | `Y` = gắn thêm cột boolean đánh dấu dòng clone. Mặc định `N` (thiếu tag → false). |
| `<cloneflagfield>` | N (bắt buộc khi addcloneflag=Y) | Tên cột cờ boolean (`ValueMetaBoolean`); rỗng khi bật cờ → `check()` ERROR và `getFields()` không thêm cột. |
| `<nrcloneinfield>` | N | `Y` = lấy số clone từ field thay vì `<nrclones>` tĩnh. Mặc định `N`. |
| `<nrclonefield>` | N (bắt buộc khi nrcloneinfield=Y) | Tên field chứa số clone cho từng dòng. |
| `<addclonenum>` | N | `Y` = gắn thêm cột số thứ tự bản sao (`ValueMetaInteger`). Mặc định `N`. |
| `<clonenumfield>` | N (bắt buộc khi addclonenum=Y) | Tên cột số thứ tự; rỗng khi bật → `check()` ERROR. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CLONE_ROW` | `<type>` | `CloneRow`. |
| `configuration.nr_clones` | `<nrclones>` | Chuỗi (cho phép `${VAR}`), không phải số. |
| `configuration.add_clone_flag` | `<addcloneflag>` | Boolean → Y/N. |
| `configuration.clone_flag_field` | `<cloneflagfield>` |  |
| `configuration.nr_clone_in_field` | `<nrcloneinfield>` | Boolean → Y/N. |
| `configuration.nr_clone_field` | `<nrclonefield>` |  |
| `configuration.add_clone_num` | `<addclonenum>` | Boolean → Y/N. |
| `configuration.clone_num_field` | `<clonenumfield>` |  |

Không có list lặp — mọi cấu hình là tag đơn, sửa bằng `set_field`
/ `set_field_path` trực tiếp.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step` (dòng 58–61 trong
  `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/clonerow/CloneRowMeta.java`)
  — `id = "CloneRow"`, category Utility. Step này KHÔNG có trong
  `engine/src/main/resources/kettle-steps.xml` (registry ở đây là
  evidence annotation, không phải XML evidence; evidence là serializer
  dưới đây).
- Serialization: `CloneRowMeta.getXML()` (dòng 93–105) — đúng 7 tag
  theo thứ tự `nrclones` (chuỗi nguyên văn), `addcloneflag` (Y/N),
  `cloneflagfield`, `nrcloneinfield` (Y/N), `nrclonefield`,
  `addclonenum` (Y/N), `clonenumfield`. Không có tag nào khác, không có
  list.
- Deserialization: `loadXML()` (dòng 107–109) gọi `readData()` (dòng
  172–186) — `nrclones` và 3 tên field đọc nguyên văn (thiếu tag →
  null); 3 cờ parse bằng `"Y".equalsIgnoreCase(...)` (thiếu tag →
  false).
- Khởi tạo (khác fallback khi load): `setDefault()` (dòng 188–196) đặt
  `nrclones="0"` (chuỗi `"0"`), 3 tên field null, 3 cờ false. Template
  dùng `nrclones=1` + cờ mẫu để thành khung chạy được; load thiếu
  `<nrclones>` cho null (KHÔNG về `"0"`) và `check()` sẽ ERROR.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime: `getFields()` (Meta dòng 234–254) thêm cột
  `ValueMetaBoolean` khi bật cờ + tên field non-empty (dòng 237–244),
  thêm cột `ValueMetaInteger` khi bật số thứ tự + tên field non-empty
  (dòng 246–253) — bật cờ mà tên field rỗng thì cột KHÔNG được thêm
  (lặng lẽ). `check()` (dòng 256–324) ERROR khi `nrclones` rỗng, khi
  bật cờ/đếm/nguồn-động mà thiếu tên field tương ứng, và khi không có
  input.
- Không có `<connection>`: step không tham chiếu DB — template không
  mang tag này, fixture test không cần khai báo connection.

Cấu hình không mặc định (2 clone + cờ + số thứ tự):

```xml
<nrclones>2</nrclones>
<addcloneflag>Y</addcloneflag>
<cloneflagfield>is_clone</cloneflagfield>
<nrcloneinfield>N</nrcloneinfield>
<nrclonefield/>
<addclonenum>Y</addclonenum>
<clonenumfield>clone_nr</clonenumfield>
```

## 5. Lưu ý / bẫy — CRITICAL

- **`<nrclones>` là chuỗi, không phải số**: loader đọc nguyên văn
  (dòng 174) — giá trị được substitute biến ở runtime. Đừng đổi thành
  int hay ép kiểu khi mapping YAML.
- **Bật cờ mà thiếu tên field = mất cột lặng lẽ**: `getFields()` chỉ
  thêm cột khi tên field non-empty (dòng 239/248) — `check()` báo
  ERROR nhưng file vẫn load/save bình thường, dễ tưởng đã cấu hình đủ.
- **`nrcloneinfield=Y` thì `<nrclones>` tĩnh bị bỏ qua**: số clone lấy
  từ `<nrclonefield>` từng dòng — đặt cả hai mà quên field nào có hiệu
  lực sẽ cho số clone bất ngờ.
- **Nhân dòng = nhân tải downstream**: mỗi dòng vào thành `1+N` dòng —
  N lớn trên stream lớn sẽ phình dữ liệu (sort/join sau đó đắt gấp bội).
- Template mặc định là khung cấu hình — người dùng phải nối hop đầu
  vào (`check()` đòi `input.length > 0`) và đặt tên field output chưa
  tồn tại trong stream (tránh trùng tên).

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
