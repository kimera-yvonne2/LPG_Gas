from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("devices", "0004_device_ownership_and_cylinder_retirement")]

    operations = [
        migrations.RemoveField(model_name="cylinder", name="serial_number"),
        migrations.AlterField(
            model_name="cylinder",
            name="capacity",
            field=models.DecimalField(
                choices=((Decimal("3.000"), "3 kg"), (Decimal("6.000"), "6 kg")),
                decimal_places=3,
                help_text="Usable LPG capacity in kilograms.",
                max_digits=8,
            ),
        ),
        migrations.AlterModelOptions(
            name="cylinder",
            options={"ordering": ("-created_at",)},
        ),
    ]
