from django.db.models import QuerySet

from accounts.models import User
from devices.models import Cylinder, Household, Sensor


def household_list_for(user: User) -> QuerySet[Household]:
    queryset = Household.objects.select_related("owner")
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(owner=user)
    return queryset


def cylinder_list_for(user: User) -> QuerySet[Cylinder]:
    queryset = Cylinder.objects.select_related("household", "household__owner")
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(household__owner=user)
    return queryset


def sensor_list_for(user: User) -> QuerySet[Sensor]:
    queryset = Sensor.objects.select_related(
        "cylinder", "cylinder__household", "cylinder__household__owner"
    )
    if user.role == User.Role.HOUSEHOLD:
        queryset = queryset.filter(cylinder__household__owner=user)
    return queryset
