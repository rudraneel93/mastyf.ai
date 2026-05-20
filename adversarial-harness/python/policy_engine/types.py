from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

PolicyAction = Literal["pass", "block", "flag"]
PolicyMode = Literal["audit", "warn", "block"]


@dataclass
class PolicyDecision:
    action: PolicyAction
    rule: str
    reason: str = ""


@dataclass
class CallContext:
    server_name: str
    tool_name: str
    arguments: dict[str, Any] = field(default_factory=dict)
    request_id: str = "harness-1"
    request_tokens: int = 50
    timestamp: str = ""
    session_id: Optional[str] = None
