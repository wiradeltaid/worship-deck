package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

var (
	usernamePattern          = regexp.MustCompile(`^[a-z0-9._-]+$`)
	ErrSetupAlreadyCompleted = errors.New("initial setup has already been completed")
)

// CountAccounts returns the count of accounts in the database.
func CountAccounts(db *sql.DB) (int, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM accounts`).Scan(&count)
	return count, err
}

// CreateFirstAdmin atomically creates the initial admin account if and only if zero accounts exist.
// Returns ErrSetupAlreadyCompleted if an account already exists.
func CreateFirstAdmin(db *sql.DB, username, password string) (*Account, error) {
	u, err := ValidateUsername(username)
	if err != nil {
		return nil, err
	}
	if err := assertPassword(password); err != nil {
		return nil, err
	}
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var count int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM accounts`).Scan(&count); err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrSetupAlreadyCompleted
	}

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := tx.Exec(
		`INSERT INTO accounts (username, password_hash, role, token_version, created_at) VALUES (?, ?, 'admin', 1, ?)`,
		u, hash, now,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Account{
		ID:           int(id),
		Username:     u,
		Role:         "admin",
		TokenVersion: 1,
		CreatedAt:    now,
		PasswordHash: hash,
	}, nil
}

type Account struct {
	ID           int
	Username     string
	Role         string
	TokenVersion int
	CreatedAt    string
	PasswordHash string
}

type PublicAccount struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
}

func LookupAccount(db *sql.DB, uid int) (*Account, error) {
	row := db.QueryRow(
		`SELECT id, username, role, token_version, created_at, password_hash FROM accounts WHERE id = ?`,
		uid,
	)
	var a Account
	if err := row.Scan(&a.ID, &a.Username, &a.Role, &a.TokenVersion, &a.CreatedAt, &a.PasswordHash); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func GetAccountByUsername(db *sql.DB, username string) (*Account, error) {
	row := db.QueryRow(
		`SELECT id, username, role, token_version, created_at, password_hash FROM accounts WHERE username = ?`,
		NormalizeUsername(username),
	)
	var a Account
	if err := row.Scan(&a.ID, &a.Username, &a.Role, &a.TokenVersion, &a.CreatedAt, &a.PasswordHash); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func NormalizeUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func SessionRevoked(db *sql.DB, sid string) (bool, error) {
	if sid == "" {
		return true, nil
	}
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM revoked_sessions WHERE sid = ?`, sid).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func ValidateAgainstDB(db *sql.DB, s *Session) (*Session, error) {
	acct, err := LookupAccount(db, s.UID)
	if err != nil {
		return nil, err
	}
	if acct == nil {
		return nil, nil
	}
	if acct.Role != s.Role {
		return nil, nil
	}
	if acct.TokenVersion != s.TV {
		return nil, nil
	}
	revoked, err := SessionRevoked(db, s.SID)
	if err != nil {
		return nil, err
	}
	if revoked {
		return nil, nil
	}
	out := *s
	out.Role = acct.Role
	out.TV = acct.TokenVersion
	return &out, nil
}

func Authenticate(db *sql.DB, username, password string) *Account {
	if len(password) > MaxPassword {
		return nil
	}
	row, err := GetAccountByUsername(db, username)
	stored := DummyHash
	if err == nil && row != nil {
		stored = row.PasswordHash
	}
	ok := VerifyPassword(password, stored)
	if row == nil || !ok {
		return nil
	}
	return row
}

func ListAccounts(db *sql.DB) ([]PublicAccount, error) {
	rows, err := db.Query(`SELECT id, username, role, created_at FROM accounts ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PublicAccount
	for rows.Next() {
		var a PublicAccount
		if err := rows.Scan(&a.ID, &a.Username, &a.Role, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if out == nil {
		out = []PublicAccount{}
	}
	return out, rows.Err()
}

func assertRole(role string) (string, error) {
	if role == "admin" || role == "operator" {
		return role, nil
	}
	return "", fmt.Errorf("role must be admin or operator")
}

func assertPassword(password string) error {
	if password == "" || len(password) < MinPassword {
		return fmt.Errorf("password must be at least 8 characters")
	}
	if len(password) > MaxPassword {
		return fmt.Errorf("password is too long")
	}
	return nil
}

func ValidateUsername(username string) (string, error) {
	u := NormalizeUsername(username)
	if u == "" {
		return "", fmt.Errorf("username is required")
	}
	if len(u) > 64 {
		return "", fmt.Errorf("username is too long")
	}
	if !usernamePattern.MatchString(u) {
		return "", fmt.Errorf("username may only contain letters, numbers, dots, underscores, hyphens")
	}
	return u, nil
}

func countAdmins(tx *sql.Tx) (int, error) {
	var n int
	err := tx.QueryRow(`SELECT COUNT(*) FROM accounts WHERE role = 'admin'`).Scan(&n)
	return n, err
}

func CreateAccount(db *sql.DB, username, password, role string) (*PublicAccount, error) {
	u, err := ValidateUsername(username)
	if err != nil {
		return nil, err
	}
	if err := assertPassword(password); err != nil {
		return nil, err
	}
	r, err := assertRole(role)
	if err != nil {
		return nil, err
	}
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	res, err := db.Exec(
		`INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)`,
		u, hash, r,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, fmt.Errorf("username already exists")
		}
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	acct, err := LookupAccount(db, int(id))
	if err != nil || acct == nil {
		return nil, fmt.Errorf("Failed to create account")
	}
	return &PublicAccount{ID: acct.ID, Username: acct.Username, Role: acct.Role, CreatedAt: acct.CreatedAt}, nil
}

func UpdateAccount(db *sql.DB, id int, role *string, password *string) (*PublicAccount, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid account id")
	}
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var existing Account
	err = tx.QueryRow(
		`SELECT id, username, role, token_version, created_at, password_hash FROM accounts WHERE id = ?`,
		id,
	).Scan(&existing.ID, &existing.Username, &existing.Role, &existing.TokenVersion, &existing.CreatedAt, &existing.PasswordHash)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("account not found")
	}
	if err != nil {
		return nil, err
	}

	if role != nil {
		r, err := assertRole(*role)
		if err != nil {
			return nil, err
		}
		if existing.Role == "admin" && r != "admin" {
			n, err := countAdmins(tx)
			if err != nil {
				return nil, err
			}
			if n <= 1 {
				return nil, fmt.Errorf("Cannot change role of the last admin")
			}
		}
		if _, err := tx.Exec(`UPDATE accounts SET role = ? WHERE id = ?`, r, id); err != nil {
			return nil, err
		}
	}
	if password != nil {
		if err := assertPassword(*password); err != nil {
			return nil, err
		}
		hash, err := HashPassword(*password)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(`UPDATE accounts SET password_hash = ? WHERE id = ?`, hash, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	acct, err := LookupAccount(db, id)
	if err != nil || acct == nil {
		return nil, fmt.Errorf("account not found")
	}
	return &PublicAccount{ID: acct.ID, Username: acct.Username, Role: acct.Role, CreatedAt: acct.CreatedAt}, nil
}

func DeleteAccount(db *sql.DB, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid account id")
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var existing Account
	err = tx.QueryRow(
		`SELECT id, username, role, token_version, created_at, password_hash FROM accounts WHERE id = ?`,
		id,
	).Scan(&existing.ID, &existing.Username, &existing.Role, &existing.TokenVersion, &existing.CreatedAt, &existing.PasswordHash)
	if err == sql.ErrNoRows {
		return fmt.Errorf("account not found")
	}
	if err != nil {
		return err
	}
	if existing.Role == "admin" {
		n, err := countAdmins(tx)
		if err != nil {
			return err
		}
		if n <= 1 {
			return fmt.Errorf("Cannot delete the last admin")
		}
	}
	if _, err := tx.Exec(`DELETE FROM accounts WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func BumpTokenVersion(db *sql.DB, accountID int) (int, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`UPDATE accounts SET token_version = token_version + 1 WHERE id = ?`, accountID)
	if err != nil {
		return 0, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if n == 0 {
		return 0, fmt.Errorf("account not found")
	}
	var tv int
	if err := tx.QueryRow(`SELECT token_version FROM accounts WHERE id = ?`, accountID).Scan(&tv); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return tv, nil
}

func RevokeSession(db *sql.DB, sid string, expiresAt int64) error {
	if sid == "" {
		return fmt.Errorf("revokeSession: sid is required")
	}
	_, err := db.Exec(
		`INSERT INTO revoked_sessions (sid, expires_at) VALUES (?, ?)
		 ON CONFLICT(sid) DO UPDATE SET expires_at = MAX(expires_at, excluded.expires_at)`,
		sid, expiresAt,
	)
	if err != nil {
		return err
	}
	cutoff := time.Now().Unix() - SessionTTLSeconds
	_, _ = db.Exec(`DELETE FROM revoked_sessions WHERE expires_at <= ?`, cutoff)
	return nil
}

func BootstrapAdmin(db *sql.DB) error {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM accounts`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	user := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_BOOTSTRAP_USER")))
	password := os.Getenv("AUTH_BOOTSTRAP_PASSWORD")
	if user == "" || password == "" {
		return nil
	}
	if _, err := ValidateUsername(user); err != nil {
		return fmt.Errorf("AUTH_BOOTSTRAP_USER must be 1–64 chars: letters, numbers, . _ -")
	}
	if len(password) < MinPassword || len(password) > MaxPassword {
		return fmt.Errorf("AUTH_BOOTSTRAP_PASSWORD must be 8–128 characters")
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		`INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, 'admin')`,
		user, hash,
	)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique") {
		return nil
	}
	return err
}
