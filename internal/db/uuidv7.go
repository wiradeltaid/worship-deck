package db

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"sync"
	"time"
)

var (
	uuidv7Mutex   sync.Mutex
	lastTimestamp int64
	seqCounter    uint16
	uuidv7Regex   = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

// NewUUIDv7 generates an RFC 9562 compliant, strictly monotonic time-sortable UUID version 7 string.
func NewUUIDv7() string {
	uuidv7Mutex.Lock()
	defer uuidv7Mutex.Unlock()
	return generateUUIDv7(time.Now().UnixMilli())
}

// newUUIDv7At generates a strictly monotonic UUIDv7 for a deterministic logical timestamp (test hook).
func newUUIDv7At(now int64) string {
	uuidv7Mutex.Lock()
	defer uuidv7Mutex.Unlock()
	return generateUUIDv7(now)
}

func resetUUIDv7State() {
	uuidv7Mutex.Lock()
	defer uuidv7Mutex.Unlock()
	lastTimestamp = 0
	seqCounter = 0
}

func generateUUIDv7(now int64) string {
	if now <= lastTimestamp {
		// Clock skew or same millisecond: advance sequence counter
		seqCounter++
		if seqCounter > 0x0FFF {
			// Counter exhaustion in one millisecond (4,096 IDs): advance logical timestamp
			lastTimestamp++
			seqCounter = 0
		}
		now = lastTimestamp
	} else {
		lastTimestamp = now
		seqCounter = 0
	}

	var b [16]byte

	// 48-bit timestamp (milliseconds since Unix epoch)
	b[0] = byte(now >> 40)
	b[1] = byte(now >> 32)
	b[2] = byte(now >> 24)
	b[3] = byte(now >> 16)
	b[4] = byte(now >> 8)
	b[5] = byte(now)

	// 4-bit version (0x7) and 12-bit sequence counter (strictly monotonic)
	b[6] = 0x70 | byte((seqCounter>>8)&0x0F)
	b[7] = byte(seqCounter & 0xFF)

	// Random data for remaining 62 bits
	var randomBytes [8]byte
	_, _ = rand.Read(randomBytes[:])

	// 2-bit variant (10) and 62-bit random payload
	b[8] = 0x80 | (randomBytes[0] & 0x3F)
	copy(b[9:], randomBytes[1:8])

	var buf [36]byte
	hex.Encode(buf[0:8], b[0:4])
	buf[8] = '-'
	hex.Encode(buf[9:13], b[4:6])
	buf[13] = '-'
	hex.Encode(buf[14:18], b[6:8])
	buf[18] = '-'
	hex.Encode(buf[19:23], b[8:10])
	buf[23] = '-'
	hex.Encode(buf[24:36], b[10:16])

	return string(buf[:])
}

// IsValidUUIDv7 checks if a given string matches RFC 9562 UUIDv7 format.
func IsValidUUIDv7(s string) bool {
	return uuidv7Regex.MatchString(s)
}

// FormatUUID helper ensures proper UUID dashes.
func FormatUUID(b [16]byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
