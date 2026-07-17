from django.contrib import admin

from devices.models import Cylinder, Household, Sensor


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("owner", "created_at", "updated_at")
    search_fields = ("owner__username", "owner__email", "owner__phone_number")


@admin.register(Cylinder)
class CylinderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "household",
        "capacity",
        "status",
    )
    list_filter = ("status", "installation_date")
    search_fields = ("household__owner__username",)


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = (
        "esp32_id",
        "household",
        "cylinder",
        "battery_level",
        "is_active",
        "online_status",
    )
    list_filter = ("is_active", "online_status")
    search_fields = ("esp32_id", "mac_address")
