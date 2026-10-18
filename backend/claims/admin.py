from django.contrib import admin

from .models import Claim, PickupReport


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ["item", "claimant", "status", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["item", "claimant"]


@admin.register(PickupReport)
class PickupReportAdmin(admin.ModelAdmin):
    """Pickup problem reports (KAN-20). The team reviews every one."""

    list_display = ["created_at", "reason", "item", "note"]
    list_filter = ["reason"]
    list_select_related = ["claim__item"]
    readonly_fields = ["claim", "reason", "note", "created_at"]

    def has_add_permission(self, request):
        return False  # reports come only from families

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="Item")
    def item(self, report):
        return report.claim.item
