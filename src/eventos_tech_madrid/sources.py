"""Fuentes que sigue muno. Para añadir una comunidad nueva basta con añadir una línea aquí.

Hay dos tipos de fuente:
- BÚSQUEDAS: traen de todo (hay que filtrar qué es tech con el clasificador).
- COMUNIDADES DE CONFIANZA: grupos/calendarios que sabemos que son tech de Madrid, así
  que todo lo que publican entra directamente (aunque el título no diga "IA" ni "dev").
"""

CITY = {
    "slug": "madrid",
    "name": "Madrid",
    "lat": 40.4168,
    "lng": -3.7038,
    "radius_km": 30,
}

# --- Luma ---------------------------------------------------------------------------
# Categorías de lu.ma/discover a buscar alrededor de la ciudad.
LUMA_DISCOVER_SLUGS = ["ai", "tech", "crypto"]

# Calendarios de Luma (lo que va después de luma.com/...). Si el calendario es global
# (p. ej. claudecommunity), solo se quedan los eventos que caen en la ciudad.
LUMA_CALENDARS = [
    "madrid",
    "madai",
    "aimadrid",
    "claudecommunity",
    "madrid-tech-brunch",
    "helmcode",
]

# --- Meetup -------------------------------------------------------------------------
MEETUP_KEYWORDS = [
    "AI", "inteligencia artificial", "machine learning", "LLM", "data science",
    "python", "javascript", "devops", "cloud", "kubernetes", "startups",
    "hackathon", "blockchain", "ciberseguridad", "developers", "product management",
]

# urlname de grupos de Meetup (meetup.com/<urlname>/) de tech en Madrid.
MEETUP_GROUPS = [
    # IA / ML / datos
    "Madrid-AI-Developers-Group", "madrid-machine-learning-meetup", "odsc-madrid-data-science",
    "pydata-madrid", "ai-performance-engineering-meetup-madrid", "mindstone-madrid-ai-meetup",
    "madrid-ai-machine-learning-and-computer-vision-meetup", "aiseceng-spain", "the-vcc",
    "Grupo-de-Usuarios-de-R-de-Madrid", "madrid-apache-spark-meetup", "madrid-databricks-meetup",
    "ac-mad", "datamecum", "graphdb-spain", "Madrid-ElasticSearch-Meetup", "quantummadrid",
    # desarrollo
    "gdgmadrid", "madridjs", "node-js-madrid", "MadridJUG", "MSCoders", "codemotion-espana",
    "go-mad", "haskell-mad", "madrid-elixir", "madrust", "devmad", "frontend-madrid",
    "ghspain", "xamarin-madrid", "madrid-gug", "sirviendo-codigo", "HackMadrid-27",
    # cloud / devops / infra
    "madrid-devops", "cloud-native-madrid", "apachekafkamadrid", "madrid-kafka",
    "grafana-and-friends-madrid", "cloud-and-beers", "azurebrains", "Power-Platform-Madrid",
    "fabricusergroupesp", "Oracle-Developer-Meetup-Spain",
    # producto / startups / comunidad tech
    "producttank-madrid", "theproductgroupmadrid", "spanishstartups", "madrid-startup-network",
    "Out-in-Tech-Madrid", "madrid-it-brunch", "TechAndBeers", "uxdx-madrid",
    "thoughtworks-madrid", "celonis-tech-meetups-madrid", "le-wagon-madrid-coding-bootcamp",
    # web3
    "ethereum-spain", "lfdt-madrid",
]

# --- Eventbrite ---------------------------------------------------------------------
# Rutas de búsqueda de eventbrite.es/d/<ruta>/ (se recorren varias páginas de cada una).
EVENTBRITE_SEARCHES = [
    "spain--madrid/science-and-tech--events",
    "spain--madrid/tech",
    "spain--madrid/inteligencia-artificial",
    "spain--madrid/startup",
    "spain--madrid/hackathon",
    "spain--madrid/programacion",
]
EVENTBRITE_MAX_PAGES = 5
