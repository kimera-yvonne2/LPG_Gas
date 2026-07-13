from accounts.models import User
from django.db.models import QuerySet
from refills.models import RefillRequest


def refill_request_list_for(user: User) -> QuerySet[RefillRequest]:
    queryset = RefillRequest.objects.select_related(
        "household",
        "household__owner",
        "cylinder",
        "assigned_technician",
    )
    role = getattr(user, "role", None)
    if role == User.Role.ADMIN:
        return queryset
    if role == User.Role.HOUSEHOLD:
        return queryset.filter(household__owner=user)
    if role == User.Role.TECHNICIAN:
        return queryset.filter(assigned_technician=user)
    return queryset.none()
