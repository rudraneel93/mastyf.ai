"""Timing side-channel probe detection."""

from __future__ import annotations

import os
import re
import time
from typing import Optional

from .types import CallContext, PolicyDecision

TIMING_PROBE = [
    re.compile(r"\b(?:sleep|benchmark|pg_sleep|waitfor\s+delay)\s*\(", re.I),
    re.compile(r"\bif\s*\(\s*(?:ascii|ord|substring)", re.I),
    re.compile(r"\b(?:timing|time[- ]?based)\s+(?:attack|oracle)", re.I),
]

_probe_counts: dict[str, tuple[int, float]] = {}
MAX_PROBES = int(os.environ.get("MCP_GUARDIAN_MAX_TIMING_PROBES_PER_MIN", "8"))


def reset_timing_probe_counters() -> None:
    _probe_counts.clear()


def evaluate_timing_guard(ctx: CallContext) -> Optional[PolicyDecision]:
    import json

    blob = json.dumps(ctx.arguments or {}, ensure_ascii=False)
    if not any(p.search(blob) for p in TIMING_PROBE):
        return None
    tenant = ctx.tenant_id or "default"
    sub = ctx.agent_identity.sub if ctx.agent_identity else "anon"
    key = f"timing:{tenant}:{ctx.server_name}:{sub}"
    now = time.time()
    count, reset = _probe_counts.get(key, (0, now + 60))
    if now > reset:
        count, reset = 1, now + 60
    else:
        count += 1
    _probe_counts[key] = (count, reset)
    if count > MAX_PROBES:
        return PolicyDecision("block", "timing-probe-rate-limit", "Timing probe rate exceeded")
    return PolicyDecision("block", "timing-side-channel-guard", "Timing side-channel probe in arguments")
