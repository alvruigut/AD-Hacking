from fastapi import APIRouter

from app.schemas.wordlist import WordlistRead
from app.services.wordlist_service import wordlist_service

router = APIRouter()


@router.get("", response_model=list[WordlistRead])
def list_wordlists() -> list[WordlistRead]:
    return wordlist_service.list()
