from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("devices", "0006_remove_cylinder_measurements_and_sensor_firmware")]

    operations = [
        migrations.AlterField(
            model_name="sensor",
            name="household",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sensors",
                to="devices.household",
            ),
        ),
        migrations.AlterField(
            model_name="sensor",
            name="mac_address",
            field=models.CharField(
                blank=True,
                max_length=17,
                null=True,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Enter a MAC address in AA:BB:CC:DD:EE:FF format.",
                        regex="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$",
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="sensor",
            name="battery_level",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("100.00"),
                max_digits=5,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0")),
                    django.core.validators.MaxValueValidator(Decimal("100")),
                ],
            ),
        ),
        migrations.AddField(
            model_name="sensor",
            name="device_secret_hash",
            field=models.CharField(default="!", max_length=128),
        ),
        migrations.AddField(
            model_name="sensor",
            name="claim_code_digest",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="sensor",
            name="claim_code_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sensor",
            name="claimed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sensor",
            name="provisioned_at",
            field=models.DateTimeField(auto_now_add=True),
        ),
    ]
