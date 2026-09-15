# DetectLastRow — Step gắn cờ boolean cho dòng cuối stream

Chuyền mọi dòng đi tiếp nguyên vẹn, kèm thêm MỘT field boolean mới
(`<resultfieldname>`, mặc định `result`): `false` cho mọi dòng, `true` cho
dòng cuối cùng. Khối cấu hình chỉ có đúng 1 tag `resultfieldname`.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DetectLastRow</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <resultfieldname>result</resultfieldname>
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
| `<resultfieldname>` | Y | Tên field boolean gắn thêm: `false` mọi dòng, `true` dòng cuối. Mặc định `result` (`setDefault`); load thiếu tag → null (rỗng) — và `init()` runtime FAIL khi rỗng, nên template pin tường minh. Điền tên field chưa tồn tại trong stream. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DETECT_LAST_ROW` | `<type>` | `DetectLastRow`. |
| `configuration.resultfieldname` | `<resultfieldname>` | Tên field boolean thêm vào — THAM CHIẾU FIELD mới (không trùng field có sẵn). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` (dòng 75, `<step
  id="DetectLastRow">`,
  `classname=org.pentaho.di.trans.steps.detectlastrow.DetectLastRowMeta`,
  category Flow). Class không mang annotation `@Step`.
- Serialization: `DetectLastRowMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/trans/steps/detectlastrow/DetectLastRowMeta.java`
  dòng 103–107) — đúng 1 tag `resultfieldname`. Không có tag nào khác
  trong fragment.
- Deserialization: `readData()` (dòng 109–116) — đọc chuỗi, thiếu → null.
- Khởi tạo: `setDefault()` (dòng 88–90) — `resultfieldname = "result"`,
  khác với fallback load (null).
- Schema: `getFields()` (dòng 92–101) thêm 1 `ValueMetaBoolean` tên
  `resultfieldname` (substitute biến) — boolean flag duy nhất step này thêm
  vào dòng; các field gốc giữ nguyên.
- Wrapper: `StepMeta.getXML(boolean)`
  (`engine/src/main/java/org/pentaho/di/trans/step/StepMeta.java` dòng
  210–264) bao fragment trên bằng `name`, `type` (= step ID),
  `description`, `distribute`, `custom_distribution`, `copies`,
  `partitioning`, rồi `attributes`, `cluster_schema`, `remotesteps`,
  `GUI`.
- Ngữ nghĩa runtime (`DetectLastRow.processRow()`,
  `engine/src/main/java/org/pentaho/di/trans/steps/detectlastrow/DetectLastRow.java`
  dòng 57–125): step giữ `previousRow`, mỗi dòng (trừ lần đọc đầu) được
  phát kèm `falseArray` (`data.getFalseArray()`, dòng 105–107); khi input
  hết, dòng cuối được phát kèm `getTrueArray()` (dòng 79–89);
  `trueArray`/`falseArray` là hằng `Boolean.TRUE`/`Boolean.FALSE`
  (`DetectLastRowData.java` dòng 38–54). `init()` FAIL khi
  `resultfieldname` rỗng (dòng 127–140) — file KTR thiếu tag không chạy
  được.
- `check()` (Meta dòng 136–164) báo ERROR khi `resultfieldname` rỗng hoặc
  KHÔNG có input — step này PHẢI có hop vào và tên field khác rỗng.

Cấu hình không mặc định (tên field cờ tùy chọn):

```xml
<resultfieldname>is_last</resultfieldname>
```

## 5. Lưu ý / bẫy

- **Phải có input hop**: step đọc từng dòng stream vào; không nối hop vào
  là lỗi `check()`.
- **Dòng cuối ra TRỄ một nhịp**: mỗi dòng chỉ được phát khi đã đọc dòng TIẾP
  theo (giữ `previousRow` để biết đâu là cuối) — downstream thấy dòng cuối
  sau khi input đã hết.
- **Stream rỗng cho ra 0 dòng**: không có `previousRow` thì không phát gì
  (khác `DetectEmptyStream` phát 1 empty row khi rỗng).
- **Tên field cờ phải mới**: `getFields()` thêm `ValueMetaBoolean` cùng tên
  — trùng tên field có sẵn gây schema downstream khó đoán; `init()` từ chối
  tên rỗng.
- Template mặc định là khung cấu hình, chưa gắn với stream nghiệp vụ cụ
  thể — người dùng điền tên field cờ phù hợp schema downstream.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/
  `setDefault()` tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/Kitchen) — không tuyên bố hai mức này.
