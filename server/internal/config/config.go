package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPAddr         string
	DatabaseURL      string
	RedisURL         string
	LogLevel         string
	FontInfoCacheTTL time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{HTTPAddr: ":3000", LogLevel: "info", FontInfoCacheTTL: time.Hour}
	if v := os.Getenv("HTTP_ADDR"); v != "" {
		cfg.HTTPAddr = v
	} else if p := os.Getenv("PORT"); p != "" {
		cfg.HTTPAddr = ":" + p
	}
	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	cfg.RedisURL = os.Getenv("REDIS_URL")
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	if v := os.Getenv("LOG_LEVEL"); v != "" {
		cfg.LogLevel = v
	}
	if v := os.Getenv("FONTINFO_CACHE_TTL_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("FONTINFO_CACHE_TTL_SECONDS: %w", err)
		}
		cfg.FontInfoCacheTTL = time.Duration(n) * time.Second
	}
	return cfg, nil
}
