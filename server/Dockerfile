FROM golang:1.26.1-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/emfont-server ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/emfont-server /usr/local/bin/emfont-server
USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/emfont-server"]
