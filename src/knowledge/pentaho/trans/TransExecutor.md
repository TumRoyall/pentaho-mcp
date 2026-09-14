# TransExecutor — Step execute sub-transformation for each group of rows

Executes a sub-transformation (.ktr), passing parameters and collecting execution results back to the stream.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TransExecutor</type>
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
    <group_size>-1</group_size>
    <group_field/>
    <group_time/>
    <parameters>
      <variablemapping>
        <variable>{{PARAM_NAME}}</variable>
        <field>{{SOURCE_FIELD}}</field>
        <input/>
      </variablemapping>
      <inherit_all_vars>Y</inherit_all_vars>
    </parameters>
    <execution_result_target_step/>
    <execution_time_field/>
    <execution_result_field/>
    <execution_errors_field/>
    <execution_lines_read_field/>
    <execution_lines_written_field/>
    <execution_lines_input_field/>
    <execution_lines_output_field/>
    <execution_lines_rejected_field/>
    <execution_lines_updated_field/>
    <execution_lines_deleted_field/>
    <execution_files_retrieved_field/>
    <execution_exit_status_field/>
    <execution_log_text_field/>
    <execution_log_channelid_field/>
    <result_rows_target_step/>
    <result_files_target_step/>
    <result_files_file_name_field/>
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
| `<specification_method>` | Y | Method: `rep_name` (repository target) or `filename` (file target). |
| `<trans_name>` | Y (repo) | Name of sub-transformation in repository. |
| `<directory_path>` | Y (repo) | Repository directory path (e.g. `/batch`). |
| `<filename>` | Y (file) | Physical path to sub-transformation file when `specification_method=filename`. |
| `<parameters>` | N | Parameter mappings passed into sub-transformation. |

## 3. Notes & Gotchas

- Repository reference uses `<specification_method>rep_name</specification_method>`, `<trans_name>` and `<directory_path>`.
- Use `kettle_set_reference` tool to safely update sub-transformation references.
