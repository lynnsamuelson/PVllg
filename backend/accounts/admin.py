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
    actions = ["reset_email_check"]

    @admin.action(description="Reset email check (they start sign-up again)")
    def reset_email_check(self, request, queryset):
        count, _ = queryset.delete()
        self.message_user(request, f"Reset {count} organization(s). They can enter their details and get a code again.")
