package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewHandlerWithoutStaticDir(t *testing.T) {
	h := newHandler(discardLogger(), "")

	rec := serve(h, "POST", "/api/v1/add", `{"operands": [1, 2]}`)
	assertResponse(t, rec, 200, "application/json", `{"result":3}`)

	// Outside /api/ there is nothing to serve: net/http's plain 404.
	rec = serve(h, "GET", "/", "")
	assertResponse(t, rec, 404, "text/plain; charset=utf-8", "404 page not found")
}

func TestNewHandlerWithStaticDir(t *testing.T) {
	dir := t.TempDir()
	const page = "<!doctype html><title>Calculator</title>"
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(page), 0o644); err != nil {
		t.Fatal(err)
	}
	h := newHandler(discardLogger(), dir)

	rec := serve(h, "GET", "/", "")
	assertResponse(t, rec, 200, "text/html; charset=utf-8", page)

	rec = serve(h, "GET", "/missing.js", "")
	assertResponse(t, rec, 404, "text/plain; charset=utf-8", "404 page not found")

	// /api/ still goes to the API, including its JSON 404.
	rec = serve(h, "POST", "/api/v1/add", `{"operands": [1, 2]}`)
	assertResponse(t, rec, 200, "application/json", `{"result":3}`)

	rec = serve(h, "GET", "/api/nope", "")
	assertResponse(t, rec, 404, "application/json", `"code":"NOT_FOUND"`)
}

func TestNewServerSetsTimeouts(t *testing.T) {
	srv := newServer(":0", http.NotFoundHandler())
	timeouts := map[string]int64{
		"ReadHeaderTimeout": int64(srv.ReadHeaderTimeout),
		"ReadTimeout":       int64(srv.ReadTimeout),
		"WriteTimeout":      int64(srv.WriteTimeout),
		"IdleTimeout":       int64(srv.IdleTimeout),
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s is not set", name)
		}
	}
}

func serve(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

// assertResponse checks the status and Content-Type, and that the body
// contains wantBody.
func assertResponse(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantType, wantBody string) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Errorf("status = %d, want %d", rec.Code, wantStatus)
	}
	if got := rec.Header().Get("Content-Type"); got != wantType {
		t.Errorf("Content-Type = %q, want %q", got, wantType)
	}
	if got := rec.Body.String(); !strings.Contains(got, wantBody) {
		t.Errorf("body = %q, want it to contain %q", got, wantBody)
	}
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
