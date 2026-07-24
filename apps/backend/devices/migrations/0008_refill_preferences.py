from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("devices", "0007_device_pairing")]

    # This migration is safe to apply to the development database where the
    # duplicate migration branch may already have created the household fields.
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    """
                    DO $$ BEGIN
                      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'devices_household' AND column_name = 'refill_provider_id') THEN
                        ALTER TABLE devices_household ADD COLUMN refill_provider_id bigint NULL REFERENCES accounts_user(id) DEFERRABLE INITIALLY DEFERRED;
                      END IF;
                      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'devices_household' AND column_name = 'automatic_refills_enabled') THEN
                        ALTER TABLE devices_household ADD COLUMN automatic_refills_enabled boolean NOT NULL DEFAULT false;
                      END IF;
                      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'devices_cylinder' AND column_name = 'automatic_refill_armed') THEN
                        ALTER TABLE devices_cylinder ADD COLUMN automatic_refill_armed boolean NOT NULL DEFAULT true;
                      END IF;
                    END $$;
                    CREATE INDEX IF NOT EXISTS devices_household_refill_provider_id_idx ON devices_household (refill_provider_id);
                    """,
                    migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="household",
                    name="refill_provider",
                    field=models.ForeignKey(
                        blank=True,
                        limit_choices_to={"is_active": True, "role": "technician"},
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="preferred_by_households",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                migrations.AddField(
                    model_name="household",
                    name="automatic_refills_enabled",
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name="cylinder",
                    name="automatic_refill_armed",
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
