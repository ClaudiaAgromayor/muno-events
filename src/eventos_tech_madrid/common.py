"""Piezas compartidas por todos los scrapers: cliente HTTP, formato común y estado de plazas."""

from __future__ import annotations

import math
import time
from typing import Any

import httpx

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)


def client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"},
        follow_redirects=True,
        timeout=30,
    )


def request(c: httpx.Client, method: str, url: str, retries: int = 3, **kw) -> httpx.Response:
    """GET/POST con reintentos ante errores de red y 429/5xx (backoff exponencial)."""
    delay = 2.0
    for attempt in range(retries):
        try:
            r = c.request(method, url, **kw)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            r.raise_for_status()
            return r
        except httpx.TransportError:
            if attempt == retries - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def compute_status(
    *,
    cancelled: bool = False,
    closed: bool = False,
    sold_out: bool = False,
    waitlist_open: bool = False,
    capacity: int | None = None,
    going: int | None = None,
    spots_left: int | None = None,
    near_capacity: bool = False,
) -> str:
    """Traduce las señales de cada plataforma a un único estado.

    Orden de prioridad: cancelado > lleno (con/sin lista de espera) > cerrado > pocas plazas > abierto.
    "Lleno" va antes que "cerrado" porque muchas plataformas cierran la inscripción *porque*
    se llenó, y lo útil para la persona es saber si hay lista de espera.
    """
    if cancelled:
        return "cancelled"
    if spots_left is None and capacity and going is not None:
        spots_left = capacity - going
    if sold_out or (spots_left is not None and spots_left <= 0 and capacity):
        return "waitlist" if waitlist_open else "sold_out"
    if closed:
        return "closed"
    if near_capacity:
        return "few_left"
    if spots_left is not None and capacity:
        if spots_left <= 3 or spots_left / capacity <= 0.15:
            return "few_left"
    return "open"


def event(
    *,
    source: str,
    source_id: str,
    title: str,
    start_at: str,
    url: str | None,
    trusted: bool = False,
    **fields: Any,
) -> dict:
    """Construye un evento en el formato de la tabla public.events.

    `trusted` no se guarda: marca que viene de una comunidad de confianza (entra aunque el
    clasificador no lo vea claramente tech). `hints` tampoco: texto extra para clasificar.
    """
    ev = {
        "id": f"{source}:{source_id}",
        "source": source,
        "source_id": str(source_id),
        "title": (title or "").strip(),
        "start_at": start_at,
        "url": url,
        "_trusted": trusted,
    }
    ev.update(fields)
    return ev
