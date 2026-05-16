# MCP Guardian on Windows

## Supported

- Node.js 18+ on Windows 10/11
- `mcp-guardian` CLI (`scan`, `audit`, `proxy`, `policy test`, `tui`)
- SQLite history at `%USERPROFILE%\.mcp-guardian\history.db`
- Path guards normalize `\` to `/` before matching sensitive-path patterns

## Known limitations

| Area | Status |
|------|--------|
| **stdio proxy** | Works when launched from PowerShell or CMD; ensure the child MCP server command is Windows-compatible |
| **Named pipes** | Not implemented — stdio JSON-RPC only (`TODO`: optional `\\.\pipe\` transport for local MCP) |
| **File paths** | Use forward slashes in policy tests; `GUARDIAN_WORKSPACE` should be an absolute path (e.g. `C:/dev/myproject`) |
| **Shell rules** | Semantic shell patterns target bash/sh; PowerShell-heavy tools use dedicated `semantic-powershell-guard` |
| **Line endings** | CRLF in config files is fine; payload normalizer collapses whitespace |

## Environment tips

```powershell
$env:MCP_GUARDIAN_DB_PATH = "$env:USERPROFILE\.mcp-guardian\history.db"
$env:GUARDIAN_WORKSPACE = "C:/Users/you/project"
mcp-guardian policy test --policy default-policy.yaml --tool read_file --args "{\"path\":\"C:/Users/you/project/README.md\"}"
```

## Path guard note

`path-guard.ts` converts backslashes to forward slashes before regex evaluation, so `C:\Users\foo\.ssh\id_rsa` is treated the same as a Unix-style path for blocking rules.
