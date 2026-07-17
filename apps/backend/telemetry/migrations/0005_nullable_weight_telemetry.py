from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("telemetry", "0004_device_payload_fields")]

    operations = [
        migrations.AlterField(
            model_name="reading",
            name="weight",
            field=models.DecimalField(
                blank=True,
                null=True,
                decimal_places=3,
                max_digits=8,
                help_text="Measured total cylinder weight in kilograms.",
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AlterField(
            model_name="reading",
            name="gas_percentage",
            field=models.DecimalField(
                blank=True,
                null=True,
                decimal_places=2,
                max_digits=5,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0")),
                    django.core.validators.MaxValueValidator(Decimal("100")),
                ],
            ),
        ),
    ]
