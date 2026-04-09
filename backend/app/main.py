import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .crud import list_saved_articles, remove_saved_article, save_article
from .database import get_db
from .schemas import SaveArticleRequest, SavedArticleResponse

app = FastAPI(
    title="Snapfacts API",
    version="0.1.0",
    description="Open-source API layer for saved articles and user interactions.",
)

raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:8000,http://localhost:8834,http://localhost:4321,https://www.snapfacts.in")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/v1/saved", response_model=list[SavedArticleResponse])
def get_saved_articles(user_key: str = Query(..., min_length=3), db: Session = Depends(get_db)):
    return list_saved_articles(db, user_key)


@app.post("/v1/saved", response_model=SavedArticleResponse)
def create_saved_article(payload: SaveArticleRequest, db: Session = Depends(get_db)):
    return save_article(db, payload)


@app.delete("/v1/saved")
def delete_saved_article(
    user_key: str = Query(..., min_length=3),
    article_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    removed = remove_saved_article(db, user_key, article_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Saved article not found")
    return {"removed": True}
