from django.urls import include, path

from config.views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("", include("accounts.urls")),
    path("", include("devices.urls")),
    path("", include("telemetry.urls")),
]
