package desktop

const (
	DefaultWindowTitle  = "WorshipDeck"
	DefaultWindowWidth  = 1440
	DefaultWindowHeight = 900
	MinWindowWidth      = 1024
	MinWindowHeight     = 768
)

// WindowOptions configures the native desktop window.
type WindowOptions struct {
	Title   string
	Width   int
	Height  int
	DataDir string
}
