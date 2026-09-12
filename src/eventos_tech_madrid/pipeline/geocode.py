import json
import os
import time

import httpx

# Nominatim (geocodificador gratuito de OpenStreetMap) exige un User-Agent real que
# identifique la app, y como mucho 1 peticion por segundo -- lo respetamos con time.sleep,
# y con la cache por direccion solo pagamos ese coste una vez por sitio, no cada 6h.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "muno-events/1.0 (github.com/ClaudiaAgromayor/muno-events)"


def geocode_address(client: httpx.Client, address: str) -> dict | None:
    resp = client.get(
        NOMINATIM_URL,
        params={"q": address, "format": "json", "limit": 1},
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return None
    return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}


def geocode_events(events: list[dict], cache: dict) -> dict:
    """Geocodifica por direccion (no por evento), asi varios eventos en el mismo sitio
    comparten una sola consulta. Devuelve la cache actualizada."""
    new_count = 0
    errors = 0

    with httpx.Client() as client:
        for ev in events:
            address = ev.get("address")
            if not address or address in cache:
                continue
            try:
                cache[address] = geocode_address(client, address)
                new_count += 1
            except Exception as e:
                print(f"  ERROR geocodificando '{address}': {e}")
                errors += 1
            time.sleep(1.1)  # respeta el limite de 1 peticion/segundo de Nominatim

    print(f"Geocodificadas {new_count} direcciones nuevas, {errors} errores, resto ya en cache")
    return cache


if __name__ == "__main__":
    events_path = "data/raw/meetup_events.json"
    cache_path = "data/processed/geocode_cache.json"

    events = json.load(open(events_path, encoding="utf-8"))
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}

    cache = geocode_events(events, cache)

    os.makedirs("data/processed", exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    for ev in events:
        coords = cache.get(ev.get("address")) if ev.get("address") else None
        ev["lat"] = coords["lat"] if coords else None
        ev["lng"] = coords["lng"] if coords else None

    with open(events_path, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

    print(f"Guardado en {events_path} y {cache_path}")
