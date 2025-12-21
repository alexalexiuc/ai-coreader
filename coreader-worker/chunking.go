package main

import (
	"bytes"
	"unicode"
)

type ChunkingOptions struct {
	MinChars          int // minimum number of characters before we even consider cutting
	MaxLookaheadChars int // how many extra characters to search for a nice boundary
}

type TextChunk struct {
	Text      string
	StartChar int // global char offset in the whole file
	EndChar   int // exclusive
	Error     error
}

func cleanUTF8(b []byte) string {
	return string(bytes.ToValidUTF8(b, []byte("\uFFFD")))
}

func findRuneBoundary(runes []rune, minIdx, maxIdx int) int {
	if minIdx >= len(runes) {
		return -1
	}
	if maxIdx > len(runes) {
		maxIdx = len(runes)
	}

	// 1) Paragraph break: double newline
	for i := minIdx; i < maxIdx-1; i++ {
		if runes[i] == '\n' && runes[i+1] == '\n' {
			return i + 2
		}
	}

	// 2) Sentence end: . ! ? followed by whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
			if i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
				return i + 1
			}
		}
	}

	// 3) Comma + whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if runes[i] == ',' && i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
			return i + 1
		}
	}

	// 4) Last whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if unicode.IsSpace(runes[i]) {
			return i + 1
		}
	}

	return -1
}

func ReadLogicalChunks(
	fileChunks <-chan FileChunk,
	opts ChunkingOptions,
) <-chan TextChunk {
	out := make(chan TextChunk)

	go func() {
		defer close(out)

		var buffer []rune
		chunkStartChar := 0 // global char offset for next chunk start

		for fc := range fileChunks {
			// propagate errors
			if fc.Error != nil {
				out <- TextChunk{Error: fc.Error}
				return
			}

			if len(fc.Data) == 0 {
				continue
			}

			// convert bytes → clean string → runes
			s := cleanUTF8(fc.Data)
			buffer = append(buffer, []rune(s)...)

			// try to cut as many logical chunks as possible
			for {
				if len(buffer) < opts.MinChars {
					break
				}

				minIdx := opts.MinChars
				maxIdx := min(opts.MinChars+opts.MaxLookaheadChars, len(buffer))

				boundary := findRuneBoundary(buffer, minIdx, maxIdx)

				// if no boundary but buffer too big, force cut
				if boundary == -1 {
					if len(buffer) > opts.MinChars+opts.MaxLookaheadChars {
						boundary = maxIdx
					} else {
						// wait for more chars
						break
					}
				}

				chunkRunes := buffer[:boundary]
				text := string(chunkRunes)

				out <- TextChunk{
					Text:      text,
					StartChar: chunkStartChar,
					EndChar:   chunkStartChar + boundary,
					Error:     nil,
				}

				// advance buffer and global offset
				buffer = buffer[boundary:]
				chunkStartChar += boundary
			}
		}

		// flush remainder as last chunk
		if len(buffer) > 0 {
			text := string(buffer)
			out <- TextChunk{
				Text:      text,
				StartChar: chunkStartChar,
				EndChar:   chunkStartChar + len(buffer),
				Error:     nil,
			}
		}
	}()

	return out
}
