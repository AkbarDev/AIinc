from datetime import datetime
from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class SavedArticle(Base):
    __tablename__ = "saved_articles"
    __table_args__ = (
        UniqueConstraint("user_key", "article_id", name="uq_saved_user_article"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(128), index=True)
    article_id: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(500))
    link: Mapped[str] = mapped_column(String(1000))
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
