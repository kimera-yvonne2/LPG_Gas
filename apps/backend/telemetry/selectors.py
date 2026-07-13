from typing import Any

from accounts.models import User
from django.db.models import QuerySet
from refills.models import RefillRequest
from telemetry.models import Reading


def reading_list_for(user: User, request: Any | None = None) -> QuerySet[Reading]:
    queryset = Reading.objects.select_related(
        "sensor", "cylinder", "cylinder__household"
    )
    role = getattr(user, "role", None)
    if role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(cylinder__household__owner=user)
    elif role == User.Role.TECHNICIAN:
        refill_request_id = None
        if request is not None:
            refill_request_id = request.query_params.get("refill_request")
        if refill_request_id is not None:
            try:
                refill_request = RefillRequest.objects.get(
                    pk=int(refill_request_id),
                    assigned_technician=user,
                )
            except (TypeError, ValueError, RefillRequest.DoesNotExist):
                queryset = queryset.none()
            else:
                queryset = queryset.filter(cylinder_id=refill_request.cylinder_id)
        else:
            queryset = queryset.none()
    elif role != User.Role.ADMIN:
        queryset = queryset.none()
    return queryset
