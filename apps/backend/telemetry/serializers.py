from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from telemetry.models import DepletionEstimate, Reading
from telemetry.services import create_reading


class ReadingSerializer(serializers.ModelSerializer):
    esp32_id = serializers.CharField(source="sensor.esp32_id", read_only=True)
    cylinder_serial_number = serializers.CharField(source="cylinder.serial_number", read_only=True)

    class Meta:
        model = Reading
        fields = (
            "id",
            "sensor",
            "cylinder",
            "esp32_id",
            "cylinder_serial_number",
            "timestamp",
            "weight",
            "gas_percentage",
            "temperature",
            "signal_strength",
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


class DepletionEstimateSerializer(serializers.ModelSerializer):
    cylinder_serial_number = serializers.CharField(
        source="cylinder.serial_number",
        read_only=True,
    )
    disclaimer = serializers.SerializerMethodField()

    class Meta:
        model = DepletionEstimate
        fields = (
            "id",
            "cylinder",
            "cylinder_serial_number",
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
