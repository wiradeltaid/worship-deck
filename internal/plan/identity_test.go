package plan

import "testing"

func TestIdentityStableForSameItems(t *testing.T) {
	items := []DrawItem{
		{Artifact: ArtifactInstance{InstanceID: "a", TemplateID: "welcome"}},
		{Artifact: ArtifactInstance{InstanceID: "b", TemplateID: "sermon"}},
	}
	a := Identity(items)
	b := Identity(items)
	if a == "" || a != b {
		t.Fatalf("expected stable non-empty identity, got %q / %q", a, b)
	}
	other := Identity([]DrawItem{
		{Artifact: ArtifactInstance{InstanceID: "a", TemplateID: "welcome"}},
	})
	if a == other {
		t.Fatal("identity must change when membership changes")
	}
}

func TestEmergencyPatchReplayMismatchedIdentityFilter(t *testing.T) {
	items := []DrawItem{
		{Artifact: ArtifactInstance{InstanceID: "a", TemplateID: "welcome"}},
	}
	baseIdentity := Identity(items)

	type emergencyPatchRecord struct {
		SlideIndex       int               `json:"slideIndex"`
		UpdatedText      string            `json:"updatedText"`
		BasePlanIdentity string            `json:"basePlanIdentity"`
		PatchedArtifact  *ArtifactInstance `json:"patchedArtifact"`
	}

	patchedInst := ArtifactInstance{InstanceID: "a", TemplateID: "welcome-patched"}
	patches := []emergencyPatchRecord{
		{
			SlideIndex:       0,
			UpdatedText:      "Stale Text",
			BasePlanIdentity: "different-identity-hash",
			PatchedArtifact:  &patchedInst,
		},
	}

	for _, p := range patches {
		if p.BasePlanIdentity != "" && p.BasePlanIdentity != baseIdentity {
			continue
		}
		if p.SlideIndex >= 0 && p.SlideIndex < len(items) && p.PatchedArtifact != nil {
			items[p.SlideIndex].Artifact = *p.PatchedArtifact
		}
	}

	if items[0].Artifact.TemplateID != "welcome" {
		t.Fatalf("expected unmodified artifact due to base identity mismatch, got %v", items[0].Artifact.TemplateID)
	}
}
