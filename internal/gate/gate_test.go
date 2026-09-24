package gate

import "testing"

func TestGatedPaths(t *testing.T) {
	gated := []string{
		"/",
		"/services",
		"/services/1",
		"/services/1/present",
		"/services/1/present/projector",
		"/services/1/slideshow",
		"/services/new",
		"/admin",
		"/admin/artifacts",
		"/announcements",
		"/api/services",
		"/api/services/1",
		"/api/services/1/sync-artifact",
		"/api/services/1/pptx",
		"/api/admin/accounts",
		"/api/admin/accounts/1",
		"/api/admin/artifacts/template-id",
		"/api/admin/artifacts/order",
		"/api/uploads/x.jpg",
		"/api/uploads/0123456789abcdef0123456789abcdef.jpg",
		"/api/hymns",
		"/api/scripture",
		"/api/bible-translations",
		"/api/present/1/remote/pair",
		"/api/present/1/remote/claim",
		"/api/present/1/remote/stream",
		"/api/present/1/remote/intent",
		"/api/present/42/remote/pair",
		"/_next/staticfoo",
		"/_next/imagefoo",
		"/_next/static/x.js",
		"/_next/static/chunks/main.js",
		"/_next/image",
		"/loginfoo",
		"/logins",
		"/assetsfoo",
		"/brandingfoo",
		"/api/webhookfoo",
		"/api/auth/loginfoo",
		"/api/auth/logoutfoo",
		"/favicon.ico.map",
	}
	for _, p := range gated {
		if !IsGated(p) {
			t.Errorf("%s must be gated", p)
		}
	}
}

func TestExemptPaths(t *testing.T) {
	exempt := []string{
		"/api/webhook",
		"/api/webhook/telegram",
		"/api/auth/login",
		"/api/auth/logout",
		"/login",
		"/login/",
		"/favicon.ico",
		"/assets/welcome-bg.jpg",
		"/branding",
		"/branding/",
		"/branding/worship-deck-icon-square.svg",
		"/branding/worship-deck-mark.svg",
		"/api/setup/status",
		"/api/setup/admin",
	}
	for _, p := range exempt {
		if IsGated(p) {
			t.Errorf("%s must be exempt", p)
		}
	}

	if !IsSetupPath("/api/setup/status") || !IsSetupPath("/api/setup/admin") {
		t.Errorf("IsSetupPath must return true for setup endpoints")
	}
	if IsSetupPath("/api/auth/login") {
		t.Errorf("IsSetupPath must return false for non-setup endpoints")
	}
}
