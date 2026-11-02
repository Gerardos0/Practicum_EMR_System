from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.services.reference_data import lexicomp_status, search_cpt, search_icd10, search_medications

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/icd10")
async def icd10(user: CurrentUser, q: Annotated[str, Query()] = ""):
    return await search_icd10(q)


@router.get("/medications")
async def medications(user: CurrentUser, q: Annotated[str, Query()] = ""):
    return await search_medications(q)


@router.get("/cpt")
async def cpt(user: CurrentUser, q: Annotated[str, Query()] = ""):
    return search_cpt(q)


@router.get("/lexicomp")
async def lexicomp(user: CurrentUser):
    return lexicomp_status()
