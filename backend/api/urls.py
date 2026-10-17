from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("notes", views.NoteViewSet)

urlpatterns = [
    path("health/", views.health),
    path("", include(router.urls)),
]
