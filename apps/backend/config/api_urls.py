from config.views import HealthView
from django.urls import include, path

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("", include("accounts.urls")),
    path("", include("devices.urls")),
    path("", include("refills.urls")),
    path("", include("telemetry.urls")),
]
