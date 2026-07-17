import django.core.validators
from django.db import migrations, models

import telemetry.models


def backfill_message_ids(apps, schema_editor):
    Reading = apps.get_model("telemetry", "Reading")
    for reading in Reading.objects.only("id").iterator():
        reading.message_id = f"legacy-{reading.id}"
        reading.save(update_fields=("message_id",))


class Migration(migrations.Migration):
    dependencies = [("telemetry", "0003_depletionestimate")]

    operations = [
        migrations.RemoveField(model_name="reading", name="temperature"),
        migrations.RemoveField(model_name="reading", name="signal_strength"),
        migrations.AddField(
            model_name="reading",
            name="message_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="reading",
            name="mq2_raw",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Raw 12-bit MQ-2 ADC reading reported by the device.",
                validators=[django.core.validators.MaxValueValidator(4095)],
            ),
        ),
        migrations.AddField(
            model_name="reading",
            name="mq2_ready",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="reading",
            name="hx711_ok",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_message_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="reading",
            name="message_id",
            field=models.CharField(
                default=telemetry.models.generate_message_id, max_length=100, unique=True
            ),
        ),
    ]
