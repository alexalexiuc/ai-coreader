package llm

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Logger handles request logging for LLM operations
type Logger struct {
	enabled   bool
	baseDir   string
	sessionID string
}

// RequestLog represents a single LLM request log entry
type RequestLog struct {
	Timestamp time.Time `json:"timestamp"`
	Prompt    string    `json:"prompt"`
	Format    string    `json:"format,omitempty"`
	Schema    string    `json:"schema,omitempty"`
	Response  string    `json:"response"`
	Error     string    `json:"error,omitempty"`
}

// NewLogger creates a new logger instance
func NewLogger(enabled bool, baseDir string, sessionID string) *Logger {
	if !enabled {
		return &Logger{enabled: false}
	}

	return &Logger{
		enabled:   true,
		baseDir:   baseDir,
		sessionID: sessionID,
	}
}

// LogRequest logs a single LLM request with prompt, format, and response
func (l *Logger) LogRequest(reqName string, prompt string, options *Options, response string, respErr error) error {
	if !l.enabled {
		return nil
	}

	// Ensure logs directory exists
	logDir := filepath.Join(l.baseDir, "logs", l.sessionID)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		fmt.Printf("Failed to create log directory: %v\n", err)
		return err
	}

	// Create log entry
	errStr := ""
	if respErr != nil {
		errStr = respErr.Error()
	}

	format := ""
	if options.Format != nil {
		format = fmt.Sprintf("%v", options.Format)
	}

	lines := "\n" + strings.Repeat("-", 150) + "\n"

	log := lines + "Timestamp" + lines + time.Now().UTC().Format(time.RFC3339) + "\n" +
		lines + "Prompt" + lines + prompt + "\n" +
		lines + "Format: " + lines + format + "\n" +
		lines + "Response: " + lines + response + "\n"
	if errStr != "" {
		log += "Error: " + errStr + "\n"
	}

	// Create filename with timestamp
	filename := fmt.Sprintf("request_%s_%d.log", reqName, time.Now().UnixNano())
	filepath := filepath.Join(logDir, filename)

	// Write to file
	if err := os.WriteFile(filepath, []byte(log), 0644); err != nil {
		fmt.Printf("Failed to write log file: %v\n", err)
		return err
	}

	return nil
}
