"""Device-presence helpers shared by API representations."""

from datetime import timedelta

from django.utils import timezone

from devices.models import Sensor

# Devices normally publish every five seconds.  A minute allows for brief Wi-Fi
# interruptions without leaving a stopped device marked as live indefinitely.
ONLINE_AFTER = timedelta(minutes=1)


def is_sensor_online(sensor: Sensor, *, now=None) -> bool:
    """Return whether a sensor has communicated within the presence window."""

    if not sensor.is_active or not sensor.online_status or sensor.last_seen is None:
        return False
    return (now or timezone.now()) - sensor.last_seen <= ONLINE_AFTER
