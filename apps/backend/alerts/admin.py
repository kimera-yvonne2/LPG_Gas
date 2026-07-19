from django.contrib import admin

from alerts.models import Alert, Notification, NotificationDelivery, PushSubscription

admin.site.register(Alert)
admin.site.register(Notification)
admin.site.register(PushSubscription)
admin.site.register(NotificationDelivery)
