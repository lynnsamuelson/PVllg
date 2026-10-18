from django.contrib import admin

from .models import Organization, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "account_type"]
    list_filter = ["account_type"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "domain", "work_email", "verified_at"]
    exclude = ["code_hash"]
