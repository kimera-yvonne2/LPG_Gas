import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("refills", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="refillrequest",
            name="assigned_technician",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={"is_active": True, "role": "technician"},
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="assigned_refill_requests",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
