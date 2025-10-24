#!/usr/bin/env python3
"""
Generate third-party license reports for this repository.

Outputs:
- docs/THIRD_PARTY_LICENSES.md (summary in Markdown)
- docs/licenses-python.csv (all installed Python packages from active interpreter)
- docs/licenses-node.csv (all packages from apps/frontend/package-lock.json)

Usage examples:
  .venv/bin/python scripts/generate_licenses.py
  python3 scripts/generate_licenses.py --python-exec .venv/bin/python

Notes:
- Python transitive dependencies are discovered from the interpreter executing
  this script (via importlib.metadata). Prefer running with the project's venv.
- Node transitive dependencies are derived from apps/frontend/package-lock.json.
  If some entries lack a license field, the script fetches license metadata from npm.
"""
from __future__ import annotations

import argparse
import csv
import dataclasses
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = REPO_ROOT / "docs"
FRONTEND_DIR = REPO_ROOT / "apps" / "frontend"
PACKAGE_LOCK = FRONTEND_DIR / "package-lock.json"


def normalize_license(name: Optional[str]) -> str:
    if not name:
        return "Unknown"
    s = name.strip()
    # Common replacements for exact phrases
    replacements = {
        "Apache Software License": "Apache-2.0",
        "Apache License 2.0": "Apache-2.0",
        "Apache License, Version 2.0": "Apache-2.0",
        "BSD License": "BSD",
        "BSD-3": "BSD-3-Clause",
        'BSD 3-Clause "New" or "Revised" License': "BSD-3-Clause",
        "BSD-3-Clause License": "BSD-3-Clause",
        "GNU Library or Lesser General Public License (LGPL)": "LGPL",
        "MIT License": "MIT",
        "ISC License": "ISC",
        "Apache 2.0": "Apache-2.0",
    }
    if s in replacements:
        return replacements[s]
    # collapse extremely long numpy license text to SPDX
    if s.startswith("Copyright (c) 2005-") and "NumPy" in s:
        return "BSD-3-Clause"
    # Prefer SPDX-like tokens when present (works for long license bodies)
    spdx_tokens = (
        "MIT",
        "Apache-2.0",
        "BSD-3-Clause",
        "BSD-2-Clause",
        "BSD",
        "LGPL-3.0",
        "LGPL",
        "AGPL-3.0",
        "MPL-2.0",
        "ISC",
        "HPND",
        "SIL OPEN FONT LICENSE",
    )
    for token in spdx_tokens:
        if token in s:
            return token
    # Handle concise combined expressions like "Apache-2.0 AND MIT" without
    # accidentally rewriting full license texts that contain the word 'AND'.
    if (" AND " in s or " OR " in s) and ("\n" not in s) and (len(s) <= 100):
        s = (
            s.replace("License, Version ", "-")
            .replace("License ", "")
            .replace("Apache Software", "Apache")
            .replace("BSD License", "BSD")
        )
        return s
    return s


# ------------------------ Python (transitive) ------------------------


@dataclasses.dataclass
class PyDist:
    name: str
    version: str
    license: str
    summary: str = ""
    homepage: str = ""


def gather_python_packages(py_exec: str) -> List[PyDist]:
    """Enumerate installed distributions using the provided Python interpreter."""
    code = r"""
import json
import sys
try:
    from importlib.metadata import distributions, metadata
except Exception:
    from importlib_metadata import distributions, metadata

rows=[]
for d in distributions():
    name=getattr(d, 'metadata', None).get('Name') if hasattr(d, 'metadata') else None
    try:
        md = metadata(d.metadata['Name']) if name else d.metadata
    except Exception:
        md = d.metadata
    lic = md.get('License')
    if not lic:
        # try classifier fallback
        cls=[c for c in md.get_all('Classifier') or [] if c.startswith('License ::')]
        if cls:
            lic = cls[-1].split('::')[-1].strip()
    rows.append({
        'name': md.get('Name') or (name or ''),
        'version': md.get('Version') or '',
        'license': lic or 'Unknown',
        'summary': md.get('Summary') or '',
        'home_page': md.get('Home-page') or '',
    })
print(json.dumps(rows))
"""
    try:
        out = subprocess.check_output([py_exec, "-c", code], text=True)
    except subprocess.CalledProcessError as e:
        print("[ERROR] Failed to enumerate Python packages:", e, file=sys.stderr)
        return []
    res = json.loads(out)
    rows: List[PyDist] = []
    for r in res:
        rows.append(
            PyDist(
                name=r.get("name") or "",
                version=r.get("version") or "",
                license=normalize_license(r.get("license")),
                summary=r.get("summary") or "",
                homepage=r.get("home_page") or "",
            )
        )
    # Filter out empty names or obvious artifacts
    rows = [r for r in rows if r.name]
    # Sort
    rows.sort(key=lambda x: x.name.lower())
    return rows


# ------------------------ Node (transitive) ------------------------


@dataclasses.dataclass
class NodePkg:
    name: str
    version: str
    license: str


def npm_registry_license(name: str, version: Optional[str]) -> Optional[str]:
    """Fetch license from npm registry for a package (optionally specific version)."""
    try:
        import urllib.request

        url_name = name.replace("/", "%2f")
        url = f"https://registry.npmjs.org/{url_name}"
        with urllib.request.urlopen(url, timeout=20) as r:
            reg = json.loads(r.read().decode("utf-8"))
        if version and "versions" in reg and version in reg["versions"]:
            meta = reg["versions"][version]
        else:
            latest = (reg.get("dist-tags") or {}).get("latest")
            meta = (reg.get("versions") or {}).get(latest, {}) if latest else reg
        lic = meta.get("license") or reg.get("license")
        if isinstance(lic, dict):
            lic = lic.get("type") or lic.get("name")
        return normalize_license(lic) if lic else None
    except Exception:
        return None


def gather_node_packages(package_lock: Path) -> List[NodePkg]:
    if not package_lock.exists():
        return []
    data = json.loads(package_lock.read_text())
    pkgs: List[NodePkg] = []
    packages = data.get("packages") or {}
    for path, meta in packages.items():
        if path == "":
            continue  # skip root project
        # derive name from path when missing
        name = meta.get("name")
        if not name:
            # e.g. node_modules/@scope/name or nested paths
            parts = Path(path).parts
            try:
                idx = parts.index("node_modules")
                pkg_parts = [parts[idx + 1]]
                # handle scoped packages
                if idx + 2 < len(parts) and parts[idx + 1].startswith("@"):
                    pkg_parts.append(parts[idx + 2])
                name = "/".join(pkg_parts)
            except Exception:
                name = path
        version = str(meta.get("version") or "")
        lic = meta.get("license")
        if not lic:
            lic = npm_registry_license(name, version)
        pkgs.append(NodePkg(name=name, version=version, license=normalize_license(lic)))
    # Dedupe best-effort on name@version
    seen = set()
    unique: List[NodePkg] = []
    for p in pkgs:
        key = (p.name, p.version)
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    unique.sort(key=lambda p: (p.name.lower(), p.version))
    return unique


# ------------------------ Output helpers ------------------------


def write_csv_python(dists: List[PyDist], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Name", "Version", "License", "Summary", "Home-Page"])
        for d in dists:
            w.writerow([d.name, d.version, d.license, d.summary, d.homepage])


def write_csv_node(pkgs: List[NodePkg], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Name", "Version", "License"])
        for p in pkgs:
            w.writerow([p.name, p.version, p.license])


def write_markdown_summary(
    py_dists: List[PyDist], node_pkgs: List[NodePkg], images: List[Tuple[str, str]], path: Path
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: List[str] = []
    lines.append("# Third-Party Licenses\n")
    lines.append(
        "This document lists direct and transitive third-party components used by this repository,\n"
    )
    lines.append(
        "grouped by ecosystem. For Python, the list is generated from the active interpreter.\n"
    )
    lines.append("\n")
    # Python summary
    lines.append("## Python (transitive)\n")
    lines.append("| Package | Version | License |\n")
    lines.append("| --- | --- | --- |\n")
    for d in py_dists:
        lines.append(f"| {d.name} | {d.version} | {d.license} |\n")
    lines.append("\n")
    # Node summary
    lines.append("## Frontend/Node (transitive)\n")
    lines.append("Derived from `apps/frontend/package-lock.json`.\n\n")
    lines.append("| Package | Version | License |\n")
    lines.append("| --- | --- | --- |\n")
    for p in node_pkgs:
        lines.append(f"| {p.name} | {p.version} | {p.license} |\n")
    lines.append("\n")
    # Images
    lines.append("## Infrastructure (Docker Images)\n")
    lines.append("| Image | License |\n")
    lines.append("| --- | --- |\n")
    for img, lic in images:
        lines.append(f"| {img} | {lic} |\n")
    lines.append("\n")
    path.write_text("".join(lines), encoding="utf-8")


def parse_docker_images() -> List[Tuple[str, str]]:
    compose = REPO_ROOT / "ops" / "compose" / "docker-compose.yml"
    images: List[str] = []
    if compose.exists():
        for line in compose.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s.startswith("image:"):
                images.append(s.split(":", 1)[1].strip())
    # Known license map (static)
    img_licenses = {
        "postgres:15": "PostgreSQL License",
        "qdrant/qdrant:latest": "Apache-2.0",
        "ollama/ollama:latest": "MIT",
        "grafana/grafana:latest": "AGPL-3.0",
        "prom/prometheus:latest": "Apache-2.0",
        "nginx:alpine": "BSD-2-Clause",
    }
    out: List[Tuple[str, str]] = []
    seen = set()
    for img in images:
        if img in seen:
            continue
        seen.add(img)
        out.append((img, img_licenses.get(img, "Unknown")))
    return out


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--python-exec",
        default=sys.executable,
        help="Python interpreter to use for enumerating installed packages.",
    )
    args = ap.parse_args(argv)

    # Python
    py_dists = gather_python_packages(args.python_exec)
    write_csv_python(py_dists, DOCS_DIR / "licenses-python.csv")

    # Node
    node_pkgs = gather_node_packages(PACKAGE_LOCK)
    write_csv_node(node_pkgs, DOCS_DIR / "licenses-node.csv")

    # Images
    images = parse_docker_images()

    # Markdown summary
    write_markdown_summary(py_dists, node_pkgs, images, DOCS_DIR / "THIRD_PARTY_LICENSES.md")

    print("Wrote:")
    print(" -", DOCS_DIR / "THIRD_PARTY_LICENSES.md")
    print(" -", DOCS_DIR / "licenses-python.csv")
    print(" -", DOCS_DIR / "licenses-node.csv")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
