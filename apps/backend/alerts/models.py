from django.db import models
from django.db.models import Q


class Alert(models.Model):
    class Kind(models.TextChoices):
        LOW_GAS = "low_gas", "Low gas"
        EMPTY_GAS = "empty_gas", "Empty gas"
        GAS_LEAK = "gas_leak", "Gas leak"

    class Severity(models.TextChoices):
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    household = models.ForeignKey(
        "devices.Household", on_delete=models.PROTECT, related_name="alerts"
    )
    cylinder = models.ForeignKey(
        "devices.Cylinder", on_delete=models.PROTECT, related_name="alerts"
    )
    reading = models.ForeignKey(
        "telemetry.Reading", on_delete=models.PROTECT, related_name="alerts"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    severity = models.CharField(max_length=20, choices=Severity.choices)
    title = models.CharField(max_length=120)
    message = models.TextField()
    is_active = models.BooleanField(default=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("cylinder", "kind"),
                condition=Q(is_active=True),
                name="unique_active_cylinder_alert_kind",
            )
        ]
        indexes = [models.Index(fields=("household", "-created_at"), name="alert_house_time_idx")]

    def __str__(self):
        return f"{self.get_kind_display()} / cylinder {self.cylinder_id}"


class Notification(models.Model):
    class Category(models.TextChoices):
        SAFETY = "safety", "Safety"
        REFILL = "refill", "Refill"
        DEVICE = "device", "Device"
        ACCOUNT = "account", "Account"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    recipient = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="notifications"
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.INFO)
    title = models.CharField(max_length=120)
    message = models.TextField()
    target_url = models.CharField(max_length=500, default="/alerts")
    event_key = models.CharField(max_length=160)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("recipient", "event_key"),
                name="unique_recipient_notification_event",
            )
        ]
        indexes = [
            models.Index(
                fields=("recipient", "read_at", "-created_at"),
                name="notification_inbox_idx",
            )
        ]

    def __str__(self):
        return f"{self.recipient_id}: {self.title}"


class PushSubscription(models.Model):
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [models.Index(fields=("user", "is_active"), name="push_user_active_idx")]

    def __str__(self):
        return f"Push subscription {self.id} for user {self.user_id}"


class NotificationDelivery(models.Model):
    class Channel(models.TextChoices):
        WEB_PUSH = "web_push", "Web push"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    notification = models.ForeignKey(
        Notification, on_delete=models.CASCADE, related_name="deliveries"
    )
    subscription = models.ForeignKey(
        PushSubscription, on_delete=models.CASCADE, related_name="deliveries"
    )
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.WEB_PUSH)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=500, blank=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("notification", "subscription", "channel"),
                name="unique_notification_subscription_channel",
            )
        ]

    def __str__(self):
        return f"{self.notification_id}/{self.subscription_id}: {self.status}"
