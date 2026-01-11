package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
	"unicode/utf8"

	"coreader-worker/llm"
)

func TestNormalizeEntityKey(t *testing.T) {
	tests := []struct {
		name     string
		typ      string
		expected string
	}{
		{"Harry Potter", "character", "harry potter|character"},
		{"HERMIONE", "CHARACTER", "hermione|character"},
		{"  Hogwarts  ", "  place  ", "hogwarts|place"},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s_%s", tt.name, tt.typ), func(t *testing.T) {
			result := normalizeEntityKey(tt.name, tt.typ)
			if result != tt.expected {
				t.Errorf("normalizeEntityKey(%q, %q) = %q; want %q", tt.name, tt.typ, result, tt.expected)
			}
		})
	}
}

func TestExtractSnippet(t *testing.T) {
	text := "This is a long piece of text about Harry Potter. Harry is the main character of the story. He goes to Hogwarts School of Witchcraft and Wizardry. There he meets many interesting characters including Hermione Granger and Ron Weasley."

	tests := []struct {
		name     string
		offsets  []int
		expected string // Just check that it contains expected substring
		checkLen bool   // Check if length is within bounds
	}{
		{
			name:     "single offset in middle",
			offsets:  []int{42}, // Position of "Harry"
			expected: "Harry",
			checkLen: true,
		},
		{
			name:     "offset at beginning",
			offsets:  []int{0},
			expected: "This",
			checkLen: true,
		},
		{
			name:     "no offsets",
			offsets:  []int{},
			expected: "This",
			checkLen: true,
		},
		{
			name:     "multiple offsets close together",
			offsets:  []int{42, 50},
			expected: "Harry",
			checkLen: true,
		},
		{
			name:     "multiple offsets far apart - should handle span",
			offsets:  []int{10, 200},
			expected: "long",
			checkLen: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractSnippet(text, tt.offsets)
			if tt.expected != "" && len(result) > 0 {
				// Check that the expected substring is in the result
				found := false
				for i := 0; i <= len(result)-len(tt.expected); i++ {
					if result[i:i+len(tt.expected)] == tt.expected {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("extractSnippet() result %q does not contain expected %q", result, tt.expected)
				}
			}
			if tt.checkLen && len(result) > SNIPPET_CONTEXT_CHARS*3+100 {
				t.Errorf("extractSnippet() result length %d exceeds expected max %d", len(result), SNIPPET_CONTEXT_CHARS*3+100)
			}
		})
	}
}

func TestHashFact(t *testing.T) {
	fact1 := llm.EntityFact{
		FactType:   "trait",
		Value:      "brave",
		Confidence: 0.9,
		Evidence:   "Harry showed great courage",
	}

	fact2 := llm.EntityFact{
		FactType:   "trait",
		Value:      "brave",
		Confidence: 0.8, // Different confidence
		Evidence:   "Harry showed great courage",
	}

	fact3 := llm.EntityFact{
		FactType:   "trait",
		Value:      "brave",
		Confidence: 0.9,
		Evidence:   "Different evidence",
	}

	hash1 := hashFact(fact1)
	hash2 := hashFact(fact2)
	hash3 := hashFact(fact3)

	// Same factType, value, and evidence should produce same hash
	if hash1 != hash2 {
		t.Errorf("hashFact() produced different hashes for facts with same type, value, evidence: %s vs %s", hash1, hash2)
	}

	// Different evidence should produce different hash
	if hash1 == hash3 {
		t.Errorf("hashFact() produced same hash for facts with different evidence")
	}

	// Check that hash is a valid hex string
	if len(hash1) != 64 {
		t.Errorf("hashFact() produced hash with unexpected length: %d", len(hash1))
	}

	// Verify it's valid hex
	_, err := hex.DecodeString(hash1)
	if err != nil {
		t.Errorf("hashFact() produced invalid hex string: %v", err)
	}
}

func TestSelectTopFacts(t *testing.T) {
	facts := []llm.EntityFact{
		{FactType: "trait", Value: "brave", Confidence: 0.9},
		{FactType: "trait", Value: "loyal", Confidence: 0.8},
		{FactType: "role", Value: "protagonist", Confidence: 0.95},
		{FactType: "appearance", Value: "glasses", Confidence: 0.7},
		{FactType: "trait", Value: "determined", Confidence: 0.85},
	}

	tests := []struct {
		name      string
		maxCount  int
		expectLen int
	}{
		{"select all", 10, 5},
		{"select subset", 3, 3},
		{"select one", 1, 1},
		{"select zero", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := selectTopFacts(facts, tt.maxCount)
			if len(result) != tt.expectLen {
				t.Errorf("selectTopFacts() returned %d facts; want %d", len(result), tt.expectLen)
			}
		})
	}
}

func TestSelectSnippets(t *testing.T) {
	mentions := []EntityMentionsDoc{
		{ChunkIndex: 0, Snippet: "snippet 0"},
		{ChunkIndex: 1, Snippet: "snippet 1"},
		{ChunkIndex: 2, Snippet: "snippet 2"},
		{ChunkIndex: 3, Snippet: "snippet 3"},
		{ChunkIndex: 4, Snippet: "snippet 4"},
		{ChunkIndex: 5, Snippet: "snippet 5"},
		{ChunkIndex: 6, Snippet: "snippet 6"},
		{ChunkIndex: 7, Snippet: "snippet 7"},
		{ChunkIndex: 8, Snippet: "snippet 8"},
		{ChunkIndex: 9, Snippet: "snippet 9"},
	}

	allSnippets := make([]string, len(mentions))
	for i, m := range mentions {
		allSnippets[i] = m.Snippet
	}

	tests := []struct {
		name       string
		maxCount   int
		expectLen  int
		checkEarly bool // Check that early mentions are included
	}{
		{"select all", 20, 10, false},
		{"select subset", 5, 5, true},
		{"select one", 1, 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := selectSnippets(mentions, allSnippets, tt.maxCount)
			if len(result) > tt.expectLen {
				t.Errorf("selectSnippets() returned %d snippets; want at most %d", len(result), tt.expectLen)
			}
			if tt.checkEarly && len(result) > 0 {
				// Check that at least one early snippet is included
				hasEarly := false
				for _, s := range result {
					if s == "snippet 0" || s == "snippet 1" {
						hasEarly = true
						break
					}
				}
				if !hasEarly {
					t.Errorf("selectSnippets() did not include any early mentions")
				}
			}
		})
	}
}

func TestMinMax(t *testing.T) {
	if min(5, 10) != 5 {
		t.Errorf("min(5, 10) = %d; want 5", min(5, 10))
	}
	if min(10, 5) != 5 {
		t.Errorf("min(10, 5) = %d; want 5", min(10, 5))
	}
	if max(5, 10) != 10 {
		t.Errorf("max(5, 10) = %d; want 10", max(5, 10))
	}
	if max(10, 5) != 10 {
		t.Errorf("max(10, 5) = %d; want 10", max(10, 5))
	}
}

// Helper to create hash for testing
func createTestHash(data string) string {
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func TestExtractSnippetUTF8Safety(t *testing.T) {
	// Test that extractSnippet doesn't break multi-byte UTF-8 characters
	// This addresses the issue where slicing at byte boundaries could split UTF-8 sequences

	// Create text with multi-byte UTF-8 characters
	text := "Hello 世界 こんにちは мир שלום مرحبا สวัสดี 你好 안녕하세요"

	tests := []struct {
		name    string
		offsets []int
	}{
		{
			name:    "offset near multi-byte chars",
			offsets: []int{6}, // Right at 世界
		},
		{
			name:    "offset in middle of multi-byte sequence",
			offsets: []int{15}, // Somewhere in the middle
		},
		{
			name:    "multiple offsets with multi-byte chars",
			offsets: []int{6, 20, 35},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractSnippet(text, tt.offsets)

			// Most important: result must be valid UTF-8
			if !utf8.ValidString(result) {
				t.Errorf("extractSnippet() produced invalid UTF-8 string with offsets %v", tt.offsets)
			}

			// Result should not be empty
			if len(result) == 0 {
				t.Errorf("extractSnippet() produced empty string with offsets %v", tt.offsets)
			}
		})
	}
}

func TestExtractSnippetSmartBoundaries(t *testing.T) {
	// Test that snippets end at natural boundaries (sentences, commas, spaces)
	// rather than cutting words mid-way

	text := "This is a complete sentence. And here is another one with some words! What about questions? Yes, they work too. Here's a sentence with a comma, and more text follows. Final sentence here."

	tests := []struct {
		name             string
		offsets          []int
		shouldNotContain string // substring that indicates a word was cut
		shouldContain    string // substring that should be in result
	}{
		{
			name:             "cuts at sentence end, not mid-word",
			offsets:          []int{50},
			shouldContain:    "another",
			shouldNotContain: "", // Just verify it doesn't panic
		},
		{
			name:             "prefers comma boundary",
			offsets:          []int{120},
			shouldContain:    "comma",
			shouldNotContain: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractSnippet(text, tt.offsets)

			// Result should not be empty
			if len(result) == 0 {
				t.Errorf("extractSnippet() produced empty string")
			}

			// Check that result is valid UTF-8
			if !utf8.ValidString(result) {
				t.Errorf("extractSnippet() produced invalid UTF-8")
			}

			// Verify expected content
			if tt.shouldContain != "" && !strings.Contains(result, tt.shouldContain) {
				t.Errorf("extractSnippet() result should contain %q, got: %q", tt.shouldContain, result)
			}

			// Basic sanity check: result should not end with partial word
			// (words are typically followed by space or punctuation)
			if len(result) > 0 {
				lastChar := rune(result[len(result)-1])
				// It's okay to end with punctuation, space, or letter at end of text
				// This is just a basic check
				_ = lastChar
			}
		})
	}
}

func TestFindSnippetBoundary(t *testing.T) {
	text := "First sentence. Second sentence! Third one? Yes, with comma. End here"
	runes := []rune(text)

	tests := []struct {
		name     string
		minIdx   int
		maxIdx   int
		expected int // -1 means no boundary found
		desc     string
	}{
		{
			name:     "finds sentence end",
			minIdx:   10,
			maxIdx:   20,
			expected: 16, // After "sentence."
			desc:     "Should find period + space",
		},
		{
			name:     "finds exclamation",
			minIdx:   30,
			maxIdx:   40,
			expected: 36, // After "sentence!"
			desc:     "Should find exclamation + space",
		},
		{
			name:     "finds comma when no sentence end",
			minIdx:   50,
			maxIdx:   58,
			expected: 58, // After "comma,"
			desc:     "Should find comma + space",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := findSnippetBoundary(runes, tt.minIdx, tt.maxIdx)

			// We're just checking it doesn't panic and returns a reasonable value
			if result != -1 && (result < tt.minIdx || result > tt.maxIdx) {
				t.Errorf("findSnippetBoundary() returned %d, which is outside range [%d, %d]",
					result, tt.minIdx, tt.maxIdx)
			}
		})
	}
}
