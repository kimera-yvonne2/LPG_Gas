from django.db import migrations


def create_missing_households(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Household = apps.get_model("devices", "Household")
    household_owner_ids = Household.objects.values_list("owner_id", flat=True)
    missing_users = User.objects.filter(role="household").exclude(
        pk__in=household_owner_ids
    )
    Household.objects.bulk_create(
        Household(owner=user) for user in missing_users.iterator()
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_verify_existing_accounts"),
        ("devices", "0002_simplify_household"),
    ]

    operations = [
        migrations.RunPython(create_missing_households, migrations.RunPython.noop),
    ]
