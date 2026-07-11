from django.contrib import admin

from devices.models import Cylinder, Household, Sensor


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "phone", "number_of_people", "usage_type")
    list_filter = ("usage_type",)
    search_fields = ("name", "email", "phone", "owner__email")


@admin.register(Cylinder)
class CylinderAdmin(admin.ModelAdmin):
    list_display = ("serial_number", "household", "capacity", "gas_percentage", "status")
    list_filter = ("status", "installation_date")
    search_fields = ("serial_number", "household__name")
    readonly_fields = ("gas_percentage",)


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ("esp32_id", "cylinder", "firmware_version", "battery_level", "online_status")
    list_filter = ("online_status", "firmware_version")
    search_fields = ("esp32_id", "mac_address", "cylinder__serial_number")
