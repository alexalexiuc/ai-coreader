package llm

import (
	"testing"
)

func TestValidateChapterHeading(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		// Valid book chapters
		{"Chapter 1", "Chapter 1", true},
		{"Chapter I", "Chapter I", true},
		{"Chapter 42", "Chapter 42", true},
		{"Chapter X: The Beginning", "Chapter X: The Beginning", true},
		{"Chapter 3 - A New Hope", "Chapter 3 - A New Hope", true},
		{"CHAPTER 5", "CHAPTER 5", true},

		// Valid parts
		{"Part 1", "Part 1", true},
		{"Part I", "Part I", true},
		{"Part Two", "Part Two", true},
		{"PART III", "PART III", true},

		// Valid books/sections/volumes
		{"Book 1", "Book 1", true},
		{"Book II", "Book II", true},
		{"Section 1", "Section 1", true},
		{"Section III", "Section III", true},
		{"Volume 1", "Volume 1", true},
		{"Volume IV", "Volume IV", true},

		// Valid special sections
		{"Prologue", "Prologue", true},
		{"Epilogue", "Epilogue", true},
		{"Introduction", "Introduction", true},
		{"Preface", "Preface", true},
		{"Afterword", "Afterword", true},
		{"PROLOGUE", "PROLOGUE", true},
		{"epilogue", "epilogue", true},

		// Invalid - play/poem structures
		{"ACT I", "ACT I", false},
		{"Act II", "Act II", false},
		{"SCENE 1", "SCENE 1", false},
		{"Scene III", "Scene III", false},
		{"ACT I, SCENE II", "ACT I, SCENE II", false},

		// Invalid - prose and dialogue
		{"The quick brown fox jumps over the lazy dog", "The quick brown fox jumps over the lazy dog", false},
		{"He walked into the room.", "He walked into the room.", false},
		{"\"Hello, world!\" she said.", "\"Hello, world!\" she said.", false},
		{"It was a dark and stormy night.", "It was a dark and stormy night.", false},

		// Invalid - too long (>80 chars)
		{"Chapter 1 with a really really really really really really really really long title", "Chapter 1 with a really really really really really really really really long title", false},

		// Invalid - ALL-CAPS speaker-like lines (except known patterns)
		{"HAMLET", "HAMLET", false},
		{"ROMEO", "ROMEO", false},
		{"NARRATOR", "NARRATOR", false},
		{"MACBETH", "MACBETH", false},

		// Invalid - generic text
		{"The Story Continues", "The Story Continues", false},
		{"A New Beginning", "A New Beginning", false},
		{"The End", "The End", false},
		{"Once upon a time", "Once upon a time", false},

		// Invalid - empty or whitespace
		{"", "", false},
		{"   ", "   ", false},

		// Edge cases - valid with whitespace
		{"  Chapter 1  ", "  Chapter 1  ", true},
		{"Part II  ", "Part II  ", true},

		// Edge cases - numbers in different formats
		{"Chapter 01", "Chapter 01", true},
		{"Chapter 100", "Chapter 100", true},
		{"Part 999", "Part 999", true},

		// Invalid - incorrect formats
		{"chapter", "chapter", false},
		{"1 Chapter", "1 Chapter", false},
		{"chapter one", "chapter one", false},
		{"Chapters 1-5", "Chapters 1-5", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateChapterHeading(tt.input)
			if result != tt.expected {
				t.Errorf("validateChapterHeading(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNormalizeChapters(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "Valid chapters only",
			input:    []string{"Chapter 1", "Chapter 2", "Prologue"},
			expected: []string{"Chapter 1", "Chapter 2", "Prologue"},
		},
		{
			name:     "Mixed valid and invalid",
			input:    []string{"Chapter 1", "HAMLET", "Chapter 2", "Some prose text here"},
			expected: []string{"Chapter 1", "Chapter 2"},
		},
		{
			name:     "Filters out ACT and SCENE",
			input:    []string{"ACT I", "SCENE 1", "Chapter 1"},
			expected: []string{"Chapter 1"},
		},
		{
			name:     "Removes duplicates",
			input:    []string{"Chapter 1", "Chapter 1", "Part I"},
			expected: []string{"Chapter 1", "Part I"},
		},
		{
			name:     "Handles whitespace",
			input:    []string{"  Chapter 1  ", "Chapter 2", "  "},
			expected: []string{"Chapter 1", "Chapter 2"},
		},
		{
			name:     "Empty input",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "All invalid",
			input:    []string{"HAMLET", "ROMEO", "Some dialogue here"},
			expected: []string{},
		},
		{
			name:     "Long text filtered out",
			input:    []string{"Chapter 1", "This is a very long line of prose that should definitely be filtered out because it exceeds the character limit"},
			expected: []string{"Chapter 1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeChapters(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("normalizeChapters() returned %d chapters, want %d\nGot: %v\nWant: %v",
					len(result), len(tt.expected), result, tt.expected)
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("normalizeChapters()[%d] = %q, want %q", i, result[i], tt.expected[i])
				}
			}
		})
	}
}
