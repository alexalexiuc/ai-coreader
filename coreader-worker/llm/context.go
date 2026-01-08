package llm

import (
	"context"

	"coreader-worker/utils"
)

type loggerKey struct{}

// WithLogger attaches a request logger to the context.
func WithLogger(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, logger)
}

// LoggerFromContext retrieves the request logger from context.
func LoggerFromContext(ctx context.Context) *Logger {
	logger, ok := ctx.Value(loggerKey{}).(*Logger)
	if !ok {
		return nil
	}
	return logger
}

// WithRequestLogger builds a logger from env settings and attaches it to context.
func WithRequestLogger(ctx context.Context, sessionID string) context.Context {
	enabled := utils.GetEnv("LLM_LOGGING_ENABLED", "true") == "true"
	return WithLogger(ctx, NewLogger(enabled, "./llm_logs", sessionID))
}

func logRequest(ctx context.Context, prompt string, options *Options, response string, respErr error) {
	logger := LoggerFromContext(ctx)
	if logger == nil {
		return
	}
	_ = logger.LogRequest(prompt, options, response, respErr)
}
