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
        "mq2_raw",
        "mq2_ready",
        "hx711_ok",
        "gas_leak_detected",
    )
    list_filter = ("gas_leak_detected", "timestamp")
    search_fields = ("sensor__esp32_id",)
    readonly_fields = ("created_at",)
