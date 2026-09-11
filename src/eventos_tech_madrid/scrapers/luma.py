import httpx
import json
from bs4 import BeautifulSoup
import os


def _parse_next_data(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    return json.loads(script.string)


def _extract_event_items(next_data: dict) -> list[dict]:
    initial = next_data["props"]["pageProps"]["initialData"]
    kind = initial.get("kind")
    data = initial["data"]

    if kind == "discover-place":
        return data.get("events", [])
    elif kind == "calendar":
        return data.get("upcoming", {}).get("entries", [])
    else:
        raise ValueError(f"Tipo de página Luma no soportado: {kind}")


def _map_item(item: dict, source_slug: str) -> dict:
    ev = item["event"]
    return {
        "source": "luma",
        "source_slug": source_slug,
        "source_id": ev["api_id"],
        "name": ev["name"],
        "start_at": ev["start_at"],
        "end_at": ev.get("end_at"),
        "timezone": ev.get("timezone"),
        "url": f"https://lu.ma/{ev['url']}",
        "city": ev.get("geo_address_info", {}).get("city"),
        "address": ev.get("geo_address_info", {}).get("address")
                   or ev.get("geo_address_info", {}).get("sublocality"),
        "organizer": item.get("calendar", {}).get("name"),
        "is_free": item.get("ticket_info", {}).get("is_free"),
        "cover_image": ev.get("cover_url"),
    }


def fetch_luma_source(slug: str) -> list[dict]:
    url = f"https://lu.ma/{slug}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    next_data = _parse_next_data(resp.text)
    items = _extract_event_items(next_data)
    return [_map_item(item, slug) for item in items]

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
    sources = [
        "madrid",
        "madai",
        "claudecommunity",
        "codex-community",
        "aimadrid",
        "madrid-tech-brunch",
        "helmcode",
    ]

    all_events = []
    for slug in sources:
        try:
            events = fetch_luma_source(slug)
            print(f"{slug}: {len(events)} eventos")
            all_events.extend(events)
        except Exception as e:
            print(f"{slug}: ERROR ({e})")

    print(f"\nTotal antes de deduplicar: {len(all_events)}")

    unique_events = dedupe_events(all_events)
    print(f"Total después de deduplicar: {len(unique_events)}")

    os.makedirs("data/raw", exist_ok=True)
    output_path = "data/raw/luma_events.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(unique_events, f, ensure_ascii=False, indent=2)
    print(f"Guardado en {output_path}")