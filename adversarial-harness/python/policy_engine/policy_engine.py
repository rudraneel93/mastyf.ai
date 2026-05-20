"""
Policy engine — faithful Python port of PolicyEngine.evaluate() sync pipeline.

Order: request-prompt-injection → semantic-guards (shell + tool-chain + semantic) → yaml-rules.
Async paths (ML, session data-flow, OPA) are not replicated; harness compares via Node for those.
"""

from __future__ import annotations

import json
import re
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

import yaml

from .normalizer import PayloadNormalizer
from .prompt_injection import scan_tool_call_arguments
from .semantic_guards import evaluate_semantic_guards
from .shell_tokenizer import ShellTokenizer
from .tool_chain import evaluate_tool_chain_guard
from .types import CallContext, PolicyAction, PolicyDecision, PolicyMode

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_POLICY = REPO_ROOT / "default-policy.yaml"


class PolicyEngine:
    def __init__(self, config: dict[str, Any]):
        self.config = config
        policy = config.get("policy", config)
        self.mode: PolicyMode = policy.get("mode", "block")
        self.rules: list[dict[str, Any]] = policy.get("rules", [])
        self.default_action: PolicyAction = policy.get("default_action", "pass")
        self.semantic_shell: bool = policy.get("semantic_shell", True) is not False
        self.unicode_strict: bool = policy.get("unicode_strict", True) is not False
        self.normalizer = PayloadNormalizer(self.unicode_strict)
        self.shell = ShellTokenizer()
        self._compiled_patterns: dict[str, list[re.Pattern[str]]] = {}
        self._compiled_arg: dict[str, list[tuple[str, list[re.Pattern[str]]]]] = {}
        self._call_counters: dict[str, tuple[int, float]] = {}
        self._compile_patterns()

    @classmethod
    def from_default_policy(cls) -> "PolicyEngine":
        data = yaml.safe_load(DEFAULT_POLICY.read_text(encoding="utf-8"))
        return cls(data)

    @staticmethod
    def _regex_from_policy_pattern(p: str) -> str:
        """PyYAML often yields extra backslash escaping vs Node js-yaml for the same YAML."""
        if "\\\\" in p:
            p = p.replace("\\\\", "\\")
        return p

    def _compile_patterns(self) -> None:
        for rule in self.rules:
            name = rule.get("name", "")
            for p in rule.get("patterns") or []:
                try:
                    self._compiled_patterns.setdefault(name, []).append(
                        re.compile(self._regex_from_policy_pattern(p), re.I),
                    )
                except re.error:
                    pass
            for ap in rule.get("argPatterns") or []:
                field = ap.get("field", "*")
                compiled = []
                for p in ap.get("patterns") or []:
                    try:
                        compiled.append(re.compile(self._regex_from_policy_pattern(p), re.I))
                    except re.error:
                        pass
                if compiled:
                    self._compiled_arg.setdefault(name, []).append((field, compiled))

    def _resolve_action(self, action: PolicyAction) -> PolicyAction:
        if self.mode == "audit":
            return "pass"
        if self.mode == "warn" and action == "block":
            return "flag"
        return action

    def _walk_leaves(self, obj: Any) -> list[str]:
        from .arg_walker import walk_string_leaves

        return [leaf.value for leaf in walk_string_leaves(obj)]

    def _evaluate_rule(
        self,
        rule: dict[str, Any],
        ctx: CallContext,
        args_str: str,
        skip_rate: bool = False,
    ) -> Optional[PolicyDecision]:
        name = rule.get("name", "")
        action = self._resolve_action(rule.get("action", "block"))

        tools = rule.get("tools") or {}
        if tools.get("allow"):
            if ctx.tool_name in tools["allow"]:
                return None
            return PolicyDecision(
                action,
                name,
                f"Tool '{ctx.tool_name}' not in allowlist",
            )
        if tools.get("deny") and ctx.tool_name in tools["deny"]:
            return PolicyDecision(action, name, f"Tool '{ctx.tool_name}' is explicitly denied")

        cats = (rule.get("toolCategories") or {}).get("deny") or []
        exceptions = rule.get("toolAllowExceptions") or []
        tool_lower = ctx.tool_name.lower()
        if any(cat.lower() in tool_lower for cat in cats) and ctx.tool_name not in exceptions:
            return PolicyDecision(
                action,
                name,
                f"Tool '{ctx.tool_name}' matches destructive category",
            )

        for field, patterns in self._compiled_arg.get(name, []):
            values = (
                self._walk_leaves(ctx.arguments)
                if field == "*"
                else self._walk_leaves(ctx.arguments.get(field))
                if ctx.arguments.get(field) is not None
                else []
            )
            for val in values:
                for pat in patterns:
                    if pat.search(val):
                        return PolicyDecision(
                            action,
                            name,
                            f"Argument field '{field}' matches blocked pattern",
                        )

        for pat in self._compiled_patterns.get(name, []):
            if pat.search(args_str):
                return PolicyDecision(action, name, "Argument pattern matched (normalized)")

        max_tokens = rule.get("maxTokens")
        if max_tokens and ctx.request_tokens > max_tokens:
            return PolicyDecision(
                action,
                name,
                f"Token count {ctx.request_tokens} exceeds max {max_tokens}",
            )

        max_cpm = rule.get("maxCallsPerMinute")
        if max_cpm and not skip_rate:
            key = f"{ctx.server_name}:{ctx.tool_name}"
            now = time.time()
            count, reset = self._call_counters.get(key, (0, now + 60))
            if now > reset:
                count, reset = 1, now + 60
            else:
                count += 1
            self._call_counters[key] = (count, reset)
            if count > max_cpm:
                return PolicyDecision(
                    action,
                    name,
                    f"Rate limit exceeded: {count}/{max_cpm}",
                )

        return None

    def _evaluate_semantic_shell(self, args_str: str) -> Optional[PolicyDecision]:
        if not self.semantic_shell or not args_str:
            return None
        ps = self.shell.detect_powershell_risk(args_str)
        if ps:
            return PolicyDecision("block", "semantic-shell-guard", ps)
        b64 = self.shell.detect_base64_pipe_shell(args_str)
        if b64:
            return PolicyDecision("block", "semantic-shell-guard", b64)
        sub = self.shell.detect_sensitive_command_substitution(args_str)
        if sub:
            return PolicyDecision("block", "semantic-shell-guard", sub)
        risk = self.shell.analyze_risk(args_str)
        if risk.has_command_substitution:
            return PolicyDecision(
                "block",
                "semantic-shell-guard",
                "Semantic: shell command substitution detected in arguments",
            )
        if risk.dangerous_commands:
            return PolicyDecision(
                "block",
                "semantic-shell-guard",
                f"Semantic: dangerous shell commands: [{', '.join(risk.dangerous_commands)}]",
            )
        return None

    def evaluate(self, ctx: CallContext, skip_local_rate_limit: bool = False) -> PolicyDecision:
        norm_args = (
            self.normalizer.normalize_json_value(ctx.arguments or {})
            if ctx.arguments
            else {}
        )
        norm_ctx = CallContext(
            server_name=ctx.server_name,
            tool_name=ctx.tool_name,
            arguments=norm_args,
            request_id=ctx.request_id,
            request_tokens=ctx.request_tokens,
            timestamp=ctx.timestamp,
            session_id=ctx.session_id,
        )
        args_str = json.dumps(norm_args, ensure_ascii=False)

        findings = scan_tool_call_arguments(norm_args)
        if findings:
            rank = {"critical": 0, "high": 1, "medium": 2}
            top = min(findings, key=lambda f: rank.get(f.severity, 9))
            return PolicyDecision(
                self._resolve_action("block"),
                "request-prompt-injection",
                f"Prompt injection: {top.pattern_id} ({top.severity})",
            )

        shell_dec = self._evaluate_semantic_shell(args_str)
        if shell_dec:
            return shell_dec

        chain = evaluate_tool_chain_guard(norm_ctx)
        if chain:
            return PolicyDecision(
                self._resolve_action(chain.action),
                chain.rule,
                chain.reason,
            )

        sem = evaluate_semantic_guards(norm_ctx)
        if sem:
            return PolicyDecision(self._resolve_action(sem.action), sem.rule, sem.reason)

        permitted = False
        for rule in self.rules:
            if (rule.get("tools") or {}).get("allow") and norm_ctx.tool_name in rule["tools"]["allow"]:
                permitted = True
            dec = self._evaluate_rule(rule, norm_ctx, args_str, skip_local_rate_limit)
            if dec:
                return dec

        if permitted:
            return PolicyDecision("pass", "allowlist", f"Tool '{norm_ctx.tool_name}' allowlisted")

        return PolicyDecision(
            self._resolve_action(self.default_action),
            "default",
            f"default_action: {self.default_action}",
        )
