from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class RefillRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        IN_TRANSIT = "in_transit", "In Transit"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

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
    assigned_technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_refill_requests",
        limit_choices_to={"role": "technician", "is_active": True},
        blank=True,
        null=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    requested_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-requested_at",)

    def __str__(self):
        return f"{self.household} / {self.cylinder} / {self.status}"

    def clean(self):
        errors = {}
        if self.cylinder_id and self.household_id:
            if self.cylinder.household_id != self.household_id:
                errors["cylinder"] = "The cylinder must belong to the selected household."
        if self.assigned_technician_id:
            technician = self.assigned_technician
            if technician.role != "technician" or not technician.is_active:
                errors["assigned_technician"] = "The refill provider must be an active technician."
        if errors:
            raise ValidationError(errors)

    def transition_to(self, status):
        transitions = {
            self.Status.PENDING: {self.Status.ACCEPTED, self.Status.CANCELLED},
            self.Status.ACCEPTED: {self.Status.IN_TRANSIT, self.Status.CANCELLED},
            self.Status.IN_TRANSIT: {self.Status.COMPLETED, self.Status.CANCELLED},
            self.Status.COMPLETED: set(),
            self.Status.CANCELLED: set(),
        }
        if status not in transitions.get(self.status, set()):
            raise ValidationError(
                {"status": f"Cannot move a refill request from {self.status} to {status}."}
            )
        self.status = status
        return self
