"""Clasificador por reglas: ¿es tech?, ¿qué tipo de evento?, ¿de qué temas?, ¿idioma?

Antes esto dependía de un LLM gratis de OpenRouter que dejó de ser gratis y fallaba en
cada ejecución. Las reglas son predecibles, gratis y suficientes para este dominio; se
ajustan editando las listas de abajo.
"""

from __future__ import annotations

import re

# (patrón, peso). Suma de pesos >= 1 => tech. Patrones fuertes valen 1 por sí solos.
_TECH = [
    (r"\b(ia|ai|a\.i\.)\b", 1), (r"inteligencia artificial|artificial intelligence", 1),
    (r"machine learning|aprendizaje autom|deep learning|\bml\b|\bmlops\b", 1),
    (r"\bllms?\b|\bgpt|\bclaude\b|openai|anthropic|gemini|\brag\b|agentes? de ia|\bagents?\b|agentic", 1),
    (r"data scien|ciencia de datos|big data|data engineer|analytics|\bdatos\b", 0.6),
    (r"hackat(h)?[oó]n|buildathon|build day|game jam|vibe ?cod", 1),
    (r"\bdevs?\b|developers?|desarrollador|programaci|programming|coding|\bcode\b|c[oó]digo", 1),
    (r"software|backend|frontend|full ?stack|\bapi\b|open source|github", 1),
    (r"python|javascript|typescript|\breact\b|node\.?js|\bjava\b|golang|\brust\b|kotlin|swift|elixir|haskell", 1),
    (r"devops|kubernetes|\bk8s\b|docker|cloud|\baws\b|azure|\bgcp\b|serverless|terraform|platform engineering|\bsre\b", 1),
    (r"ciberseguridad|cybersecurity|infosec|pentest|hacking", 1),
    (r"blockchain|web3|ethereum|crypto|bitcoin|defi", 0.8),
    (r"startup|founders?|emprend|venture|\bvcs?\b|pitch|aceleradora|incubadora", 0.6),
    (r"\btech\b|tecnolog|technology|digital|innovaci[oó]n", 0.5),
    (r"robot|drones?|hardware|iot|quantum|cu[aá]ntic", 0.8),
    (r"product manag|product owner|\bux\b|\bui\b|dise[ñn]o de producto|no-?code|low-?code", 0.6),
    (r"ingenier|engineer", 0.6),
]

# Señales de que NO es para nuestro público aunque mencione "digital", "IA" de pasada...
_NOT_TECH = [
    r"tarot|reiki|meditaci|mindfulness|yoga|astrolog|coaching personal|constelaciones",
    r"iconograf[ií]a|pintura|museo|teatro|concierto|cata de vino|senderismo|salsa|bachata",
    r"inmobiliari|real estate investing|forex|trading de|criptomonedas para ganar",
    r"open day|fashion|\bmoda\b|genes|business english|stand ?up|club de lectura|book club",
    r"tertulia|theatre|practice spanish|pub crawl|erasmus|\bparty\b|fiesta|curso online|language exchange|intercambio de idiomas|macroeconom|geopol[ií]tic|green drinks",
]

# Las búsquedas de Eventbrite traen mucho evento "de empresa" genérico: se les pide más
# evidencia que a Luma/Meetup.
_SOURCE_THRESHOLD = {"eventbrite": 0.35}

_KIND = [
    ("hackathon", r"hackat(h)?[oó]n|buildathon|build ?day|game jam|\bjam\b|codefest|\bctf\b"),
    ("conferencia", r"summit|congreso|conference|conferencia|\bcon\b \d{4}|forum|f[oó]rum|festival|expo\b|\bdays?\b \d{4}|world|cumbre|jornadas"),
    ("workshop", r"workshop|taller|bootcamp|hands[- ]on|masterclass|curso|training|formaci[oó]n|crash course|study group"),
    ("networking", r"networking|brunch|beers|cervezas|drinks|afterwork|after work|copas|dinner|cena|breakfast|desayuno|caf[eé]\b|social|mixer|happy hour"),
    ("charla", r"charla|talk|webinar|ponencia|mesa redonda|panel|fireside|keynote|presentaci[oó]n|demo night|demo day"),
]

_TOPICS = {
    "ia": r"\b(ia|ai)\b|inteligencia artificial|artificial intelligence|\bllm|gpt|claude|openai|agent|genai|generativ",
    "ml-data": r"machine learning|deep learning|\bml\b|data scien|ciencia de datos|big data|analytics|\bdatos\b|data engineer|spark|databricks|kafka",
    "dev": r"developer|desarroll|programaci|coding|software|python|javascript|typescript|react|node|java\b|golang|rust|frontend|backend",
    "cloud-devops": r"cloud|aws|azure|gcp|devops|kubernetes|docker|sre|platform engineering|serverless",
    "startups": r"startup|founder|emprend|venture|\bvc\b|pitch|inversi[oó]n|aceleradora",
    "producto-ux": r"product manag|product owner|\bux\b|\bui\b|dise[ñn]o|producto",
    "web3": r"blockchain|web3|ethereum|crypto|defi|bitcoin",
    "ciberseguridad": r"ciberseguridad|cybersecurity|infosec|security|seguridad",
    "hardware": r"robot|drone|hardware|iot|quantum|cu[aá]ntic|chip",
}

_ES = re.compile(r"\b(el|la|los|las|de|del|que|y|para|con|una|un|en|por|cómo|qué|nuestro|evento)\b", re.I)
_EN = re.compile(r"\b(the|and|for|with|you|your|our|this|how|what|join|event|will|from)\b", re.I)


def _text(ev: dict) -> str:
    return " ".join(
        str(ev.get(k) or "") for k in ("title", "description", "organizer", "_hints")
    ).lower()


def tech_score(ev: dict) -> float:
    title = (ev.get("title") or "").lower()
    text = _text(ev)
    score = 0.0
    for pat, w in _TECH:
        if re.search(pat, title):
            score += w * 1.5  # lo que dice el título pesa más
        elif re.search(pat, text):
            score += w * 0.6
    if any(re.search(p, title) for p in _NOT_TECH):
        score -= 2
    return round(min(score, 3.0) / 3.0, 3)


def kind(ev: dict) -> str:
    title = (ev.get("title") or "").lower()
    text = _text(ev)
    for k, pat in _KIND:
        if re.search(pat, title):
            return k
    # Eventos de varios días casi siempre son conferencias/hackathons
    s, e = ev.get("start_at") or "", ev.get("end_at") or ""
    if s[:10] and e[:10] and e[:10] > s[:10]:
        return "hackathon" if re.search(_KIND[0][1], text) else "conferencia"
    for k, pat in _KIND:
        if re.search(pat, text[:600]):
            return k
    return "meetup"


def topics(ev: dict) -> list[str]:
    text = _text(ev)
    return [t for t, pat in _TOPICS.items() if re.search(pat, text)]


def language(ev: dict) -> str | None:
    text = f"{ev.get('title') or ''} {ev.get('description') or ''}"[:2000]
    es, en = len(_ES.findall(text)), len(_EN.findall(text))
    if es + en < 4:
        return None
    return "es" if es >= en else "en"


TECH_THRESHOLD = 0.3  # ~0.9 puntos de evidencia


def classify(ev: dict) -> dict | None:
    """Devuelve el evento con kind/topics/language/tech_score, o None si no es tech."""
    score = tech_score(ev)
    if ev.get("_trusted"):
        score = max(score, 0.5)
    if score < _SOURCE_THRESHOLD.get(ev.get("source"), TECH_THRESHOLD):
        return None
    ev["tech_score"] = score
    ev["kind"] = kind(ev)
    ev["topics"] = topics(ev)
    ev["language"] = language(ev)
    return ev
