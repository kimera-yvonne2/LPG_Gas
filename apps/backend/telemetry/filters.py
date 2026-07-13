import django_filters

from telemetry.models import Reading


class ReadingFilter(django_filters.FilterSet):
    timestamp_after = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="gte")
    timestamp_before = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="lte")
    weight_min = django_filters.NumberFilter(field_name="weight", lookup_expr="gte")
    weight_max = django_filters.NumberFilter(field_name="weight", lookup_expr="lte")
    gas_percentage_min = django_filters.NumberFilter(field_name="gas_percentage", lookup_expr="gte")
    gas_percentage_max = django_filters.NumberFilter(field_name="gas_percentage", lookup_expr="lte")

    class Meta:
        model = Reading
        fields = (
            "sensor",
            "cylinder",
            "gas_leak_detected",
            "timestamp_after",
            "timestamp_before",
            "weight_min",
            "weight_max",
            "gas_percentage_min",
            "gas_percentage_max",
        )
