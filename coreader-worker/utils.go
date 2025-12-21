package main

import (
	"os"
)

func GetEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func GetEnvWithPanic(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	panic(key + " is not set")
}
