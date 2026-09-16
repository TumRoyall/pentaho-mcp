# Jms2Consumer — Step đọc message JMS (streaming)

Step streaming nhận message từ JMS broker (ActiveMQ/IBM MQ) và đẩy từng
message qua sub-transformation (`TRANSFORMATION_PATH` + `SUB_STEP`). KHÁC
các step cổ điển: KHÔNG có `getXML()` viết tay — serialization qua
`BaseSerializingMeta` → JAXB `StepMetaProps`, fragment là `<step-props>`
chứa `<group>`/`<property name="INJECTION_NAME">` (không phải tag phẳng).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Jms2Consumer</type>
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
        <property group="" name="RECEIVE_TIMEOUT">
          <value>0</value>
        </property>
        <property group="" name="MESSAGE_FIELD_NAME">
          <value>message</value>
        </property>
        <property group="" name="DESTINATION_FIELD_NAME">
          <value>destination</value>
        </property>
        <property group="" name="MESSAGE_ID">
          <value>messageId</value>
        </property>
        <property group="" name="JMS_TIMESTAMP">
          <value>jmsTimestamp</value>
        </property>
        <property group="" name="JMS_REDELIVERED">
          <value>jmsRedelivered</value>
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
| `DESTINATION` | Y | Tên queue/topic (`JmsDelegate.destinationName`, mặc định `""`). |
| `IBMMQ_URL` / `IBMMQ_USERNAME` / `IBMMQ_PASSWORD` | N (IBM MQ) | URL + credential (`${VAR}`; password thuộc `secure`). |
| `AMQ_URL` / `AMQ_USERNAME` / `AMQ_PASSWORD` | Y (ActiveMQ) | URL + credential (`${VAR}`). |
| `CONNECTION_TYPE` | N | `ACTIVEMQ` (mặc định) / IBM MQ. |
| `DESTINATION_TYPE` | N | `QUEUE` (mặc định) / `TOPIC`. |
| `RECEIVE_TIMEOUT` | N | Ms chờ message; mặc định `"0"`. Chuỗi số. |
| `MESSAGE_FIELD_NAME` | N | Tên cột message trong sub-trans; mặc định `message`. |
| `DESTINATION_FIELD_NAME` | N | Tên cột destination; mặc định `destination`. |
| `MESSAGE_ID` / `JMS_TIMESTAMP` / `JMS_REDELIVERED` | N | Tên 3 cột metadata; mặc định `messageId`/`jmsTimestamp`/`jmsRedelivered`. |
| `TRANSFORMATION_PATH` | Y | Sub-transformation xử lý message (`${VAR}`/đường dẫn). |
| `NUM_MESSAGES` / `DURATION` | N | Batch message / ms; mặc định `"1000"` cả hai. |
| `SUB_STEP` | Y | Tên step trong sub-trans nhận message. |
| `SSL_*` (`SSL_GROUP`) | N | SSL keystore/truststore; `SSL_ENABLED` boolean `false`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: JMS_CONSUMER` | `<type>` | `Jms2Consumer`. |
| `configuration.destination` | `<property name="DESTINATION">/<value>` | Queue/topic. |
| `configuration.amq_url` / `username` / `password` | `AMQ_URL` / `AMQ_USERNAME` / `AMQ_PASSWORD` | `${VAR}`. |
| `configuration.sub_transformation` | `TRANSFORMATION_PATH` | Đường dẫn sub-trans. |
| `configuration.sub_step` | `SUB_STEP` | Step nhận message. |
| `configuration.message_field` | `MESSAGE_FIELD_NAME` | Tên cột. |

Không có tag phẳng — mọi cấu hình nằm trong `<step-props>`; fill bằng
`setFieldPath` với path `step-props/...`? Không — `setFieldPath` tìm theo
tên tag con; với `<property>` trùng tên tag, trỏ bằng attribute không được
hỗ trợ. Thực tế generator thay cả block `<step-props>` hoặc set theo
`<value>` thứ tự — ghi rõ giới hạn ở mục 5.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "Jms2Consumer", …)`
  (`plugins/streaming/impls/jms/src/main/java/org/pentaho/di/trans/step/jms/JmsConsumerMeta.java`
  dòng 61). Registry presence không phải XML evidence, evidence là cơ chế
  dưới đây.
- Serialization: class KHÔNG override `getXML()` — kế thừa
  `BaseSerializingMeta.getXML()`
  (`engine/src/main/java/org/pentaho/di/core/util/serialization/BaseSerializingMeta.java`
  dòng 53–55) = `MetaXmlSerializer.serialize(StepMetaProps.from(this))`
  (JAXB, `MetaXmlSerializer.java` dòng 52–60). Fragment là
  `<step-props>` (`STEP_TAG = "step-props"`, `StepMetaProps.java` dòng
  71): các `<group name="…">` (dòng 87–88), mỗi `<property group name>`
  mang `<value>` list (dòng 280–307). Thứ tự property theo metadata
  injector (nhóm `""` trước, `SSL_GROUP` sau).
- Trường: `JmsConsumerMeta` dòng 80–113 — `@InjectionDeep jmsDelegate`
  (các prop `DESTINATION`…`AMQ_SSL_TRUST_ALL`, `JmsDelegate.java` dòng
  55–108; default `connectionType=ACTIVEMQ`, `destinationType=QUEUE`),
  `RECEIVE_TIMEOUT` mặc định `"0"` (dòng 83), `messageField=message`,
  `destinationField=destination`, `messageId`, `jmsTimestamp`,
  `jmsRedelivered` (dòng 85–113). Base:
  `BaseStreamStepMeta.java` dòng 67–84 — `TRANSFORMATION_PATH=""`,
  `NUM_MESSAGES(bathSize)="1000"`, `DURATION="1000"`, `SUB_STEP=""`,
  `PREFETCH_COUNT="100000"`, `PARALLELISM="1"`; `setDefault()` dòng
  119–124.
- Quan sát thực: `plugins/streaming/impls/jms/src/test/resources/jms-consumer.ktr`
  dòng 451–537 — block `<step-props secure="IBMMQ_PASSWORD AMQ_PASSWORD
  SSL_KEYSTORE_PASSWORD SSL_TRUSTSTORE_PASSWORD">` với đúng cấu trúc
  group/property/value (`xsi:type` trên `<value>`). Fixture này THIẾU
  `MESSAGE_ID`/`JMS_TIMESTAMP`/`JMS_REDELIVERED`/`PREFETCH_COUNT`/
  `PARALLELISM` (lưu trước khi source có các field này — xem bẫy).
- Output schema: `getRowMeta()` (dòng 129–137) — 5 cột String
  (message/destination/messageId/jmsTimestamp/jmsRedelivered).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (topic + timeout 5s + batch 500):

```xml
<property group="" name="DESTINATION">
  <value>orders.events</value>
</property>
<property group="" name="DESTINATION_TYPE">
  <value>TOPIC</value>
</property>
<property group="" name="RECEIVE_TIMEOUT">
  <value>5000</value>
</property>
<property group="" name="NUM_MESSAGES">
  <value>500</value>
</property>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Fragment là `<step-props>`, không phải tag phẳng**: đừng bịa
  `<destination>`, `<amq_url>`… — deserializer (`deserialize(node).to()`,
  `BaseSerializingMeta` dòng 57–60) chỉ đọc `<step-props>`.
- **Fixture `.ktr` trong source đã cũ**: `jms-consumer.ktr` (dòng
  451–537) thiếu 5 property hiện có trong source — template liệt kê đủ
  theo source hiện tại, không sao chép mù fixture.
- **Password/credential luôn `${VAR}`**: 4 field `secure` được mã hóa khi
  lưu qua Spoon; trong template/test chỉ dùng biến.
- **Cần sub-trans + step nhận**: `TRANSFORMATION_PATH`/`SUB_STEP` bắt
  buộc khi chạy; validator không kiểm tra tồn tại file sub-trans ở mức
  structural (không repositoryContext).
- **Thứ tự property theo injector/JAXB**: không có `getXML()` viết tay
  nào pin thứ tự — template giữ thứ tự quan sát (delegate → own → base),
  test assert theo thứ tự này; thay đổi thứ tự injector ở source sau này
  có thể làm lệch (giới hạn đã nêu).
- Template mặc định là khung cấu hình — người dùng phải điền broker URL,
  destination, sub-trans có thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu cơ chế `BaseSerializingMeta`/
  `MetaXmlSerializer`/`StepMetaProps` + `@Injection` fields + fixture
  `.ktr` trong source tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy với broker thật) — không tuyên bố hai mức này.
