import django_filters

from devices.models import Cylinder, Household, Sensor


class HouseholdFilter(django_filters.FilterSet):
    class Meta:
        model = Household
        fields = ()


class CylinderFilter(django_filters.FilterSet):
    capacity_min = django_filters.NumberFilter(field_name="capacity", lookup_expr="gte")
    capacity_max = django_filters.NumberFilter(field_name="capacity", lookup_expr="lte")
    installed_after = django_filters.DateFilter(field_name="installation_date", lookup_expr="gte")
    installed_before = django_filters.DateFilter(field_name="installation_date", lookup_expr="lte")

    class Meta:
        model = Cylinder
        fields = (
            "household",
            "status",
            "capacity_min",
            "capacity_max",
            "installed_after",
            "installed_before",
        )


class SensorFilter(django_filters.FilterSet):
    battery_min = django_filters.NumberFilter(field_name="battery_level", lookup_expr="gte")
    last_seen_after = django_filters.IsoDateTimeFilter(field_name="last_seen", lookup_expr="gte")

    class Meta:
        model = Sensor
        fields = (
            "household",
            "cylinder",
            "is_active",
            "online_status",
            "battery_min",
            "last_seen_after",
        )
