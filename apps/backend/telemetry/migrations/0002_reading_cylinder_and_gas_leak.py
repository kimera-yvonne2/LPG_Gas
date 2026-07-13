import django.db.models.deletion
from django.db import migrations, models


def backfill_reading_cylinders(apps, schema_editor):
    Reading = apps.get_model("telemetry", "Reading")
    for reading in Reading.objects.select_related("sensor").iterator():
        reading.cylinder_id = reading.sensor.cylinder_id
        reading.save(update_fields=("cylinder",))


class Migration(migrations.Migration):
    dependencies = [
        ("devices", "0004_device_ownership_and_cylinder_retirement"),
        ("telemetry", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="reading",
            name="cylinder",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="readings",
                to="devices.cylinder",
            ),
        ),
        migrations.AddField(
            model_name="reading",
            name="gas_leak_detected",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_reading_cylinders, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="reading",
            name="cylinder",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="readings",
                to="devices.cylinder",
            ),
        ),
    ]
