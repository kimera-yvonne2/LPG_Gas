from django.contrib.auth import get_user_model
from django.db.models import Q
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.permissions import IsAdminRole
from accounts.selectors import user_list
from accounts.serializers import (
    AdminUserWriteSerializer,
    EmailVerificationSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegistrationSerializer,
    ResendVerificationSerializer,
    UserSerializer,
)
from accounts.services import (
    can_resend_verification,
    send_password_reset_email,
    send_verification_email,
    verify_email,
)

User = get_user_model()


@extend_schema_view(
    post=extend_schema(
        tags=["Authentication"],
        summary="Register a household account",
        request=RegistrationSerializer,
        responses={201: UserSerializer},
    )
)
class RegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Log in with email and password",
        request=LoginSerializer,
        examples=[
            OpenApiExample(
                "Login",
                value={"email": "household@example.com", "password": "strong-password"},
                request_only=True,
            )
        ],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Authentication"], summary="Rotate a refresh token")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        summary="Log out and revoke a refresh token",
        request=LogoutSerializer,
        responses={204: None},
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            return Response(
                {"refresh": ["Invalid or expired refresh token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Request a password reset",
        request=PasswordResetRequestSerializer,
        responses={202: None},
        description="Always returns the same response to prevent account enumeration.",
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=True
        ).first()
        if user:
            send_password_reset_email(user)
        return Response(status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Confirm a password reset",
        request=PasswordResetConfirmSerializer,
        responses={204: None},
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailVerificationView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Verify an email address",
        parameters=[OpenApiParameter("token", str, OpenApiParameter.QUERY, required=True)],
        responses={204: None},
    )
    def get(self, request):
        serializer = EmailVerificationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            verify_email(serializer.validated_data["token"])
        except User.DoesNotExist:
            return Response(
                {"token": ["Invalid or already-used verification token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Resend an email-verification message",
        request=ResendVerificationSerializer,
        responses={202: None},
        description="Always returns the same response to prevent account enumeration.",
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"],
            is_active=True,
            email_verified=False,
        ).first()
        if user and can_resend_verification(user):
            send_verification_email(user)
        return Response(status=status.HTTP_202_ACCEPTED)


@extend_schema_view(
    list=extend_schema(tags=["Users"], summary="List users (admin only)"),
    retrieve=extend_schema(tags=["Users"], summary="Retrieve a user (admin only)"),
    create=extend_schema(tags=["Users"], summary="Create a role-bearing user (admin only)"),
    update=extend_schema(tags=["Users"], summary="Replace a user (admin only)"),
    partial_update=extend_schema(tags=["Users"], summary="Update a user (admin only)"),
)
class UserViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAdminRole]
    search_fields = ("email", "username", "phone_number")
    filterset_fields = ("role", "is_active", "email_verified")

    def get_queryset(self):
        queryset = user_list()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(username__icontains=search)
                | Q(phone_number__icontains=search)
            )
        return queryset

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return AdminUserWriteSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == "me":
            return [IsAuthenticated()]
        return super().get_permissions()

    @extend_schema(tags=["Users"], summary="Get the authenticated user", responses=UserSerializer)
    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(UserSerializer(request.user).data)
