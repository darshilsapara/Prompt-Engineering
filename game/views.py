"""
Django views for the Motor Racing game.
Handles:
  - GET  /           → serve the main game page (index.html)
  - GET  /api/scores/ → return top 10 high scores as JSON
  - POST /api/scores/ → submit a new high score
"""

import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from game.db import SessionLocal, init_db
from game.models import HighScore


# Ensure tables exist on first import
init_db()


def index(request):
    """Render the main game page."""
    return render(request, "game/index.html")


@require_http_methods(["GET"])
def get_scores(request):
    """
    Return the top 10 high scores ordered by score descending.
    Response: { "scores": [ { ...score fields... }, ... ] }
    """
    db = SessionLocal()
    try:
        scores = (
            db.query(HighScore)
            .order_by(HighScore.score.desc())
            .limit(10)
            .all()
        )
        return JsonResponse({"scores": [s.to_dict() for s in scores]})
    finally:
        db.close()


@csrf_exempt
@require_http_methods(["POST"])
def post_score(request):
    """
    Save a new high score entry.
    Request body (JSON):
      {
        "player_name": str,
        "score": int,
        "level_reached": int,
        "cars_dodged": int,
        "coins_collected": int
      }
    Response: { "success": true, "entry": { ...saved fields... } }
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    player_name = str(data.get("player_name", "Anonymous"))[:50]
    score = int(data.get("score", 0))
    level_reached = int(data.get("level_reached", 1))
    cars_dodged = int(data.get("cars_dodged", 0))
    coins_collected = int(data.get("coins_collected", 0))

    db = SessionLocal()
    try:
        entry = HighScore(
            player_name=player_name,
            score=score,
            level_reached=level_reached,
            cars_dodged=cars_dodged,
            coins_collected=coins_collected,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return JsonResponse({"success": True, "entry": entry.to_dict()}, status=201)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return JsonResponse({"error": str(exc)}, status=500)
    finally:
        db.close()
