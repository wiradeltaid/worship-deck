package desktop

const DefaultMutexName = `Local\WorshipDeck.SingleInstance`

// SingleInstanceLock manages process mutual exclusion.
type SingleInstanceLock interface {
	Release() error
}
