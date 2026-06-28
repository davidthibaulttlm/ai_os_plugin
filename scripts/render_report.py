#!/usr/bin/env python3
"""render_report.py — Deterministic Markdown renderer for code-review-report.json

Usage:
  python3 scripts/render_report.py report.json -o code-review.md
  python3 scripts/render_report.py --validate report.json
"""

import argparse
import json
import sys
from datetime import datetime

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
DIMENSION_ORDER = ["correctness", "architecture", "performance", "security", "dependency-cve"]
DIMENSION_TITLES = {
    "correctness": "Correctness",
    "architecture": "Architecture / Design",
    "performance": "Performance",
    "security": "Security (OWASP Top 10:2025)",
    "dependency-cve": "Dependency CVEs",
}
DISPOSITION_ICONS = {
    "blocker": "🚫",
    "should-fix": "⚠️",
    "consider": "💡",
    "nit": "📝",
    "praise": "👍",
}
SEVERITY_ICONS = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🟢",
    "info": "⚪",
}


def sort_findings(findings):
    return sorted(findings, key=lambda f: (SEVERITY_ORDER.get(f.get("severity", "info"), 4), f.get("id", "")))


def render_snippet(snippet):
    if not snippet:
        return ""
    return f"\n```\n{snippet}\n```\n"


def render_finding(f):
    lines = []
    sev_icon = SEVERITY_ICONS.get(f.get("severity", "info"), "⚪")
    disp_icon = DISPOSITION_ICONS.get(f.get("disposition", "consider"), "")
    loc = f.get("location", {})
    file_path = loc.get("file", "unknown")
    line_num = loc.get("line")

    lines.append(f"### {sev_icon} {disp_icon} `{f['id']}` — {f['title']}")
    lines.append("")
    lines.append(f"| Field | Value |")
    lines.append(f"|-------|-------|")
    lines.append(f"| **Severity** | {f.get('severity', 'info')} |")
    lines.append(f"| **Confidence** | {f.get('confidence', 'medium')} |")
    lines.append(f"| **Disposition** | {f.get('disposition', 'consider')} |")
    lines.append(f"| **Category** | {f.get('category', 'unknown')} |")
    if line_num:
        lines.append(f"| **Location** | [{file_path}#{line_num}](#{file_path}#{line_num}) |")
    else:
        lines.append(f"| **Location** | [{file_path}]({file_path}) |")
    lines.append("")
    lines.append(f"**Detail:** {f.get('detail', '')}")
    lines.append("")
    lines.append(f"**Recommendation:** {f.get('recommendation', '')}")
    lines.append("")

    refs = f.get("references", [])
    if refs:
        lines.append("**References:**")
        for ref in refs:
            lines.append(f"- {ref}")
        lines.append("")

    lines.append(render_snippet(f.get("snippet", "")))
    return "\n".join(lines)


def render_report(data):
    lines = []
    summary = data.get("summary", {})
    findings = sort_findings(data.get("findings", []))
    dimensions = data.get("dimensions", [])
    counts = summary.get("counts", {})
    verdict = summary.get("verdict", "unknown")

    # Verdict badge
    verdict_badges = {
        "approve": "✅ APPROVE",
        "approve-with-nits": "🟡 APPROVE WITH NITS",
        "request-changes": "🟠 REQUEST CHANGES",
        "block": "🔴 BLOCK",
    }
    lines.append(f"# Code Review Report")
    lines.append("")
    lines.append(f"**Verdict:** {verdict_badges.get(verdict, verdict.upper())}")
    lines.append("")
    lines.append(f"**Date:** {data.get('date', 'Unknown')}")
    lines.append(f"**Scope:** {data.get('scope', 'Full codebase')}")
    lines.append(f"**Version:** {data.get('version', '1.0.0')}")
    lines.append("")

    # Summary narrative
    narrative = summary.get("narrative", "")
    if narrative:
        lines.append("## Summary")
        lines.append("")
        lines.append(narrative)
        lines.append("")

    # Counts
    lines.append("## Findings Summary")
    lines.append("")
    lines.append(f"| Severity | Count |")
    lines.append(f"|----------|-------|")
    for sev in ["critical", "high", "medium", "low", "info"]:
        count = counts.get(sev, 0)
        icon = SEVERITY_ICONS.get(sev, "")
        lines.append(f"| {icon} {sev.capitalize()} | {count} |")
    lines.append(f"| **Total** | **{counts.get('total', len(findings))}** |")
    lines.append("")

    # CVE scan info
    cve_scan = data.get("cve_scan", {})
    if cve_scan:
        lines.append("## CVE Scan")
        lines.append("")
        lines.append(f"- **Method:** {cve_scan.get('method', 'Unknown')}")
        lines.append(f"- **Complete:** {'Yes' if cve_scan.get('complete') else 'No (partial/best-effort)'}")
        if cve_scan.get("scope"):
            lines.append(f"- **Scope:** {cve_scan['scope']}")
        lines.append("")

    # Dimensions status
    lines.append("## Dimension Status")
    lines.append("")
    lines.append("| Dimension | Status |")
    lines.append("|-----------|--------|")
    for dim in DIMENSION_ORDER:
        dim_info = next((d for d in dimensions if d.get("name") == dim), None)
        status = dim_info.get("status", "not-reviewed") if dim_info else "not-reviewed"
        status_icons = {"reviewed": "✅", "not-applicable": "➖", "not-reviewed": "❓"}
        lines.append(f"| {DIMENSION_TITLES.get(dim, dim)} | {status_icons.get(status, status)} {status} |")
    lines.append("")

    # Findings by dimension
    for dim in DIMENSION_ORDER:
        dim_findings = [f for f in findings if f.get("category") == dim]
        if not dim_findings:
            continue

        lines.append(f"## {DIMENSION_TITLES.get(dim, dim)}")
        lines.append("")

        if not dim_findings:
            lines.append("No findings.")
            lines.append("")
            continue

        for f in dim_findings:
            lines.append(render_finding(f))
            lines.append("---")
            lines.append("")

    # Footer
    lines.append("---")
    lines.append("")
    lines.append(f"*Report generated deterministically from `report.json` via `scripts/render_report.py`*")
    lines.append("")

    return "\n".join(lines)


def validate_report(data):
    errors = []

    if "summary" not in data:
        errors.append("Missing 'summary'")
    else:
        s = data["summary"]
        if "verdict" not in s:
            errors.append("Missing 'summary.verdict'")
        elif s["verdict"] not in ("approve", "approve-with-nits", "request-changes", "block"):
            errors.append(f"Invalid verdict: {s['verdict']}")
        if "counts" not in s:
            errors.append("Missing 'summary.counts'")
        if "narrative" not in s:
            errors.append("Missing 'summary.narrative'")

    if "findings" not in data:
        errors.append("Missing 'findings'")
    else:
        for i, f in enumerate(data["findings"]):
            if "id" not in f:
                errors.append(f"Finding {i}: missing 'id'")
            if "category" not in f:
                errors.append(f"Finding {i} ({f.get('id', '?')}): missing 'category'")
            elif f["category"] not in DIMENSION_ORDER:
                errors.append(f"Finding {f['id']}: invalid category '{f['category']}'")
            if "severity" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'severity'")
            elif f["severity"] not in SEVERITY_ORDER:
                errors.append(f"Finding {f['id']}: invalid severity '{f['severity']}'")
            if "confidence" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'confidence'")
            if "disposition" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'disposition'")
            if "title" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'title'")
            if "detail" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'detail'")
            if "recommendation" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'recommendation'")
            if "location" not in f:
                errors.append(f"Finding {f.get('id', i)}: missing 'location'")

    if "dimensions" not in data:
        errors.append("Missing 'dimensions'")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Render code review report from JSON to Markdown")
    parser.add_argument("report", help="Path to report.json")
    parser.add_argument("-o", "--output", help="Output Markdown file path")
    parser.add_argument("--validate", action="store_true", help="Validate report.json and exit")
    args = parser.parse_args()

    with open(args.report, "r", encoding="utf-8") as f:
        data = json.load(f)

    if args.validate:
        errors = validate_report(data)
        if errors:
            print("Validation FAILED:")
            for e in errors:
                print(f"  ❌ {e}")
            sys.exit(1)
        else:
            print("Validation PASSED — report.json is valid.")
            sys.exit(0)

    md = render_report(data)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"Report rendered to {args.output}")
    else:
        print(md)


if __name__ == "__main__":
    main()
