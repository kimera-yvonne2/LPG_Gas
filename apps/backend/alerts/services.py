from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from alerts.models import Alert, Notification, NotificationDelivery, PushSubscription
from alerts.tasks import send_web_push_task

LOW_GAS_THRESHOLD = Decimal("15.00")
LOW_GAS_RESET_THRESHOLD = Decimal("20.00")
EMPTY_GAS_THRESHOLD = Decimal("1.00")
EMPTY_GAS_RESET_THRESHOLD = Decimal("5.00")


def create_notification(
    *,
    recipient,
    category: str,
    severity: str,
    title: str,
    message: str,
    target_url: str,
    event_key: str,
) -> Notification:
    """Persist an inbox item and queue one delivery for each active browser."""

    notification, created = Notification.objects.get_or_create(
        recipient=recipient,
        event_key=event_key,
        defaults={
            "category": category,
            "severity": severity,
            "title": title,
            "message": message,
            "target_url": target_url,
        },
    )
    if not created:
        return notification

    subscription_ids = PushSubscription.objects.filter(user=recipient, is_active=True).values_list(
        "id", flat=True
    )
    deliveries = NotificationDelivery.objects.bulk_create(
        [
            NotificationDelivery(notification=notification, subscription_id=subscription_id)
            for subscription_id in subscription_ids
        ]
    )
    for delivery in deliveries:
        transaction.on_commit(
            lambda delivery_id=delivery.id: send_web_push_task(delivery_id),
            robust=True,
        )
    return notification


def _resolve(cylinder_id: int, kind: str) -> None:
    Alert.objects.filter(cylinder_id=cylinder_id, kind=kind, is_active=True).update(
        is_active=False, resolved_at=timezone.now()
    )


def _create(reading, *, kind: str, severity: str, title: str, message: str) -> None:
    alert, created = Alert.objects.get_or_create(
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
        owner = reading.cylinder.household.owner
        create_notification(
            recipient=owner,
            category=Notification.Category.SAFETY,
            severity=severity,
            title=title,
            message=message,
            target_url="/alerts",
            event_key=f"alert:{alert.id}:created",
        )
        if severity == Alert.Severity.CRITICAL:
            from accounts.models import User

            for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True).iterator():
                create_notification(
                    recipient=admin,
                    category=Notification.Category.SAFETY,
                    severity=Notification.Severity.CRITICAL,
                    title=title,
                    message=message,
                    target_url="/alerts",
                    event_key=f"alert:{alert.id}:created",
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
        # A clear flag only re-arms detection and does not create a notification.
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
