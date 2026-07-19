from rest_framework import mixins, serializers, viewsets

from accounts.models import User
from alerts.models import Alert


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = (
            "id",
            "cylinder",
            "reading",
            "kind",
            "severity",
            "title",
            "message",
            "is_active",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields


class AlertViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AlertSerializer
    filterset_fields = ("kind", "severity", "is_active", "cylinder")

    def get_queryset(self):
        if self.request.user.role == User.Role.ADMIN:
            return Alert.objects.all()
        if self.request.user.role == User.Role.HOUSEHOLD:
            return Alert.objects.filter(household__owner=self.request.user)
        return Alert.objects.none()
