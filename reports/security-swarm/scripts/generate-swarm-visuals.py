#!/usr/bin/env python3
"""Generate PNG figures from visuals-data.json + swarm artifacts (300 DPI)."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SWARM_DIR = ROOT / "reports" / "security-swarm"
FIGURES_DIR = SWARM_DIR / "figures"
MANIFEST_PATH = FIGURES_DIR / "manifest.json"
VISUALS_DATA_PATH = SWARM_DIR / "visuals-data.json"
LATEST_PATH = SWARM_DIR / "latest.json"
CORPUS_PATH = ROOT / "corpus-eval-report.json"
CALIBRATION_PATH = SWARM_DIR / "calibration.json"
LIVE_FS_PATH = ROOT / "scenarios" / "real-life" / "output" / "live-filesystem-session.json"

PASS = "#16a34a"
FAIL = "#dc2626"
MUTED = "#64748b"
INSTANT = "#2563eb"
BATCH = "#dc2626"
WARN = "#ea580c"

manifest: list[dict] = []


def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        print(f"[swarm-visuals] skip missing {path.relative_to(ROOT)}")
        return None
    with path.open() as f:
        return json.load(f)


def style_axes(ax, title: str, xlabel: str = "", ylabel: str = "") -> None:
    ax.set_title(title, fontsize=13, fontweight="bold", pad=10)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(True, alpha=0.35, linestyle="-", linewidth=0.6)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def register(path: Path, title: str, category: str, data_source: str) -> Path:
    manifest.append({
        "name": path.name,
        "title": title,
        "category": category,
        "url": f"/reports/security-swarm/figures/{path.name}",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "dataSource": data_source,
    })
    return path


def save(fig, name: str, title: str, category: str, data_source: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / name
    fig.savefig(path, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return register(path, title, category, data_source)


def empty_figure(name: str, title: str, category: str, message: str) -> Path:
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.text(
        0.5,
        0.5,
        message,
        ha="center",
        va="center",
        fontsize=11,
        color="#334155",
        bbox=dict(boxstyle="round,pad=0.6", facecolor="#f8fafc", edgecolor="#94a3b8"),
    )
    ax.set_title(title, fontsize=13, fontweight="bold")
    return save(fig, name, title, category, "empty")


# ── Regression (legacy fig1-4, 7) ─────────────────────────────────────────────

def fig1_gates(latest: dict) -> Path:
    gates = latest.get("gates", {})
    labels = [
        ("Corpus", gates.get("corpus")),
        ("Parity", gates.get("parity")),
        ("Steps", gates.get("steps")),
        ("Scout", gates.get("scout")),
        ("Bypass baseline", gates.get("bypassBaseline")),
    ]
    bypass_ok = gates.get("bypassCount", 0) <= gates.get("maxBypasses", 0)
    labels.append((f"Bypasses ({gates.get('bypassCount', 0)}/{gates.get('maxBypasses', 0)})", bypass_ok))
    names = [l[0] for l in labels]
    passed = [bool(l[1]) for l in labels]
    colors = [PASS if p else FAIL for p in passed]
    fig, ax = plt.subplots(figsize=(10, 5))
    y = np.arange(len(names))
    ax.barh(y, [1] * len(names), color=colors, height=0.65)
    ax.set_yticks(y, labels=names, fontsize=10)
    ax.set_xlim(0, 1.2)
    ax.set_xticks([])
    for i, p in enumerate(passed):
        ax.text(0.5, i, "PASS" if p else "FAIL", ha="center", va="center", color="white", fontweight="bold")
    overall = "PASS" if latest.get("overall") else "FAIL"
    style_axes(ax, f"Security swarm gates ({overall})", ylabel="Gate")
    fig.text(0.99, 0.02, f"mode={latest.get('mode', '?')}", ha="right", fontsize=8, color=MUTED)
    return save(fig, "fig1-gates-dashboard.png", "Regression gates", "regression", "latest.json")


def fig2_corpus_rates(latest: dict, corpus: dict | None) -> Path:
    c = latest.get("corpus") or {}
    attack = float(c.get("attackBlockRate", corpus.get("attackBlockRate", 0) if corpus else 0)) * 100
    benign = float(c.get("benignPassRate", corpus.get("benignPassRate", 0) if corpus else 0)) * 100
    fig, ax = plt.subplots(figsize=(8, 5))
    cats = ["Attack block rate", "Benign pass rate"]
    vals = [attack, benign]
    bars = ax.bar(cats, vals, color=[INSTANT, PASS], width=0.55)
    ax.set_ylim(0, 105)
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 1.5, f"{v:.1f}%", ha="center", fontweight="bold")
    style_axes(ax, "Corpus detection rates", ylabel="Rate (%)")
    return save(fig, "fig2-corpus-rates.png", "Corpus rates", "regression", "latest.json + corpus-eval")


def fig3_category_recall(corpus: dict | None) -> Path | None:
    if not corpus:
        return None
    cats = [c for c in corpus.get("byCategory", []) if c.get("category") != "benign"]
    if not cats:
        return None
    labels = [c["category"] for c in cats]
    recall = [float(c.get("recall", 0)) * 100 for c in cats]
    fig, ax = plt.subplots(figsize=(11, 6))
    y = np.arange(len(labels))
    colors = [PASS if r >= 99.9 else FAIL if r < 90 else WARN for r in recall]
    ax.barh(y, recall, color=colors, height=0.7)
    ax.set_yticks(y, labels=labels, fontsize=10)
    ax.set_xlim(0, 105)
    style_axes(ax, "Per-category attack recall", xlabel="Recall (%)")
    ax.invert_yaxis()
    return save(fig, "fig3-category-recall.png", "Category recall", "regression", "corpus-eval-report.json")


def fig4_step_timings(latest: dict) -> Path:
    steps = latest.get("timings", {}).get("steps") or []
    labels = [s["label"] for s in steps]
    secs = [float(s["elapsedSec"]) for s in steps]
    total = float(latest.get("timings", {}).get("totalSec", sum(secs)))
    fig, ax = plt.subplots(figsize=(11, 6))
    y = np.arange(len(labels))
    ax.barh(y, secs, color=INSTANT, height=0.7)
    ax.set_yticks(y, labels=labels, fontsize=9)
    style_axes(ax, f"Swarm step timings (total {total:.1f}s)", xlabel="Seconds")
    ax.invert_yaxis()
    return save(fig, "fig4-step-timings.png", "Pipeline timings", "infrastructure", "latest.json")


def fig7_live_filesystem(live: dict) -> Path | None:
    results = live.get("proxyResults") or []
    if not results:
        return None
    labels = [r.get("scenario", "?") for r in results]
    ok = [bool(r.get("ok")) for r in results]
    fig, ax = plt.subplots(figsize=(11, max(4, len(labels) * 0.55)))
    y = np.arange(len(labels))
    ax.barh(y, [1] * len(labels), color=[PASS if o else FAIL for o in ok], height=0.65)
    ax.set_yticks(y, labels=labels, fontsize=9)
    ax.set_xlim(0, 1.2)
    ax.set_xticks([])
    passed = live.get("summary", {}).get("scenariosPassed", 0)
    total = live.get("summary", {}).get("scenariosRun", 0)
    style_axes(ax, f"Live filesystem MCP ({passed}/{total})", ylabel="Scenario")
    ax.invert_yaxis()
    return save(fig, "fig7-live-filesystem-results.png", "Live filesystem scenarios", "regression", "live-filesystem-session.json")


# ── Traffic (from visuals-data) ─────────────────────────────────────────────

def traffic_calls_over_time(vd: dict) -> Path:
    hourly = vd.get("traffic", {}).get("hourly") or []
    if not hourly:
        return empty_figure(
            "traffic-calls-over-time.png",
            "Traffic over time",
            "traffic",
            vd.get("meta", {}).get("emptyReasons", {}).get("traffic", "No hourly traffic data"),
        )
    labels = [h["hourStart"][:16].replace("T", " ") for h in hourly]
    passed = [h["passed"] for h in hourly]
    blocked = [h["blocked"] for h in hourly]
    x = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.bar(x, passed, label="Passed", color=PASS, width=0.8)
    ax.bar(x, blocked, bottom=passed, label="Blocked", color=FAIL, width=0.8)
    ax.set_xticks(x, labels, rotation=35, ha="right", fontsize=8)
    style_axes(ax, "Proxied MCP calls over time (hourly)", ylabel="Calls")
    ax.legend(loc="upper right")
    return save(fig, "traffic-calls-over-time.png", "Calls over time", "traffic", "history.db")


def traffic_latency_by_server(vd: dict) -> Path:
    servers = vd.get("traffic", {}).get("byServer") or []
    if not servers:
        return empty_figure("traffic-latency-percentiles.png", "Latency by server", "traffic", "No server latency data")
    names = [s["serverName"][:20] for s in servers[:12]]
    p50 = [s["latencyP50Ms"] for s in servers[:12]]
    p95 = [s["latencyP95Ms"] for s in servers[:12]]
    x = np.arange(len(names))
    w = 0.35
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.bar(x - w / 2, p50, w, label="p50", color=INSTANT)
    ax.bar(x + w / 2, p95, w, label="p95", color=WARN)
    ax.set_xticks(x, names, rotation=25, ha="right", fontsize=9)
    style_axes(ax, "Agent latency percentiles by server", ylabel="ms")
    ax.legend()
    return save(fig, "traffic-latency-percentiles.png", "Latency by server", "traffic", "history.db")


def traffic_cost_by_server(vd: dict) -> Path:
    servers = [s for s in (vd.get("traffic", {}).get("byServer") or []) if s.get("costUsd", 0) > 0]
    if not servers:
        return empty_figure("traffic-cost-by-server.png", "Cost by server", "traffic", "No priced calls in window")
    names = [s["serverName"][:18] for s in servers[:10]]
    costs = [s["costUsd"] for s in servers[:10]]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.barh(np.arange(len(names)), costs, color=INSTANT)
    ax.set_yticks(np.arange(len(names)), labels=names)
    style_axes(ax, "Estimated MCP cost by server (USD)", xlabel="USD")
    ax.invert_yaxis()
    return save(fig, "traffic-cost-by-server.png", "Cost by server", "traffic", "history.db")


def traffic_top_tools(vd: dict) -> Path:
    tools = vd.get("traffic", {}).get("topTools") or []
    if not tools:
        return empty_figure("traffic-top-tools.png", "Top tools", "traffic", "No tool calls recorded")
    names = [t["tool"][:24] for t in tools[:10]]
    counts = [t["count"] for t in tools[:10]]
    fig, ax = plt.subplots(figsize=(10, 5))
    y = np.arange(len(names))
    ax.barh(y, counts, color=INSTANT)
    ax.set_yticks(y, labels=names, fontsize=9)
    style_axes(ax, "Top MCP tools by call volume", xlabel="Calls")
    ax.invert_yaxis()
    return save(fig, "traffic-top-tools.png", "Top tools", "traffic", "history.db")


def traffic_block_rules(vd: dict) -> Path:
    rules = vd.get("traffic", {}).get("topBlockRules") or []
    if not rules:
        return empty_figure("traffic-block-rules.png", "Block rules", "traffic", "No blocks in window")
    names = [r.get("plainEnglish", r["rule"])[:28] for r in rules[:8]]
    counts = [r["count"] for r in rules[:8]]
    fig, ax = plt.subplots(figsize=(10, 5))
    y = np.arange(len(names))
    ax.barh(y, counts, color=FAIL)
    ax.set_yticks(y, labels=names, fontsize=9)
    style_axes(ax, "Policy blocks by rule", xlabel="Count")
    ax.invert_yaxis()
    return save(fig, "traffic-block-rules.png", "Block rules", "traffic", "history.db")


# ── AI learning (live state) ──────────────────────────────────────────────────

def learning_blocks_per_minute(vd: dict) -> Path:
    il = vd.get("instantLearning", {})
    series = il.get("blocksPerMinute") or []
    source = il.get("source", "none")
    if not series:
        msg = vd.get("meta", {}).get("emptyReasons", {}).get("instantLearning", "No learning events")
        return empty_figure("learning-blocks-per-minute.png", "Learning blocks per minute", "learning", msg)
    ts = [p["t"] / 60_000 for p in series]
    vals = [p["value"] for p in series]
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(ts, vals, color=INSTANT, marker="o", linewidth=2)
    style_axes(ax, f"Instant learning — blocks per minute ({source})", xlabel="Minutes from window start", ylabel="Blocks")
    return save(fig, "learning-blocks-per-minute.png", "Blocks per minute", "learning", f"attack-learning-state ({source})")


def learning_rule_tool_pairs(vd: dict) -> Path:
    pairs = vd.get("instantLearning", {}).get("ruleToolPairs") or []
    if not pairs:
        return empty_figure("learning-rule-tool-heatmap.png", "Rule:tool pairs", "learning", "No rule:tool stats")
    labels = [f"{p['rule'][:12]}:{p['tool'][:14]}" for p in pairs[:12]]
    counts = [p["count"] for p in pairs[:12]]
    fig, ax = plt.subplots(figsize=(10, 5))
    y = np.arange(len(labels))
    ax.barh(y, counts, color=INSTANT)
    ax.set_yticks(y, labels=labels, fontsize=8)
    style_axes(ax, "Top rule:tool block clusters (instant learning)", xlabel="Block count")
    ax.invert_yaxis()
    return save(fig, "learning-rule-tool-heatmap.png", "Rule:tool clusters", "learning", "attack-learning-state.json")


def learning_suggestion_rate(vd: dict) -> Path:
    il = vd.get("instantLearning", {})
    total = il.get("totalEvents", 0)
    queued = il.get("queuedSuggestions", 0)
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.bar(["Total block events", "Queued suggestions"], [total, queued], color=[MUTED, INSTANT], width=0.5)
    style_axes(ax, "Instant learning suggestion queue", ylabel="Count")
    src = il.get("source", "none")
    ax.text(0.5, -0.12, f"data source: {src}", transform=ax.transAxes, ha="center", fontsize=8, color=MUTED)
    return save(fig, "learning-suggestion-rate.png", "Suggestion queue", "learning", "attack-learning-state.json")


def learning_class_confidence(vd: dict) -> Path:
    classes = vd.get("instantLearning", {}).get("classConfidence") or []
    if not classes:
        return empty_figure("learning-class-confidence.png", "Attack class confidence", "learning", "No class confidence map")
    names = [c["class"] for c in classes]
    vals = [c["confidence"] * 100 for c in classes]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(names, vals, color=INSTANT, width=0.55)
    ax.set_ylim(0, 105)
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=25, ha="right")
    style_axes(ax, "Known attack class confidence", ylabel="Confidence (%)")
    return save(fig, "learning-class-confidence.png", "Class confidence", "learning", "attack-learning-state.json")


def fig5_learning_live(vd: dict) -> Path | None:
    """Legacy comparison only when live empty and eval exists."""
    il = vd.get("instantLearning", {})
    if il.get("source") == "live" and il.get("blocksPerMinute"):
        return None
    eval_path = ROOT / "reports" / "attack-learning-eval" / "metrics.json"
    metrics = load_json(eval_path)
    if not metrics or not isinstance(metrics, dict):
        return None
    inst = metrics.get("instant", {})
    batch = metrics.get("batchOnly", {})
    if not inst or not batch:
        return None
    names = ["Median time to\nsuggestion (min)", "Avg blocks to\nsuggestion"]
    inst_vals = [inst.get("medianTimeToSuggestionMs", 0) / 60_000, inst.get("avgBlocksToSuggestion", 0)]
    batch_vals = [batch.get("medianTimeToSuggestionMs", 0) / 60_000, batch.get("avgBlocksToSuggestion", 0)]
    x = np.arange(len(names))
    w = 0.35
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(x - w / 2, inst_vals, w, label="Instant", color=INSTANT)
    ax.bar(x + w / 2, batch_vals, w, label="Batch-only", color=BATCH)
    ax.set_xticks(x, names, fontsize=10)
    ax.legend()
    style_axes(ax, "Instant vs batch learning (simulated eval)", ylabel="Value")
    return save(fig, "fig5-learning-comparison.png", "Learning eval comparison", "learning", "attack-learning-eval/metrics.json")


# ── Semantic ──────────────────────────────────────────────────────────────────

def semantic_confidence_hist(vd: dict) -> Path:
    buckets = vd.get("semantic", {}).get("confidenceBuckets") or []
    if not buckets:
        cal = load_json(CALIBRATION_PATH)
        if cal and isinstance(cal, dict):
            buckets = []
            for s in cal.get("sampleFlagged", [])[:50]:
                c = s.get("confidence", 0)
                b = "0.85-1.0" if c >= 0.85 else "0.7-0.85" if c >= 0.7 else "0.5-0.7" if c >= 0.5 else "0.0-0.5"
                found = next((x for x in buckets if x["bucket"] == b), None)
                if found:
                    found["count"] += 1
                else:
                    buckets.append({"bucket": b, "count": 1})
    if not buckets:
        return empty_figure("semantic-confidence-hist.png", "Semantic confidence", "semantic", "No flagged semantic audits")
    labels = [b["bucket"] for b in buckets]
    counts = [b["count"] for b in buckets]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(labels, counts, color=INSTANT, width=0.6)
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=20, ha="right")
    style_axes(ax, "Semantic flag confidence distribution", ylabel="Count")
    return save(fig, "semantic-confidence-hist.png", "Confidence distribution", "semantic", "calibration.json")


def semantic_labels_pie(vd: dict) -> Path:
    labels = vd.get("semantic", {}).get("labelMix") or []
    if not labels:
        return empty_figure("semantic-labels-pie.png", "Semantic labels", "semantic", "No labeled outcomes")
    names = [l["label"] for l in labels]
    sizes = [l["count"] for l in labels]
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.pie(sizes, labels=names, autopct="%1.0f%%", startangle=90, colors=[PASS, FAIL, MUTED, WARN][: len(names)])
    ax.set_title("Semantic audit label mix", fontsize=13, fontweight="bold")
    return save(fig, "semantic-labels-pie.png", "Label mix", "semantic", "calibration.json")


def fig6_semantic_totals(vd: dict) -> Path | None:
    totals = vd.get("semantic", {}).get("totals") or {}
    if not totals.get("records"):
        cal = load_json(CALIBRATION_PATH)
        if cal and isinstance(cal, dict):
            totals = cal.get("totals", {})
    labels = ["Records", "Flagged", "Labeled", "TP", "FP"]
    keys = ["records", "flagged", "labeled", "truePositive", "falsePositive"]
    values = [totals.get(k, 0) for k in keys]
    fig, ax = plt.subplots(figsize=(9, 5))
    x = np.arange(len(labels))
    ax.bar(x, values, color=[MUTED if v == 0 else INSTANT for v in values], width=0.6)
    ax.set_xticks(x, labels, fontsize=9)
    style_axes(ax, "Semantic audit outcome totals", ylabel="Count")
    if sum(values) == 0:
        return empty_figure("fig6-semantic-calibration.png", "Semantic totals", "semantic", "No semantic records")
    return save(fig, "fig6-semantic-calibration.png", "Semantic totals", "semantic", "calibration.json")


# ── Infrastructure ────────────────────────────────────────────────────────────

def user_servers_probe(vd: dict) -> Path:
    servers = vd.get("regression", {}).get("userServers") or []
    if not servers:
        return empty_figure("user-servers-probe-status.png", "Your MCP servers", "infrastructure", "No user-servers-session.json")
    names = [s["serverName"][:16] for s in servers]
    status = [s["status"] for s in servers]
    colors = [PASS if st == "ok" else WARN if st == "skipped" else FAIL for st in status]
    fig, ax = plt.subplots(figsize=(10, max(4, len(names) * 0.5)))
    y = np.arange(len(names))
    ax.barh(y, [1] * len(names), color=colors, height=0.65)
    ax.set_yticks(y, labels=names, fontsize=9)
    ax.set_xlim(0, 1.2)
    ax.set_xticks([])
    for i, st in enumerate(status):
        ax.text(0.5, i, st, ha="center", va="center", color="white", fontweight="bold", fontsize=9)
    style_axes(ax, "Your MCP server probe status", ylabel="Server")
    ax.invert_yaxis()
    return save(fig, "user-servers-probe-status.png", "Server probes", "infrastructure", "user-servers-session.json")


def pipeline_waterfall(vd: dict, latest: dict) -> Path:
    steps = vd.get("pipeline", {}).get("stepTimings") or latest.get("timings", {}).get("steps") or []
    if not steps:
        return empty_figure("pipeline-phase-waterfall.png", "Analysis pipeline", "infrastructure", "No step timings")
    labels = [s["label"][:22] for s in steps]
    secs = [float(s["elapsedSec"]) for s in steps]
    fig, ax = plt.subplots(figsize=(11, 5))
    cum = 0
    for i, (lab, sec) in enumerate(zip(labels, secs)):
        ax.barh(i, sec, left=cum, color=INSTANT, height=0.7)
        ax.text(cum + sec / 2, i, f"{sec:.1f}s", ha="center", va="center", fontsize=8, color="white")
        cum += sec
    ax.set_yticks(np.arange(len(labels)), labels=labels, fontsize=9)
    style_axes(ax, "Security analysis pipeline duration", xlabel="Cumulative seconds")
    ax.invert_yaxis()
    return save(fig, "pipeline-phase-waterfall.png", "Pipeline waterfall", "infrastructure", "latest.json")


def write_manifest() -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w") as f:
        json.dump({"generatedAt": datetime.utcnow().isoformat() + "Z", "figures": manifest}, f, indent=2)


def main() -> int:
    global manifest
    manifest = []

    vd = load_json(VISUALS_DATA_PATH)
    if not vd or not isinstance(vd, dict):
        print("[swarm-visuals] visuals-data.json missing — run visuals-data export first", file=sys.stderr)
        vd = {
            "traffic": {"hourly": [], "byServer": [], "topTools": [], "topBlockRules": []},
            "instantLearning": {"source": "none", "blocksPerMinute": [], "ruleToolPairs": []},
            "semantic": {"confidenceBuckets": [], "labelMix": [], "totals": {}},
            "regression": {"userServers": []},
            "pipeline": {"stepTimings": []},
            "meta": {"emptyReasons": {"traffic": "visuals-data.json not generated"}},
        }

    latest = load_json(LATEST_PATH)
    if not latest or not isinstance(latest, dict):
        print("[swarm-visuals] latest.json required", file=sys.stderr)
        return 1

    corpus = load_json(CORPUS_PATH)
    live = load_json(LIVE_FS_PATH)
    cal = load_json(CALIBRATION_PATH)

    paths: list[Path] = []

    paths.append(fig1_gates(latest))
    paths.append(fig2_corpus_rates(latest, corpus if isinstance(corpus, dict) else None))
    if isinstance(corpus, dict):
        p3 = fig3_category_recall(corpus)
        if p3:
            paths.append(p3)
    paths.append(fig4_step_timings(latest))

    paths.append(traffic_calls_over_time(vd))
    paths.append(traffic_latency_by_server(vd))
    paths.append(traffic_cost_by_server(vd))
    paths.append(traffic_top_tools(vd))
    paths.append(traffic_block_rules(vd))

    paths.append(learning_blocks_per_minute(vd))
    paths.append(learning_rule_tool_pairs(vd))
    paths.append(learning_suggestion_rate(vd))
    paths.append(learning_class_confidence(vd))
    p5 = fig5_learning_live(vd)
    if p5:
        paths.append(p5)

    p6 = fig6_semantic_totals(vd)
    if p6:
        paths.append(p6)
    paths.append(semantic_confidence_hist(vd))
    paths.append(semantic_labels_pie(vd))

    if isinstance(live, dict):
        p7 = fig7_live_filesystem(live)
        if p7:
            paths.append(p7)

    paths.append(user_servers_probe(vd))
    paths.append(pipeline_waterfall(vd, latest))

    write_manifest()

    print("[swarm-visuals] wrote:")
    for p in paths:
        print(f"  {p.relative_to(ROOT)}")
    print(f"  {MANIFEST_PATH.relative_to(ROOT)} ({len(manifest)} figures)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
