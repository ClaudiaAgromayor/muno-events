import httpx
import json
from bs4 import BeautifulSoup


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


if __name__ == "__main__":
    sources = ["madrid", "madai", "claudecommunity", "codex-community", "aimadrid"]
    all_events = []
    for slug in sources:
        events = fetch_luma_source(slug)
        print(f"{slug}: {len(events)} eventos")
        all_events.extend(events)
    print(f"\nTotal: {len(all_events)} eventos (antes de deduplicar)")