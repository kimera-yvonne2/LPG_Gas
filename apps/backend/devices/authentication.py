from dataclasses import dataclass

from django.contrib.auth.hashers import check_password
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from devices.models import Sensor


@dataclass(frozen=True)
class DevicePrincipal:
    sensor_id: int
    is_authenticated: bool = True
    is_active: bool = True


class DeviceAuthentication(BaseAuthentication):
    def authenticate(self, request):
        device_id = request.headers.get("X-Device-ID", "").strip()
        secret = request.headers.get("X-Device-Secret", "")
        if not device_id or not secret:
            raise AuthenticationFailed("Device credentials are required.")

        sensor = Sensor.objects.filter(esp32_id=device_id, is_active=True).first()
        if sensor is None or not check_password(secret, sensor.device_secret_hash):
            raise AuthenticationFailed("Invalid device credentials.")
        return DevicePrincipal(sensor_id=sensor.id), sensor

    def authenticate_header(self, request):
        return "Device"
