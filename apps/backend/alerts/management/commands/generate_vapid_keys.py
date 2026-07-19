import base64

from cryptography.hazmat.primitives import serialization
from django.core.management.base import BaseCommand
from py_vapid import Vapid


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


class Command(BaseCommand):
    help = "Generate a VAPID key pair for Web Push environment variables."

    def handle(self, *args, **options):
        vapid = Vapid()
        vapid.generate_keys()
        private_value = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
        public_value = vapid.public_key.public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )

        self.stdout.write("Generate these once and store them in your secret environment:")
        self.stdout.write(f"WEB_PUSH_VAPID_PRIVATE_KEY={base64url(private_value)}")
        self.stdout.write(f"WEB_PUSH_VAPID_PUBLIC_KEY={base64url(public_value)}")
        self.stdout.write("WEB_PUSH_VAPID_SUBJECT=mailto:your-monitored-email@example.com")
        self.stdout.write(
            self.style.WARNING(
                "Keep the private key secret. The public key is safe to expose to browsers."
            )
        )
