import json

from django.test import Client, TestCase

from game.db import SessionLocal
from game.models import HighScore


class ScoreAPITestCase(TestCase):
    """API tests for the high-score leaderboard."""

    def setUp(self):
        self.client = Client()
        db = SessionLocal()
        try:
            db.query(HighScore).delete()
            db.commit()
        finally:
            db.close()

    def test_index_returns_200(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "NEON")

    def test_get_scores_empty(self):
        response = self.client.get("/api/scores/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("scores", data)
        self.assertIsInstance(data["scores"], list)

    def test_post_score_submit(self):
        payload = {
            "player_name": "TestRacer",
            "score": 420,
            "level_reached": 2,
            "cars_dodged": 7,
            "coins_collected": 4,
        }
        response = self.client.post(
            "/api/scores/submit/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["entry"]["player_name"], "TestRacer")
        self.assertEqual(body["entry"]["score"], 420)

        listed = self.client.get("/api/scores/").json()["scores"]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["score"], 420)

    def test_post_score_invalid_json(self):
        response = self.client.post(
            "/api/scores/submit/",
            data="not-json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
