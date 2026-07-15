# ---- Frontend build stage ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend runtime stage ----
FROM python:3.12-slim AS backend
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py db.py main.py llm_structure.py audio_pipeline.py ./
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# SQLite DB lives on a mounted volume so it survives redeploys/restarts.
ENV DB_PATH=/data/lecturelens.db
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
