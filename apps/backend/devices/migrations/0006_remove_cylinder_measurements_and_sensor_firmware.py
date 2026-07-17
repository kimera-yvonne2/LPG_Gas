from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("devices", "0005_remove_cylinder_serial_number_and_capacity_choices")]

    operations = [
        migrations.RemoveField(model_name="cylinder", name="current_weight"),
        migrations.RemoveField(model_name="cylinder", name="gas_percentage"),
        migrations.RemoveField(model_name="sensor", name="firmware_version"),
    ]
