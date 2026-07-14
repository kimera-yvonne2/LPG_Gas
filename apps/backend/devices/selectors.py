from typing import Any

from django.db.models import QuerySet

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
    queryset = Cylinder.objects.select_related("household", "household__owner")
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
