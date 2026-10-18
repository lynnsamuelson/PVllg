from django.contrib import admin
from django.utils import timezone

from .models import Organization, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "account_type"]
    list_filter = ["account_type"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "domain", "work_email", "verified_at"]
    exclude = ["code_hash"]
    actions = ["mark_verified", "reset_email_check"]

    @admin.action(description="Mark verified (skip the email code)")
    def mark_verified(self, request, queryset):
        count = queryset.filter(verified_at__isnull=True).update(verified_at=timezone.now(), code_hash="", code_attempts=0)
        self.message_user(request, f"Marked {count} organization(s) verified.")

    @admin.action(description="Reset email check (they start sign-up again)")
    def reset_email_check(self, request, queryset):
        count, _ = queryset.delete()
        self.message_user(request, f"Reset {count} organization(s). They can enter their details and get a code again.")
