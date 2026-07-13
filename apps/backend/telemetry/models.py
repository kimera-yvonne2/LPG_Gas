from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from devices.models import Cylinder, Sensor


class Reading(models.Model):
    sensor = models.ForeignKey(Sensor, on_delete=models.PROTECT, related_name="readings")
    cylinder = models.ForeignKey(Cylinder, on_delete=models.PROTECT, related_name="readings")
    timestamp = models.DateTimeField(default=timezone.now)
    weight = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Measured total cylinder weight in kilograms.",
    )
    gas_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    temperature = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("-40")), MaxValueValidator(Decimal("125"))],
        help_text="Sensor temperature in degrees Celsius.",
    )
    signal_strength = models.SmallIntegerField(
        validators=[MinValueValidator(-120), MaxValueValidator(0)],
        help_text="Wi-Fi RSSI in dBm.",
    )
    gas_leak_detected = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-timestamp",)
        constraints = [
            models.UniqueConstraint(
                fields=("sensor", "timestamp"), name="unique_sensor_reading_timestamp"
            )
        ]
        indexes = [
            models.Index(fields=("sensor", "-timestamp"), name="reading_sensor_time_idx"),
            models.Index(fields=("timestamp",), name="reading_time_idx"),
        ]

    def __str__(self):
        return f"{self.sensor.esp32_id} at {self.timestamp.isoformat()}"

    def save(self, *args, **kwargs):
        if not self.cylinder_id:
            raise ValidationError({"cylinder": "A reading must belong to a cylinder."})
        self.gas_percentage = self.calculate_gas_percentage()
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        if self.timestamp and self.timestamp > timezone.now():
            raise ValidationError({"timestamp": "Reading timestamp cannot be in the future."})

        cylinder = self.cylinder if self.cylinder_id else None
        if self.sensor_id and cylinder:
            if self.sensor.household_id != cylinder.household_id:
                raise ValidationError(
                    {"cylinder": "The reading cylinder must belong to the device household."}
                )
        if cylinder and self.weight is not None:
            if self.weight < cylinder.empty_weight:
                raise ValidationError(
                    {"weight": "Reading weight cannot be below cylinder empty weight."}
                )
            maximum = cylinder.empty_weight + cylinder.capacity
            if self.weight > maximum:
                raise ValidationError({"weight": "Reading weight exceeds the cylinder capacity."})

    def calculate_gas_percentage(self):
        cylinder = self.cylinder
        gas_weight = max(self.weight - cylinder.empty_weight, Decimal("0"))
        percentage = (gas_weight / cylinder.capacity) * Decimal("100")
        return min(percentage, Decimal("100")).quantize(Decimal("0.01"))
