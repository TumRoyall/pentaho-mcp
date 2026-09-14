import { scanConnections, getSanitizedConnection, putConnection, deleteConnection } from '../repository/connections.js';
import { planConnectionRename } from '../repository/operations.js';

const str = d => ({ type: 'string', description: d });

export function connectionTools(ctx) {
  return [
    {
      name: 'kettle_connection_list',
      title: 'List shared database connections (.kdb)',
      description: 'List all .kdb connections in KETTLE_ROOT with sanitized definitions and password statuses.',
      annotations: { title: 'List shared database connections (.kdb)', readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => {
        const report = scanConnections(ctx);
        return { connections: report.connections, issues: report.issues, complete: report.complete };
      },
    },
    {
      name: 'kettle_connection_get',
      title: 'Get connection detail',
      description: 'Get sanitized definition, attributes, password status and hash for one connection.',
      annotations: { title: 'Get connection detail', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { name: str('Connection name') },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => getSanitizedConnection(ctx, a.name),
    },
    {
      name: 'kettle_connection_put',
      title: 'Create or update connection (.kdb)',
      description: 'Create or update a root .kdb connection. Refuses plaintext passwords (only empty or ${VARIABLE} placeholders allowed).',
      annotations: { title: 'Create or update connection (.kdb)', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Connection name'),
          definition: {
            type: 'object',
            properties: {
              server: str('Database server host/IP'),
              type: str('RDBMS type name (e.g. POSTGRESQL, ORACLE, MYSQL)'),
              access: str('Access method (e.g. Native, JNDI)'),
              database: str('Database name/SID'),
              port: str('Port number'),
              username: str('Database user name'),
              password: str('Password placeholder (empty or ${VARIABLE} string only)'),
            },
            additionalProperties: false,
          },
          expectedHash: str('Optional hash for concurrent modification check'),
        },
        required: ['name', 'definition'],
        additionalProperties: false,
      },
      handler: a => putConnection(ctx, a),
    },
    {
      name: 'kettle_connection_usage',
      title: 'Analyze connection usages',
      description: 'Find all artifacts using a named connection across the repository.',
      annotations: { title: 'Analyze connection usages', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { name: str('Connection name') },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => {
        const report = scanConnections(ctx);
        const usages = report.usages.filter(u => u.name.toLowerCase() === a.name.toLowerCase());
        return { name: a.name, usages, issues: report.issues, complete: report.complete };
      },
    },
    {
      name: 'kettle_connection_rename',
      title: 'Rename connection (.kdb)',
      description: 'Rename a connection file and update all verified consumers across the repository.',
      annotations: { title: 'Rename connection (.kdb)', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Current connection name'),
          newName: str('New connection name'),
          apply: { type: 'boolean', default: false, description: 'Apply rename changes (default false for preview)' }
        },
        required: ['name', 'newName'],
        additionalProperties: false,
      },
      handler: a => planConnectionRename(ctx, { name: a.name, newName: a.newName, apply: a.apply === true }),
    },
    {
      name: 'kettle_connection_delete',
      title: 'Delete connection (.kdb)',
      description: 'Delete a root .kdb connection file. Rejects if referenced by any artifact.',
      annotations: { title: 'Delete connection (.kdb)', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Connection name to delete'),
          expectedHash: str('Optional hash for concurrent modification check'),
        },
        required: ['name'],
        additionalProperties: false,
      },
      handler: a => deleteConnection(ctx, a),
    },
  ];
}
