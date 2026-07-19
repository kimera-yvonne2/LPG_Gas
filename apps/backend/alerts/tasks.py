from celery import shared_task
from django.core.mail import send_mail


@shared_task(
    bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, retry_kwargs={"max_retries": 3}
)
def send_notification_email_task(self, subject: str, body: str, recipients: list[str]) -> int:
    if not recipients:
        return 0
    return send_mail(subject, body, None, recipients, fail_silently=False)
