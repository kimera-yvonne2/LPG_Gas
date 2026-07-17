from typing import Any

from django.db.models import DateTimeField, DecimalField, OuterRef, QuerySet, Subquery

from accounts.models import User
from devices.models import Cylinder, Household, Sensor


def household_list_for(user: User, request: Any | None = None) -> QuerySet[Household]:
    queryset = Household.objects.select_related("owner")
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(owner=user)
    elif role == User.Role.TECHNICIAN:
        queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset


def cylinder_list_for(user: User, request: Any | None = None) -> QuerySet[Cylinder]:
    from telemetry.models import Reading

    latest_reading = Reading.objects.filter(cylinder=OuterRef("pk")).order_by("-timestamp")
    queryset = Cylinder.objects.select_related("household", "household__owner").annotate(
        latest_weight=Subquery(
            latest_reading.values("weight")[:1],
            output_field=DecimalField(max_digits=8, decimal_places=3),
        ),
        latest_gas_percentage=Subquery(
            latest_reading.values("gas_percentage")[:1],
            output_field=DecimalField(max_digits=5, decimal_places=2),
        ),
        latest_reading_at=Subquery(
            latest_reading.values("timestamp")[:1], output_field=DateTimeField()
        ),
    )
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(household__owner=user).exclude(status=Cylinder.Status.RETIRED)
    elif role == User.Role.TECHNICIAN:
        queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset


def sensor_list_for(user: User, request: Any | None = None) -> QuerySet[Sensor]:
    queryset = Sensor.objects.select_related("household", "household__owner", "cylinder")
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(household__owner=user, is_active=True)
    elif role == User.Role.TECHNICIAN:
        queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset
