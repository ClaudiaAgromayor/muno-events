import httpx
import json
from bs4 import BeautifulSoup


def fetch_luma_city(city_slug: str) -> list[dict]:
    url = f"https://lu.ma/{city_slug}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    data = json.loads(script.string)

    events_raw = data["props"]["pageProps"]["initialData"]["data"]["events"]

    events = []
    for item in events_raw:
        ev = item["event"]
        events.append({
            "source": "luma",
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
        })
    return events


if __name__ == "__main__":
    events = fetch_luma_city("madrid")
    print(f"Encontrados {len(events)} eventos\n")
    for e in events[:3]:
        print(e["name"], "-", e["start_at"])