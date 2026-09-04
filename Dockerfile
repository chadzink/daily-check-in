# Stage 1: Build React SPA with Vite
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go binary embedding the compiled frontend SPA
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY embed.go ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/dailycheckin ./cmd/server

# Stage 3: Hardened minimal Alpine runtime
FROM alpine:3.21
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=backend-builder /app/bin/dailycheckin ./dailycheckin

ENV PORT=8080 \
    APP_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

USER nobody:nobody

ENTRYPOINT ["/app/dailycheckin"]
