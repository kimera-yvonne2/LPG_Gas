from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from alerts.models import Alert
from alerts.tasks import send_notification_email_task

LOW_GAS_THRESHOLD = Decimal("15.00")
LOW_GAS_RESET_THRESHOLD = Decimal("20.00")
EMPTY_GAS_THRESHOLD = Decimal("1.00")
EMPTY_GAS_RESET_THRESHOLD = Decimal("5.00")


def queue_email(*, subject: str, body: str, recipients: list[str]) -> None:
    recipients = [address for address in recipients if address]
    transaction.on_commit(
        lambda: send_notification_email_task.delay(subject, body, recipients), robust=True
    )


def _resolve(cylinder_id: int, kind: str) -> None:
    Alert.objects.filter(cylinder_id=cylinder_id, kind=kind, is_active=True).update(
        is_active=False, resolved_at=timezone.now()
    )


def _create(reading, *, kind: str, severity: str, title: str, message: str) -> None:
    _, created = Alert.objects.get_or_create(
        cylinder=reading.cylinder,
        kind=kind,
        is_active=True,
        defaults={
            "household": reading.cylinder.household,
            "reading": reading,
            "severity": severity,
            "title": title,
            "message": message,
        },
    )
    if created:
        queue_email(
            subject=f"LPG Guardian: {title}",
            body=f"{message}\n\nRecorded at {reading.timestamp:%Y-%m-%d %H:%M:%S %Z}.",
            recipients=[reading.cylinder.household.owner.email],
        )


def process_reading_alerts(reading) -> None:
    cylinder_id = reading.cylinder_id
    previous_percentage = (
        reading.__class__.objects.filter(cylinder_id=cylinder_id, gas_percentage__isnull=False)
        .exclude(pk=reading.pk)
        .order_by("-timestamp")
        .values_list("gas_percentage", flat=True)
        .first()
    )
    if reading.gas_leak_detected:
        _create(
            reading,
            kind=Alert.Kind.GAS_LEAK,
            severity=Alert.Severity.CRITICAL,
            title="Gas leak detected",
            message=(
                f"Cylinder #{cylinder_id} reported a gas leak. Move away from the area, "
                "avoid flames and electrical switches, and contact emergency assistance. "
                f"Sensor diagnostic value: {reading.mq2_raw}."
            ),
        )
    else:
        # A clear flag only re-arms detection. It intentionally sends no email.
        _resolve(cylinder_id, Alert.Kind.GAS_LEAK)

    percentage = reading.gas_percentage
    if percentage is None:
        return
    if percentage <= EMPTY_GAS_THRESHOLD and (
        previous_percentage is None or previous_percentage > EMPTY_GAS_THRESHOLD
    ):
        _create(
            reading,
            kind=Alert.Kind.EMPTY_GAS,
            severity=Alert.Severity.CRITICAL,
            title="Gas cylinder empty",
            message=f"Cylinder #{cylinder_id} has approximately {percentage}% gas remaining.",
        )
    elif percentage > EMPTY_GAS_RESET_THRESHOLD:
        _resolve(cylinder_id, Alert.Kind.EMPTY_GAS)

    if EMPTY_GAS_THRESHOLD < percentage <= LOW_GAS_THRESHOLD and (
        previous_percentage is None or previous_percentage > LOW_GAS_THRESHOLD
    ):
        _create(
            reading,
            kind=Alert.Kind.LOW_GAS,
            severity=Alert.Severity.WARNING,
            title="Low gas level",
            message=f"Cylinder #{cylinder_id} has {percentage}% gas remaining.",
        )
    elif percentage > LOW_GAS_RESET_THRESHOLD:
        _resolve(cylinder_id, Alert.Kind.LOW_GAS)
