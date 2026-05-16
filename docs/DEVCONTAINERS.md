# Dev Containers

Run MCP Guardian inside a [Dev Container](https://containers.dev/) so tools, proxy, and SQLite share one filesystem.

## Bind mount

Mount your repo at `/workspace` (default in many templates). Keep Guardian state on the mounted volume:

```bash
export MCP_GUARDIAN_DB_PATH=/workspace/.mcp-guardian/history.db
mkdir -p /workspace/.mcp-guardian
```

All proxy processes and the TUI should use the **same** `MCP_GUARDIAN_DB_PATH`. Guardian opens the DB in WAL mode with a 5s busy timeout; concurrent writers share one file instead of per-PID copies.

## Example `devcontainer.json` snippet

```json
{
  "mounts": ["source=${localWorkspaceFolder},target=/workspace,type=bind"],
  "remoteEnv": {
    "MCP_GUARDIAN_DB_PATH": "/workspace/.mcp-guardian/history.db",
    "GUARDIAN_WORKSPACE": "/workspace"
  },
  "postCreateCommand": "mkdir -p /workspace/.mcp-guardian && pnpm install && pnpm build"
}
```

## TUI beside proxy

- Start the proxy first (`mcp-guardian proxy` or wrapped MCP).
- Run `mcp-guardian tui` in another terminal in the same container.
- TUI opens the DB **read-only**; learning runs on the proxy process.

See [REMOTE_SSH.md](./REMOTE_SSH.md) if the IDE is local but tools run on a remote host.
