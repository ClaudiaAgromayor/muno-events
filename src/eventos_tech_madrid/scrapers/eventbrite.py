import httpx
import json
import re
from bs4 import BeautifulSoup


def _parse_ld_json_events(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(data, dict) and data.get("@type") == "ItemList":
            return data.get("itemListElement", [])
    return []


def _extract_event_id(url: str) -> str:
    match = re.search(r"-(\d+)$", url or "")
    return match.group(1) if match else url


def fetch_eventbrite_category(path: str) -> list[dict]:
    url = f"https://www.eventbrite.com/d/{path}/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    items = _parse_ld_json_events(resp.text)

    events = []
    for entry in items:
        ev = entry.get("item", {})
        if ev.get("@type") != "Event":
            continue
        location = ev.get("location", {})
        address = location.get("address", {})
        events.append({
            "source": "eventbrite",
            "source_slug": path,
            "source_id": _extract_event_id(ev.get("url")),
            "name": ev.get("name"),
            "description": ev.get("description"),
            "start_at": ev.get("startDate"),
            "end_at": ev.get("endDate"),
            "url": ev.get("url"),
            "city": address.get("addressLocality"),
            "address": address.get("streetAddress"),
            "venue": location.get("name"),
            "attendance_mode": ev.get("eventAttendanceMode"),
        })
    return events
    

def dedupe_events(events: list[dict]) -> list[dict]:
    deduped = {}
    for ev in events:
        key = ev["source_id"]
        if key not in deduped:
            deduped[key] = ev.copy()
            deduped[key]["found_in"] = [ev["source_slug"]]
        else:
            deduped[key]["found_in"].append(ev["source_slug"])
    return list(deduped.values())


if __name__ == "__main__":
    import os

    categories = [
        "spain--madrid/tech",
        "spain--madrid/science-and-tech--events",
        "spain--madrid/startup",
    ]

    all_events = []
    for path in categories:
        try:
            events = fetch_eventbrite_category(path)
            print(f"{path}: {len(events)} eventos")
            all_events.extend(events)
        except Exception as e:
            print(f"{path}: ERROR ({e})")

    print(f"\nTotal antes de deduplicar: {len(all_events)}")
    unique_events = dedupe_events(all_events)
    print(f"Total después de deduplicar: {len(unique_events)}")

    os.makedirs("data/raw", exist_ok=True)
    output_path = "data/raw/eventbrite_events.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(unique_events, f, ensure_ascii=False, indent=2)
    print(f"Guardado en {output_path}")