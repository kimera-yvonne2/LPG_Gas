import uuid

from django.db import migrations, models


def populate_verification_tokens(apps, schema_editor):
    user_model = apps.get_model("accounts", "User")
    for user in user_model.objects.filter(email_verification_token__isnull=True).iterator():
        user.email_verification_token = uuid.uuid4()
        user.save(update_fields=["email_verification_token"])


def migrate_legacy_roles(apps, schema_editor):
    user_model = apps.get_model("accounts", "User")
    user_model.objects.filter(role="resident").update(role="household")
    user_model.objects.filter(role="provider").update(role="service_provider")


def reverse_legacy_roles(apps, schema_editor):
    user_model = apps.get_model("accounts", "User")
    user_model.objects.filter(role="household").update(role="resident")
    user_model.objects.filter(role="service_provider").update(role="provider")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.RunPython(migrate_legacy_roles, reverse_legacy_roles),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("household", "Household"),
                    ("service_provider", "Service Provider"),
                    ("technician", "Technician"),
                ],
                default="household",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verification_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verification_token",
            field=models.UUIDField(null=True, unique=True),
        ),
        migrations.RunPython(populate_verification_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="email_verification_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
