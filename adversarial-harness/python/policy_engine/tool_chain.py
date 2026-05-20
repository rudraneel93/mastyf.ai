"""Cross-tool chain guard — mirrors tool-chain-guard.ts."""

from __future__ import annotations

import re
from typing import Any, Optional

from .arg_walker import walk_string_leaves
from .normalizer import deobfuscate_recursive
from .types import CallContext, PolicyDecision

READ_TOOLS = re.compile(
    r"\b(?:read_file|read|cat|head|tail|less|strings|type|get_file|fetch_file)\b",
    re.I,
)
SENSITIVE_TARGETS = re.compile(
    r"\b(?:/etc/passwd|\.env(?:\.\w+)?|\.ssh/|id_rsa|id_ed25519|\.aws/|credentials|secrets?|serviceaccount/token|terraform\.tfstate|\.kube/config)\b",
    re.I,
)
EXFIL_VERBS = re.compile(
    r"\b(?:curl|wget|fetch|ncat|netcat|post|send|upload|forward|deliver|transmit|ship|emit|exfil|webhook|callback)\b",
    re.I,
)
CHAIN_CONNECTORS = re.compile(
    r"\b(?:then|after that|afterwards|next|finally|and then|step\s*2)\b",
    re.I,
)

STAGED_CHAIN_RE = re.compile(
    READ_TOOLS.pattern
    + r".{0,120}"
    + SENSITIVE_TARGETS.pattern
    + r".{0,160}"
    + CHAIN_CONNECTORS.pattern
    + r".{0,120}"
    + EXFIL_VERBS.pattern,
    re.I,
)
EXFIL_AFTER_READ_RE = re.compile(
    EXFIL_VERBS.pattern
    + r".{0,80}"
    + SENSITIVE_TARGETS.pattern
    + "|"
    + SENSITIVE_TARGETS.pattern
    + r".{0,120}"
    + EXFIL_VERBS.pattern,
    re.I,
)
STEP_CHAIN_RE = re.compile(
    r"step\s*[12]\s*[:.]?\s*(?:read|cat|get).{0,200}step\s*[23]\s*[:.]?\s*(?:curl|post|send|wget|upload|webhook)",
    re.I,
)


def evaluate_tool_chain_guard(ctx: CallContext) -> Optional[PolicyDecision]:
    args = ctx.arguments or {}
    blob = "\n".join(
        deobfuscate_recursive(leaf.value) for leaf in walk_string_leaves(args)
    )
    if not blob.strip():
        return None
    if (
        STAGED_CHAIN_RE.search(blob)
        or EXFIL_AFTER_READ_RE.search(blob)
        or STEP_CHAIN_RE.search(blob)
    ):
        return PolicyDecision(
            action="block",
            rule="semantic-tool-chain-guard",
            reason=f"Cross-tool exfiltration chain detected in '{ctx.tool_name}' arguments",
        )
    return None
