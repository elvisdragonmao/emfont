package http

import "net/http"

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", s.Healthz)
	mux.HandleFunc("GET /list", s.List)
	mux.HandleFunc("GET /info/{fontID}", s.Info)
}
