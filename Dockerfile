FROM python:3.11
RUN apt-get update && apt-get install -y build-essential cmake git

# Set working directory
WORKDIR /app

# Set PYTHONPATH so Python can find your app package
ENV PYTHONPATH=/app

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project into /app
COPY . .

# Default command (can be overridden by docker-compose)
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
