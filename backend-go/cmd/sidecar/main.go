// Command sidecar is the Go replacement entrypoint for the LogLensAi
// backend, mirroring sidecar/main.py's argparse surface and dispatch
// between stdio and HTTP transports (sidecar/src/api.py's run_stdio /
// run_http / start_background_http).
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"loglensai/backend-go/internal/ai"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/rpc"
)

const version = "0.1.0"

func main() {
	var (
		stdioFlag   = flag.Bool("stdio", false, "Run in JSON-RPC stdio mode (default)")
		httpFlag    = flag.Bool("http", false, "Run in HTTP mode")
		devFlag     = flag.Bool("dev", false, "Alias for --http (legacy support)")
		port        = flag.Int("port", 5000, "Port for HTTP mode (default: 5000)")
		dbPath      = flag.String("db", "loglens.duckdb", "Path to DuckDB file")
		withHTTP    = flag.Bool("with-http", false, "Start background HTTP server in Stdio mode")
		showVersion = flag.Bool("version", false, "Print version and exit")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("LogLensAi Sidecar %s\n", version)
		return
	}

	application, err := app.NewApp(*dbPath)
	if err != nil {
		log.Fatalf("sidecar: failed to initialize app: %v", err)
	}
	defer func() {
		if closeErr := application.Close(); closeErr != nil {
			log.Printf("sidecar: error during shutdown: %v", closeErr)
		}
	}()

	registry := rpc.NewRegistry()
	rpc.RegisterStubs(registry)
	rpc.RegisterApp(registry, application)
	rpc.RegisterSettingsMethods(registry, application)
	rpc.RegisterHierarchyMethods(registry, application)
	rpc.RegisterLogOpsMethods(registry, application)

	// AI wiring (Phase 3): reconciles internal/ai/providers, internal/ai/rag,
	// and internal/ai/graph (see internal/ai/wiring.go's package doc comment
	// for why this glue lives in its own package rather than inside
	// internal/app). Wire only fails on a genuinely misconfigured
	// ai_provider setting -- degrade to AI-disabled rather than refusing to
	// start the whole sidecar over it, matching NewApp's own philosophy of
	// never failing core startup over an optional subsystem.
	aiWiring, aiErr := ai.Wire(application)
	if aiErr != nil {
		log.Printf("sidecar: AI wiring failed, AI features disabled: %v", aiErr)
	} else {
		rpc.RegisterAI(registry, application, aiWiring.Provider, aiWiring.Tools)
	}

	// AI-extra wiring (session mgmt, cluster analysis, dashboard, anomalies):
	// separate from ai.Wire above since it needs the raw providers.Provider
	// and rag.Service (see internal/ai/rpc_extra.go's NewExtra), not the
	// graph-shaped Provider/MemorySearcher interfaces ai.Wiring exposes.
	// Same degrade-not-fail philosophy as ai.Wire.
	aiExtra, aiExtraErr := ai.NewExtra(application)
	if aiExtraErr != nil {
		log.Printf("sidecar: AI-extra wiring failed, cluster analysis/dashboard AI features disabled: %v", aiExtraErr)
	} else {
		rpc.RegisterAIExtraMethods(registry, application, aiExtra)
	}

	log.Printf("sidecar: registered %d RPC methods", registry.Len())

	// buildMux assembles the same /rpc handler NewHTTPHandler/ListenAndServe
	// always built, plus (when AI wiring succeeded) the /api/stream_chat SSE
	// route -- used by every HTTP-serving code path below (--http/--dev, and
	// --with-http's background server) so stream_chat is available whenever
	// /rpc is.
	buildMux := func() *http.ServeMux {
		mux := rpc.NewHTTPHandler(registry)
		if aiWiring != nil {
			rpc.MountStreamChat(mux, application, aiWiring.Provider, aiWiring.Tools)
		}
		return mux
	}

	useHTTP := *httpFlag || *devFlag

	switch {
	case useHTTP:
		addr := fmt.Sprintf("127.0.0.1:%d", *port)
		log.Printf("rpc: HTTP server listening on %s", addr)
		if err := http.ListenAndServe(addr, buildMux()); err != nil {
			log.Fatalf("sidecar: HTTP server failed: %v", err)
		}
	default:
		// Default mode is stdio, matching main.py when neither --http nor
		// --dev is passed (--stdio is accepted but not required).
		_ = stdioFlag

		if *withHTTP {
			addr := fmt.Sprintf("127.0.0.1:%d", *port)
			go func() {
				log.Printf("rpc: HTTP server listening on %s", addr)
				if err := http.ListenAndServe(addr, buildMux()); err != nil {
					log.Printf("sidecar: background HTTP server stopped: %v", err)
				}
			}()
		}

		rpc.RunStdio(os.Stdin, os.Stdout, registry)
	}
}
