from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/resources/", include("resources.urls")),
    path("api/items/", include("items.urls")),
    path("api/claims/", include("claims.urls")),
    path("api/", include("api.urls")),
]
