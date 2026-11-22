# One image that serves both the API and the built frontend from the same
# origin, so no CORS is needed (SPEC 7).
#
#   docker build -t fullstack-calculator .
#   docker run --rm -p 8080:8080 fullstack-calculator

# 1. Build the frontend into /frontend/dist.
FROM node:24-slim AS frontend
WORKDIR /frontend
# Dependencies first, so editing the source doesn't reinstall them.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Build the server as a static binary. Without cgo it needs no libc, so it
# runs on distroless/static.
FROM golang:1.25-alpine AS backend
WORKDIR /backend
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

# 3. Runtime: only the binary and the static files, with no shell or package
# manager, running as the image's non-root user (uid 65532).
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=backend /server /server
COPY --from=frontend /frontend/dist /static
ENV STATIC_DIR=/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
