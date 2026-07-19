from django.conf import settings
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from accounts.models import User
from alerts.models import Alert, Notification, PushSubscription


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
        if getattr(self, "swagger_fake_view", False):
            return Alert.objects.none()
        if self.request.user.role == User.Role.ADMIN:
            return Alert.objects.all()
        if self.request.user.role == User.Role.HOUSEHOLD:
            return Alert.objects.filter(household__owner=self.request.user)
        return Alert.objects.none()


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "category",
            "severity",
            "title",
            "message",
            "target_url",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields = fields

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    filterset_fields = ("category", "severity")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=("read_at",))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=("post",), url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated})


class PushSubscriptionSerializer(serializers.ModelSerializer):
    keys = serializers.DictField(write_only=True)

    class Meta:
        model = PushSubscription
        fields = ("id", "endpoint", "keys", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "is_active", "created_at", "updated_at")
        extra_kwargs = {"endpoint": {"validators": []}}

    def validate_endpoint(self, value):
        if not value.startswith("https://"):
            raise serializers.ValidationError("A secure push-service endpoint is required.")
        return value

    def validate_keys(self, value):
        if not value.get("p256dh") or not value.get("auth"):
            raise serializers.ValidationError("Both p256dh and auth keys are required.")
        return value

    def create(self, validated_data):
        keys = validated_data.pop("keys")
        request = self.context["request"]
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=validated_data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": keys["p256dh"],
                "auth": keys["auth"],
                "user_agent": request.headers.get("User-Agent", "")[:500],
                "is_active": True,
            },
        )
        return subscription


class PushSubscriptionViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PushSubscriptionSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PushSubscription.objects.none()
        return PushSubscription.objects.filter(user=self.request.user)

    @action(detail=False, methods=("post",), url_path="remove-endpoint")
    def remove_endpoint(self, request):
        endpoint = request.data.get("endpoint")
        if not endpoint:
            raise serializers.ValidationError({"endpoint": "This field is required."})
        deleted, _ = self.get_queryset().filter(endpoint=endpoint).delete()
        return Response({"deleted": bool(deleted)}, status=status.HTTP_200_OK)


class WebPushConfigSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(read_only=True)
    public_key = serializers.CharField(read_only=True)


class WebPushConfigView(GenericAPIView):
    serializer_class = WebPushConfigSerializer

    def get(self, request):
        return Response(
            {
                "enabled": bool(
                    settings.WEB_PUSH_VAPID_PUBLIC_KEY and settings.WEB_PUSH_VAPID_PRIVATE_KEY
                ),
                "public_key": settings.WEB_PUSH_VAPID_PUBLIC_KEY,
            }
        )
