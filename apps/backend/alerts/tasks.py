import json

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from pywebpush import WebPushException, webpush

from alerts.models import NotificationDelivery


@shared_task
def send_web_push_task(delivery_id: int) -> bool:
    delivery = (
        NotificationDelivery.objects.select_related("notification", "subscription")
        .filter(pk=delivery_id)
        .first()
    )
    if delivery is None or delivery.status == NotificationDelivery.Status.SENT:
        return False

    private_key = settings.WEB_PUSH_VAPID_PRIVATE_KEY
    if not private_key:
        delivery.status = NotificationDelivery.Status.FAILED
        delivery.last_error = "Web Push is not configured."
        delivery.attempts += 1
        delivery.save(update_fields=("status", "last_error", "attempts", "updated_at"))
        return False

    notification = delivery.notification
    subscription = delivery.subscription
    payload = json.dumps(
        {
            "notification_id": notification.id,
            "title": notification.title,
            "body": notification.message,
            "url": notification.target_url,
            "severity": notification.severity,
            "tag": notification.event_key,
        }
    )
    delivery.attempts += 1
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
            ttl=300 if notification.severity == "critical" else 86400,
        )
    except WebPushException as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        if status_code in {404, 410}:
            subscription.is_active = False
            subscription.save(update_fields=("is_active", "updated_at"))
        delivery.status = NotificationDelivery.Status.FAILED
        delivery.last_error = f"Push service rejected delivery ({status_code or 'unknown'})."
        delivery.save(update_fields=("status", "last_error", "attempts", "updated_at"))
        return False

    delivery.status = NotificationDelivery.Status.SENT
    delivery.sent_at = timezone.now()
    delivery.last_error = ""
    delivery.save(update_fields=("status", "sent_at", "last_error", "attempts", "updated_at"))
    return True
