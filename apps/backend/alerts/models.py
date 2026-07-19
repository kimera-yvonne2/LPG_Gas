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
