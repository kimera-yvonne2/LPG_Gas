from typing import Any

from django.db.models import QuerySet

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from refills.models import RefillRequest


def _refill_request_from_request(request: Any | None, technician: User) -> RefillRequest | None:
    if request is None:
        return None
    refill_request_id = request.query_params.get("refill_request")
    if refill_request_id is None:
        return None
    try:
        return RefillRequest.objects.select_related("household", "cylinder").get(
            pk=int(refill_request_id),
            assigned_technician=technician,
        )
    except (TypeError, ValueError, RefillRequest.DoesNotExist):
        return None


def household_list_for(user: User, request: Any | None = None) -> QuerySet[Household]:
    queryset = Household.objects.select_related("owner")
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(owner=user)
    elif role == User.Role.TECHNICIAN:
        refill_request = _refill_request_from_request(request, user)
        if refill_request is not None:
            queryset = queryset.filter(pk=refill_request.household_id)
        else:
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
        refill_request = _refill_request_from_request(request, user)
        if refill_request is not None:
            queryset = queryset.filter(pk=refill_request.cylinder_id)
        else:
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
        refill_request = _refill_request_from_request(request, user)
        if refill_request is not None:
            queryset = queryset.filter(cylinder_id=refill_request.cylinder_id)
        else:
            queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset
