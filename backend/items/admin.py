from django.contrib import admin

from .models import Item


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "quantity", "owner", "pickup_date", "general_area", "created_at"]
    list_filter = ["category"]
    search_fields = ["name", "owner__username"]
