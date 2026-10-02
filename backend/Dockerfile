# ----- Stage 1:build ------------
FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o devboard-backend .

#----------- Stage 2: Runner -----------------
FROM alpine:3.24

COPY --from=builder /app/devboard-backend /devboard-backend

RUN adduser -D -u 10001 app

USER 10001:10001

EXPOSE 8080

CMD ["/devboard-backend"]


