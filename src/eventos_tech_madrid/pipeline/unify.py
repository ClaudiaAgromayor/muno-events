import json
from difflib import SequenceMatcher


def _load(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _normalize_luma(events: list[dict]) -> list[dict]:
    return [{
        "id": f"luma:{e['source_id']}",
        "source": "luma",
        "source_id": e["source_id"],
        "name": e["name"],
        "description": e.get("description"),
        "start_at": e.get("start_at"),
        "end_at": e.get("end_at"),
        "url": e.get("url"),
        "city": e.get("city"),
        "address": e.get("address"),
        "organizer": e.get("organizer"),
        "extra": {
            "categories": e.get("categories"),
            "is_free": e.get("is_free"),
            "guest_count": e.get("guest_count"),
            "sold_out": e.get("sold_out"),
            "waitlist_active": e.get("waitlist_active"),
        },
    } for e in events]


def _normalize_meetup(events: list[dict]) -> list[dict]:
    return [{
        "id": f"meetup:{e['source_id']}",
        "source": "meetup",
        "source_id": e["source_id"],
        "name": e["name"],
        "description": e.get("description"),
        "start_at": e.get("start_at"),
        "end_at": None,  # no lo capturamos en la búsqueda por keyword
        "url": e.get("url"),
        "city": e.get("city"),
        "address": e.get("address"),
        "organizer": e.get("organizer"),
        "extra": {
            "attendees": e.get("attendees"),
            "max_tickets": e.get("max_tickets"),
            "spots_left": e.get("spots_left"),
        },
    } for e in events]


def _normalize_eventbrite(events: list[dict]) -> list[dict]:
    return [{
        "id": f"eventbrite:{e['source_id']}",
        "source": "eventbrite",
        "source_id": e["source_id"],
        "name": e["name"],
        "description": e.get("description"),
        "start_at": e.get("start_at"),
        "end_at": e.get("end_at"),
        "url": e.get("url"),
        "city": e.get("city"),
        "address": e.get("address"),
        "organizer": e.get("venue"),  # eventbrite no da organizador, usamos el recinto
        "extra": {
            "attendance_mode": e.get("attendance_mode"),
        },
    } for e in events]


def _normalize_manual(events: list[dict]) -> list[dict]:
    return [{
        "id": f"manual:{e['source_id']}",
        "source": "manual",
        "source_id": e["source_id"],
        "name": e["name"],
        "description": e.get("description"),
        "start_at": e.get("start_at"),
        "end_at": None,  # el Form no pide hora de fin
        "url": e.get("url"),
        "city": e.get("city"),
        "address": e.get("address"),
        "organizer": e.get("organizer"),
        "extra": {},
    } for e in events]


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def dedupe_cross_platform(events: list[dict], threshold: float = 0.93) -> list[dict]:
    """Agrupa eventos del mismo día con nombres parecidos, aunque vengan de plataformas distintas."""
    result = []
    used = [False] * len(events)

    for i, ev in enumerate(events):
        if used[i]:
            continue
        group = [ev]
        used[i] = True
        day_i = (ev.get("start_at") or "")[:10]

        for j in range(i + 1, len(events)):
            if used[j]:
                continue
            other = events[j]
            day_j = (other.get("start_at") or "")[:10]
            if day_i and day_i == day_j and _similar(ev["name"], other["name"]) >= threshold:
                group.append(other)
                used[j] = True

        merged = group[0].copy()
        merged["found_on_platforms"] = sorted({g["source"] for g in group})
        merged["duplicate_ids"] = [g["id"] for g in group[1:]]
        result.append(merged)

    return result


if __name__ == "__main__":
    import os

    luma = _normalize_luma(_load("data/raw/luma_events.json"))
    meetup = _normalize_meetup(_load("data/raw/meetup_events.json"))
    eventbrite = _normalize_eventbrite(_load("data/raw/eventbrite_events.json"))
    manual = _normalize_manual(_load("data/raw/manual_events.json"))

    print(f"Luma: {len(luma)} | Meetup: {len(meetup)} | Eventbrite: {len(eventbrite)} | Manual: {len(manual)}")

    all_events = luma + meetup + eventbrite + manual
    print(f"Total combinado: {len(all_events)}")

    unified = dedupe_cross_platform(all_events)
    print(f"Total tras deduplicar entre plataformas: {len(unified)}")

    cross_dupes = [e for e in unified if len(e["found_on_platforms"]) > 1]
    print(f"Eventos encontrados en más de una plataforma: {len(cross_dupes)}")
    for e in cross_dupes:
        print(f"  - {e['name']} ({', '.join(e['found_on_platforms'])})")

    os.makedirs("data/processed", exist_ok=True)
    with open("data/processed/events.json", "w", encoding="utf-8") as f:
        json.dump(unified, f, ensure_ascii=False, indent=2)
    print("\nGuardado en data/processed/events.json")