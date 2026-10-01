"""Pipeline completo: scrapea todas las fuentes -> clasifica -> deduplica -> Supabase.

Uso:
    uv run python -m eventos_tech_madrid.pipeline.run                 # todas las fuentes
    uv run python -m eventos_tech_madrid.pipeline.run --only eventbrite
    uv run python -m eventos_tech_madrid.pipeline.run --dry-run       # no escribe en Supabase

Variables de entorno: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (secretos de GitHub).
Sale con código 1 si alguna fuente falla del todo, para que GitHub avise (antes los
fallos quedaban escondidos detrás de continue-on-error).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher

import httpx

from eventos_tech_madrid.common import client
from eventos_tech_madrid.pipeline.classify import classify
from eventos_tech_madrid.scrapers import eventbrite, luma, meetup
from eventos_tech_madrid.sources import CITY

SCRAPERS = {"luma": luma.scrape, "meetup": meetup.scrape, "eventbrite": eventbrite.scrape}
PRIORITY = {"luma": 0, "meetup": 1, "eventbrite": 2}  # cuál manda si hay duplicados

COLUMNS = {
    "id", "city", "source", "source_id", "url", "also_on", "title", "description", "image_url",
    "organizer", "organizer_url", "kind", "topics", "start_at", "end_at", "is_online",
    "venue_name", "address", "lat", "lng", "is_free", "price_min", "currency", "status",
    "capacity", "going_count", "waitlist_count", "language", "tech_score", "last_seen_at",
    "updated_at",
}


def _norm(title: str) -> str:
    t = unicodedata.normalize("NFKD", title.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"madrid|\||-|–|—|:|edici[oó]n|#\d+|\d{4}", " ", t)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", t)).strip()


def dedupe(events: list[dict]) -> list[dict]:
    """Mismo día + título muy parecido = mismo evento publicado en varias plataformas."""
    events = sorted(events, key=lambda e: PRIORITY.get(e["source"], 9))
    kept: list[dict] = []
    for ev in events:
        day, nt = ev["start_at"][:10], _norm(ev["title"])
        dup = next(
            (k for k in kept
             if k["start_at"][:10] == day
             and (SequenceMatcher(None, _norm(k["title"]), nt).ratio() >= 0.82
                  or (len(nt) > 12 and (nt in _norm(k["title"]) or _norm(k["title"]) in nt)))),
            None,
        )
        if dup is None:
            ev["also_on"] = []
            kept.append(ev)
        else:
            dup["also_on"].append({"source": ev["source"], "url": ev["url"]})
            for f in ("description", "image_url", "lat", "lng", "address", "capacity", "price_min"):
                if not dup.get(f) and ev.get(f):
                    dup[f] = ev[f]
    return kept


MAX_PER_SERIES = 3


def collapse_series(events: list[dict]) -> list[dict]:
    """Los eventos recurrentes (p. ej. un afterwork semanal) solo se muestran las próximas
    MAX_PER_SERIES veces; si no, una sola serie llena la lista entera."""
    seen: dict[tuple, int] = {}
    out = []
    for ev in sorted(events, key=lambda e: e["start_at"]):
        key = (ev.get("organizer") or "", _norm(ev["title"]))
        seen[key] = seen.get(key, 0) + 1
        if seen[key] <= MAX_PER_SERIES:
            out.append(ev)
    return out


def upsert(rows: list[dict]) -> None:
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    with httpx.Client(timeout=60) as c:
        for i in range(0, len(rows), 200):
            r = c.post(f"{url}/rest/v1/events?on_conflict=id", headers=headers, json=rows[i : i + 200])
            if r.status_code >= 300:
                raise RuntimeError(f"Supabase {r.status_code}: {r.text[:500]}")


def log_run(stats: dict, ok: bool, started: str) -> None:
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    httpx.post(
        f"{url}/rest/v1/scrape_runs",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"started_at": started, "finished_at": _now(), "stats": stats, "ok": ok},
        timeout=30,
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(SCRAPERS), action="append")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default="data/latest.json", help="copia local para depurar")
    args = ap.parse_args()

    started, now = _now(), datetime.now(timezone.utc)
    stats: dict[str, dict] = {}
    collected: list[dict] = []

    with client() as c:
        for name in args.only or SCRAPERS:
            print(f"\n== {name} ==")
            try:
                raw = SCRAPERS[name](c)
                kept = [e for e in (classify(ev) for ev in raw) if e]
                rejected = [ev["title"] for ev in raw if not ev.get("kind")]
                stats[name] = {"found": len(raw), "kept": len(kept), "error": None}
                print(f"  {name}: {len(raw)} encontrados, {len(kept)} tech")
                if rejected:
                    print("  descartados (no tech):", "; ".join(t[:40] for t in rejected[:25]))
                collected += kept
            except Exception as e:  # noqa: BLE001
                stats[name] = {"found": 0, "kept": 0, "error": str(e)[:300]}
                print(f"  {name}: ERROR {e}")

    upcoming = [e for e in collected if datetime.fromisoformat(e["start_at"].replace("Z", "+00:00")) > now]
    events = collapse_series(dedupe(upcoming))
    print(f"\nTotal: {len(collected)} -> {len(upcoming)} futuros -> {len(events)} tras deduplicar")

    rows = []
    for ev in events:
        ev["city"] = CITY["slug"]
        ev["last_seen_at"] = ev["updated_at"] = started
        rows.append({k: v for k, v in ev.items() if k in COLUMNS})

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print(f"Copia local en {args.out}")

    failed = [n for n, s in stats.items() if s["error"]]
    if not args.dry_run:
        if rows:
            upsert(rows)
            print(f"Guardados {len(rows)} eventos en Supabase")
        log_run(stats, ok=not failed, started=started)

    if failed:
        print(f"\nFUENTES CON ERROR: {', '.join(failed)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
