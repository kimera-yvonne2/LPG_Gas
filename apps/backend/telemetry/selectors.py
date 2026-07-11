from django.db.models import QuerySet

from accounts.models import User
from telemetry.models import Reading


def reading_list_for(user: User) -> QuerySet[Reading]:
    queryset = Reading.objects.select_related(
        "sensor", "sensor__cylinder", "sensor__cylinder__household"
    )
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(sensor__cylinder__household__owner=user)
    return queryset
