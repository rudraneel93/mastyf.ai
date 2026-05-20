"""Path guard — mirrors path-guard.ts sensitive path patterns."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

SENSITIVE_PATH_PATTERNS = [
    re.compile(r"^/$"),
    re.compile(r"^/etc(?:/|$)"),
    re.compile(r"^/root(?:/|$)"),
    re.compile(r"^/proc(?:/|$)"),
    re.compile(r"^/sys(?:/|$)"),
    re.compile(r"/\.ssh(?:/|$)"),
    re.compile(r"/\.aws/credentials$"),
    re.compile(r"/\.env(?:\.|$)"),
    re.compile(r"(?:^|/)id_rsa(?:\.|$)"),
    re.compile(r"(?:^|/)authorized_keys$"),
    re.compile(r"/\.kube(?:/|$)"),
    re.compile(r"/var/run/docker\.sock$"),
    re.compile(r"/var/run/secrets/kubernetes\.io/"),
    re.compile(r"(?:^|/)terraform\.tfstate(?:\.|$)"),
    re.compile(r"(?:^|/)passwd$"),
]

PATH_LIKE = re.compile(
    r"(?:^|[\s\"'`])(?:~\/|\/|\.\/|\.\.|\\|\.kube|\.ssh|\.env|id_rsa)",
    re.I,
)


@dataclass
class PathGuardResult:
    block: bool
    reason: str = ""


def evaluate_path_guard(paths: Iterable[str]) -> PathGuardResult:
    for p in paths:
        norm = p.strip()
        for pat in SENSITIVE_PATH_PATTERNS:
            if pat.search(norm):
                return PathGuardResult(
                    block=True,
                    reason=f"Blocked sensitive path: {norm[:80]}",
                )
    return PathGuardResult(block=False)
