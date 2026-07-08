#!/usr/bin/env node
/**
 * SAP Business One Dictionary — MCP server (zero dependencies).
 * ------------------------------------------------------------------
 * Speaks the MCP stdio transport directly (newline-delimited JSON-RPC 2.0),
 * so the plugin is fully self-contained: it needs only Node.js at runtime,
 * no `npm install` and no bundled node_modules.
 *
 * Data source: sapB1_refdb.json (compact {d,c,f} form) — ~2,200 SAP B1
 * tables with description, category and documented fields.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ---- Load the dictionary (once, at startup) ----------------------
const DB_PATH = path.join(__dirname, 'sapB1_refdb.json');

/** @type {Record<string, {d: string, c: string, f: Record<string,string>}>} */
let DB;
try {
  DB = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
} catch (err) {
  // Fatal: without data the server is useless. Report on stderr and exit.
  process.stderr.write(`[sap-b1-dictionary] cannot load ${DB_PATH}: ${err.message}\n`);
  process.exit(1);
}

const SERVER_INFO = { name: 'sap-b1-dictionary', version: '1.0.0' };
const DEFAULT_PROTOCOL_VERSION = '2025-11-25';

// ---- Dictionary lookups ------------------------------------------
function getTableInfo(tableName) {
  const key = String(tableName || '').toUpperCase();
  const t = DB[key];
  if (!t) return null;
  return {
    table: key,
    description: t.d,
    category: t.c,
    fields: Object.entries(t.f || {}).map(([field, description]) => ({ field, description })),
  };
}

function searchTables(term, limit) {
  const q = String(term || '').toLowerCase();
  const cap = Number.isFinite(limit) && limit > 0 ? limit : 50;
  const out = [];
  for (const [k, v] of Object.entries(DB)) {
    if (k.toLowerCase().includes(q) || (v.d || '').toLowerCase().includes(q)) {
      out.push({ table: k, description: v.d, category: v.c });
      if (out.length >= cap) break;
    }
  }
  return out;
}

function getTableFields(tableName) {
  const t = DB[String(tableName || '').toUpperCase()];
  if (!t || !t.f) return [];
  return Object.entries(t.f).map(([field, description]) => ({ field, description }));
}

function listTablesByCategory(category, limit) {
  const cat = String(category || '').toLowerCase();
  const cap = Number.isFinite(limit) && limit > 0 ? limit : 200;
  const out = [];
  for (const [k, v] of Object.entries(DB)) {
    if ((v.c || '').toLowerCase().includes(cat)) {
      out.push({ table: k, description: v.d, category: v.c });
      if (out.length >= cap) break;
    }
  }
  return out;
}

function listCategories() {
  const counts = {};
  for (const v of Object.values(DB)) counts[v.c] = (counts[v.c] || 0) + 1;
  return Object.entries(counts)
    .map(([category, tableCount]) => ({ category, tableCount }))
    .sort((a, b) => b.tableCount - a.tableCount);
}

// ---- Tool definitions --------------------------------------------
const TOOLS = [
  {
    name: 'get_table_info',
    description:
      'Get full information about a SAP Business One table: description, category/module, and all documented fields with their descriptions. Table name is case-insensitive (e.g. "OINV", "oinv").',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'SAP B1 table name, e.g. "OINV", "OITM", "OCRD".' },
      },
      required: ['table'],
    },
    handler: (args) => {
      const info = getTableInfo(args.table);
      return info || { error: `Table "${args.table}" not found. Use search_tables to discover valid names.` };
    },
  },
  {
    name: 'search_tables',
    description:
      'Search SAP Business One tables by name or description (case-insensitive substring match). Returns table name, description and category. Useful to discover which table holds a given kind of data.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Text to search for in table names and descriptions, e.g. "invoice", "warehouse".' },
        limit: { type: 'integer', description: 'Max results to return (default 50).' },
      },
      required: ['term'],
    },
    handler: (args) => {
      const results = searchTables(args.term, args.limit);
      return { count: results.length, results };
    },
  },
  {
    name: 'get_table_fields',
    description:
      'List the documented fields (column name + description) of a single SAP Business One table. Table name is case-insensitive.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'SAP B1 table name, e.g. "OINV".' },
      },
      required: ['table'],
    },
    handler: (args) => {
      const fields = getTableFields(args.table);
      if (!fields.length) return { error: `Table "${args.table}" not found or has no documented fields.` };
      return { table: String(args.table).toUpperCase(), fieldCount: fields.length, fields };
    },
  },
  {
    name: 'list_tables_by_category',
    description:
      'List SAP Business One tables belonging to a category/module (case-insensitive, partial match). Categories include "Marketing Documents", "Finance", "Inventory and Production", "Administration", "Banking", "Business Partners", etc. Use list_categories to see them all.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category/module name or fragment, e.g. "Finance", "Inventory".' },
        limit: { type: 'integer', description: 'Max results to return (default 200).' },
      },
      required: ['category'],
    },
    handler: (args) => {
      const results = listTablesByCategory(args.category, args.limit);
      return { count: results.length, results };
    },
  },
  {
    name: 'list_categories',
    description:
      'List every SAP Business One category/module in the dictionary with the number of tables in each. Good starting point to understand the data model.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({ categories: listCategories() }),
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

// ---- JSON-RPC plumbing (newline-delimited over stdio) ------------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function result(id, res) {
  send({ jsonrpc: '2.0', id, result: res });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize': {
      const clientVersion = params && params.protocolVersion;
      result(id, {
        // Echo the client's version when provided; both sides then agree.
        protocolVersion: clientVersion || DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    case 'ping':
      result(id, {});
      return;

    case 'tools/list':
      result(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
      return;

    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOL_MAP.get(name);
      if (!tool) {
        error(id, -32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const data = tool.handler(args);
        result(id, {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          isError: Boolean(data && data.error),
        });
      } catch (err) {
        result(id, {
          content: [{ type: 'text', text: `Error running ${name}: ${err.message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      // Unknown method with an id → method-not-found. Notifications (no id) are ignored.
      if (id !== undefined && id !== null) error(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore malformed lines
  }
  // Dispatch anything with a method. Requests carry an id and get a reply;
  // notifications (e.g. notifications/initialized) have no id and are ignored
  // inside handleRequest's default branch.
  if (msg && msg.method) handleRequest(msg);
});

rl.on('close', () => process.exit(0));
