"""
SQLAlchemy models for the Motor Racing game.
Defines: HighScore
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from game.db import Base


class HighScore(Base):
    """
    Stores the top high scores for the Motor Racing game.
    Each record holds a player name, score value, and timestamp.
    """

    __tablename__ = "high_scores"

    id = Column(Integer, primary_key=True, index=True)
    player_name = Column(String(50), nullable=False, default="Anonymous")
    score = Column(Integer, nullable=False, default=0)
    level_reached = Column(Integer, nullable=False, default=1)
    cars_dodged = Column(Integer, nullable=False, default=0)
    coins_collected = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self):
        """Serialize model instance to a plain dictionary for JSON responses."""
        return {
            "id": self.id,
            "player_name": self.player_name,
            "score": self.score,
            "level_reached": self.level_reached,
            "cars_dodged": self.cars_dodged,
            "coins_collected": self.coins_collected,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
        }
