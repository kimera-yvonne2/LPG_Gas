from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import ValidationError

from devices.pairing import provision_device


class Command(BaseCommand):
    help = "Provision an ESP32 and print its device secret exactly once."

    def add_arguments(self, parser):
        parser.add_argument("--device-id", required=True)
        parser.add_argument("--mac-address")

    def handle(self, *args, **options):
        try:
            sensor, secret = provision_device(
                device_id=options["device_id"].strip(),
                mac_address=(options.get("mac_address") or "").strip() or None,
            )
        except ValidationError as exc:
            raise CommandError(str(exc.detail)) from exc

        self.stdout.write(self.style.SUCCESS("Device provisioned successfully."))
        self.stdout.write(f"Device ID: {sensor.esp32_id}")
        self.stdout.write(f"Device secret: {secret}")
        self.stdout.write(self.style.WARNING("Save this secret now; it will not be shown again."))
