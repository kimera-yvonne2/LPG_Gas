from devices.models import Cylinder, Household, Sensor
from django.contrib import admin


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("owner", "created_at", "updated_at")
    search_fields = ("owner__username", "owner__email", "owner__phone_number")


@admin.register(Cylinder)
class CylinderAdmin(admin.ModelAdmin):
    list_display = (
        "serial_number",
        "household",
        "capacity",
        "gas_percentage",
        "status",
    )
    list_filter = ("status", "installation_date")
    search_fields = ("serial_number", "household__owner__username")
    readonly_fields = ("gas_percentage",)


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = (
        "esp32_id",
        "household",
        "cylinder",
        "firmware_version",
        "battery_level",
        "is_active",
        "online_status",
    )
    list_filter = ("is_active", "online_status", "firmware_version")
    search_fields = ("esp32_id", "mac_address", "cylinder__serial_number")
