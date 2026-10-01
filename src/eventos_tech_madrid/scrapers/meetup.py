"""Meetup: usa el endpoint GraphQL de la web (meetup.com/gql2), que responde sin login.

La API oficial ahora exige Meetup Pro; esta es la que usa meetup.com en el navegador. A
diferencia de las páginas HTML (que solo traen la primera página de resultados), aquí se
puede paginar y pedir exactamente los campos de aforo: maxTickets, apuntados, lista de
espera y si las inscripciones están cerradas.
"""

from __future__ import annotations

import httpx

from eventos_tech_madrid.common import compute_status, distance_km, event, request
from eventos_tech_madrid.sources import CITY, MEETUP_GROUPS, MEETUP_KEYWORDS

GQL = "https://www.meetup.com/gql2"

EVENT_FIELDS = """
  id title description dateTime endTime eventUrl eventType maxTickets status
  going { totalCount }
  waiting: rsvps(filter: { rsvpStatus: [WAITLIST] }) { totalCount }
  rsvpSettings { rsvpsClosed rsvpCloseTime }
  feeSettings { amount currency }
  featuredEventPhoto { highResUrl }
  venue { name address city lat lon }
  group { name urlname }
"""

SEARCH_Q = f"""query($f: EventSearchFilter!, $after: String) {{
  eventSearch(filter: $f, first: 50, after: $after) {{
    pageInfo {{ hasNextPage endCursor }}
    edges {{ node {{ {EVENT_FIELDS} }} }}
  }}
}}"""

GROUP_Q = f"""query($u: String!) {{
  groupByUrlname(urlname: $u) {{
    name
    events(status: ACTIVE, first: 30) {{ edges {{ node {{ {EVENT_FIELDS} }} }} }}
  }}
}}"""


def _gql(c: httpx.Client, query: str, variables: dict) -> dict:
    r = request(c, "POST", GQL, json={"query": query, "variables": variables})
    data = r.json()
    if data.get("errors") and not data.get("data"):
        raise RuntimeError(data["errors"][0].get("message"))
    return data["data"]


def _to_event(n: dict, trusted: bool) -> dict | None:
    if n.get("status") not in (None, "ACTIVE", "CANCELLED", "UPCOMING"):
        return None
    venue = n.get("venue") or {}
    is_online = n.get("eventType") == "ONLINE"
    lat, lng = venue.get("lat"), venue.get("lon")

    if not is_online:
        near = lat is not None and distance_km(lat, lng, CITY["lat"], CITY["lng"]) <= CITY["radius_km"]
        if not near:
            return None
        lat, lng = (lat, lng) if (lat or lng) else (None, None)
    else:
        if not trusted:
            return None
        lat = lng = None

    capacity = n.get("maxTickets") or None  # 0 = sin límite
    going = (n.get("going") or {}).get("totalCount")
    waiting = (n.get("waiting") or {}).get("totalCount") or 0
    fee = n.get("feeSettings") or {}
    closed = bool((n.get("rsvpSettings") or {}).get("rsvpsClosed"))

    status = compute_status(
        cancelled=n.get("status") == "CANCELLED",
        closed=closed,
        sold_out=bool(capacity and going is not None and going >= capacity),
        # En Meetup, cuando se llena, la lista de espera está activa por defecto salvo que
        # se cierren las inscripciones.
        waitlist_open=not closed,
        capacity=capacity,
        going=going,
    )
    if waiting > 0 and status in ("open", "few_left"):
        status = "waitlist"  # ya hay gente esperando: lo honesto es decir lista de espera

    group = n.get("group") or {}
    return event(
        source="meetup",
        source_id=n["id"],
        title=n["title"],
        start_at=n["dateTime"],
        end_at=n.get("endTime"),
        url=n.get("eventUrl"),
        trusted=trusted,
        description=(n.get("description") or "")[:5000] or None,
        image_url=(n.get("featuredEventPhoto") or {}).get("highResUrl"),
        organizer=group.get("name"),
        organizer_url=f"https://www.meetup.com/{group['urlname']}/" if group.get("urlname") else None,
        is_online=is_online,
        venue_name=venue.get("name") if not is_online else None,
        address=venue.get("address") or None,
        lat=lat,
        lng=lng,
        is_free=not fee.get("amount"),
        price_min=fee.get("amount") or None,
        currency=fee.get("currency"),
        status=status,
        capacity=capacity,
        going_count=going,
        waitlist_count=waiting or None,
    )


def scrape(c: httpx.Client) -> list[dict]:
    found: dict[str, dict] = {}

    for kw in MEETUP_KEYWORDS:
        after, total = None, 0
        for _ in range(6):
            f = {"query": kw, "lat": CITY["lat"], "lon": CITY["lng"], "radius": CITY["radius_km"]}
            data = _gql(c, SEARCH_Q, {"f": f, "after": after})["eventSearch"]
            for edge in data["edges"]:
                ev = _to_event(edge["node"], trusted=False)
                if ev:
                    found.setdefault(ev["id"], ev)
                    total += 1
            if not data["pageInfo"]["hasNextPage"]:
                break
            after = data["pageInfo"]["endCursor"]
        print(f"  meetup búsqueda '{kw}': {total}")

    trusted_groups = {g.lower() for g in MEETUP_GROUPS}
    for urlname in MEETUP_GROUPS:
        try:
            g = _gql(c, GROUP_Q, {"u": urlname})["groupByUrlname"]
            if not g:
                print(f"  meetup grupo {urlname}: no existe")
                continue
            edges = g["events"]["edges"]
            for edge in edges:
                ev = _to_event(edge["node"], trusted=True)
                if ev:
                    found[ev["id"]] = ev
        except Exception as e:  # noqa: BLE001
            print(f"  meetup grupo {urlname}: ERROR {e}")

    # Un evento encontrado por búsqueda que en realidad es de un grupo de confianza
    for ev in found.values():
        url = (ev.get("organizer_url") or "").lower()
        if any(f"/{g}/" in url for g in trusted_groups):
            ev["_trusted"] = True

    return list(found.values())
