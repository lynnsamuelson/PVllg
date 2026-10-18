from django.contrib import admin

from . import demo
from .models import Item


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "quantity", "owner", "pickup_date", "general_area", "created_at"]
    list_filter = ["category"]
    search_fields = ["name", "owner__username"]
    actions = ["refresh_demo_dates"]

    @admin.action(description="Refresh demo pickup dates")
    def refresh_demo_dates(self, request, queryset):
        moved = demo.refresh_dates(queryset)
        self.message_user(request, f"Moved {moved} demo item(s) to their pickup days from today.")
