// Command server runs the calculator API. It listens on :8080 (or :$PORT)
// and, when STATIC_DIR is set, also serves the built frontend from that
// directory. It shuts down gracefully on SIGINT or SIGTERM.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/GabrielHKGodinho/fullstack-calculator/backend/internal/httpapi"
)

const (
	defaultPort     = "8080"
	shutdownTimeout = 10 * time.Second
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if err := run(logger); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}

// run serves until SIGINT or SIGTERM, then shuts down gracefully.
func run(logger *slog.Logger) error {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	staticDir := os.Getenv("STATIC_DIR")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	srv := newServer(":"+port, newHandler(logger, staticDir))

	// Listen before logging, so "listening" is only logged once the port is
	// actually bound (a busy port fails here instead).
	ln, err := net.Listen("tcp", srv.Addr)
	if err != nil {
		return err
	}
	logger.Info("listening", "addr", ln.Addr().String(), "static_dir", staticDir)

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	// Restore default signal handling, so a second Ctrl-C kills the process
	// right away instead of waiting for the shutdown.
	stop()
	logger.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Info("server stopped")
	return nil
}

// newHandler routes /api/ to the API. When staticDir is set, every other path
// is served from that directory; otherwise those paths get net/http's plain
// 404.
func newHandler(logger *slog.Logger, staticDir string) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api/", httpapi.New(logger))
	if staticDir != "" {
		mux.Handle("/", http.FileServer(http.Dir(staticDir)))
	}
	return mux
}

// newServer returns an http.Server with explicit timeouts, so slow or idle
// clients cannot hold connections open forever.
func newServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
