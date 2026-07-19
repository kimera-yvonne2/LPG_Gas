from unittest.mock import patch

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from alerts.models import Notification, NotificationDelivery, PushSubscription
from alerts.services import create_notification
from alerts.tasks import send_web_push_task

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def users():
    first = User.objects.create_user(
        email="push-household@example.com",
        username="push-household",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )
    second = User.objects.create_user(
        email="push-technician@example.com",
        username="push-technician",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )
    return first, second


def make_notification(user, event_key="test:event"):
    return Notification.objects.create(
        recipient=user,
        category=Notification.Category.SAFETY,
        severity=Notification.Severity.CRITICAL,
        title="Test alert",
        message="An important event occurred.",
        target_url="/alerts",
        event_key=event_key,
    )


def test_user_lists_and_marks_only_own_notifications(api_client, users):
    first, second = users
    own = make_notification(first)
    make_notification(second, "test:other")
    api_client.force_authenticate(first)

    response = api_client.get(reverse("v1:notification-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == own.id
    assert response.data["results"][0]["is_read"] is False

    marked = api_client.post(reverse("v1:notification-mark-read", args=[own.id]))
    assert marked.status_code == 200
    assert marked.data["is_read"] is True
    assert api_client.get(reverse("v1:notification-unread-count")).data == {"count": 0}


def test_user_cannot_mark_another_users_notification(api_client, users):
    first, second = users
    other = make_notification(second)
    api_client.force_authenticate(first)

    response = api_client.post(reverse("v1:notification-mark-read", args=[other.id]))
    assert response.status_code == 404


def test_push_subscription_is_owned_by_current_user_and_can_move_on_login(api_client, users):
    first, second = users
    payload = {
        "endpoint": "https://push.example.test/subscription/1",
        "keys": {"p256dh": "public-encryption-key", "auth": "auth-secret"},
    }
    api_client.force_authenticate(first)
    first_response = api_client.post(reverse("v1:push-subscription-list"), payload, format="json")
    assert first_response.status_code == 201

    api_client.force_authenticate(second)
    second_response = api_client.post(reverse("v1:push-subscription-list"), payload, format="json")
    assert second_response.status_code == 201
    subscription = PushSubscription.objects.get(endpoint=payload["endpoint"])
    assert subscription.user == second
    assert PushSubscription.objects.filter(user=first).count() == 0


def test_web_push_config_never_exposes_private_key(api_client, users):
    first, _ = users
    api_client.force_authenticate(first)
    with override_settings(
        WEB_PUSH_VAPID_PUBLIC_KEY="safe-public-key",
        WEB_PUSH_VAPID_PRIVATE_KEY="secret-private-key",
    ):
        response = api_client.get(reverse("v1:web-push-config"))
    assert response.data == {"enabled": True, "public_key": "safe-public-key"}
    assert "private" not in response.data


def test_create_notification_is_idempotent(users):
    first, _ = users
    first_notification = create_notification(
        recipient=first,
        category=Notification.Category.REFILL,
        severity=Notification.Severity.INFO,
        title="Refill accepted",
        message="Your refill was accepted.",
        target_url="/refills",
        event_key="refill:1:accepted",
    )
    second_notification = create_notification(
        recipient=first,
        category=Notification.Category.REFILL,
        severity=Notification.Severity.INFO,
        title="Refill accepted",
        message="Your refill was accepted.",
        target_url="/refills",
        event_key="refill:1:accepted",
    )
    assert first_notification == second_notification
    assert Notification.objects.count() == 1


@override_settings(
    WEB_PUSH_VAPID_PRIVATE_KEY="private-key",
    WEB_PUSH_VAPID_SUBJECT="mailto:admin@example.com",
)
@patch("alerts.tasks.webpush")
def test_web_push_delivery_records_success(mock_webpush, users):
    first, _ = users
    notification = make_notification(first)
    subscription = PushSubscription.objects.create(
        user=first,
        endpoint="https://push.example.test/subscription/2",
        p256dh="public-encryption-key",
        auth="auth-secret",
    )
    delivery = NotificationDelivery.objects.create(
        notification=notification,
        subscription=subscription,
    )

    assert send_web_push_task(delivery.id) is True
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.SENT
    assert delivery.attempts == 1
    assert delivery.sent_at is not None
    mock_webpush.assert_called_once()
