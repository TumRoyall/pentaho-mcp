# Jms2Producer — Step gửi message JMS (streaming)

Step streaming gửi MỖI dòng đầu vào thành một JMS message (nội dung lấy từ
field `FIELD_TO_SEND`) tới queue/topic, kèm header tùy chọn
(`PROPERTIES`/`PROPERTY_NAMES`/`PROPERTY_VALUES`) và tùy chọn phân phối
(`DELIVERY_MODE`, `PRIORITY`, `TIME_TO_LIVE`…). Serialization qua
`BaseSerializingMeta` → fragment `<step-props>` (như `Jms2Consumer`).
Producer KHÔNG có prop streaming-base (không `TRANSFORMATION_PATH`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Jms2Producer</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <step-props secure="IBMMQ_PASSWORD AMQ_PASSWORD SSL_KEYSTORE_PASSWORD SSL_TRUSTSTORE_PASSWORD">
      <group name="">
        <property group="" name="DESTINATION">
          <value>{{JMS_DESTINATION}}</value>
        </property>
        <property group="" name="IBMMQ_URL">
          <value/>
        </property>
        <property group="" name="IBMMQ_USERNAME">
          <value/>
        </property>
        <property group="" name="IBMMQ_PASSWORD">
          <value>${IBMMQ_PASSWORD}</value>
        </property>
        <property group="" name="AMQ_URL">
          <value>${AMQ_URL}</value>
        </property>
        <property group="" name="AMQ_USERNAME">
          <value>${AMQ_USER}</value>
        </property>
        <property group="" name="AMQ_PASSWORD">
          <value>${AMQ_PASSWORD}</value>
        </property>
        <property group="" name="CONNECTION_TYPE">
          <value>ACTIVEMQ</value>
        </property>
        <property group="" name="DESTINATION_TYPE">
          <value>QUEUE</value>
        </property>
        <property group="" name="FIELD_TO_SEND">
          <value>{{MESSAGE_FIELD}}</value>
        </property>
        <property group="" name="DISABLE_MESSAGE_ID">
          <value>N</value>
        </property>
        <property group="" name="DISABLE_MESSAGE_TIMESTAMP">
          <value>N</value>
        </property>
        <property group="" name="DELIVERY_MODE">
          <value>persistent</value>
        </property>
        <property group="" name="PRIORITY">
          <value>4</value>
        </property>
        <property group="" name="TIME_TO_LIVE">
          <value>0</value>
        </property>
        <property group="" name="DELIVERY_DELAY">
          <value>0</value>
        </property>
        <property group="" name="JMS_CORRELATION_ID">
          <value/>
        </property>
        <property group="" name="JMS_TYPE">
          <value/>
        </property>
      </group>
      <group name="PROPERTIES">
        <property group="PROPERTIES" name="PROPERTY_NAMES">
        </property>
        <property group="PROPERTIES" name="PROPERTY_VALUES">
        </property>
      </group>
      <group name="SSL_GROUP">
        <property group="SSL_GROUP" name="SSL_ENABLED">
          <value>false</value>
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
| `DESTINATION` | Y | Tên queue/topic đích. |
| `AMQ_URL` / `AMQ_USERNAME` / `AMQ_PASSWORD` (+ `IBMMQ_*`) | Y (broker dùng) | URL + credential (`${VAR}`). |
| `CONNECTION_TYPE` / `DESTINATION_TYPE` | N | `ACTIVEMQ` / `QUEUE` (mặc định delegate). |
| `FIELD_TO_SEND` | Y | Tên field chứa nội dung message (động — cần hop vào). |
| `PROPERTIES`/`PROPERTY_NAMES` + `PROPERTY_VALUES` | N | Header JMS song song 2 list (tên ↔ giá trị theo index). |
| `DISABLE_MESSAGE_ID` / `DISABLE_MESSAGE_TIMESTAMP` | N | Tắt sinh message-id/timestamp. |
| `DELIVERY_MODE` | N | `persistent` / `non-persistent`. |
| `PRIORITY` | N | 0–9 (JMS). |
| `TIME_TO_LIVE` / `DELIVERY_DELAY` | N | Ms; `0` = không hết hạn/không trễ. |
| `JMS_CORRELATION_ID` / `JMS_TYPE` | N | Header tương quan/loại message. |
| `SSL_*` (`SSL_GROUP`) | N | SSL; `SSL_ENABLED` boolean. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: JMS_PRODUCER` | `<type>` | `Jms2Producer`. |
| `configuration.destination` | `DESTINATION` value | Queue/topic. |
| `configuration.message_field` | `FIELD_TO_SEND` value | Field động, cần hop vào. |
| `configuration.delivery_mode` | `DELIVERY_MODE` value | `persistent`/`non-persistent`. |
| `configuration.headers{}` | `PROPERTY_NAMES` + `PROPERTY_VALUES` values | 2 list song song theo index. |

Mọi cấu hình nằm trong `<step-props>` (xem giới hạn fill ở `Jms2Consumer`
mục 5).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "Jms2Producer", …)`
  (`plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsProducerMeta.java`
  dòng 68).
- Serialization: class `extends BaseSerializingMeta`
  (`JmsProducerMeta.java` dòng 74 — kế thừa `getXML()` JAXB như
  `Jms2Consumer`); `setDefault()` rỗng (dòng 151–153, "no defaults").
- Trường: `JmsProducerMeta` dòng 103–139 — `@InjectionDeep jmsDelegate`
  (prop delegate như consumer), `FIELD_TO_SEND` (dòng 106–107, mặc định
  `""`), `PROPERTY_NAMES`/`PROPERTY_VALUES` nhóm `PROPERTIES` (dòng
  109–115, 2 `ArrayList` rỗng), `DISABLE_MESSAGE_ID`,
  `DISABLE_MESSAGE_TIMESTAMP`, `DELIVERY_MODE`, `PRIORITY`,
  `TIME_TO_LIVE`, `DELIVERY_DELAY`, `JMS_CORRELATION_ID`, `JMS_TYPE`
  (dòng 117–139, hằng tên dòng 90–101).
- Quan sát thực: `plugins/streaming/impls/jms/src/test/resources/amq-producer.ktr`
  dòng 491+ — block `<step-props>` với nhóm `""` (delegate +
  `FIELD_TO_SEND`), nhóm `PROPERTIES`, nhóm SSL; producer KHÔNG có
  `TRANSFORMATION_PATH`/`NUM_MESSAGES` (không kế thừa base-stream).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (header + non-persistent + TTL 60s):

```xml
<property group="" name="FIELD_TO_SEND">
  <value>PAYLOAD_JSON</value>
</property>
<property group="" name="DELIVERY_MODE">
  <value>non-persistent</value>
</property>
<property group="" name="TIME_TO_LIVE">
  <value>60000</value>
</property>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Fragment là `<step-props>`**: đừng bịa tag phẳng (xem `Jms2Consumer`
  mục 5).
- **`setDefault()` rỗng**: producer mới không có default nào (dòng
  151–153) — template ghi đủ giá trị cần thiết.
- **`FIELD_TO_SEND` là field ĐỘNG**: step bắt buộc có hop vào chứa field
  này; khác consumer (tự sinh cột).
- **2 list header song song theo index**: `PROPERTY_NAMES[i]` ↔
  `PROPERTY_VALUES[i]` — lệch số phần tử gây sai header lặng lẽ.
- **Password luôn `${VAR}`** (4 field `secure`).
- Template mặc định là khung cấu hình — người dùng phải điền broker URL,
  destination, field message tồn tại; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `BaseSerializingMeta` +
  `@Injection` fields + fixture `.ktr` trong source tại commit đã ghim ở
  mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy với broker thật) — không tuyên bố hai mức này.
