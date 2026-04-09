from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import SavedArticle
from .schemas import SaveArticleRequest


def list_saved_articles(db: Session, user_key: str):
    stmt = (
        select(SavedArticle)
        .where(SavedArticle.user_key == user_key)
        .order_by(SavedArticle.saved_at.desc())
    )
    return list(db.scalars(stmt).all())


def save_article(db: Session, payload: SaveArticleRequest):
    stmt = select(SavedArticle).where(
        SavedArticle.user_key == payload.user_key,
        SavedArticle.article_id == payload.article_id,
    )
    existing = db.scalar(stmt)
    if existing:
        return existing

    item = SavedArticle(
        user_key=payload.user_key,
        article_id=payload.article_id,
        title=payload.title,
        link=str(payload.link),
        category=payload.category,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def remove_saved_article(db: Session, user_key: str, article_id: str):
    stmt = delete(SavedArticle).where(
        SavedArticle.user_key == user_key,
        SavedArticle.article_id == article_id,
    )
    result = db.execute(stmt)
    db.commit()
    return result.rowcount > 0
