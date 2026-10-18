from django.urls import path

from . import views

urlpatterns = [
    path("", views.post_item),
    path("<int:pk>/", views.item_detail),
    path("<int:pk>/report/", views.report_item),
    path("search/", views.search_items),
    path("mine/", views.my_items),
    path("mine/<int:pk>/", views.my_item),
    path("mine/<int:pk>/available/", views.item_available),
    path("photos/<int:pk>/", views.item_photo),
]
