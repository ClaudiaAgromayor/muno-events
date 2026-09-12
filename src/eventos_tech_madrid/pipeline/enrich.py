import json
import os
from typing import Literal

import anthropic
from pydantic import BaseModel

MODEL = "claude-haiku-4-5"

SYSTEM_PROMPT = (
    "Analizas la descripcion de un evento de tech/IA/ML en Madrid y extraes "
    "metadatos que el texto no siempre dice de forma explicita. Si la "
    "descripcion no menciona algo con claridad, usa 'no_especificado' en vez "
    "de adivinar."
)


class EventEnrichment(BaseModel):
    nivel: Literal["principiante", "intermedio", "avanzado", "no_especificado"]
    idioma: Literal["es", "en", "no_especificado"]
    comida_gratis: Literal["si", "no", "no_especificado"]
    se_graba: Literal["si", "no", "no_especificado"]


def enrich_event(client: anthropic.Anthropic, name: str, description: str | None) -> dict:
    response = client.messages.parse(
        model=MODEL,
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Titulo: {name}\n\nDescripcion: {description or '(sin descripcion)'}",
        }],
        output_format=EventEnrichment,
    )
    return response.parsed_output.model_dump()


def enrich_events(events: list[dict], cache: dict) -> dict:
    """Enriquece solo los eventos que no estan ya en la cache (por id). Devuelve la cache actualizada."""
    client = anthropic.Anthropic()
    new_count = 0
    errors = 0

    for ev in events:
        if ev["id"] in cache:
            continue
        try:
            cache[ev["id"]] = enrich_event(client, ev["name"], ev.get("description"))
            new_count += 1
        except Exception as e:
            print(f"  ERROR enriqueciendo {ev['id']}: {e}")
            errors += 1

    print(f"Enriquecidos {new_count} eventos nuevos, {errors} errores, {len(events) - new_count - errors} ya en cache")
    return cache


if __name__ == "__main__":
    events_path = "data/processed/events.json"
    cache_path = "data/processed/enrichment_cache.json"

    events = json.load(open(events_path, encoding="utf-8"))
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}

    cache = enrich_events(events, cache)

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    for ev in events:
        ev["enrichment"] = cache.get(ev["id"])

    with open(events_path, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

    print(f"Guardado en {events_path} y {cache_path}")
