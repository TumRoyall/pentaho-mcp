# FileStream — Step đọc file đang ghi (tail -f, streaming)

Step streaming đọc các dòng mới append vào file (`sourcePath`) như
`tail -f` và đẩy qua sub-transformation (prop base-stream
`TRANSFORMATION_PATH` + `SUB_STEP`). Serialization qua
`StepWithMappingMeta` → `BaseSerializingMeta` → fragment `<step-props>`:
1 prop riêng (`sourcePath`, chữ thường!) + prop base-stream.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>FileStream</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <step-props secure="">
      <group name="">
        <property group="" name="sourcePath">
          <value>${STREAM_FILE}</value>
        </property>
        <property group="" name="TRANSFORMATION_PATH">
          <value>${SUB_TRANS}</value>
        </property>
        <property group="" name="NUM_MESSAGES">
          <value>1000</value>
        </property>
        <property group="" name="DURATION">
          <value>1000</value>
        </property>
        <property group="" name="SUB_STEP">
          <value>{{SUB_STEP}}</value>
        </property>
      </group>
    </step-props>
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

| Property (injection name) | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `sourcePath` | Y | File cần tail (`${STREAM_FILE}`). Chữ THƯỜNG (hằng `SOURCE_PATH = "sourcePath"` — khác prop HOA của JMS/MQTT). |
| `TRANSFORMATION_PATH` | Y | Sub-transformation xử lý dòng (kế thừa base-stream). |
| `NUM_MESSAGES` / `DURATION` | N | Batch / ms; mặc định `"1000"`. |
| `SUB_STEP` | Y | Step trong sub-trans nhận dòng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILE_STREAM` | `<type>` | `FileStream`. |
| `configuration.source_path` | `sourcePath` value | `${VAR}`; chữ thường. |
| `configuration.sub_transformation` | `TRANSFORMATION_PATH` value | Đường dẫn sub-trans. |
| `configuration.sub_step` | `SUB_STEP` value | Step nhận dòng. |

Mọi cấu hình nằm trong `<step-props>` (xem giới hạn fill ở `Jms2Consumer`
mục 5).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "FileStream", …)`
  (`plugins/file-stream/src/main/java/org/pentaho/di/trans/step/filestream/FileStreamMeta.java`
  dòng 46, `extends BaseStreamStepMeta`, dòng 49).
- Serialization: class KHÔNG override `getXML()`/`loadXML()` — kế thừa
  qua `StepWithMappingMeta extends BaseSerializingMeta`
  (`engine/src/main/java/org/pentaho/di/trans/StepWithMappingMeta.java`
  dòng 64) → JAXB `<step-props>` như `Jms2Consumer`.
- Trường: prop duy nhất `@Injection(name = SOURCE_PATH)` (dòng 55–56)
  với `SOURCE_PATH = "sourcePath"` (dòng 52, chữ thường); `setDefault()`
  RỖNG (dòng 68–69); còn lại là prop base-stream (`TRANSFORMATION_PATH`,
  `NUM_MESSAGES`, `DURATION`, `SUB_STEP`, …, `BaseStreamStepMeta.java`
  dòng 67–84).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (tail log + batch 200):

```xml
<property group="" name="sourcePath">
  <value>${APP_LOG}</value>
</property>
<property group="" name="NUM_MESSAGES">
  <value>200</value>
</property>
```

## 5. Lưu ý / bẫy

- **Fragment là `<step-props>`**: đừng bịa `<source_path>`/`<filepath>`
  phẳng — deserializer chỉ đọc `<step-props>`.
- **`sourcePath` chữ thường**: khác mọi prop JMS/MQTT (HOA hết) — điền
  `SOURCEPATH`/`SOURCE_PATH` sẽ bị bỏ qua lặng lẽ.
- **`setDefault()` rỗng**: không có default nào (kể cả base-stream —
  base `setDefault()` đặt batch/duration/parallelism/prefetch nhưng
  FileStream KHÔNG gọi `super.setDefault()`, override rỗng dòng 68–69).
  Template ghi đủ giá trị.
- **Cần sub-trans + step nhận**: như các consumer khác; không chạy I/O
  file khi test template.
- Template mặc định là khung cấu hình — người dùng phải điền file,
  sub-trans có thật; không chạy I/O khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu đăng ký + kế thừa
  (`StepWithMappingMeta` → `BaseSerializingMeta`) + `@Injection` fields
  tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Pan/file thật) — không tuyên bố hai mức này.
