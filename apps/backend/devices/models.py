from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone


class Household(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="household",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("owner__username",)

    def __str__(self):
        return self.owner.username


class Cylinder(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EMPTY = "empty", "Empty"
        DISCONNECTED = "disconnected", "Disconnected"
        MAINTENANCE = "maintenance", "Maintenance"
        RETIRED = "retired", "Retired"

    household = models.ForeignKey(Household, on_delete=models.PROTECT, related_name="cylinders")
    capacity = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        choices=((Decimal("3.000"), "3 kg"), (Decimal("6.000"), "6 kg")),
        help_text="Usable LPG capacity in kilograms.",
    )
    empty_weight = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Cylinder tare weight in kilograms.",
    )
    installation_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("household", "status"), name="cylinder_owner_status_idx"),
            models.Index(fields=("installation_date",), name="cylinder_install_idx"),
        ]

    def __str__(self):
        return f"Cylinder {self.pk or 'new'} ({self.capacity} kg)"

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.installation_date and self.installation_date > timezone.localdate():
            errors["installation_date"] = "Installation date cannot be in the future."
        if errors:
            raise ValidationError(errors)

class Sensor(models.Model):
    mac_address_validator = RegexValidator(
        regex=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$",
        message="Enter a MAC address in AA:BB:CC:DD:EE:FF format.",
    )

    household = models.ForeignKey(
        Household, on_delete=models.PROTECT, related_name="sensors", blank=True, null=True
    )
    cylinder = models.OneToOneField(
        Cylinder,
        on_delete=models.SET_NULL,
        related_name="sensor",
        blank=True,
        null=True,
    )
    esp32_id = models.CharField(max_length=100, unique=True)
    mac_address = models.CharField(
        max_length=17, unique=True, validators=[mac_address_validator], blank=True, null=True
    )
    battery_level = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("100.00"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    online_status = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    device_secret_hash = models.CharField(max_length=128, default="!")
    claim_code_digest = models.CharField(max_length=64, blank=True)
    claim_code_expires_at = models.DateTimeField(blank=True, null=True)
    claimed_at = models.DateTimeField(blank=True, null=True)
    provisioned_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("esp32_id",)
        indexes = [
            models.Index(fields=("online_status", "last_seen"), name="sensor_online_seen_idx")
        ]

    def __str__(self):
        return self.esp32_id

    def save(self, *args, **kwargs):
        if self.mac_address:
            self.mac_address = self.mac_address.upper()
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.last_seen and self.last_seen > timezone.now():
            errors["last_seen"] = "Last seen cannot be in the future."
        if self.cylinder_id and not self.household_id:
            errors["cylinder"] = "An unclaimed device cannot be connected to a cylinder."
        elif self.cylinder_id and self.household_id:
            if self.cylinder.household_id != self.household_id:
                errors["cylinder"] = "The device and cylinder must belong to the same household."
            if self.cylinder.status == Cylinder.Status.RETIRED:
                errors["cylinder"] = "A device cannot be connected to a retired cylinder."
        if errors:
            raise ValidationError(errors)
