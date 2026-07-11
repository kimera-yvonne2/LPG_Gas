FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN addgroup --system django && adduser --system --ingroup django django
COPY requirements.txt requirements-dev.txt ./

FROM base AS development
RUN pip install -r requirements-dev.txt
COPY . .
RUN chmod +x scripts/entrypoint.sh
EXPOSE 8000

FROM base AS production
RUN pip install -r requirements.txt
COPY . .
RUN chmod +x scripts/entrypoint.sh && chown -R django:django /app
USER django
EXPOSE 8000
CMD ["./scripts/entrypoint.sh", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
