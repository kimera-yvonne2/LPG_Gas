from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("devices", "0001_initial"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="household",
            name="household_usage_idx",
        ),
        migrations.RemoveField(model_name="household", name="address"),
        migrations.RemoveField(model_name="household", name="email"),
        migrations.RemoveField(model_name="household", name="name"),
        migrations.RemoveField(model_name="household", name="number_of_people"),
        migrations.RemoveField(model_name="household", name="phone"),
        migrations.RemoveField(model_name="household", name="usage_type"),
        migrations.AlterModelOptions(
            name="household",
            options={"ordering": ("owner__username",)},
        ),
    ]
