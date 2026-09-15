# ADD_RESULT_FILENAMES — Job entry thêm filenames vào result

Thêm FILE vào result filenames của job — nêu trực tiếp từng file, hoặc nêu
thư mục để QUÉT và đăng ký các file con khớp regex. Thư mục không bao giờ
tự thành result entry. Ba cờ Y/N (`arg_from_previous`,
`include_subfolders`, `delete_all_before`) rồi khối `<fields>` chứa 0..n
item `<field>` (`name`, `filemask`) — cùng họ với `DELETE_FILES` nhưng entry
này THÊM vào result chứ không xóa file.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>ADD_RESULT_FILENAMES</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <delete_all_before>N</delete_all_before>
      <fields>
        <field>
          <name>${SOURCE_PATH}</name>
          <filemask>{{FILEMASK}}</filemask>
        </field>
      </fields>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<arg_from_previous>` | N | `Y` đọc cặp (folder, mask) từ 2 cột đầu của result ROWS entry trước; `N` (mặc định) dùng danh sách `<fields>` tĩnh. Nhánh rows chỉ chạy khi `argFromPrevious && rows != null`; `else-if arguments != null` fallback static khi rows null. Lưu ý: rows RỖNG nhưng non-null + `Y` → duyệt 0 vòng, KHÔNG fallback static. |
| `<include_subfolders>` | N | `Y` quét cả thư mục con khi `name` là thư mục; mặc định `N`. Chỉ có tác dụng ở nhánh quét thư mục. |
| `<delete_all_before>` | N | `Y` clear map result filenames trong memory trước khi thêm (`result.getResultFiles().clear()`); KHÔNG xóa file trên đĩa. Mặc định `N`. |
| `<fields>/<field>/name` | Y (khi `arg_from_previous=N`) | File hoặc thư mục nguồn. Dùng biến (`${SOURCE_DIR}`), không hardcode đường dẫn máy. |
| `<fields>/<field>/filemask` | N | **Regex Java** (full-match) lọc file khi `name` là thư mục; để rỗng khi nêu chính xác một file. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.include_subfolders` | `<include_subfolders>` | Y/N. |
| `configuration.delete_all_before` | `<delete_all_before>` | Y/N. |
| `configuration.files[].path` | `<fields>/<field>/name` | |
| `configuration.files[].filemask` | `<fields>/<field>/filemask` | Regex, không phải glob. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4, commit
`1a939ab5cabe4517867879684aeca2a526bcc638` —

- Đăng ký: annotation `@JobEntry(id = "ADD_RESULT_FILENAMES", ...)`
  (`plugins/core/impl/src/main/java/org/pentaho/di/job/entries/addresultfilenames/JobEntryAddResultFilenames.java`
  dòng 70–75, category FileManagement). KHÔNG có trong
  `kettle-job-entries.xml` — annotation plugin core là nguồn đăng ký duy
  nhất trong phạm vi source đã kiểm kê.
- Serialization: `getXML()` (dòng 107–130) — `super.getXML()` (`name`,
  `description`, `type`, `attributes`) rồi đúng thứ tự `arg_from_previous`,
  `include_subfolders`, `delete_all_before` (Y/N), khối `<fields>` bao ngoài
  chứa mỗi `<field>` đúng thứ tự `name` rồi `filemask`. `arguments == null`
  → khối `<fields>` rỗng (wrapper vẫn luôn serialize).
- Deserialization: `loadXML()` (dòng 132–158) — 3 cờ đọc Y/N
  (`"Y".equalsIgnoreCase`, tag thiếu → false); đếm `<field>` dưới
  `<fields>` qua `countNodes`, đọc `name`/`filemask` từng item.
- Defaults ctor (dòng 89–96): cả ba cờ `false`, `arguments = null`.
- Wrapper ngoài: `JobEntryCopy.getXML()`
  (`engine/src/main/java/org/pentaho/di/job/entry/JobEntryCopy.java` dòng
  102–119) bao bằng `parallel`, `draw`, `nr`, `xloc`, `yloc`,
  `attributes_kjc` — giữ nguyên theo mẫu.
- Ngữ nghĩa runtime (`execute()`, dòng 203–270): `deleteallbefore` xóa sạch
  result files trước (dòng 210–221);   nhánh `argFromPrevious && rows != null` (dòng 230–248)
  lấy folder ở cột 0 và mask ở cột 1 của từng result row; nhánh
  `else-if arguments != null` (dòng 249–262) duyệt danh sách tĩnh — static
  chỉ là fallback khi rows null, rows rỗng non-null thì không fallback;
  quét thư mục qua `TextFileSelector`
  (dòng 356–378, `includeSubfolders` gác nhánh thư mục con); `filemask` là
  regex (`GetFileWildcard`, dòng 391–405 — `Pattern.compile().matcher().
  matches()`); file thêm vào result dưới dạng
  `ResultFile(FILE_TYPE_GENERAL, ...)` (dòng 294–298, 308–313).

Cấu hình 2 file theo đúng thứ tự source (`name`, `filemask`):

```xml
<fields>
  <field>
    <name>${SOURCE_DIR}</name>
    <filemask>.*\.csv$</filemask>
  </field>
  <field>
    <name>${ARCHIVE_DIR}</name>
    <filemask>.*\.zip$</filemask>
  </field>
</fields>
```

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field` (cùng họ
  `DELETE_FILES`/`TRUNCATE_TABLES`).
- `arg_from_previous=Y` + có result rows thì `<fields>` tĩnh BỊ BỎ QUA —
  đừng cấu hình cả hai rồi trông chờ merge. Nhưng khi rows null, nhánh static
  vẫn chạy fallback — hành vi phụ thuộc runtime, không suy ra từ XML tĩnh.
- `filemask` là regex full-match: `.*\.csv$` chứ không phải `*.csv`.
- Entry này chỉ thêm vào result filenames trong memory — không copy/move file
  trên đĩa (việc đó là của `COPY_MOVE_RESULT_FILENAMES`).
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Version Evidence

- `source_version: 9.4`, `verified_versions: 9.4`,
  `verification: source_reviewed` — đối chiếu `getXML()`/`loadXML()`/ctor
  tại commit đã ghim ở mục 4.
- Chưa kiểm chứng `spoon_loaded` (mở/lưu bằng Spoon PDI 9.4) hay
  `runtime_passed` (chạy bằng Kitchen) — không tuyên bố hai mức này.
