import django_filters

from devices.models import Cylinder, Household, Sensor


class HouseholdFilter(django_filters.FilterSet):
    people_min = django_filters.NumberFilter(field_name="number_of_people", lookup_expr="gte")
    people_max = django_filters.NumberFilter(field_name="number_of_people", lookup_expr="lte")

    class Meta:
        model = Household
        fields = ("usage_type", "people_min", "people_max")


class CylinderFilter(django_filters.FilterSet):
    capacity_min = django_filters.NumberFilter(field_name="capacity", lookup_expr="gte")
    capacity_max = django_filters.NumberFilter(field_name="capacity", lookup_expr="lte")
    gas_percentage_min = django_filters.NumberFilter(field_name="gas_percentage", lookup_expr="gte")
    gas_percentage_max = django_filters.NumberFilter(field_name="gas_percentage", lookup_expr="lte")
    installed_after = django_filters.DateFilter(field_name="installation_date", lookup_expr="gte")
    installed_before = django_filters.DateFilter(field_name="installation_date", lookup_expr="lte")

    class Meta:
        model = Cylinder
        fields = (
            "household",
            "status",
            "capacity_min",
            "capacity_max",
            "gas_percentage_min",
            "gas_percentage_max",
            "installed_after",
            "installed_before",
        )


class SensorFilter(django_filters.FilterSet):
    battery_min = django_filters.NumberFilter(field_name="battery_level", lookup_expr="gte")
    last_seen_after = django_filters.IsoDateTimeFilter(field_name="last_seen", lookup_expr="gte")

    class Meta:
        model = Sensor
        fields = ("cylinder", "online_status", "firmware_version", "battery_min", "last_seen_after")
