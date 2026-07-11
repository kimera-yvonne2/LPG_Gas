from django.contrib import admin

from telemetry.models import Reading


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = ("sensor", "timestamp", "weight", "gas_percentage", "signal_strength")
    list_filter = ("timestamp",)
    search_fields = ("sensor__esp32_id", "sensor__cylinder__serial_number")
    readonly_fields = ("created_at",)
