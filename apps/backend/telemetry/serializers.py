from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from telemetry.models import DepletionEstimate, Reading
from telemetry.services import create_reading


class ReadingSerializer(serializers.ModelSerializer):
    esp32_id = serializers.CharField(source="sensor.esp32_id", read_only=True)

    class Meta:
        model = Reading
        fields = (
            "id",
            "sensor",
            "cylinder",
            "esp32_id",
            "timestamp",
            "weight",
            "gas_percentage",
            "message_id",
            "mq2_raw",
            "mq2_ready",
            "hx711_ok",
            "gas_leak_detected",
            "created_at",
        )
        read_only_fields = ("id", "cylinder", "gas_percentage", "created_at")

    def validate(self, attrs):
        sensor = attrs.get("sensor")
        if not sensor or not sensor.is_active:
            raise serializers.ValidationError({"sensor": "This device is not active."})
        if sensor.cylinder_id is None:
            raise serializers.ValidationError(
                {"sensor": "Connect the device to a cylinder before sending readings."}
            )
        if sensor.cylinder.status == sensor.cylinder.Status.RETIRED:
            raise serializers.ValidationError(
                {"sensor": "The connected cylinder has been retired."}
            )
        attrs["cylinder"] = sensor.cylinder
        candidate = Reading(**attrs)
        candidate.gas_percentage = candidate.calculate_gas_percentage()
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def create(self, validated_data):
        return create_reading(**validated_data)


class DeviceTelemetrySerializer(serializers.Serializer):
    message_id = serializers.CharField(max_length=100)
    weight = serializers.DecimalField(
        max_digits=8, decimal_places=3, allow_null=True, required=True
    )
    mq2_raw = serializers.IntegerField(min_value=0, max_value=4095)
    mq2_ready = serializers.BooleanField()
    gas_leak_detected = serializers.BooleanField()
    hx711_ok = serializers.BooleanField()

    def validate_message_id(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate(self, attrs):
        sensor = self.context["sensor"]
        if not sensor.is_active:
            raise serializers.ValidationError({"device": "This device is inactive."})
        if sensor.household_id is None:
            raise serializers.ValidationError({"device": "Pair this device to a household first."})
        if sensor.cylinder_id is None:
            raise serializers.ValidationError({"device": "Connect this device to a cylinder first."})
        if sensor.cylinder.status == sensor.cylinder.Status.RETIRED:
            raise serializers.ValidationError({"device": "The connected cylinder is retired."})
        if attrs["hx711_ok"] and attrs["weight"] is None:
            raise serializers.ValidationError(
                {"weight": "A valid weight is required when hx711_ok is true."}
            )
        if not attrs["mq2_ready"] and attrs["gas_leak_detected"]:
            raise serializers.ValidationError(
                {"gas_leak_detected": "A warming MQ-2 sensor cannot report a confirmed leak."}
            )

        candidate = Reading(sensor=sensor, cylinder=sensor.cylinder, **attrs)
        candidate.gas_percentage = candidate.calculate_gas_percentage()
        try:
            candidate.full_clean(exclude=("timestamp", "message_id"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class DepletionEstimateSerializer(serializers.ModelSerializer):
    disclaimer = serializers.SerializerMethodField()

    class Meta:
        model = DepletionEstimate
        fields = (
            "id",
            "cylinder",
            "status",
            "estimated_depletion_at",
            "lower_bound_at",
            "upper_bound_at",
            "estimated_days_remaining",
            "confidence_score",
            "model_name",
            "model_version",
            "input_reading_count",
            "input_started_at",
            "input_ended_at",
            "failure_reason",
            "generated_at",
            "disclaimer",
        )
        read_only_fields = fields

    def get_disclaimer(self, obj):
        return (
            "This depletion forecast is an estimate based on recent usage "
            "and must not be treated as a safety guarantee."
        )
