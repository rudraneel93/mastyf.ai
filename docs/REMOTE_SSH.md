# VS Code Remote SSH

When Cursor or VS Code runs on your laptop but MCP servers run on a **Remote SSH** host, tool arguments often use **local** paths (`C:\Users\dev\app\...`) while Guardian policy and workspace rules use **remote** paths (`/home/vscode/app/...`).

## Environment

| Variable | Description |
|----------|-------------|
| `GUARDIAN_REMOTE_SSH` | Set to `true` to enable path translation |
| `GUARDIAN_REMOTE_PATH_MAP` | Map local prefixes to remote (JSON or `local=/remote` pairs) |
| `GUARDIAN_WORKSPACE` | Workspace root (local side); translated for path-guard checks |
| `MCP_GUARDIAN_DB_PATH` | Shared SQLite file on the remote host (use WAL; see below) |

### Path map examples

```bash
# JSON
export GUARDIAN_REMOTE_PATH_MAP='{"C:/Users/dev/app":"/home/vscode/app"}'

# Pairs (comma-separated)
export GUARDIAN_REMOTE_PATH_MAP='C:\Users\dev\app=/home/vscode/app'
```

## Cursor / VS Code setup

1. Open the project via **Remote SSH** so MCP and Guardian run on the same machine as tools.
2. Set `GUARDIAN_REMOTE_SSH=true` and `GUARDIAN_REMOTE_PATH_MAP` in the wrapped MCP server `env` (or in `guardian-proxy.sh`).
3. Point `GUARDIAN_WORKSPACE` at your **local** project root; Guardian translates it for policy checks.
4. Use one canonical database path for all proxies:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "bash",
      "args": ["scripts/guardian-proxy.sh", "--config", "guardian-configs/my-server.json", "--policy", "default-policy.yaml"],
      "env": {
        "GUARDIAN_REMOTE_SSH": "true",
        "GUARDIAN_REMOTE_PATH_MAP": "C:/Users/dev/app=/home/vscode/app",
        "GUARDIAN_WORKSPACE": "C:/Users/dev/app",
        "MCP_GUARDIAN_DB_PATH": "/home/vscode/.mcp-guardian/history.db"
      }
    }
  }
}
```

`mcp-guardian wrap` copies `GUARDIAN_REMOTE_SSH` and `GUARDIAN_REMOTE_PATH_MAP` into wrapped entries when those variables are set in the shell running `wrap`.

## SQLite on Remote SSH

Multiple proxy processes should share **`MCP_GUARDIAN_DB_PATH`** on the remote filesystem. `HistoryDatabase` enables **WAL** and **`busy_timeout=5000`**; writes retry on `SQLITE_BUSY` with exponential backoff.
