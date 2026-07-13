from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
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


def _can_manage_household(actor: User, household: Household) -> bool:
    return actor.role == User.Role.ADMIN or household.owner_id == actor.id


@transaction.atomic
def connect_sensor(*, sensor: Sensor, cylinder: Cylinder, actor: User) -> Sensor:
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    cylinder = Cylinder.objects.select_for_update().get(pk=cylinder.pk)
    if not _can_manage_household(actor, sensor.household):
        raise PermissionDenied("You cannot manage this device.")
    if sensor.household_id != cylinder.household_id:
        raise ValidationError(
            {"cylinder": "The device and cylinder must belong to the same household."}
        )
    if cylinder.status == Cylinder.Status.RETIRED:
        raise ValidationError({"cylinder": "A retired cylinder cannot receive a device."})
    if Sensor.objects.filter(cylinder=cylinder).exclude(pk=sensor.pk).exists():
        raise ValidationError({"cylinder": "This cylinder already has a connected device."})
    if not sensor.is_active:
        raise ValidationError({"device": "An inactive device cannot be connected."})
    sensor.cylinder = cylinder
    sensor.save(update_fields=("cylinder", "updated_at"))
    return sensor


@transaction.atomic
def disconnect_sensor(*, sensor: Sensor, actor: User) -> Sensor:
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    if not _can_manage_household(actor, sensor.household):
        raise PermissionDenied("You cannot manage this device.")
    sensor.cylinder = None
    sensor.online_status = False
    sensor.save(update_fields=("cylinder", "online_status", "updated_at"))
    return sensor


@transaction.atomic
def remove_sensor(*, sensor: Sensor, actor: User) -> str:
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    if not _can_manage_household(actor, sensor.household):
        raise PermissionDenied("You cannot manage this device.")
    if sensor.readings.exists():
        sensor.cylinder = None
        sensor.is_active = False
        sensor.online_status = False
        sensor.save(update_fields=("cylinder", "is_active", "online_status", "updated_at"))
        return "deactivated"
    sensor.delete()
    return "deleted"


@transaction.atomic
def remove_cylinder(*, cylinder: Cylinder, actor: User) -> str:
    cylinder = Cylinder.objects.select_for_update().get(pk=cylinder.pk)
    if not _can_manage_household(actor, cylinder.household):
        raise PermissionDenied("You cannot manage this cylinder.")
    Sensor.objects.filter(cylinder=cylinder).update(cylinder=None, online_status=False)
    if cylinder.readings.exists() or cylinder.refill_requests.exists():
        cylinder.status = Cylinder.Status.RETIRED
        cylinder.save(update_fields=("status", "updated_at"))
        return "retired"
    cylinder.delete()
    return "deleted"


@transaction.atomic
def replace_cylinder(*, cylinder: Cylinder, actor: User, **replacement_data) -> Cylinder:
    cylinder = Cylinder.objects.select_for_update().get(pk=cylinder.pk)
    if not _can_manage_household(actor, cylinder.household):
        raise PermissionDenied("You cannot manage this cylinder.")
    if cylinder.status == Cylinder.Status.RETIRED:
        raise ValidationError({"cylinder": "This cylinder has already been retired."})
    sensor = Sensor.objects.select_for_update().filter(cylinder=cylinder).first()
    replacement = Cylinder.objects.create(
        household=cylinder.household,
        status=Cylinder.Status.ACTIVE,
        **replacement_data,
    )
    if sensor:
        sensor.cylinder = replacement
        sensor.save(update_fields=("cylinder", "updated_at"))
    cylinder.status = Cylinder.Status.RETIRED
    cylinder.save(update_fields=("status", "updated_at"))
    return replacement
