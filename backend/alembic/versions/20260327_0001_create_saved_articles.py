"""create saved articles table"""

from alembic import op
import sqlalchemy as sa

revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_articles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_key", sa.String(length=128), nullable=False),
        sa.Column("article_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("link", sa.String(length=1000), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_key", "article_id", name="uq_saved_user_article"),
    )
    op.create_index("ix_saved_articles_id", "saved_articles", ["id"], unique=False)
    op.create_index("ix_saved_articles_user_key", "saved_articles", ["user_key"], unique=False)
    op.create_index("ix_saved_articles_article_id", "saved_articles", ["article_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_articles_article_id", table_name="saved_articles")
    op.drop_index("ix_saved_articles_user_key", table_name="saved_articles")
    op.drop_index("ix_saved_articles_id", table_name="saved_articles")
    op.drop_table("saved_articles")
