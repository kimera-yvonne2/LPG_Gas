from django.db.models import QuerySet

from accounts.models import User


def user_list() -> QuerySet[User]:
    return User.objects.all().order_by("-date_joined")
