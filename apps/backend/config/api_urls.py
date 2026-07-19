from django.urls import include, path

from alerts.views import AlertViewSet
from config.views import HealthView

alert_list = AlertViewSet.as_view({"get": "list"})
alert_detail = AlertViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    path("alerts/", alert_list, name="alert-list"),
    path("alerts/<int:pk>/", alert_detail, name="alert-detail"),
    path("health/", HealthView.as_view(), name="health"),
    path("", include("accounts.urls")),
    path("", include("devices.urls")),
    path("", include("refills.urls")),
    path("", include("telemetry.urls")),
]
