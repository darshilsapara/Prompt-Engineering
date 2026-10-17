from django.apps import AppConfig


class GameConfig(AppConfig):
    name = 'game'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        """Initialize SQLAlchemy tables when the Django application starts."""
        from game.db import init_db  # noqa: PLC0415
        init_db()
