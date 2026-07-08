# SAP Business One tools — Claude Code plugin

A Claude Code plugin that gives the team two SAP Business One capabilities:

1. **`sap-sql-*`** — live SQL querying, with **one server instance per company
   database** (`sap-sql-blue`, `sap-sql-blue-usa`, `sap-sql-team`,
   `sap-sql-teamh2021`). Each is powered by the public npm
   server [`mcp-sapb1-sql`](https://www.npmjs.com/package/mcp-sapb1-sql) (run on
   demand with `npx`) and pinned to its own database. All are connected at the
   same time, so you can query any company's data — and every server's helper
   tools (open invoices, top customers, stock, …) work against its own database.
2. **`sap-b1-dictionary`** — an offline semantic dictionary of ~2,200 SAP B1
   tables (descriptions, categories/modules, documented fields). No database
   connection; bundled as data. Helps Claude know what each table/field *means*
   before querying.

## Requirements

- **Node.js** installed and on `PATH`. Needed for every server (`node` runs the
  dictionary server; `npx` runs each SQL server and downloads it on first use).
- Network access to the SAP B1 SQL Server (`sap-sql-*` only).
- The SQL login must have `db_datareader` in **each** database you want to query
  (see *Adding or removing databases* below).

## Configuration (per user)

This repo contains **no secrets**. Credentials and host are supplied through
environment variables on each user's machine; the database names are pinned per
server in `plugin.json`. You only need to set three variables — the database name
is **not** one of them (each server already knows its database).

| Env var | Required? | Default | Purpose |
|---------|-----------|---------|---------|
| `SAP_DB_SERVER` | **yes** | — | DB host / IP |
| `SAP_DB_USER` | **yes** | — | SQL Server login |
| `SAP_DB_PASSWORD` | **yes** | — | SQL Server password |
| `SAP_DB_PORT` | no | `1433` | Port |
| `SAP_DB_ENCRYPT` | no | `false` | Encrypt connection |
| `SAP_DB_TRUST_SERVER_CERTIFICATE` | no | `true` | Trust server cert |

Get the host and credentials from your administrator.

### Setting the vars on Windows (PowerShell, persistent)

```powershell
setx SAP_DB_SERVER   "your_db_host"
setx SAP_DB_USER     "your_sql_user"
setx SAP_DB_PASSWORD "your_sql_password"
# then FULLY QUIT and reopen Claude Code so it picks them up
```

> Security notes:
> - Prefer a **read-only** SQL login for querying from Claude.
> - The host, user and password are **not** stored in this repo (env vars only).
>   The **database names** *are* listed in `plugin.json` — if you make this repo
>   **public**, be aware you are exposing your company database names. Keep the
>   repo private (or use Approach A with a single env-driven database) if that
>   matters.
> - `SAP_DB_ENCRYPT=false` means the DB connection is unencrypted — acceptable on a
>   trusted internal network, reconsider otherwise.

## Adding or removing databases

Each queryable database is one entry under `mcpServers` in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json). To add a database,
copy an existing `sap-sql-*` block, rename the key, and change only `DB_NAME`:

```json
"sap-sql-globex": {
  "command": "npx",
  "args": ["-y", "mcp-sapb1-sql"],
  "env": {
    "DB_SERVER": "${SAP_DB_SERVER}",
    "DB_NAME": "GLOBEX",
    "DB_USER": "${SAP_DB_USER}",
    "DB_PASSWORD": "${SAP_DB_PASSWORD}",
    "DB_PORT": "${SAP_DB_PORT:-1433}",
    "DB_ENCRYPT": "${SAP_DB_ENCRYPT:-false}",
    "DB_TRUST_SERVER_CERTIFICATE": "${SAP_DB_TRUST_SERVER_CERTIFICATE:-true}"
  }
}
```

Requirements and trade-offs:

- The SQL login needs `db_datareader` in that database, granted by a DBA:
  ```sql
  USE <DATABASE>;
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'Reader_IA_R3')
      CREATE USER Reader_IA_R3 FOR LOGIN Reader_IA_R3;
  ALTER ROLE db_datareader ADD MEMBER Reader_IA_R3;
  ```
- Each database instance exposes ~28 tools, so **N databases ≈ N×28 tools**. Keep
  the list to the databases the team actually uses to avoid overwhelming the model.
- For a one-off cross-database query, any `runSqlQuery` tool also accepts
  three-part names (e.g. `SELECT * FROM ROAD.dbo.OITM`) as long as the login has
  read access to that database.

## Install (local test)

From Claude Code, in the parent folder of this plugin:

```
/plugin marketplace add ./sap-b1-dictionary-plugin
/plugin install sap-b1-tools@mondraker-plugins
```

Confirm the tools appear (scoped names like `plugin:sap-b1-tools:...`). Try:
*"list the SAP B1 categories"* (dictionary, no DB) and, once your env vars are set,
a live query such as *"top customers in BLUE"* or *"open invoices in ROAD"*.

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
│   ├── plugin.json         # declares the dictionary + one server per database
│   └── marketplace.json    # marketplace entry (source: this repo root)
├── servers/
│   ├── server.js           # zero-dependency dictionary MCP server
│   └── sapB1_refdb.json    # dictionary data (~2,200 tables)
└── README.md
```
