from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("refills", "0002_refillrequest_assigned_technician"),
    ]

    operations = [
        migrations.AlterField(
            model_name="refillrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("in_transit", "In Transit"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
