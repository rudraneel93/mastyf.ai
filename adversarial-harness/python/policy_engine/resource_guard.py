"""Resource exhaustion guards — argument size and JSON depth."""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from .arg_walker import walk_string_leaves
from .types import CallContext, PolicyDecision

MAX_POLICY_ARGS_BYTES = int(os.environ.get("MCP_GUARDIAN_MAX_POLICY_ARGS_BYTES", "2097152"))
MAX_JSON_DEPTH = int(os.environ.get("MCP_GUARDIAN_MAX_JSON_DEPTH", "32"))


def _json_depth(value: Any, depth: int = 0) -> int:
    if depth > MAX_JSON_DEPTH + 2:
        return depth
    if value is None or not isinstance(value, (dict, list)):
        return depth
    if isinstance(value, list):
        return max((_json_depth(item, depth + 1) for item in value[:50]), default=depth)
    return max(
        (_json_depth(v, depth + 1) for v in list(value.values())[:80]),
        default=depth,
    )


def evaluate_resource_guard(ctx: CallContext, args_str: str) -> Optional[PolicyDecision]:
    # ADV-003: null-byte injection (raw leaves; json.dumps escapes \0 to \\u0000)
    has_null_in_leaves = any(
        "\0" in leaf.value or "\x00" in leaf.value
        for leaf in walk_string_leaves(ctx.arguments or {})
    )
    if has_null_in_leaves or "\0" in args_str or "\x00" in args_str:
        return PolicyDecision(
            "block",
            "resource-null-byte",
            "Null byte (\\x00) detected in tool arguments",
        )

    size = len(args_str.encode("utf-8"))
    if size > MAX_POLICY_ARGS_BYTES:
        return PolicyDecision(
            "block",
            "resource-args-size",
            f"Tool arguments exceed {MAX_POLICY_ARGS_BYTES} bytes ({size})",
        )
    if ctx.arguments and _json_depth(ctx.arguments) > MAX_JSON_DEPTH:
        return PolicyDecision(
            "block",
            "resource-json-depth",
            f"Nested arguments exceed max depth {MAX_JSON_DEPTH}",
        )
    return None
