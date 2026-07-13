import django.db.models.deletion
from django.db import migrations, models


def backfill_sensor_households(apps, schema_editor):
    Sensor = apps.get_model("devices", "Sensor")
    for sensor in Sensor.objects.select_related("cylinder").iterator():
        sensor.household_id = sensor.cylinder.household_id
        sensor.save(update_fields=("household",))


class Migration(migrations.Migration):
    dependencies = [
        ("devices", "0003_backfill_households"),
    ]

    operations = [
        migrations.AddField(
            model_name="sensor",
            name="household",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sensors",
                to="devices.household",
            ),
        ),
        migrations.AddField(
            model_name="sensor",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="sensor",
            name="cylinder",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sensor",
                to="devices.cylinder",
            ),
        ),
        migrations.AlterField(
            model_name="cylinder",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("empty", "Empty"),
                    ("disconnected", "Disconnected"),
                    ("maintenance", "Maintenance"),
                    ("retired", "Retired"),
                ],
                default="active",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_sensor_households, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="sensor",
            name="household",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sensors",
                to="devices.household",
            ),
        ),
    ]
