package desktop

const DefaultMutexName = `Local\WorshipPresenter.SingleInstance`

// SingleInstanceLock manages process mutual exclusion.
type SingleInstanceLock interface {
	Release() error
}
