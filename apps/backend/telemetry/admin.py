from django.contrib import admin

from telemetry.models import Reading


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = (
        "sensor",
        "cylinder",
        "timestamp",
        "weight",
        "gas_percentage",
        "gas_leak_detected",
        "signal_strength",
    )
    list_filter = ("gas_leak_detected", "timestamp")
    search_fields = ("sensor__esp32_id", "cylinder__serial_number")
    readonly_fields = ("created_at",)
