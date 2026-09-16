# ExecProcess — Step chạy tiến trình ngoài theo dòng

Với MỖI dòng đầu vào, chạy một lệnh shell (`<processfield>` — cột chứa
dòng lệnh, thay vì lệnh tĩnh), thu stdout vào cột `<resultfieldname>`
(String 100, mặc định `"Result output"`), stderr vào `<errorfieldname>`
(String 100, `"Error output"`), mã thoát vào `<exitvaluefieldname>`
(Integer, `"Exit value"`). `<failwhennotsuccess>=Y` fail step khi mã thoát
khác 0. Tham số bổ sung từ các cột trong
`<argumentFields>/<argumentField>/<argumentFieldName>` khi
`<argumentsInFields>=Y`; phân tách dòng output bởi
`<outputlinedelimiter>` (thiếu → `""` tương thích).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ExecProcess</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <processfield>{{COMMAND_FIELD}}</processfield>
    <resultfieldname>Result output</resultfieldname>
    <errorfieldname>Error output</errorfieldname>
    <exitvaluefieldname>Exit value</exitvaluefieldname>
    <failwhennotsuccess>N</failwhennotsuccess>
    <outputlinedelimiter/>
    <argumentsInFields>N</argumentsInFields>
    <argumentFields>
    </argumentFields>
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
| `<processfield>` | Y | Cột chứa dòng lệnh chạy. `check()` ERROR khi rỗng. |
| `<resultfieldname>` | N | Cột stdout (String 100); mặc định `"Result output"`. Rỗng → không thêm. |
| `<errorfieldname>` | N | Cột stderr (String 100); mặc định `"Error output"`. |
| `<exitvaluefieldname>` | N | Cột mã thoát (Integer); mặc định `"Exit value"`. |
| `<failwhennotsuccess>` | N | Y = fail khi exit != 0. Mặc định N. |
| `<outputlinedelimiter>` | N | Phân tách dòng output; thiếu → `""` (tương thích, dòng 258–260). |
| `<argumentsInFields>` | N | Y = lấy thêm tham số từ `<argumentFields>`. |
| `<argumentFields>/<argumentField>/<argumentFieldName>` | N | Cột tham số bổ sung (list lồng 2 cấp). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EXEC_PROCESS` | `<type>` | `ExecProcess`. |
| `configuration.command_field` | `<processfield>` | Cột lệnh. |
| `configuration.fail_on_error` | `<failwhennotsuccess>` | Y/N. |
| `configuration.argument_fields[]` | `<argumentFields>/<argumentField>/<argumentFieldName>` | Cột tham số. |

`<argumentFields>` → `set_fields` lồng (`listTag=argumentFields`,
`itemTag=argumentField` rồi field con).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: `engine/src/main/resources/kettle-steps.xml` dòng 94 —
  `<step id="ExecProcess">` →
  `org.pentaho.di.trans.steps.execprocess.ExecProcessMeta` (category Utility).
- Serialization: `getXML()` (dòng 229–248) — `processfield` (232),
  `resultfieldname` (233), `errorfieldname` (234),
  `exitvaluefieldname` (235), `failwhennotsuccess` Y/N (236),
  `outputlinedelimiter` (237), `argumentsInFields` Y/N (238), block
  `<argumentFields>` (240–246; item `<argumentField>` bọc
  `<argumentFieldName>` 242–244).
- Deserialization: `readData()` (dòng 250–273+) — delimiter null →
  `""` (258–260); block args thiếu → mảng rỗng (263–266).
- Khởi tạo: `setDefault()` (dòng 194–199) — 3 tên cột output mặc định,
  fail false (không default processfield/args).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–230).
- Ngữ nghĩa runtime: `getFields()` (dòng 202–226) append String 100 ×2 +
  Integer exit; worker chạy `Runtime.exec` từng dòng (cổng I/O — KHÔNG
  chạy trong scope này; template/test không thực thi).
- Không có `<connection>`.

Cấu hình không mặc định (fail khi lỗi + tham số từ cột):

```xml
<processfield>CMD</processfield>
<resultfieldname>STDOUT</resultfieldname>
<errorfieldname>STDERR</errorfieldname>
<exitvaluefieldname>EXIT_CODE</exitvaluefieldname>
<failwhennotsuccess>Y</failwhennotsuccess>
<outputlinedelimiter>
</outputlinedelimiter>
<argumentsInFields>Y</argumentsInFields>
<argumentFields>
  <argumentField>
    <argumentFieldName>ARG1</argumentFieldName>
  </argumentField>
</argumentFields>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Lệnh từ CỘT, không phải tag tĩnh**: không có tag lệnh cố định —
  phải có cột chứa lệnh trong stream.
- **Item lồng 2 cấp** (`argumentField` bọc `argumentFieldName`) —
  khác list `<field>` phẳng thường gặp.
- Chạy shell thật khi execute (cổng phê duyệt I/O) — template và test
  KHÔNG thực thi tiến trình.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` hay `runtime_passed`.
