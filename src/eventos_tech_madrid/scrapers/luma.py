import httpx
import json
from bs4 import BeautifulSoup
import os
import time


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

def _extract_text_from_doc(node) -> str:
    """Convierte el árbol ProseMirror de description_mirror en texto plano."""
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    children = node.get("content", [])
    text = "".join(_extract_text_from_doc(child) for child in children)
    if node.get("type") in {"paragraph", "heading", "list_item"}:
        text += "\n"
    return text


def fetch_luma_event_detail(url_slug: str) -> dict:
    """Trae descripción, categorías y aforo de la página individual de un evento."""
    url = f"https://lu.ma/{url_slug}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    next_data = _parse_next_data(resp.text)
    data = next_data["props"]["pageProps"]["initialData"]["data"]

    description = _extract_text_from_doc(data.get("description_mirror") or {}).strip()
    categories = [c.get("name") for c in (data.get("categories") or [])]
    coordinate = (data.get("event") or {}).get("coordinate") or {}

    return {
        "description": description,
        "categories": categories,
        "guest_count": data.get("guest_count"),
        "sold_out": data.get("sold_out"),
        "waitlist_active": data.get("waitlist_active"),
        "lat": coordinate.get("latitude"),
        "lng": coordinate.get("longitude"),
    }


def enrich_with_details(events: list[dict]) -> list[dict]:
    for ev in events:
        slug = ev["url"].rstrip("/").split("/")[-1]
        try:
            detail = fetch_luma_event_detail(slug)
            ev.update(detail)
        except Exception as e:
            print(f"  no se pudo enriquecer '{ev['name']}': {e}")
        time.sleep(0.3)  # pausa corta entre peticiones, por educación con el servidor
    return events

TECH_CATEGORIES = {"AI", "Tech"}


def filter_madrid_tech(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Devuelve (eventos_validos, eventos_para_revisar_a_mano)."""
    madrid_events = [e for e in events if "madrid" in (e.get("city") or "").lower()]

    valid = []
    needs_review = []
    for ev in madrid_events:
        cats = set(ev.get("categories") or [])
        if cats & TECH_CATEGORIES:
            valid.append(ev)
        elif not cats:
            needs_review.append(ev)
        # si tiene categorías pero ninguna es tech (ej. Fitness), se descarta sin más

    return valid, needs_review

if __name__ == "__main__":
    sources = [
        "madrid",
        "madai",
        "claudecommunity",
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

    print("\nEnriqueciendo con descripción y categorías (tarda ~1 seg por evento)...")
    unique_events = enrich_with_details(unique_events)

    valid_events, needs_review = filter_madrid_tech(unique_events)
    print(f"\nEventos válidos (Madrid + tech): {len(valid_events)}")
    print(f"Para revisión manual (Madrid, sin categoría): {len(needs_review)}")

    os.makedirs("data/raw", exist_ok=True)
    with open("data/raw/luma_events.json", "w", encoding="utf-8") as f:
        json.dump(valid_events, f, ensure_ascii=False, indent=2)
    with open("data/raw/luma_needs_review.json", "w", encoding="utf-8") as f:
        json.dump(needs_review, f, ensure_ascii=False, indent=2)
    print("Guardado en data/raw/luma_events.json y data/raw/luma_needs_review.json")