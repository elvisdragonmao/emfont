package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"emfont/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type Server struct {
	db       *db.DB
	redis    *redis.Client
	cacheTTL time.Duration
}

func NewServer(db *db.DB, rdb *redis.Client, cacheTTL time.Duration) *Server {
	return &Server{db: db, redis: rdb, cacheTTL: cacheTTL}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) Healthz(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Health(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "down", "database": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "up", "database": true})
}

type ListFont struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Weight   []int16  `json:"weight"`
	Author   string   `json:"author"`
	NameZh   string   `json:"name_zh"`
	NameEn   string   `json:"name_en"`
	Category string   `json:"category"`
	Tags     []string `json:"tags"`
	Family   string   `json:"family"`
	Sid      int      `json:"sid"`
}

func (s *Server) List(w http.ResponseWriter, r *http.Request) {
	fonts, err := s.queryList(r.Context(), strings.TrimSpace(r.URL.Query().Get("q")))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"status": "failed", "message": "database query failed"})
		return
	}
	writeJSON(w, http.StatusOK, fonts)
}

func (s *Server) queryList(ctx context.Context, q string) ([]ListFont, error) {
	var args []any
	where := ""
	if q != "" {
		where = `WHERE id ILIKE $1 OR name ILIKE $1 OR name_zh ILIKE $1 OR name_en ILIKE $1
			OR EXISTS (SELECT 1 FROM unnest(authors) AS author WHERE author ILIKE $1)`
		args = append(args, "%"+q+"%")
	}
	rows, err := s.db.Pool().Query(ctx, `SELECT id, name, weights, authors, name_zh, name_en,
		category, tags, family, demo_content_id FROM font_family `+where+` ORDER BY id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ListFont
	for rows.Next() {
		var f ListFont
		var authors []string
		if err := rows.Scan(&f.ID, &f.Name, &f.Weight, &authors, &f.NameZh, &f.NameEn,
			&f.Category, &f.Tags, &f.Family, &f.Sid); err != nil {
			return nil, err
		}
		if len(authors) > 0 {
			f.Author = authors[0]
		}
		if f.Weight == nil {
			f.Weight = []int16{}
		}
		if f.Tags == nil {
			f.Tags = []string{}
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

type FontInfo struct {
	ID   string `json:"-"`
	Name struct {
		Original string  `json:"original"`
		Zh       *string `json:"zh"`
		En       *string `json:"en"`
	} `json:"name"`
	Category    *string  `json:"category"`
	Weight      []int16  `json:"weight"`
	Tags        []string `json:"tags"`
	Family      *string  `json:"family"`
	Version     *string  `json:"version"`
	License     *string  `json:"license"`
	Source      *string  `json:"source"`
	Author      string   `json:"author"`
	Description *string  `json:"description"`
	Format      string   `json:"format"`
	Sid         int      `json:"sid"`
}

func (s *Server) Info(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("fontID")
	ctx := r.Context()
	key := "fontinfo:" + id
	if cached, err := s.redis.Get(ctx, key).Result(); err == nil && cached != "" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write([]byte(cached))
		return
	}
	font, err := s.queryInfo(ctx, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"status": "failed", "message": "database query failed"})
		return
	}
	if font == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"status": "failed", "message": "Font not found"})
		return
	}
	b, _ := json.Marshal(font)
	_ = s.redis.Set(ctx, key, b, s.cacheTTL).Err()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(b)
}

func (s *Server) queryInfo(ctx context.Context, id string) (*FontInfo, error) {
	row := s.db.Pool().QueryRow(ctx, `SELECT id, name, name_zh, name_en, weights, category, tags, family,
		version, license, repo_url, authors, description, format, demo_content_id FROM font_family WHERE id = $1`, id)
	var f FontInfo
	var authors []string
	err := row.Scan(&f.ID, &f.Name.Original, &f.Name.Zh, &f.Name.En, &f.Weight,
		&f.Category, &f.Tags, &f.Family, &f.Version, &f.License, &f.Source,
		&authors, &f.Description, &f.Format, &f.Sid)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(authors) > 0 {
		f.Author = authors[0]
	}
	if f.Weight == nil {
		f.Weight = []int16{}
	}
	if f.Tags == nil {
		f.Tags = []string{}
	}
	return &f, nil
}
