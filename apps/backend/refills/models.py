from django.db import models
from django.utils import timezone


class RefillRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        IN_TRANSIT = "in_transit", "In Transit"
        COMPLETED = "completed", "Completed"

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTOMATIC = "automatic", "Automatic"

    household = models.ForeignKey(
        "devices.Household",
        on_delete=models.PROTECT,
        related_name="refill_requests",
    )
    cylinder = models.ForeignKey(
        "devices.Cylinder",
        on_delete=models.PROTECT,
        related_name="refill_requests",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    requested_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-requested_at",)

    def __str__(self):
        return f"{self.household} / {self.cylinder} / {self.status}"

    def transition_to(self, status):
        if status not in self.Status.values:
            raise ValueError("Invalid refill status")
        self.status = status
        return self
