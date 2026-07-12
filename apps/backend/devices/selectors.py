from typing import Any

from django.db.models import QuerySet

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from refills.models import RefillRequest


def _refill_request_from_request(request: Any | None) -> RefillRequest | None:
    if request is None:
        return None
    refill_request_id = request.query_params.get("refill_request")
    if refill_request_id is None:
        return None
    try:
        return RefillRequest.objects.select_related("household", "cylinder").get(
            pk=int(refill_request_id)
        )
    except (TypeError, ValueError, RefillRequest.DoesNotExist):
        return None


def household_list_for(user: User, request: Any | None = None) -> QuerySet[Household]:
    queryset = Household.objects.select_related("owner")
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(owner=user)
    elif user.role == User.Role.TECHNICIAN:
        refill_request = _refill_request_from_request(request)
        if refill_request is not None:
            queryset = queryset.filter(pk=refill_request.household_id)
    return queryset


def cylinder_list_for(user: User, request: Any | None = None) -> QuerySet[Cylinder]:
    queryset = Cylinder.objects.select_related("household", "household__owner")
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(household__owner=user)
    elif user.role == User.Role.TECHNICIAN:
        refill_request = _refill_request_from_request(request)
        if refill_request is not None:
            queryset = queryset.filter(pk=refill_request.cylinder_id)
    return queryset


def sensor_list_for(user: User, request: Any | None = None) -> QuerySet[Sensor]:
    queryset = Sensor.objects.select_related(
        "cylinder", "cylinder__household", "cylinder__household__owner"
    )
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(cylinder__household__owner=user)
    elif user.role == User.Role.TECHNICIAN:
        refill_request = _refill_request_from_request(request)
        if refill_request is not None:
            queryset = queryset.filter(cylinder_id=refill_request.cylinder_id)
    return queryset
