from django.db.models import QuerySet

from accounts.models import User


def user_list() -> QuerySet[User]:
    return User.objects.all().order_by("-date_joined")


def refill_provider_list() -> QuerySet[User]:
    return User.objects.filter(
        role=User.Role.TECHNICIAN,
        is_active=True,
    ).order_by("username", "id")
