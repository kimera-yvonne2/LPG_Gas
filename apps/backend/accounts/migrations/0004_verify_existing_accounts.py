from django.db import migrations


def verify_existing_accounts(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email_verified=False).update(email_verified=True)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_remove_service_provider_role")]

    operations = [
        migrations.RunPython(verify_existing_accounts, migrations.RunPython.noop),
    ]
