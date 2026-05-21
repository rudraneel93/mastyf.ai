"""Language-specific deserialization gadget detection."""

from __future__ import annotations

import json
import re
from typing import Optional

from .types import CallContext, PolicyDecision

GADGET_PATTERNS = [
    re.compile(r"\b(?:pickle\.loads?|cPickle|__reduce__)\b", re.I),
    re.compile(r"\bObjectInputStream\b|\breadObject\s*\(\s*\)", re.I),
    re.compile(r"\b(?:ysoserial|node-serialize)\b", re.I),
    re.compile(r"\bunserialize\s*\(", re.I),
    re.compile(r"\bMarshal\.load\b|\byaml\.unsafe_load\b", re.I),
]


def evaluate_language_gadget_guard(ctx: CallContext) -> Optional[PolicyDecision]:
    blob = json.dumps(ctx.arguments or {}, ensure_ascii=False)
    if any(p.search(blob) for p in GADGET_PATTERNS):
        return PolicyDecision(
            "block",
            "semantic-language-gadget",
            "Language-specific gadget pattern in arguments",
        )
    return None
