# SAP Business One tools — Claude Code plugin

A Claude Code plugin that gives the team two SAP Business One capabilities:

1. **`sap-sql-N`** — live SQL querying, with **one server instance per database
   "slot"** (`sap-sql-1` … `sap-sql-4`). Each is powered by the public npm
   server [`mcp-sapb1-sql`](https://www.npmjs.com/package/mcp-sapb1-sql) (run on
   demand with `npx`). **The database each slot connects to is supplied by an
   environment variable** (`SAP_DB_1` … `SAP_DB_4`) — no database names are stored
   in this repo. All configured slots connect at the same time, and every server's
   helper tools (open invoices, top customers, stock, …) work against its database.
   Claude discovers which slot is which database at runtime (`SELECT DB_NAME()`).
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

This repo contains **no secrets, no host/IP, and no database names** — everything
is supplied through environment variables on each user's machine. Set the
connection details plus one variable per database you want to query.

| Env var | Required? | Default | Purpose |
|---------|-----------|---------|---------|
| `SAP_DB_SERVER` | **yes** | — | DB host / IP |
| `SAP_DB_USER` | **yes** | — | SQL Server login |
| `SAP_DB_PASSWORD` | **yes** | — | SQL Server password |
| `SAP_DB_1` | **yes** | — | Database for slot `sap-sql-1` |
| `SAP_DB_2` | no | — | Database for slot `sap-sql-2` |
| `SAP_DB_3` | no | — | Database for slot `sap-sql-3` |
| `SAP_DB_4` | no | — | Database for slot `sap-sql-4` |
| `SAP_DB_PORT` | no | `1433` | Port |
| `SAP_DB_ENCRYPT` | no | `false` | Encrypt connection |
| `SAP_DB_TRUST_SERVER_CERTIFICATE` | no | `true` | Trust server cert |

Set as many `SAP_DB_N` as you need (unused slots simply fail to connect and can be
ignored). Get the host, credentials and database names from your administrator.

### Setting the vars on Windows (PowerShell, persistent)

```powershell
setx SAP_DB_SERVER   "your_db_host"
setx SAP_DB_USER     "your_sql_user"
setx SAP_DB_PASSWORD "your_sql_password"
setx SAP_DB_1        "FIRST_DATABASE"
setx SAP_DB_2        "SECOND_DATABASE"
setx SAP_DB_3        "THIRD_DATABASE"
setx SAP_DB_4        "FOURTH_DATABASE"
# then FULLY QUIT and reopen Claude Code so it picks them up
```

> Security notes:
> - This repo is safe to be **public**: it contains no host, no credentials, and no
>   database names — all come from environment variables.
> - Prefer a **read-only** SQL login for querying from Claude.
> - `SAP_DB_ENCRYPT=false` means the DB connection is unencrypted — acceptable on a
>   trusted internal network, reconsider otherwise.

## Adding or removing databases

The repo ships **4 generic slots** (`sap-sql-1` … `sap-sql-4`). You choose which
database each maps to via the `SAP_DB_N` env vars — nothing to edit in the repo.

- **Use fewer:** set only the `SAP_DB_N` you need; the rest fail to connect and can
  be ignored (or grant the DB access later).
- **Use more:** add another slot to
  [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) by copying a
  `sap-sql-N` block, bumping the key/number, and pointing `DB_NAME` at
  `${SAP_DB_5}` (etc.).

Requirements and trade-offs:

- The SQL login needs `db_datareader` in each mapped database, granted by a DBA:
  ```sql
  USE <DATABASE>;   -- run once per database
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'Reader_IA_R3')
      CREATE USER Reader_IA_R3 FOR LOGIN Reader_IA_R3;
  ALTER ROLE db_datareader ADD MEMBER Reader_IA_R3;
  ```
- Each slot exposes ~28 tools, so **N slots ≈ N×28 tools**. Keep it to the
  databases the team actually uses to avoid overwhelming the model.
- For a one-off cross-database query, any `runSqlQuery` tool also accepts
  three-part names (e.g. `SELECT * FROM OTHER_DB.dbo.OITM`) as long as the login
  has read access to that database.

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
