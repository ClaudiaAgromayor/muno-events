import csv
import httpx
import io
from datetime import datetime

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkE8_sQRP0rgEdYD_my7eauXPx06bGr1zTmAr6Hr5ixOABa1p5EAM2B5rjLrvDFMpPGDerZV06j3s0/pub?output=csv"


def _parse_start_at(fecha: str, hora: str) -> str:
    """Combina las columnas nativas 'Fecha' y 'Hora' del Form en un datetime ISO.

    Formato real de Sheets verificado con una respuesta de prueba:
    Fecha = 'd/m/aaaa' (ej. '24/9/2026'), Hora = 'h:mm:ss a.m./p.m.' (ej. '10:00:00 a.m.').
    """
    d = datetime.strptime(fecha.strip(), "%d/%m/%Y")
    hora_norm = (
        hora.strip()
        .replace("a. m.", "AM")
        .replace("p. m.", "PM")
        .replace("a.m.", "AM")
        .replace("p.m.", "PM")
    )
    t = datetime.strptime(hora_norm, "%I:%M:%S %p")
    return datetime.combine(d.date(), t.time()).isoformat()


def fetch_manual_submissions(csv_url: str = CSV_URL) -> tuple[list[dict], list[dict]]:
    """Lee los envios manuales publicados como CSV. Devuelve (validos, para_revisar)."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(csv_url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    reader = csv.DictReader(io.StringIO(resp.text))

    valid = []
    needs_review = []
    for i, row in enumerate(reader, start=1):
        name = (row.get("Nombre del evento") or "").strip()
        fecha = (row.get("Fecha") or "").strip()
        hora = (row.get("Hora") or "").strip()
        timestamp = (row.get("Marca temporal") or "").strip()

        # id estable por marca temporal (unica por envio), no por posicion de fila,
        # para que no cambie si se borra una respuesta anterior en la Sheet
        source_id = timestamp.replace("/", "-").replace(" ", "_").replace(":", "") or f"row{i}"

        event = {
            "source": "manual",
            "source_id": source_id,
            "name": name,
            "description": (row.get("Descripción") or "").strip() or None,
            "url": (row.get("Enlace del evento") or "").strip() or None,
            "city": "Madrid",  # el Form no pide ciudad; la app es solo Madrid por ahora
            "address": (row.get("Ubicación") or "").strip() or None,
            "organizer": None,
        }

        if not name or not fecha or not hora:
            event["start_at"] = None
            event["review_reason"] = "faltan campos obligatorios (nombre, fecha u hora)"
            needs_review.append(event)
            continue

        try:
            event["start_at"] = _parse_start_at(fecha, hora)
        except ValueError:
            event["start_at"] = None
            event["review_reason"] = f"no se pudo interpretar fecha/hora: '{fecha}' '{hora}'"
            needs_review.append(event)
            continue

        valid.append(event)

    return valid, needs_review


if __name__ == "__main__":
    import json
    import os

    valid_events, needs_review = fetch_manual_submissions()
    print(f"Envios validos: {len(valid_events)}")
    print(f"Para revision manual: {len(needs_review)}")

    os.makedirs("data/raw", exist_ok=True)
    with open("data/raw/manual_events.json", "w", encoding="utf-8") as f:
        json.dump(valid_events, f, ensure_ascii=False, indent=2)
    with open("data/raw/manual_needs_review.json", "w", encoding="utf-8") as f:
        json.dump(needs_review, f, ensure_ascii=False, indent=2)
    print("Guardado en data/raw/manual_events.json y manual_needs_review.json")
