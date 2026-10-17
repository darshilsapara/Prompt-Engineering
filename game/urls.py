"""URL routes for the game app."""

from django.urls import path
from game import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/scores/", views.get_scores, name="get_scores"),
    path("api/scores/submit/", views.post_score, name="post_score"),
]
