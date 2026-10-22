package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"emfont/internal/config"
	"emfont/internal/db"
	emfonthttp "emfont/internal/http"
	"github.com/redis/go-redis/v9"
)

func main() { os.Exit(run()) }

func run() int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, err := config.Load()
	if err != nil {
		slog.Default().Error("config load failed", "error", err)
		return 1
	}
	database, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Default().Error("database open failed", "error", err)
		return 1
	}
	defer database.Close()
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Default().Error("redis url parse failed", "error", err)
		return 1
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Default().Error("redis ping failed", "error", err)
		return 1
	}
	defer rdb.Close()

	mux := http.NewServeMux()
	emfonthttp.NewServer(database, rdb, cfg.FontInfoCacheTTL).Register(mux)
	server := &http.Server{
		Addr: cfg.HTTPAddr, Handler: withCORS(mux), ReadTimeout: 5 * time.Second,
		WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		slog.Default().Info("server listening", "addr", cfg.HTTPAddr)
		errCh <- server.ListenAndServe()
	}()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Default().Error("shutdown failed", "error", err)
			return 1
		}
		return 0
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			slog.Default().Error("server error", "error", err)
			return 1
		}
		return 0
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
