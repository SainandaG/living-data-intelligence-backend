# ─── Stage 1: Build dependencies ───────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Stage 2: Production image ──────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Create a non-root system user
RUN addgroup --system app && adduser --system --no-create-home --group app

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/app/.local

# Copy application source
COPY . .

# Set ownership
RUN chown -R app:app /app

USER app

ENV PATH=/home/app/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
