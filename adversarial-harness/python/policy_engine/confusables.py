"""Cyrillic/Greek homoglyph folding (mirrors src/utils/confusables.ts fast path)."""

HOMOGLYPH_MAP: dict[int, str] = {
    0x0430: "a",
    0x0435: "e",
    0x043E: "o",
    0x0440: "p",
    0x0441: "c",
    0x0443: "y",
    0x0445: "x",
    0x0456: "i",
    0x03BF: "o",
    0x03C1: "p",
}


def fold_homoglyphs(text: str) -> str:
    out: list[str] = []
    for ch in text:
        code = ord(ch)
        out.append(HOMOGLYPH_MAP.get(code, ch))
    return "".join(out)
