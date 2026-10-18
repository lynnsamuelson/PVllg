from django.urls import path

from . import views

urlpatterns = [
    path("", views.claims),
    path("<int:pk>/", views.claim_detail),
    path("<int:pk>/calendar.ics", views.claim_calendar),
    path("<int:pk>/cancel/", views.cancel_claim),
    path("<int:pk>/approve/", views.approve_claim),
    path("<int:pk>/decline/", views.decline_claim),
    path("<int:pk>/picked-up/", views.picked_up),
    path("<int:pk>/didnt-come/", views.didnt_come),
]
