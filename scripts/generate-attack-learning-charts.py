#!/usr/bin/env python3
"""Generate PNG figures from reports/attack-learning-eval/metrics.json (300 DPI)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports" / "attack-learning-eval"
FIGURES_DIR = REPORT_DIR / "figures"
METRICS_PATH = REPORT_DIR / "metrics.json"

COLORS = {"instant": "#2563eb", "batch": "#dc2626"}
CATEGORIES = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"]


def load_metrics() -> dict:
    if not METRICS_PATH.exists():
        print(f"[charts] Missing {METRICS_PATH}", file=sys.stderr)
        sys.exit(1)
    with METRICS_PATH.open() as f:
        return json.load(f)


def downsample(points: list[dict], max_pts: int = 300) -> list[dict]:
    if len(points) <= max_pts:
        return points
    step = max(1, len(points) // max_pts)
    out = points[::step]
    if out[-1] != points[-1]:
        out.append(points[-1])
    return out


def blocks_per_minute(points: list[dict]) -> tuple[list[float], list[float]]:
    buckets: dict[int, int] = {}
    for p in points:
        minute = int(p["t"] // 60_000)
        buckets[minute] = buckets.get(minute, 0) + int(p.get("value", 1))
    mins = sorted(buckets)
    return [float(m) for m in mins], [float(buckets[m]) for m in mins]


def style_axes(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.grid(True, alpha=0.35, linestyle="-", linewidth=0.6)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def save(fig, name: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / name
    fig.savefig(path, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def fig1(m: dict) -> Path:
    inst = m.get("chartSeries", {}).get("blocksPerMinuteInstant") or m["instant"]["blocksPerMinute"]
    batch = m.get("chartSeries", {}).get("blocksPerMinuteBatch") or m["batchOnly"]["blocksPerMinute"]
    xi, yi = blocks_per_minute(inst)
    xb, yb = blocks_per_minute(batch)
    all_x = sorted(set(xi) | set(xb))
    im = {x: v for x, v in zip(xi, yi)}
    bm = {x: v for x, v in zip(xb, yb)}

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(all_x, [im.get(x, 0) for x in all_x], color=COLORS["instant"], lw=2, label="Instant")
    ax.plot(
        all_x,
        [bm.get(x, 0) for x in all_x],
        color=COLORS["batch"],
        lw=2,
        ls="--",
        label="Batch-only control",
    )
    style_axes(ax, "Fig 1 — Blocks per minute over simulated time", "Simulated minute", "Blocked calls / min")
    ax.legend()
    return save(fig, "fig1-blocks-per-minute.png")


def fig2(m: dict) -> Path:
    inst = downsample(m.get("chartSeries", {}).get("cumulativeInstant") or m["instant"]["cumulativeUniqueSuggested"])
    batch = downsample(m.get("chartSeries", {}).get("cumulativeBatch") or m["batchOnly"]["cumulativeUniqueSuggested"])

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot([p["t"] / 3_600_000 for p in inst], [p["value"] for p in inst], color=COLORS["instant"], lw=2.2, label="Instant")
    ax.plot(
        [p["t"] / 3_600_000 for p in batch],
        [p["value"] for p in batch],
        color=COLORS["batch"],
        lw=2.2,
        ls="--",
        label="Batch-only",
    )
    style_axes(ax, "Fig 2 — Cumulative suggestions discovered", "Simulated hours", "Unique rule×tool suggestions")
    ax.legend()
    return save(fig, "fig2-cumulative-suggestions.png")


def fig3(m: dict) -> Path:
    clusters = (m.get("chartSeries", {}).get("repeatTop15") or m["instant"]["repeatClusters"])[:15]
    labels = [c["groupKey"].replace(":", " · ") for c in clusters]
    values = [c["repeatCount"] for c in clusters]

    fig, ax = plt.subplots(figsize=(10, 7))
    y = np.arange(len(labels))
    ax.barh(y, values, color=COLORS["instant"], height=0.7)
    ax.set_yticks(y, labels=labels, fontsize=9)
    ax.invert_yaxis()
    style_axes(ax, "Fig 3 — Top 15 rule×tool repeat clusters", "Repeats after first block", "")
    return save(fig, "fig3-repeat-clusters.png")


def fig4(m: dict) -> Path:
    cdf = m.get("chartSeries", {}).get("cdfInstant") or m["instant"]["cdfByCategory"]
    fig, ax = plt.subplots(figsize=(12, 5))
    for i, (cat, points) in enumerate(cdf.items()):
        if not points:
            continue
        ax.plot(
            [p["xMs"] / 60_000 for p in points],
            [p["y"] * 100 for p in points],
            color=CATEGORIES[i % len(CATEGORIES)],
            lw=2,
            label=cat,
        )
    style_axes(ax, "Fig 4 — Time-to-first-suggestion CDF by category (instant)", "Minutes from first block", "Cumulative %")
    ax.set_ylim(0, 100)
    ax.legend(fontsize=9, loc="lower right")
    return save(fig, "fig4-cdf-time-to-suggestion.png")


def fig5(m: dict) -> Path:
    inst = downsample(m.get("chartSeries", {}).get("queueInstant") or m["instant"]["queueSizeOverTime"])
    batch = downsample(m.get("chartSeries", {}).get("queueBatch") or m["batchOnly"]["queueSizeOverTime"])

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot([p["t"] / 3_600_000 for p in inst], [p["value"] for p in inst], color=COLORS["instant"], lw=2, label="Instant")
    ax.plot(
        [p["t"] / 3_600_000 for p in batch],
        [p["value"] for p in batch],
        color=COLORS["batch"],
        lw=2,
        ls="--",
        label="Batch-only",
    )
    style_axes(ax, "Fig 5 — Pending suggestion queue size over time", "Simulated hours", "Queue depth")
    ax.legend()
    return save(fig, "fig5-queue-size.png")


def fig6(m: dict) -> Path:
    heat = m["heatmap"]
    rules = sorted(heat.keys())
    tools = sorted({t for r in heat.values() for t in r})
    data = np.array([[heat.get(r, {}).get(t, 0) for t in tools] for r in rules])

    fig, ax = plt.subplots(figsize=(max(8, len(tools) * 0.9), max(4, len(rules) * 0.7)))
    im = ax.imshow(data, aspect="auto", cmap="Blues")
    ax.set_xticks(range(len(tools)), labels=tools, rotation=35, ha="right", fontsize=9)
    ax.set_yticks(range(len(rules)), labels=rules, fontsize=9)
    for i in range(len(rules)):
        for j in range(len(tools)):
            v = int(data[i, j])
            if v > 0:
                ax.text(j, i, str(v), ha="center", va="center", fontsize=8, color="white" if v > data.max() * 0.55 else "black")
    ax.set_title("Fig 6 — Rule×tool heatmap (block counts)", fontsize=14, fontweight="bold", pad=12)
    fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    return save(fig, "fig6-heatmap.png")


def fig7(m: dict) -> Path:
    data = m.get("chartSeries", {}).get("blocksUntilSuggestionByRule") or {
        "instant": m["instant"]["blocksUntilSuggestionByRule"],
        "batch": m["batchOnly"]["blocksUntilSuggestionByRule"],
    }
    rules = sorted(set(data["instant"]) | set(data["batch"]))

    def median(vals: list[float]) -> float:
        if not vals:
            return 0.0
        s = sorted(vals)
        n = len(s)
        return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

    inst_med = [median(data["instant"].get(r, [])) for r in rules]
    batch_med = [median(data["batch"].get(r, [])) for r in rules]

    x = np.arange(len(rules))
    w = 0.36
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.bar(x - w / 2, inst_med, width=w, label="Instant", color=COLORS["instant"])
    ax.bar(x + w / 2, batch_med, width=w, label="Batch-only", color=COLORS["batch"])
    ax.set_xticks(x, labels=rules, rotation=30, ha="right", fontsize=9)
    style_axes(ax, "Fig 7 — Blocks until suggestion by rule (median)", "", "Blocks (median)")
    ax.legend()
    return save(fig, "fig7-blocks-until-suggestion.png")


def main() -> None:
    m = load_metrics()
    outputs = [fig1(m), fig2(m), fig3(m), fig4(m), fig5(m), fig6(m), fig7(m)]
    print(f"[charts] Wrote {len(outputs)} figures to {FIGURES_DIR}")
    for p in outputs:
        print(f"  {p}")


if __name__ == "__main__":
    main()
