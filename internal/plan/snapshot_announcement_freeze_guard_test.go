package plan_test

import (
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

func TestSnapshotAnnouncementFreezeBoundary(t *testing.T) {
	handle, root := newTestDB(t)

	// 1. Create an announcement set and two slides
	var annSetID int
	err := handle.QueryRow(`
		INSERT INTO announcement_sets (label, updated_at)
		VALUES ('Weekly News Label', '2026-09-01T00:00:00Z')
		RETURNING id
	`).Scan(&annSetID)
	if err != nil {
		t.Fatalf("insert announcement_set: %v", err)
	}

	slide1Payload := `{"schemaVersion":1,"id":"ann-1","label":"Slide 1","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#111111","elements":[]}}}`
	slide2Payload := `{"schemaVersion":1,"id":"ann-2","label":"Slide 2","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#222222","elements":[]}}}`

	_, err = handle.Exec(`
		INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at)
		VALUES (?, 'Pre-Edit Slide 1', ?, 0, '2026-09-01T00:00:00Z'),
		       (?, 'Pre-Edit Slide 2', ?, 1, '2026-09-01T00:00:00Z')
	`, annSetID, slide1Payload, annSetID, slide2Payload)
	if err != nil {
		t.Fatalf("insert announcement_set_slides: %v", err)
	}

	// 2. Place ann-set-marker on the spine
	_, err = handle.Exec(`
		INSERT INTO artifact_templates (id, label, base_type, position, ann_set_id, updated_at)
		VALUES ('marker-news', 'Weekly News Marker', 'ann-set-marker', 10, ?, '2026-09-01T00:00:00Z')
	`, annSetID)
	if err != nil {
		t.Fatalf("insert marker: %v", err)
	}

	// 3. Create Service 1 and freeze it via CloneRegistryToNewService
	var serviceID int
	err = handle.QueryRow(`
		INSERT INTO services (date, raw_payload, created_at, updated_at)
		VALUES ('2026-09-26', 'SABBATH, SEPTEMBER 26, 2026\nDIVINE SERVICE', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
		RETURNING id
	`).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert service: %v", err)
	}

	if err := db.CloneRegistryToNewService(handle, serviceID); err != nil {
		t.Fatalf("CloneRegistryToNewService: %v", err)
	}

	// Verify frozen state before edits
	snapBefore, err := plan.LoadSnapshot(handle, serviceID)
	if err != nil {
		t.Fatalf("LoadSnapshot before edit: %v", err)
	}
	slidesBefore := snapBefore.AnnouncementSlides[annSetID]
	if len(slidesBefore) != 2 {
		t.Fatalf("expected 2 frozen announcement slides, got %d", len(slidesBefore))
	}
	if slidesBefore[0].Label != "Pre-Edit Slide 1" {
		t.Errorf("expected slide 0 label 'Pre-Edit Slide 1', got %q", slidesBefore[0].Label)
	}
	if snapBefore.AnnouncementSetLabels[annSetID] != "Weekly News Label" {
		t.Errorf("expected set label 'Weekly News Label', got %q", snapBefore.AnnouncementSetLabels[annSetID])
	}

	// 4. EDIT live Announcement Set:
	// - Modify slide 1 label & payload
	// - Delete slide 2
	// - Add slide 3
	// - Change announcement_sets label
	// - Retarget marker on live spine to another set (or delete marker)
	_, err = handle.Exec(`
		UPDATE announcement_set_slides
		   SET label = 'Post-Edit Slide 1 Modified', payload = '{"schemaVersion":1,"id":"ann-1","label":"Post-Edit Slide 1 Modified","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#999999","elements":[]}}}'
		 WHERE ann_set_id = ? AND position = 0
	`, annSetID)
	if err != nil {
		t.Fatalf("update live slide 1: %v", err)
	}

	_, err = handle.Exec(`DELETE FROM announcement_set_slides WHERE ann_set_id = ? AND position = 1`, annSetID)
	if err != nil {
		t.Fatalf("delete live slide 2: %v", err)
	}

	slide3Payload := `{"schemaVersion":1,"id":"ann-3","label":"Slide 3 New","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#333333","elements":[]}}}`
	_, err = handle.Exec(`
		INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at)
		VALUES (?, 'Live New Slide 3', ?, 2, '2026-09-02T00:00:00Z')
	`, annSetID, slide3Payload)
	if err != nil {
		t.Fatalf("insert live slide 3: %v", err)
	}

	_, err = handle.Exec(`UPDATE announcement_sets SET label = 'Live Mutated Label' WHERE id = ?`, annSetID)
	if err != nil {
		t.Fatalf("update live set label: %v", err)
	}

	// Retarget live marker to a different (or NULL) set
	_, err = handle.Exec(`UPDATE artifact_templates SET ann_set_id = 99999 WHERE id = 'marker-news'`)
	if err != nil {
		t.Fatalf("retarget live marker: %v", err)
	}

	// 5. ASSERT FROZEN SERVICE REMAINS COMPLETELY UNCHANGED (BR-8 / AD-35)
	snapFrozenAfterEdit, err := plan.LoadSnapshot(handle, serviceID)
	if err != nil {
		t.Fatalf("LoadSnapshot frozen service after edit: %v", err)
	}

	// Frozen service's marker still targets original annSetID
	markerTmpl, ok := snapFrozenAfterEdit.ByID["marker-news"]
	if !ok {
		t.Fatalf("marker-news missing from frozen snapshot")
	}
	if markerTmpl.AnnSetID == nil || *markerTmpl.AnnSetID != annSetID {
		t.Errorf("frozen marker annSetID = %v, want %d", markerTmpl.AnnSetID, annSetID)
	}

	// Frozen service still shows 2 slides with original pre-edit labels and background colors
	slidesFrozen := snapFrozenAfterEdit.AnnouncementSlides[annSetID]
	if len(slidesFrozen) != 2 {
		t.Fatalf("frozen service announcement slides count = %d, want 2", len(slidesFrozen))
	}
	if slidesFrozen[0].Label != "Pre-Edit Slide 1" {
		t.Errorf("frozen slide 0 label = %q, want 'Pre-Edit Slide 1'", slidesFrozen[0].Label)
	}
	if slidesFrozen[0].Template.Layouts["default"].BackgroundColor != "#111111" {
		t.Errorf("frozen slide 0 bgColor = %q, want '#111111'", slidesFrozen[0].Template.Layouts["default"].BackgroundColor)
	}
	if slidesFrozen[1].Label != "Pre-Edit Slide 2" {
		t.Errorf("frozen slide 1 label = %q, want 'Pre-Edit Slide 2'", slidesFrozen[1].Label)
	}
	if snapFrozenAfterEdit.AnnouncementSetLabels[annSetID] != "Weekly News Label" {
		t.Errorf("frozen set label = %q, want 'Weekly News Label'", snapFrozenAfterEdit.AnnouncementSetLabels[annSetID])
	}

	// 6. ASSERT LIVE PREVIEW (serviceID 0) REFLECTS LIVE EDITS IMMEDIATELY
	snapLivePreview, err := plan.LoadSnapshot(handle, 0)
	if err != nil {
		t.Fatalf("LoadSnapshot live preview: %v", err)
	}
	slidesLive := snapLivePreview.AnnouncementSlides[annSetID]
	if len(slidesLive) != 2 { // Slide 1 (modified) and Slide 3 (new); Slide 2 was deleted
		t.Fatalf("live preview slides count = %d, want 2", len(slidesLive))
	}
	if slidesLive[0].Label != "Post-Edit Slide 1 Modified" {
		t.Errorf("live preview slide 0 label = %q, want 'Post-Edit Slide 1 Modified'", slidesLive[0].Label)
	}
	if snapLivePreview.AnnouncementSetLabels[annSetID] != "Live Mutated Label" {
		t.Errorf("live preview set label = %q, want 'Live Mutated Label'", snapLivePreview.AnnouncementSetLabels[annSetID])
	}

	// 7. SYNC ARTIFACT: pull live changes into frozen service
	// Restore marker to annSetID on spine first so Sync pulls it
	_, _ = handle.Exec(`UPDATE artifact_templates SET ann_set_id = ? WHERE id = 'marker-news'`, annSetID)

	if err := db.CloneRegistryToNewService(handle, serviceID); err != nil {
		t.Fatalf("sync artifact clone: %v", err)
	}

	// Verify that after sync, the frozen service now reflects post-edit content
	snapSynced, err := plan.LoadSnapshot(handle, serviceID)
	if err != nil {
		t.Fatalf("LoadSnapshot synced: %v", err)
	}
	slidesSynced := snapSynced.AnnouncementSlides[annSetID]
	if len(slidesSynced) != 2 {
		t.Fatalf("synced slides count = %d, want 2", len(slidesSynced))
	}
	if slidesSynced[0].Label != "Post-Edit Slide 1 Modified" {
		t.Errorf("synced slide 0 label = %q, want 'Post-Edit Slide 1 Modified'", slidesSynced[0].Label)
	}

	// 8. Regression: Zero slides at freeze time
	var emptySetID int
	_ = handle.QueryRow(`INSERT INTO announcement_sets (label, updated_at) VALUES ('Empty Set', '2026-09-01T00:00:00Z') RETURNING id`).Scan(&emptySetID)
	_, _ = handle.Exec(`INSERT INTO artifact_templates (id, label, base_type, position, ann_set_id, updated_at) VALUES ('marker-empty', 'Empty Marker', 'ann-set-marker', 20, ?, '2026-09-01T00:00:00Z')`, emptySetID)

	var service2ID int
	_ = handle.QueryRow(`INSERT INTO services (date, raw_payload, created_at, updated_at) VALUES ('2026-10-03', 'SABBATH, OCTOBER 3, 2026\nDIVINE SERVICE', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z') RETURNING id`).Scan(&service2ID)
	if err := db.CloneRegistryToNewService(handle, service2ID); err != nil {
		t.Fatalf("clone empty service: %v", err)
	}

	// Add slide to empty set live after freeze
	_, _ = handle.Exec(`INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at) VALUES (?, 'Late Slide', '{}', 0, '2026-09-02T00:00:00Z')`, emptySetID)

	// Frozen service 2 must still show 0 slides for emptySetID
	snap2, err := plan.LoadSnapshot(handle, service2ID)
	if err != nil {
		t.Fatalf("LoadSnapshot service 2: %v", err)
	}
	if len(snap2.AnnouncementSlides[emptySetID]) != 0 {
		t.Errorf("service 2 froze with 0 slides, but now shows %d slides (live leak!)", len(snap2.AnnouncementSlides[emptySetID]))
	}

	// 9. Cascade delete on service deletion
	var annRowCount int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM service_announcement_set_slides WHERE service_id = ?`, serviceID).Scan(&annRowCount)
	if annRowCount == 0 {
		t.Errorf("expected service_announcement_set_slides rows before delete, got 0")
	}

	_, err = handle.Exec(`DELETE FROM services WHERE id = ?`, serviceID)
	if err != nil {
		t.Fatalf("delete service: %v", err)
	}

	_ = handle.QueryRow(`SELECT COUNT(*) FROM service_announcement_set_slides WHERE service_id = ?`, serviceID).Scan(&annRowCount)
	if annRowCount != 0 {
		t.Errorf("expected 0 service_announcement_set_slides rows after cascade delete, got %d", annRowCount)
	}

	_ = root
}
