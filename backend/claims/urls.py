from django.urls import path

from . import views

urlpatterns = [
    path("", views.claims),
    path("<int:pk>/cancel/", views.cancel_claim),
]
