FROM golang:1.22-bullseye AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/worker

FROM debian:bookworm-slim
WORKDIR /app
ENV PATH="/app:${PATH}"
COPY --from=builder /app/worker /app/worker
ENTRYPOINT ["/app/worker"]
