"""Payload normalization — mirrors src/utils/payload-normalizer.ts."""

from __future__ import annotations

import html
import re
import unicodedata
from typing import Any

from .confusables import fold_homoglyphs

ZERO_WIDTH_RE = re.compile(
    r"[\u200B-\u200F\uFEFF\u00AD\u2060-\u2064\u061C\u180E\u034F\u17B4\u17B5\u202A-\u202E]"
)
URL_PCT_RE = re.compile(r"%([0-9A-Fa-f]{2})")
HEX_ESC_RE = re.compile(r"\\x([0-9A-Fa-f]{2})")
UNI_ESC_RE = re.compile(r"\\u([0-9A-Fa-f]{4})")
UNI_LONG_ESC_RE = re.compile(r"\\U([0-9A-Fa-f]{8})")
HTML_NUM_RE = re.compile(r"&#(\d+);")
HTML_HEX_RE = re.compile(r"&#x([0-9A-Fa-f]+);", re.I)
BASE64_BLOB_RE = re.compile(r"[A-Za-z0-9+/]{40,}={0,2}")


def strip_zero_width(text: str) -> str:
    return ZERO_WIDTH_RE.sub("", text)


def _url_decode(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        try:
            return chr(int(m.group(1), 16))
        except ValueError:
            return m.group(0)

    return URL_PCT_RE.sub(repl, s)


def _hex_decode(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        code = int(m.group(1), 16)
        return "\0" if code == 0 else chr(code)

    return HEX_ESC_RE.sub(repl, s)


def _unicode_decode(s: str) -> str:
    def u4(m: re.Match[str]) -> str:
        try:
            return chr(int(m.group(1), 16))
        except ValueError:
            return m.group(0)

    def u8(m: re.Match[str]) -> str:
        try:
            code = int(m.group(1), 16)
            if code > 0x10FFFF:
                return m.group(0)
            return chr(code)
        except ValueError:
            return m.group(0)

    s = UNI_ESC_RE.sub(u4, s)
    return UNI_LONG_ESC_RE.sub(u8, s)


def _html_decode(s: str) -> str:
    s = html.unescape(s)
    s = HTML_NUM_RE.sub(lambda m: chr(int(m.group(1))), s)
    return HTML_HEX_RE.sub(lambda m: chr(int(m.group(1), 16)), s)


def _unwrap_double_escapes(s: str) -> str:
    return s.replace("\\\\", "\\")


def _shell_normalize(s: str) -> str:
    return (
        s.replace("\\ ", " ")
        .replace("\\$", "$")
        .replace("\\`", "`")
        .replace('\\"', '"')
        .replace("\\'", "'")
    )


def deobfuscate_recursive(value: str, max_depth: int = 5, unicode_strict: bool = True) -> str:
    current = strip_zero_width(value)
    if len(current) > 1_000_000:
        current = current[:1_000_000]

    folded = fold_homoglyphs(current)
    if folded != current:
        current = folded
    if unicode_strict:
        current = unicodedata.normalize("NFKC", current)
    else:
        current = unicodedata.normalize("NFKC", current)

    depth = 0
    while depth < max_depth:
        before = current
        current = _url_decode(current)
        current = _hex_decode(current)
        current = _unicode_decode(current)
        current = _html_decode(current)
        current = _unwrap_double_escapes(current)
        if current == before:
            break
        depth += 1

    current = _shell_normalize(current)
    current = re.sub(r"\s+", " ", current).strip()
    return current


def detect_shell_in_base64_blobs(blob: str) -> bool:
    import base64

    for m in BASE64_BLOB_RE.finditer(blob):
        try:
            decoded = base64.b64decode(m.group(0), validate=False).decode("utf-8", errors="ignore")
            if re.search(r"\b(bash|sh|cmd|powershell|eval|exec|curl|wget)\b", decoded, re.I):
                return True
        except Exception:
            continue
    return False


class PayloadNormalizer:
    def __init__(self, unicode_strict: bool = True, max_depth: int = 5):
        self.unicode_strict = unicode_strict
        self.max_depth = max_depth

    def normalize(self, text: str) -> str:
        """Full normalize pipeline (mirrors PayloadNormalizer.normalize in TS)."""
        current = text[:1_000_000] if len(text) > 1_000_000 else text
        current = fold_homoglyphs(current)
        if self.unicode_strict:
            try:
                from .confusables import normalize_confusables  # optional TR39

                current = normalize_confusables(current)
            except Exception:
                pass
        current = unicodedata.normalize("NFKC", current)
        depth = 0
        while depth < self.max_depth:
            before = current
            current = _url_decode(current)
            current = _hex_decode(current)
            current = _unicode_decode(current)
            current = _html_decode(current)
            current = _unwrap_double_escapes(current)
            if current == before:
                break
            depth += 1
        current = _shell_normalize(current)
        # Collapse Unicode whitespace (incl. zero-width) like TS \s+
        current = re.sub(r"[\s\u200B-\u200F\uFEFF\u00AD\u2060-\u2064\u061C\u180E\u034F\u17B4\u17B5\u202A-\u202E]+", " ", current).strip()
        return current

    def normalize_json_value(self, value: Any) -> Any:
        if isinstance(value, str):
            return self.normalize(value)
        if isinstance(value, list):
            return [self.normalize_json_value(v) for v in value]
        if isinstance(value, dict):
            return {k: self.normalize_json_value(v) for k, v in value.items()}
        return value
