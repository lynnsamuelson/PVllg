from django.contrib import admin

from .models import Claim


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ["item", "claimant", "status", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["item", "claimant"]
