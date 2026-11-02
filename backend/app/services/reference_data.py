"""External vocabularies. Lexicomp is not called unless a URL is configured."""

import httpx
from fastapi import HTTPException, status

from app.clinical_sections import CPT_CODES
from app.core.config import settings

_ICD_URL = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
_RXNAV_URL = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json"


async def search_icd10(term: str) -> list[dict[str, str]]:
    query = term.strip()
    if len(query) < 2:
        return []
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(_ICD_URL, params={"sf": "code,name", "terms": query, "maxList": 25})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ICD-10 search is unavailable right now.") from exc
    codes = payload[1] if isinstance(payload, list) and len(payload) > 3 else []
    names = payload[3] if isinstance(payload, list) and len(payload) > 3 else []
    results = []
    for code, name in zip(codes, names, strict=False):
        label = name[0] if isinstance(name, list) and name else str(name)
        results.append({"code": str(code), "label": label})
    return results


async def search_medications(term: str) -> list[dict[str, str]]:
    query = term.strip()
    if len(query) < 2:
        return []
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(_RXNAV_URL, params={"term": query, "maxEntries": 20})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Medication search is unavailable. The Lexicomp catalog is not connected.",
        ) from exc
    candidates = payload.get("approximateGroup", {}).get("candidate") or []
    seen: set[str] = set()
    results = []
    for item in candidates:
        name = (item.get("name") or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        results.append({"name": name, "rxcui": item.get("rxcui") or ""})
    return results


def search_cpt(term: str) -> list[dict[str, str]]:
    query = term.strip().lower()
    rows = CPT_CODES
    if query:
        rows = [row for row in rows if query in row["code"].lower() or query in row["label"].lower()]
    return rows


def lexicomp_status() -> dict:
    url = (settings.LEXICOMP_URL or "").strip()
    if not url:
        return {
            "configured": False,
            "url": None,
            "detail": "Interaction checking uses the university Lexicomp subscription. An administrator still needs to set LEXICOMP_URL.",
        }
    return {"configured": True, "url": url, "detail": "Open Lexicomp to check interactions. This chart does not score them."}
