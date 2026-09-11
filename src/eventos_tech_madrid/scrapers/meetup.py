import httpx
import json
from bs4 import BeautifulSoup
import urllib.parse


def _parse_next_data(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    return json.loads(script.string)


def _resolve(store: dict, ref):
    """Sigue una referencia {'__ref': 'Event:123'} hasta el objeto real."""
    if isinstance(ref, dict) and "__ref" in ref:
        return store[ref["__ref"]]
    return ref


def fetch_meetup_group(urlname: str) -> list[dict]:
    url = f"https://www.meetup.com/{urlname}/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    data = _parse_next_data(resp.text)
    store = data["props"]["pageProps"]["__APOLLO_STATE__"]

    root = store["ROOT_QUERY"]
    group_key = next(k for k in root if k.startswith("groupByUrlname"))
    group = _resolve(store, root[group_key])

    events_key = next(
        k for k in group if k.startswith("events(") and '"ACTIVE"' in k
    )
    connection = group[events_key]

    events = []
    for edge in connection.get("edges", []):
        ev = _resolve(store, edge["node"])
        venue = _resolve(store, ev["venue"]) if ev.get("venue") else None
        events.append({
            "source": "meetup",
            "source_slug": urlname,
            "source_id": ev["id"],
            "name": ev["title"],
            "start_at": ev.get("dateTime"),
            "end_at": ev.get("endTime"),
            "url": ev.get("eventUrl"),
            "city": venue.get("city") if venue else None,
            "address": venue.get("address") if venue else None,
            "organizer": group.get("name"),
            "attendees": ev.get("going", {}).get("totalCount"),
        })
    return events


def fetch_meetup_search(keyword: str, location: str = "es--madrid") -> list[dict]:
    encoded_kw = urllib.parse.quote(keyword)
    url = f"https://www.meetup.com/find/?keywords={encoded_kw}&source=EVENTS&location={location}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    data = _parse_next_data(resp.text)
    store = data["props"]["pageProps"]["__APOLLO_STATE__"]
    root = store["ROOT_QUERY"]

    search_key = next(k for k in root if k.startswith("eventSearch:"))
    connection = root[search_key]

    events = []
    for edge in connection.get("edges", []):
        ev = _resolve(store, edge["node"])
        if "title" not in ev:
            continue  # entradas de eventos recurrentes sin datos completos, se ignoran

        group = _resolve(store, ev["group"]) if ev.get("group") else {}
        venue = ev.get("venue") or {}
        events.append({
            "source": "meetup",
            "source_slug": keyword,
            "source_id": ev["id"],
            "name": ev.get("title"),
            "start_at": ev.get("dateTime"),
            "url": ev.get("eventUrl"),
            "event_type": ev.get("eventType"),
            "city": venue.get("city"),
            "address": venue.get("address"),
            "organizer": group.get("name"),
            "attendees": ev.get("rsvps", {}).get("totalCount"),
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

    keywords = [
        "Artificial Intelligence",
        "Machine Learning",
        "Data Science",
        "DevOps",
        "Startups",
        "Hackathon",
    ]

    all_events = []
    for kw in keywords:
        try:
            events = fetch_meetup_search(kw)
            print(f"{kw}: {len(events)} eventos")
            all_events.extend(events)
        except Exception as e:
            print(f"{kw}: ERROR ({e})")

    print(f"\nTotal antes de deduplicar: {len(all_events)}")
    unique_events = dedupe_events(all_events)
    print(f"Total después de deduplicar: {len(unique_events)}")

    os.makedirs("data/raw", exist_ok=True)
    output_path = "data/raw/meetup_events.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(unique_events, f, ensure_ascii=False, indent=2)
    print(f"Guardado en {output_path}")