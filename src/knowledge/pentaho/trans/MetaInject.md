# MetaInject — ETL Metadata Injection Step

Injects dynamic metadata into a target transformation meta template at runtime.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MetaInject</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <specification_method>rep_name</specification_method>
    <trans_object_id/>
    <trans_name>{{SUB_TRANS_NAME}}</trans_name>
    <filename/>
    <directory_path>{{SUB_TRANS_DIR}}</directory_path>
    <source_step/>
    <source_output_fields/>
    <target_file/>
    <no_execution>N</no_execution>
    <stream_source_step/>
    <stream_target_step/>
    <mappings/>
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

| Field XML | Required | Meaning / Usage |
|---|---|---|
| `<specification_method>` | Y | Method: `rep_name` or `filename`. |
| `<trans_name>` | Y (repo) | Sub-transformation name in repository. |
| `<directory_path>` | Y (repo) | Repository directory path. |
| `<filename>` | Y (file) | Sub-transformation template file path. |
| `<mappings>` | N | Metadata injection mappings. |
