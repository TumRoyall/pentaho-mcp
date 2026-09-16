# MQTTProducer — Step gửi message MQTT (streaming)

Step streaming publish MỖI dòng đầu vào thành một MQTT message: topic tĩnh
(`TOPIC`) hoặc từ field (`FIELD_TOPIC` + `TOPIC_IN_FIELD=Y`), nội dung từ
field (`MESSAGE_FIELD`). Serialization qua `BaseSerializingMeta` →
fragment `<step-props>` (nhóm `""` + nhóm `SSL`). Producer KHÔNG có prop
streaming-base.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MQTTProducer</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <step-props secure="PASSWORD SSL_VALUES">
      <group name="">
        <property group="" name="MQTT_SERVER">
          <value>${MQTT_SERVER}</value>
        </property>
        <property group="" name="CLIENT_ID">
          <value>{{CLIENT_ID}}</value>
        </property>
        <property group="" name="TOPIC">
          <value>{{TOPIC}}</value>
        </property>
        <property group="" name="FIELD_TOPIC">
          <value/>
        </property>
        <property group="" name="TOPIC_IN_FIELD">
          <value>false</value>
        </property>
        <property group="" name="QOS">
          <value>0</value>
        </property>
        <property group="" name="MESSAGE_FIELD">
          <value>{{MESSAGE_FIELD}}</value>
        </property>
        <property group="" name="USERNAME">
          <value>${MQTT_USER}</value>
        </property>
        <property group="" name="PASSWORD">
          <value>${MQTT_PASSWORD}</value>
        </property>
        <property group="" name="KEEP_ALIVE_INTERVAL">
          <value/>
        </property>
        <property group="" name="MAX_INFLIGHT">
          <value/>
        </property>
        <property group="" name="CONNECTION_TIMEOUT">
          <value/>
        </property>
        <property group="" name="CLEAN_SESSION">
          <value/>
        </property>
        <property group="" name="STORAGE_LEVEL">
          <value/>
        </property>
        <property group="" name="SERVER_URIS">
          <value/>
        </property>
        <property group="" name="MQTT_VERSION">
          <value/>
        </property>
        <property group="" name="AUTOMATIC_RECONNECT">
          <value/>
        </property>
      </group>
      <group name="SSL">
        <property group="SSL" name="USE_SSL">
          <value>false</value>
        </property>
        <property group="SSL" name="SSL_KEYS">
        </property>
        <property group="SSL" name="SSL_VALUES">
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
| `MQTT_SERVER` | Y | URI broker (`${MQTT_SERVER}`). |
| `CLIENT_ID` | N | Client id. |
| `TOPIC` | Y (khi topic tĩnh) | Topic publish tĩnh. |
| `FIELD_TOPIC` + `TOPIC_IN_FIELD` | N (bắt buộc khi topic động) | Field chứa topic + `true` = lấy topic từ field. Boolean chữ thường. |
| `QOS` | N | `0` / `1` / `2`. |
| `MESSAGE_FIELD` | Y | Field chứa nội dung message (động — cần hop vào). |
| `USERNAME` / `PASSWORD` | N | Credential (`${VAR}`). |
| Paho options (`KEEP_ALIVE_INTERVAL`…`AUTOMATIC_RECONNECT`) | N | Trống = default lib. |
| `SSL`: `USE_SSL` / `SSL_KEYS` / `SSL_VALUES` | N | SSL; 2 list song song. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MQTT_PRODUCER` | `<type>` | `MQTTProducer`. |
| `configuration.server` | `MQTT_SERVER` value | `${VAR}`. |
| `configuration.topic` | `TOPIC` value | Topic tĩnh. |
| `configuration.topic_field` | `FIELD_TOPIC` value + `TOPIC_IN_FIELD=true` | Topic động. |
| `configuration.message_field` | `MESSAGE_FIELD` value | Field động, cần hop vào. |
| `configuration.qos` | `QOS` value | `0`/`1`/`2`. |

Mọi cấu hình nằm trong `<step-props>` (xem giới hạn fill ở `Jms2Consumer`
mục 5).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "MQTTProducer", …)`
  (`plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTProducerMeta.java`
  dòng 86, `extends BaseSerializingMeta`, dòng 99).
- Serialization: không override `getXML()` — qua `BaseSerializingMeta`
  (JAXB `<step-props>`) như `Jms2Consumer`.
- Trường: dòng 106–155 — `mqttServer`, `clientId`, `topic`, `fieldTopic`,
  `topicInField=false` (dòng 119), `qos`, `messageField`, `username`,
  `password`, `useSsl=false` nhóm `SSL`, `sslKeys`/`sslValues` rỗng,
  option Paho; `setDefault()` (dòng 162+) — xem source.
- Quan sát thực: `plugins/streaming/impls/mqtt/src/test/resources/ProduceFourRows.ktr`
  dòng 491+ — thứ tự nhóm `""`: `MQTT_SERVER`, `CLIENT_ID`, `TOPIC`,
  `QOS`, `MESSAGE_FIELD`, `USERNAME`, `PASSWORD`, Paho options, rồi nhóm
  `SSL`. Fixture thiếu `FIELD_TOPIC`/`TOPIC_IN_FIELD` (lưu trước khi
  source có — template liệt kê đủ).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (topic từ field + QoS 2):

```xml
<property group="" name="TOPIC">
  <value/>
</property>
<property group="" name="FIELD_TOPIC">
  <value>TARGET_TOPIC</value>
</property>
<property group="" name="TOPIC_IN_FIELD">
  <value>true</value>
</property>
<property group="" name="QOS">
  <value>2</value>
</property>
```

## 5. Lưu ý / bẫy

- **Fragment là `<step-props>`**: đừng bịa tag phẳng (xem `Jms2Consumer`
  mục 5).
- **Hai chế độ topic loại trừ nhau**: `TOPIC_IN_FIELD=true` thì topic lấy
  từ `FIELD_TOPIC`, `TOPIC` tĩnh bị bỏ qua — đừng điền cả hai rồi mong cả
  hai có tác dụng.
- **Boolean chữ thường**: `TOPIC_IN_FIELD`/`USE_SSL` ghi `true`/`false`
  (JAXB boolean), không phải Y/N.
- **Fixture `.ktr` trong source đã cũ**: thiếu `FIELD_TOPIC`/
  `TOPIC_IN_FIELD` — template liệt kê đủ theo source.
- **Password luôn `${VAR}`**.
- Template mặc định là khung cấu hình — người dùng phải nối hop có field
  message và điền broker/topic; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `BaseSerializingMeta` +
  `@Injection` fields + fixture `.ktr` trong source tại commit đã ghim ở
  mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy với broker thật) — không tuyên bố hai mức này.
