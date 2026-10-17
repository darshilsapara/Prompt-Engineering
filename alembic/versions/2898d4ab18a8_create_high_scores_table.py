"""create high_scores table

Revision ID: 2898d4ab18a8
Revises:
Create Date: 2026-10-17 21:41:49.052599

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2898d4ab18a8"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the high_scores table."""
    op.create_table(
        "high_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("player_name", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("level_reached", sa.Integer(), nullable=False),
        sa.Column("cars_dodged", sa.Integer(), nullable=False),
        sa.Column("coins_collected", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_high_scores_id"), "high_scores", ["id"], unique=False)


def downgrade() -> None:
    """Drop the high_scores table."""
    op.drop_index(op.f("ix_high_scores_id"), table_name="high_scores")
    op.drop_table("high_scores")
