#!/usr/bin/env python3
"""Batch parity helper — reads JSON stdin, prints blocked decisions."""

from __future__ import annotations

import json
import sys

from policy_engine import PolicyEngine
from policy_engine.types import CallContext

def main() -> None:
    items = json.load(sys.stdin)
    engine = PolicyEngine.from_default_policy()
    out = []
    for item in items:
        dec = engine.evaluate(
            CallContext(
                server_name="parity",
                tool_name=item["toolName"],
                arguments=item.get("arguments") or {},
                session_id=f"parity:{item['rel']}",
            ),
        )
        out.append(
            {
                "rel": item["rel"],
                "blocked": dec.action == "block",
                "rule": dec.rule,
            },
        )
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
