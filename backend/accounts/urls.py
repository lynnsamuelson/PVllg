from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf),
    path("me/", views.me),
    path("signup/", views.signup),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("profile/", views.person_profile),
    path("org/", views.organization),
    path("org/resend/", views.organization_resend),
    path("org/verify/", views.organization_verify),
    path("org/profile/", views.organization_profile),
]
