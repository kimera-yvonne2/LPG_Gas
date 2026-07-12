from django.db import migrations, models


def migrate_service_providers(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="service_provider").update(role="technician")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_authentication_module")]

    operations = [
        migrations.RunPython(migrate_service_providers, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("household", "Household"),
                    ("technician", "Technician"),
                ],
                default="household",
                max_length=20,
            ),
        ),
    ]
