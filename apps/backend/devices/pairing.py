import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from devices.models import Household, Sensor

PAIRING_CODE_TTL = timedelta(minutes=10)


def claim_code_digest(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


@transaction.atomic
def provision_device(*, device_id: str, mac_address: str | None = None):
    if Sensor.objects.filter(esp32_id=device_id).exists():
        raise ValidationError({"device_id": "This device has already been provisioned."})
    secret = secrets.token_urlsafe(32)
    sensor = Sensor.objects.create(
        esp32_id=device_id,
        mac_address=mac_address or None,
        device_secret_hash=make_password(secret),
    )
    return sensor, secret


@transaction.atomic
def issue_pairing_code(sensor: Sensor):
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    if sensor.household_id:
        sensor.claim_code_digest = ""
        sensor.claim_code_expires_at = None
        sensor.save(update_fields=("claim_code_digest", "claim_code_expires_at", "updated_at"))
        return None
    code = f"{secrets.randbelow(1_000_000):06d}"
    sensor.claim_code_digest = claim_code_digest(code)
    sensor.claim_code_expires_at = timezone.now() + PAIRING_CODE_TTL
    sensor.save(update_fields=("claim_code_digest", "claim_code_expires_at", "updated_at"))
    return code


@transaction.atomic
def claim_device(*, code: str, actor: User, household: Household | None = None):
    if actor.role == User.Role.HOUSEHOLD:
        try:
            household = actor.household
        except Household.DoesNotExist:
            raise ValidationError(
                {"household": "Your household has not been provisioned."}
            ) from None
    elif actor.role == User.Role.ADMIN:
        if household is None:
            raise ValidationError({"household": "Select the household receiving this device."})
    else:
        raise PermissionDenied("You cannot claim monitoring devices.")

    sensor = (
        Sensor.objects.select_for_update()
        .filter(
            claim_code_digest=claim_code_digest(code),
            claim_code_expires_at__gt=timezone.now(),
            household__isnull=True,
            is_active=True,
        )
        .first()
    )
    if sensor is None:
        raise ValidationError({"pairing_code": "The pairing code is invalid or expired."})
    sensor.household = household
    sensor.claimed_at = timezone.now()
    sensor.claim_code_digest = ""
    sensor.claim_code_expires_at = None
    sensor.save(
        update_fields=(
            "household",
            "claimed_at",
            "claim_code_digest",
            "claim_code_expires_at",
            "updated_at",
        )
    )
    return sensor


@transaction.atomic
def unpair_device(*, sensor: Sensor, actor: User):
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    if actor.role != User.Role.ADMIN and (
        actor.role != User.Role.HOUSEHOLD
        or sensor.household_id is None
        or sensor.household.owner_id != actor.id
    ):
        raise PermissionDenied("You cannot unpair this device.")
    sensor.household = None
    sensor.cylinder = None
    sensor.claimed_at = None
    sensor.claim_code_digest = ""
    sensor.claim_code_expires_at = None
    sensor.online_status = False
    sensor.save(
        update_fields=(
            "household",
            "cylinder",
            "claimed_at",
            "claim_code_digest",
            "claim_code_expires_at",
            "online_status",
            "updated_at",
        )
    )
    return sensor
