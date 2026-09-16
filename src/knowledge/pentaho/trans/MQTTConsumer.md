# MQTTConsumer — Step đọc message MQTT (streaming)

Step streaming subscribe topic MQTT (`TOPICS` list) và đẩy từng message qua
sub-transformation (`TRANSFORMATION_PATH` + `SUB_STEP`), mỗi message một
dòng với 2 cột (`MSG_OUTPUT_NAME`, `TOPIC_OUTPUT_NAME`, mặc định
`Message`/`Topic`). Serialization qua `BaseSerializingMeta` → fragment
`<step-props>` (nhóm `""` + nhóm `SSL`).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MQTTConsumer</type>
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
        <property group="" name="TOPICS">
          <value>{{TOPIC}}</value>
        </property>
        <property group="" name="MSG_OUTPUT_NAME">
          <value>Message</value>
        </property>
        <property group="" name="TOPIC_OUTPUT_NAME">
          <value>Topic</value>
        </property>
        <property group="" name="QOS">
          <value>0</value>
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
        <property group="" name="MESSAGE_DATA_TYPE">
          <value>String</value>
        </property>
        <property group="" name="TRANSFORMATION_PATH">
          <value>${SUB_TRANS}</value>
        </property>
        <property group="" name="NUM_MESSAGES">
          <value>1000</value>
        </property>
        <property group="" name="PREFETCH_COUNT">
          <value>100000</value>
        </property>
        <property group="" name="DURATION">
          <value>1000</value>
        </property>
        <property group="" name="SUB_STEP">
          <value>{{SUB_STEP}}</value>
        </property>
        <property group="" name="PARALLELISM">
          <value>1</value>
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
| `CLIENT_ID` | N | Client id (trống = tự sinh). |
| `TOPICS` | Y | List topic subscribe (nhiều `<value>`). |
| `MSG_OUTPUT_NAME` / `TOPIC_OUTPUT_NAME` | N | Tên 2 cột output; mặc định `Message`/`Topic`. Chú ý: TÊN INJECTION là `MSG_OUTPUT_NAME`/`TOPIC_OUTPUT_NAME` (literal trong source), không phải hằng `Message`/`Topic name`. |
| `QOS` | N | `0` (mặc định) / `1` / `2`. Chuỗi số. |
| `USERNAME` / `PASSWORD` | N | Credential (`${VAR}`). |
| `KEEP_ALIVE_INTERVAL` / `MAX_INFLIGHT` / `CONNECTION_TIMEOUT` / `CLEAN_SESSION` / `STORAGE_LEVEL` / `SERVER_URIS` / `MQTT_VERSION` / `AUTOMATIC_RECONNECT` | N | Tùy chọn client Paho (trống = default lib). |
| `MESSAGE_DATA_TYPE` | N | Kiểu dữ liệu message (mặc định String). |
| `TRANSFORMATION_PATH` / `NUM_MESSAGES` / `PREFETCH_COUNT` / `DURATION` / `SUB_STEP` / `PARALLELISM` | Sub-trans Y / N | Kế thừa `BaseStreamStepMeta` dòng 67–83: path, batch `"1000"`, prefetch `"100000"`, duration `"1000"`, sub-step, parallelism `"1"`. |
| `SSL`: `USE_SSL` / `SSL_KEYS` / `SSL_VALUES` | N | SSL; 2 list song song key↔value. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MQTT_CONSUMER` | `<type>` | `MQTTConsumer`. |
| `configuration.server` | `MQTT_SERVER` value | `${VAR}`. |
| `configuration.topics[]` | `TOPICS` values | Nhiều `<value>`. |
| `configuration.qos` | `QOS` value | `0`/`1`/`2`. |
| `configuration.message_field` / `topic_field` | `MSG_OUTPUT_NAME` / `TOPIC_OUTPUT_NAME` | Tên cột. |
| `configuration.sub_transformation` | `TRANSFORMATION_PATH` | Đường dẫn sub-trans. |

Mọi cấu hình nằm trong `<step-props>` (xem giới hạn fill ở `Jms2Consumer`
mục 5).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@Step(id = "MQTTConsumer", …)`
  (`plugins/streaming/impls/mqtt/src/main/java/org/pentaho/di/trans/step/mqtt/MQTTConsumerMeta.java`
  dòng 96, `extends BaseStreamStepMeta`, dòng 109).
- Serialization: không override `getXML()` — qua `BaseSerializingMeta`
  (JAXB `<step-props>`) như `Jms2Consumer`. Tên injection là hằng
  `MQTTConstants.java` dòng 29–52 (`MQTT_SERVER`, `TOPICS`, `QOS`, …,
  nhóm `SSL` dòng 37); NGOẠI LỆ: `MSG_OUTPUT_NAME`/`TOPIC_OUTPUT_NAME` là
  literal trong annotation (dòng 127, 132), không phải hằng `Message`/
  `Topic name` (dòng 34–35, dùng cho metaverse).
- Trường/default: dòng 114–176 — `mqttServer=""`, `clientId=""`,
  `topics=[]`, `msgOutputName="Message"`, `topicOutputName="Topic"`,
  `qos="0"`, option Paho `""`, `messageDataType=String`;
  `setDefault()` (dòng 183+) reset + nạp `sslKeys`/`sslValues` từ
  `DEFAULT_SSL_OPTS`.
- Quan sát thực: `plugins/streaming/impls/mqtt/src/test/resources/ConsumeRows.ktr`
  dòng 451–543 — đúng cấu trúc group `""` (thứ tự `MQTT_SERVER`…
  `AUTOMATIC_RECONNECT` rồi `TRANSFORMATION_PATH`, `NUM_MESSAGES`,
  `DURATION`) + nhóm `SSL` (`USE_SSL` boolean, `SSL_KEYS`/`SSL_VALUES` 13
  value song song). Fixture này thiếu `CLIENT_ID`/`MESSAGE_DATA_TYPE`
  (lưu trước khi source có — xem bẫy).
- Wrapper: `StepMeta.getXML(boolean)` (dòng 210–264) bao fragment bằng
  wrapper `<step>` chuẩn.
- Không có `<connection>`: step không tham chiếu DB — fixture test không
  cần khai báo connection.

Cấu hình không mặc định (2 topic + QoS 1 + reconnect):

```xml
<property group="" name="TOPICS">
  <value>sensors/temperature</value>
  <value>sensors/humidity</value>
</property>
<property group="" name="QOS">
  <value>1</value>
</property>
<property group="" name="AUTOMATIC_RECONNECT">
  <value>true</value>
</property>
```

## 5. Lưu ý / bẫy — CRITICAL

- **Fragment là `<step-props>`**: đừng bịa tag phẳng (xem `Jms2Consumer`
  mục 5).
- **Tên injection ≠ hằng metaverse**: XML dùng `MSG_OUTPUT_NAME`/
  `TOPIC_OUTPUT_NAME` (literal dòng 127/132); hằng `Message`/`Topic name`
  chỉ là nhãn metaverse — điền nhầm tên property thì deserializer bỏ qua
  lặng lẽ.
- **Fixture `.ktr` trong source đã cũ**: `ConsumeRows.ktr` thiếu
  `CLIENT_ID`/`MESSAGE_DATA_TYPE` — template liệt kê đủ theo source.
- **2 list SSL song song theo index**: `SSL_KEYS[i]` ↔ `SSL_VALUES[i]`
  (13 cặp default) — lệch số phần tử sai cấu hình lặng lẽ.
- **Password luôn `${VAR}`**.
- Template mặc định là khung cấu hình — người dùng phải điền broker,
  topic, sub-trans có thật; không chạy network khi test.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `BaseSerializingMeta` +
  `@Injection` fields + hằng `MQTTConstants` + fixture `.ktr` trong source
  tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy với broker thật) — không tuyên bố hai mức này.
