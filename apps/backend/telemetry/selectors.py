from typing import Any

from django.db.models import QuerySet

from accounts.models import User
from telemetry.models import DepletionEstimate, Reading


def reading_list_for(user: User, request: Any | None = None) -> QuerySet[Reading]:
    queryset = Reading.objects.select_related("sensor", "cylinder", "cylinder__household")
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(cylinder__household__owner=user)
    elif role == User.Role.TECHNICIAN:
        queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset


def depletion_estimate_list_for(user: User) -> QuerySet[DepletionEstimate]:
    queryset = DepletionEstimate.objects.select_related(
        "cylinder",
        "cylinder__household",
        "cylinder__household__owner",
    )

    role = getattr(user, "role", None)

    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(cylinder__household__owner=user)
    elif role == User.Role.ADMIN:
        pass
    else:
        queryset = queryset.none()

    return queryset
