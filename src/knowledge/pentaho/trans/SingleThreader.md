# SingleThreader — Single-threaded sub-transformation execution step

Executes a sub-transformation in a single thread batching rows.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SingleThreader</type>
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
    <batch_size>100</batch_size>
    <batch_time/>
    <inject_step/>
    <retrieve_step/>
    <parameters>
      <pass_all_parameters>Y</pass_all_parameters>
    </parameters>
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
| `<filename>` | Y (file) | Sub-transformation file path. |
| `<batch_size>` | N | Batch size (default 100). |
| `<inject_step>` | N | Target step in sub-transformation to inject rows into. |
| `<retrieve_step>` | N | Source step in sub-transformation to retrieve output rows from. |
