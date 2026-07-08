# SAP Business One tools — Claude Code plugin

A Claude Code plugin that gives the team two SAP Business One capabilities:

1. **`sap-sql`** — live SQL querying against the company SAP B1 database, via the
   public npm server [`mcp-sapb1-sql`](https://www.npmjs.com/package/mcp-sapb1-sql)
   (run on demand with `npx`).
2. **`sap-b1-dictionary`** — an offline semantic dictionary of ~2,200 SAP B1
   tables (descriptions, categories/modules, documented fields). No database
   connection; bundled as data. Helps Claude know what each table/field *means*
   before querying.

## Requirements

- **Node.js** installed and on `PATH`. Needed for both servers (`node` runs the
  dictionary server; `npx` runs the SQL server and downloads it on first use).
- Network access to the SAP B1 SQL Server (`sap-sql` only).

## Configuration (per user)

This repo contains **no secrets and no internal connection details**. The database
connection is supplied entirely through environment variables on each user's
machine. Host, database name, user and password must all be set; only generic
transport options have defaults.

| Env var | Required? | Default | Purpose |
|---------|-----------|---------|---------|
| `SAP_DB_SERVER` | **yes** | — | DB host / IP |
| `SAP_DB_NAME` | **yes** | — | Database name |
| `SAP_DB_USER` | **yes** | — | SQL Server login |
| `SAP_DB_PASSWORD` | **yes** | — | SQL Server password |
| `SAP_DB_PORT` | no | `1433` | Port |
| `SAP_DB_ENCRYPT` | no | `false` | Encrypt connection |
| `SAP_DB_TRUST_SERVER_CERTIFICATE` | no | `true` | Trust server cert |

Get the host, database name and credentials from your administrator.

### Setting the vars on Windows (PowerShell, persistent)

```powershell
setx SAP_DB_SERVER   "your_db_host"
setx SAP_DB_NAME     "your_database"
setx SAP_DB_USER     "your_sql_user"
setx SAP_DB_PASSWORD "your_sql_password"
# then open a NEW terminal / restart Claude Code so it picks them up
```

> Security notes:
> - Prefer a **read-only** SQL login for querying from Claude.
> - Host and database name are intentionally **not** stored in this repo, so a
>   public repo exposes no internal network topology.
> - `SAP_DB_ENCRYPT=false` means the DB connection is unencrypted — acceptable on a
>   trusted internal network, reconsider otherwise.

## Install (local test)

From Claude Code, in the parent folder of this plugin:

```
/plugin marketplace add ./sap-b1-dictionary-plugin
/plugin install sap-b1-tools@mondraker-plugins
```

Confirm the tools appear (scoped names like `plugin:sap-b1-tools:...`). Try:
*"list the SAP B1 categories"* (dictionary, no DB) and, once your env vars are set,
a live query through `sap-sql`.

## Install (from the org marketplace)

Once published to Git and added in **Organization settings → Plugins**:

```
/plugin install sap-b1-tools@mondraker-plugins
```

## Dictionary tools (`sap-b1-dictionary`)

| Tool | What it does |
|------|--------------|
| `get_table_info` | Full info for one table: description, category, all fields. |
| `search_tables` | Find tables by name or description. |
| `get_table_fields` | List a table's documented fields. |
| `list_tables_by_category` | List tables in a module (Finance, Inventory, …). |
| `list_categories` | All categories/modules with table counts. |

## Layout

```
sap-b1-dictionary-plugin/
├── .claude-plugin/
│   ├── plugin.json         # declares both MCP servers
│   └── marketplace.json    # marketplace entry (source: this repo root)
├── servers/
│   ├── server.js           # zero-dependency dictionary MCP server
│   └── sapB1_refdb.json    # dictionary data (~2,200 tables)
└── README.md
```
