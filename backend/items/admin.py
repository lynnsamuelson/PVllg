from django.contrib import admin

from . import demo
from .models import Item, ItemReport


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "quantity", "owner", "pickup_date", "general_area", "paused_at", "created_at"]
    list_filter = ["category", ("paused_at", admin.EmptyFieldListFilter)]
    search_fields = ["name", "owner__username"]
    actions = ["refresh_demo_dates", "unpause"]

    @admin.action(description="Put paused items back in search")
    def unpause(self, request, queryset):
        count = queryset.filter(paused_at__isnull=False).update(paused_at=None, paused_reason="")
        self.message_user(request, f"Put {count} paused item(s) back in search.")

    @admin.action(description="Refresh demo pickup dates")
    def refresh_demo_dates(self, request, queryset):
        moved = demo.refresh_dates(queryset)
        self.message_user(request, f"Moved {moved} demo item(s) to their pickup days from today.")


@admin.register(ItemReport)
class ItemReportAdmin(admin.ModelAdmin):
    """Reports from item pages (KAN-22). Read-only: they come only from the site."""

    list_display = ["created_at", "reason", "item"]
    list_filter = ["reason"]
    list_select_related = ["item"]
    readonly_fields = ["item", "reporter", "reason", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
