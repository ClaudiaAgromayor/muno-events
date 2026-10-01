"""Envíos del Google Form "Enviar evento a MUNO" (publicado como CSV desde su Hoja).

Es la vía para añadir eventos sin cuenta; la otra es /nuevo en la web (pegar un link).
Los envíos entran como confiables (los ha mandado alguien a propósito para muno), pero
pasan igualmente por el clasificador para sacar tipo, temas e idioma.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from eventos_tech_madrid.common import event, request

CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkE8_sQRP0rgEdYD_my7eauXPx06bGr1zTmAr6Hr5ixOABa1p5EAM2B5rjLrvDFMpPGDerZV06j3s0"
    "/pub?output=csv"
)
MADRID = ZoneInfo("Europe/Madrid")


def _start_at(fecha: str, hora: str) -> str:
    """Formato real de Sheets: Fecha 'd/m/aaaa', Hora 'h:mm:ss a. m.' o 'HH:MM:SS'."""
    d = datetime.strptime(fecha.strip(), "%d/%m/%Y")
    h = (
        hora.strip().replace("a. m.", "AM").replace("p. m.", "PM").replace("a.m.", "AM").replace("p.m.", "PM")
    )
    for fmt in ("%I:%M:%S %p", "%H:%M:%S", "%H:%M"):
        try:
            t = datetime.strptime(h, fmt).time()
            break
        except ValueError:
            continue
    else:
        raise ValueError(f"hora no reconocida: {hora!r}")
    return datetime.combine(d.date(), t, tzinfo=MADRID).isoformat()


def scrape(c: httpx.Client) -> list[dict]:
    text = request(c, "GET", CSV_URL).content.decode("utf-8")
    out = []
    for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=1):
        name = (row.get("Nombre del evento") or "").strip()
        fecha, hora = (row.get("Fecha") or "").strip(), (row.get("Hora") or "").strip()
        stamp = (row.get("Marca temporal") or "").strip()
        if not (name and fecha and hora):
            print(f"  form fila {i}: faltan nombre/fecha/hora, se ignora")
            continue
        try:
            start = _start_at(fecha, hora)
        except ValueError as e:
            print(f"  form fila {i}: {e}")
            continue
        # id estable por marca temporal (única por envío), no por número de fila
        sid = "".join(ch for ch in stamp if ch.isalnum()) or f"fila{i}"
        out.append(
            event(
                source="user",
                source_id=f"form-{sid}",
                title=name,
                start_at=start,
                url=(row.get("Enlace del evento") or "").strip() or None,
                trusted=True,
                description=(row.get("Descripción") or "").strip() or None,
                address=(row.get("Ubicación") or "").strip() or None,
                organizer=(row.get("Organizador") or "").strip() or None,
            )
        )
    print(f"  form: {len(out)} envíos válidos")
    return out
