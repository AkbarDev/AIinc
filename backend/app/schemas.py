from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field


class SaveArticleRequest(BaseModel):
    user_key: str = Field(min_length=3, max_length=128)
    article_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=500)
    link: HttpUrl
    category: str | None = Field(default=None, max_length=120)


class SavedArticleResponse(BaseModel):
    id: int
    user_key: str
    article_id: str
    title: str
    link: str
    category: str | None
    saved_at: datetime

    model_config = {"from_attributes": True}
