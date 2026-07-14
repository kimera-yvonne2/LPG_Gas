from typing import Any

from django.db.models import QuerySet

from accounts.models import User
from telemetry.models import Reading


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
