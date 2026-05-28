from pydantic import BaseModel


class WordlistRead(BaseModel):
    id: str
    label: str
    category: str
    path: str
    source: str
