from typing import Any

from django.db.models import QuerySet

from accounts.models import User
from refills.models import RefillRequest
from telemetry.models import Reading


def reading_list_for(user: User, request: Any | None = None) -> QuerySet[Reading]:
    queryset = Reading.objects.select_related(
        "sensor", "sensor__cylinder", "sensor__cylinder__household"
    )
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(sensor__cylinder__household__owner=user)
    elif user.role == User.Role.TECHNICIAN:
        refill_request_id = None
        if request is not None:
            refill_request_id = request.query_params.get("refill_request")
        if refill_request_id is not None:
            try:
                refill_request = RefillRequest.objects.get(pk=int(refill_request_id))
            except (TypeError, ValueError, RefillRequest.DoesNotExist):
                queryset = queryset.none()
            else:
                queryset = queryset.filter(sensor__cylinder_id=refill_request.cylinder_id)
    return queryset
