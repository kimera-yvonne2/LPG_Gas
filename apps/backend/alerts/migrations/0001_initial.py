import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("devices", "0001_initial"), ("telemetry", "0005_nullable_weight_telemetry")]
    operations = [
        migrations.CreateModel(
            name="Alert",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("low_gas", "Low gas"),
                            ("empty_gas", "Empty gas"),
                            ("gas_leak", "Gas leak"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[("warning", "Warning"), ("critical", "Critical")], max_length=20
                    ),
                ),
                ("title", models.CharField(max_length=120)),
                ("message", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cylinder",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="alerts",
                        to="devices.cylinder",
                    ),
                ),
                (
                    "household",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="alerts",
                        to="devices.household",
                    ),
                ),
                (
                    "reading",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="alerts",
                        to="telemetry.reading",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
                "indexes": [
                    models.Index(fields=["household", "-created_at"], name="alert_house_time_idx")
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="alert",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True)),
                fields=("cylinder", "kind"),
                name="unique_active_cylinder_alert_kind",
            ),
        ),
    ]
