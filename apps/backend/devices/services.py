from django.db import transaction

from devices.models import Cylinder, Household, Sensor


@transaction.atomic
def create_household(**data) -> Household:
    return Household.objects.create(**data)


@transaction.atomic
def create_cylinder(**data) -> Cylinder:
    return Cylinder.objects.create(**data)


@transaction.atomic
def update_cylinder(*, instance: Cylinder, **data) -> Cylinder:
    for field, value in data.items():
        setattr(instance, field, value)
    instance.save()
    return instance


@transaction.atomic
def create_sensor(**data) -> Sensor:
    return Sensor.objects.create(**data)
