import json
import os
import time
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError

# OpenRouter (https://openrouter.ai): capa gratuita real para esto -- 20 peticiones/min,
# 50/dia sin tarjeta ni pago. Como solo procesamos eventos NUEVOS cada ciclo (gracias a la
# cache de mas abajo), nos sobra de largo. Se probo primero con google/gemma-4-31b-it:free
# pero su unico proveedor (Google AI Studio) estaba saturado de forma persistente el
# 2026-09-12, no puntual -- verificado reintentando con backoff exponencial. Nex AGI
# tambien soporta salida JSON forzada (response_format + structured_outputs) y tenia
# buena disponibilidad en ese momento.
MODEL = "nex-agi/nex-n2.5-pro:free"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = (
    "Analizas la descripcion de un evento de tech/IA/ML en Madrid y extraes "
    "metadatos que el texto no siempre dice de forma explicita. Si la "
    "descripcion no menciona algo con claridad, usa 'no_especificado' en vez "
    "de adivinar."
)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "nivel": {"type": "string", "enum": ["principiante", "intermedio", "avanzado", "no_especificado"]},
        "idioma": {"type": "string", "enum": ["es", "en", "no_especificado"]},
        "comida_gratis": {"type": "string", "enum": ["si", "no", "no_especificado"]},
        "se_graba": {"type": "string", "enum": ["si", "no", "no_especificado"]},
    },
    "required": ["nivel", "idioma", "comida_gratis", "se_graba"],
    "additionalProperties": False,
}


class EventEnrichment(BaseModel):
    nivel: Literal["principiante", "intermedio", "avanzado", "no_especificado"]
    idioma: Literal["es", "en", "no_especificado"]
    comida_gratis: Literal["si", "no", "no_especificado"]
    se_graba: Literal["si", "no", "no_especificado"]


def enrich_event(client: httpx.Client, name: str, description: str | None, max_retries: int = 3) -> dict:
    delay = 15  # el modelo gratuito comparte cupo global entre todos los usuarios de
    # OpenRouter ("upstream_provider_shared_pool") -- un 429 aqui puede ser saturacion
    # puntual, asi que merece un par de reintentos cortos. Pero si sigue fallando tras
    # esos reintentos, no vale la pena insistir mas: puede ser el limite diario (que a
    # veces no se distingue del texto de saturacion puntual) o saturacion persistente --
    # en ambos casos el llamador (enrich_events) debe parar el proceso entero, no seguir
    # martilleando el resto de eventos uno a uno.
    for attempt in range(max_retries):
        resp = client.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Titulo: {name}\n\nDescripcion: {description or '(sin descripcion)'}"},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "event_enrichment", "strict": True, "schema": RESPONSE_SCHEMA},
                },
                "reasoning": {"enabled": False},
            },
            timeout=30,
        )

        if resp.status_code == 429 and attempt < max_retries - 1:
            print(f"    saturado, reintento en {delay}s...")
            time.sleep(delay)
            delay *= 2
            continue

        if resp.status_code >= 400:
            # httpx.HTTPStatusError no incluye el cuerpo de la respuesta en su mensaje,
            # y ahi es donde OpenRouter explica el motivo real (limite, saldo, modelo caido...)
            raise httpx.HTTPStatusError(
                f"{resp.status_code} {resp.reason_phrase}: {resp.text}",
                request=resp.request,
                response=resp,
            )

        content = resp.json()["choices"][0]["message"]["content"]
        parsed = EventEnrichment.model_validate_json(content)
        return parsed.model_dump()


def _save_cache(cache: dict, cache_path: str) -> None:
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def enrich_events(events: list[dict], cache: dict, cache_path: str) -> dict:
    """Enriquece solo los eventos que no estan ya en la cache (por id). Devuelve la cache actualizada.

    Guarda en disco tras CADA evento nuevo, no solo al final: cada llamada gasta una
    peticion gratis limitada, y un Ctrl+C o un corte a mitad no debe tirar ese trabajo.
    """
    new_count = 0
    errors = 0
    pending = [ev for ev in events if ev["id"] not in cache]

    with httpx.Client() as client:
        for i, ev in enumerate(pending, start=1):
            print(f"  [{i}/{len(pending)}] {ev['name'][:60]}")
            try:
                cache[ev["id"]] = enrich_event(client, ev["name"], ev.get("description"))
                new_count += 1
                _save_cache(cache, cache_path)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    print("    limite gratis alcanzado (diario o saturacion persistente) -- paramos aqui, el resto se hara en la siguiente ejecucion")
                    break
                print(f"    ERROR: {e}")
                errors += 1
            except (ValidationError, KeyError, json.JSONDecodeError) as e:
                print(f"    ERROR: {e}")
                errors += 1
            time.sleep(3.5)  # el tier gratis de OpenRouter permite 20 peticiones/min

    print(f"Enriquecidos {new_count} eventos nuevos, {errors} errores, {len(events) - new_count - errors} ya en cache")
    return cache


if __name__ == "__main__":
    events_path = "data/processed/events.json"
    cache_path = "data/processed/enrichment_cache.json"

    events = json.load(open(events_path, encoding="utf-8"))
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}

    cache = enrich_events(events, cache, cache_path)

    for ev in events:
        ev["enrichment"] = cache.get(ev["id"])

    with open(events_path, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

    print(f"Guardado en {events_path} y {cache_path}")
