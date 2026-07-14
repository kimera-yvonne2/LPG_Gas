from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("refills", "0003_alter_refillrequest_status"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="refillrequest",
            name="cylinder",
        ),
    ]
