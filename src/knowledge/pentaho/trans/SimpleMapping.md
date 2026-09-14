# SimpleMapping — Simplified sub-transformation step

Executes a simple sub-mapping transformation with 1 input and 1 output stream.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>SimpleMapping</type>
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
    <mappingdefinition>
      <input_step/>
      <output_step/>
      <main_path/>
      <rename_on_output>Y</rename_on_output>
      <description/>
    </mappingdefinition>
    <parameters>
      <inherit_all_vars>Y</inherit_all_vars>
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

## 3. Notes & Gotchas

- Uses `<trans_name>` and `<directory_path>` for repository sub-mapping resolution.
- Use `kettle_set_reference` tool for reference management.
