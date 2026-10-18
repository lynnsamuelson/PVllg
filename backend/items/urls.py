from django.urls import path

from . import views

urlpatterns = [
    path("", views.post_item),
    path("photos/<int:pk>/", views.item_photo),
]
