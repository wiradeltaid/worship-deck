package plan

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

var intercessory = map[int]struct{}{671: {}, 684: {}}

type request struct {
	id         string
	templateID string
	layoutKey  string
	values     map[string]interface{}
	fade       *bool
}

type groupChild struct {
	role      GroupRole
	roleLabel string
	req       request
}

type node struct {
	kind     string // artifact | group
	id       string
	label    string
	req      request
	children []groupChild
}

type ctx struct {
	serviceDate    string
	flyers         []string
	sermonGraphic  *string
	familyPhoto    *string
	youthPhoto     *string
	bibleTalkHymns []HymnItem
	dsOpening      *HymnItem
	dsClosing      *HymnItem
	dsMiddle       []HymnItem
	specialSong    string
	sermon         *ParsedSermon
	closingPrayer  string
	themeVerse     *ParsedScripture
	verseReading   *ParsedScripture
	familyPrayer   string
	youthPrayer    string
	familyName     string
	youthName        string
	legacyCombined   string
	familyBody          string
	announcementInserts []string
}

func trimPtr(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

func hasScripture(s *ParsedScripture) bool {
	if s == nil {
		return false
	}
	return strings.TrimSpace(ptrStr(s.Reference)) != "" || strings.TrimSpace(s.Text) != ""
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func leaf(r request) []node {
	return []node{{kind: "artifact", req: r}}
}

func songGroup(hymn HymnItem, idPrefix, templateID string) []node {
	var children []groupChild
	prefix := hymn.BookCode
	if prefix == "" {
		prefix = "SDAH"
	}
	subtitle := fmt.Sprintf("%s %d", prefix, hymn.Number)
	if hymn.Incomplete {
		subtitle = fmt.Sprintf("%s %d (incomplete)", prefix, hymn.Number)
	}
	children = append(children, groupChild{
		role: RoleTitle,
		req: request{
			id:         idPrefix + "-title",
			templateID: templateID,
			layoutKey:  "title",
			values: map[string]interface{}{
				"song_number": subtitle,
				"song_title":  hymn.Title,
			},
		},
	})
	if !hymn.Incomplete && strings.TrimSpace(hymn.Lyrics) != "" {
		for i, lyric := range SplitLyricsLabeled(hymn.Lyrics) {
			vals := map[string]interface{}{}
			layoutKey := "verse"
			if lyric.Label == "Reff" || lyric.Label == "Chorus" {
				layoutKey = "reff"
				vals["reff[]"] = lyric.Text
			} else {
				vals["verse_content[]"] = lyric.Text
				if lyric.Label != "" {
					vals["verse_number"] = lyric.Label
				}
			}
			children = append(children, groupChild{
				role:      RoleLyric,
				roleLabel: lyric.Label,
				req: request{
					id:         fmt.Sprintf("%s-lyric-%d", idPrefix, i+1),
					templateID: templateID,
					layoutKey:  layoutKey,
					values:     vals,
				},
			})
		}
	}
	if len(children) == 0 {
		return nil
	}
	return []node{{kind: "group", id: idPrefix, label: hymn.Title, children: children}}
}

func fixedLyric(id string) []node {
	return leaf(request{id: id, templateID: id})
}

func computeCtx(serviceDate string, parsed ParsedRundown, media Media) ctx {
	var flyers []string
	for _, u := range media.Flyers {
		if isAnnouncementImageURL(u) {
			flyers = append(flyers, u)
		}
	}
	var sermonGraphic, familyPhoto, youthPhoto *string
	if media.SermonGraphicURL != nil && isSafeImageURL(*media.SermonGraphicURL) {
		sermonGraphic = media.SermonGraphicURL
	}
	if media.FamilyPhotoURL != nil && isSafeImageURL(*media.FamilyPhotoURL) {
		familyPhoto = media.FamilyPhotoURL
	}
	if media.YouthPhotoURL != nil && isSafeImageURL(*media.YouthPhotoURL) {
		youthPhoto = media.YouthPhotoURL
	}
	bt, ds := bucketHymns(parsed.Items)
	filter := func(in []HymnItem) []HymnItem {
		var out []HymnItem
		for _, h := range in {
			if _, skip := intercessory[h.Number]; !skip {
				out = append(out, h)
			}
		}
		return out
	}
	bt = filter(bt)
	ds = filter(ds)
	inserts := make([]string, 4)
	for i := 0; i < 4 && i < len(media.AnnouncementInserts); i++ {
		if s := strings.TrimSpace(media.AnnouncementInserts[i]); isSafeImageURL(s) {
			inserts[i] = s
		}
	}
	c := ctx{
		serviceDate:         serviceDate,
		flyers:              flyers,
		sermonGraphic:       sermonGraphic,
		familyPhoto:         familyPhoto,
		youthPhoto:          youthPhoto,
		announcementInserts: inserts,
		bibleTalkHymns: bt,
		specialSong:    trimPtr(parsed.SpecialSong),
		sermon:         parsed.Sermon,
		closingPrayer:  trimPtr(parsed.ClosingPrayerPerson),
		familyPrayer:   trimPtr(parsed.FamilyPrayerRequest),
		youthPrayer:    trimPtr(parsed.YouthPrayerRequest),
		familyName:          trimPtr(parsed.FamilyName),
		youthName:           trimPtr(parsed.YouthName),
	}
	if hasScripture(parsed.ThemeVerse) {
		c.themeVerse = parsed.ThemeVerse
	}
	if hasScripture(parsed.VerseReading) {
		c.verseReading = parsed.VerseReading
	}
	if c.familyPrayer == "" && c.youthPrayer == "" {
		c.legacyCombined = trimPtr(parsed.FamilyYouth)
	}
	var parts []string
	if c.familyPrayer != "" {
		parts = append(parts, "Family: "+c.familyPrayer)
	}
	if c.youthPrayer != "" {
		parts = append(parts, "Youth: "+c.youthPrayer)
	}
	if len(parts) > 0 {
		c.familyBody = strings.Join(parts, "\n\n")
	} else {
		c.familyBody = c.legacyCombined
	}
	if len(ds) > 0 {
		c.dsOpening = &ds[0]
	}
	if len(ds) > 1 {
		c.dsClosing = &ds[len(ds)-1]
	}
	if len(ds) > 2 {
		c.dsMiddle = ds[1 : len(ds)-1]
	}
	return c
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func catalogValues(c ctx) map[string]interface{} {
	out := map[string]interface{}{}
	if date := firstNonEmpty(c.serviceDate); date != "" {
		out["service_date"] = date
	}
	if c.verseReading != nil {
		if ref := firstNonEmpty(ptrStr(c.verseReading.Reference)); ref != "" {
			out["scripture_reference"] = ref
		}
		if text := firstNonEmpty(c.verseReading.Text); text != "" {
			out["scripture_text"] = text
		}
		if version := firstNonEmpty(c.verseReading.Translation); version != "" {
			out["scripture_bible_version"] = version
		}
	}
	if c.themeVerse != nil {
		if ref := firstNonEmpty(ptrStr(c.themeVerse.Reference)); ref != "" {
			out["theme_reference"] = ref
		}
		if text := firstNonEmpty(c.themeVerse.Text); text != "" {
			out["theme_text"] = text
		}
	}
	if performer := firstNonEmpty(c.specialSong); performer != "" {
		out["special_song"] = performer
	}
	if c.sermon != nil {
		if title := firstNonEmpty(c.sermon.Title); title != "" {
			out["sermon_title"] = title
		}
		if speaker := firstNonEmpty(c.sermon.Speaker); speaker != "" {
			out["sermon_speaker_name"] = speaker
		}
	}
	if c.sermonGraphic != nil {
		if imageURL := firstNonEmpty(*c.sermonGraphic); imageURL != "" {
			out["sermon_poster"] = imageURL
		}
	}
	if person := firstNonEmpty(c.closingPrayer); person != "" {
		out["closing_prayer_person"] = person
	}
	if familyText := firstNonEmpty(c.familyPrayer, c.legacyCombined); familyText != "" {
		out["family_request"] = familyText
	}
	if youthText := firstNonEmpty(c.youthPrayer); youthText != "" {
		out["youth_request"] = youthText
	}
	if famName := firstNonEmpty(c.familyName); famName != "" {
		out["family_name"] = famName
	}
	if ytName := firstNonEmpty(c.youthName); ytName != "" {
		out["youth_name"] = ytName
	}
	if c.familyPhoto != nil {
		if photo := firstNonEmpty(*c.familyPhoto); photo != "" {
			out["family_photo"] = photo
		}
	}
	if c.youthPhoto != nil {
		if photo := firstNonEmpty(*c.youthPhoto); photo != "" {
			out["youth_photo"] = photo
		}
	}
	return out
}

func mergeCatalogValues(c ctx, handler map[string]interface{}) map[string]interface{} {
	out := catalogValues(c)
	for key, value := range handler {
		out[key] = value
	}
	return out
}

func nodesFor(id string, c ctx, snap Snapshot) []node {
	switch id {
	case "welcome":
		return leaf(request{
			id: "welcome", templateID: "welcome",
			values: map[string]interface{}{"service_date": c.serviceDate},
		})
	case "bible-talk-sequence":
		return leaf(request{id: "bible-talk-sequence", templateID: "bible-talk-sequence"})
	case "prayer-partners":
		return leaf(request{id: "prayer-partners", templateID: "prayer-partners"})
	case "bt-opening-song-cue":
		if !hasSongForCue(id, snap) && len(c.bibleTalkHymns) == 0 {
			return nil
		}
		return leaf(request{id: "bt-opening-song-cue", templateID: "bt-opening-song-cue"})
	case "bt-closing-song-cue":
		if !hasSongForCue(id, snap) && len(c.bibleTalkHymns) < 2 {
			return nil
		}
		return leaf(request{id: "bt-closing-song-cue", templateID: "bt-closing-song-cue"})
	case "ds-opening-song-cue":
		if !hasSongForCue(id, snap) && c.dsOpening == nil {
			return nil
		}
		return leaf(request{id: "ds-opening-song-cue", templateID: "ds-opening-song-cue"})
	case "ds-closing-song-cue":
		if !hasSongForCue(id, snap) && c.dsClosing == nil {
			return nil
		}
		return leaf(request{id: "ds-closing-song-cue", templateID: "ds-closing-song-cue"})
	case "verse-reading":
		if c.verseReading == nil {
			return nil
		}
		return leaf(request{
			id: "verse-reading", templateID: "verse-reading",
			values: map[string]interface{}{
				"scripture_reference": ptrStr(c.verseReading.Reference),
				"scripture_text":      c.verseReading.Text,
			},
		})
	case "opening-prayer":
		return leaf(request{id: "bt-opening-prayer", templateID: "opening-prayer"})
	case "bible-talk":
		return leaf(request{id: "bible-talk", templateID: "bible-talk"})
	case "closing-prayer":
		return leaf(request{id: "bt-closing-prayer", templateID: "closing-prayer"})
	case "break-time":
		return leaf(request{id: "break-time", templateID: "break-time"})
	case "ds-sequence":
		return leaf(request{id: "ds-sequence", templateID: "ds-sequence"})
	case "bible-verse-contemplation":
		vals := map[string]interface{}{}
		if c.themeVerse != nil {
			vals["theme_reference"] = ptrStr(c.themeVerse.Reference)
			vals["theme_text"] = c.themeVerse.Text
		}
		return leaf(request{
			id: "theme-verse", templateID: "bible-verse-contemplation", values: vals,
		})
	case "intercessory-prayer":
		return leaf(request{id: "intercessory-prayer", templateID: "intercessory-prayer"})
	case "intercessory-671-lyric-1":
		return fixedLyric("intercessory-671-lyric-1")
	case "intercessory-prayer-during":
		return leaf(request{id: "intercessory-prayer-during", templateID: "intercessory-prayer-during"})
	case "intercessory-684-lyric-1":
		return fixedLyric("intercessory-684-lyric-1")
	case "special-song":
		if c.specialSong == "" {
			return nil
		}
		return leaf(request{
			id: "special-song", templateID: "special-song",
			values: map[string]interface{}{"special_song": c.specialSong},
		})
	case "sermon":
		if c.sermon == nil {
			return nil
		}
		return leaf(request{
			id: "sermon", templateID: "sermon",
			values: map[string]interface{}{"sermon_title": c.sermon.Title, "sermon_speaker_name": c.sermon.Speaker},
		})
	case "sermon-flyer":
		if c.sermonGraphic == nil {
			return nil
		}
		fade := false
		return leaf(request{
			id: "sermon-graphic", templateID: "sermon-flyer",
			values: map[string]interface{}{"sermon_poster": *c.sermonGraphic},
			fade:   &fade,
		})
	case "closing-prayer-ds":
		if c.closingPrayer == "" {
			return nil
		}
		return leaf(request{
			id: "ds-closing-prayer", templateID: "closing-prayer-ds",
			values: map[string]interface{}{"closing_prayer_person": c.closingPrayer},
		})
	case "hope-lyric-1":
		return fixedLyric("hope-lyric-1")
	case "hope-lyric-2":
		return fixedLyric("hope-lyric-2")
	case "announcements-header":
		if len(c.flyers) == 0 {
			return nil
		}
		return leaf(request{id: "announcements", templateID: "announcements-header"})
	case "welcome-repeat":
		return leaf(request{id: "welcome-repeat", templateID: "welcome-repeat"})
	case "offering-tithe":
		return leaf(request{id: "offering-tithe", templateID: "offering-tithe"})
	case "midweek-prayer":
		return leaf(request{id: "midweek-prayer", templateID: "midweek-prayer"})
	case "fellowship-etiquette":
		return leaf(request{id: "fellowship-etiquette", templateID: "fellowship-etiquette"})
	case "contact":
		return leaf(request{id: "contact", templateID: "contact"})
	case "family-youth":
		if c.familyBody == "" && c.familyPhoto == nil && c.youthPhoto == nil && c.familyName == "" && c.youthName == "" {
			return nil
		}
		vals := map[string]interface{}{}
		famText := c.familyPrayer
		if famText == "" {
			famText = c.legacyCombined
		}
		if famText != "" {
			vals["family_request"] = famText
		}
		if c.youthPrayer != "" {
			vals["youth_request"] = c.youthPrayer
		}
		if c.familyName != "" {
			vals["family_name"] = c.familyName
		}
		if c.youthName != "" {
			vals["youth_name"] = c.youthName
		}
		if c.familyPhoto != nil {
			vals["family_photo"] = *c.familyPhoto
		}
		if c.youthPhoto != nil {
			vals["youth_photo"] = *c.youthPhoto
		}
		fade := false
		return leaf(request{
			id: "family-youth", templateID: "family-youth", values: vals, fade: &fade,
		})
	case "announcement-flyer":
		var out []node
		fade := false
		for i, u := range c.flyers {
			out = append(out, node{
				kind: "artifact",
				req: request{
					id:         fmt.Sprintf("flyer-%d", i),
					templateID: "announcement-flyer",
					values:     map[string]interface{}{"imageUrl": []string{u}},
					fade:       &fade,
				},
			})
		}
		return out
	case "thank-you":
		return leaf(request{id: "thank-you", templateID: "thank-you"})
	default:
		tmpl, ok := snap.ByID[id]
		if ok {
			if tmpl.BaseType == "song-set-entry" {
				vn := tmpl.ID
				if tmpl.VariableName != nil && *tmpl.VariableName != "" {
					vn = *tmpl.VariableName
				}
				hymn, hasSong := snap.SongInputs[vn]
				if !hasSong {
					// Fallback to legacy parsed rundown bucket if available for default positions
					switch vn {
					case "opening_song_bt":
						if len(c.bibleTalkHymns) > 0 {
							hymn = c.bibleTalkHymns[0]
							hasSong = true
						}
					case "closing_song_bt":
						if len(c.bibleTalkHymns) > 1 {
							hymn = c.bibleTalkHymns[1]
							hasSong = true
						}
					case "opening_song_dw":
						if c.dsOpening != nil {
							hymn = *c.dsOpening
							hasSong = true
						}
					case "closing_song_dw":
						if c.dsClosing != nil {
							hymn = *c.dsClosing
							hasSong = true
						}
					}
				}
				if hasSong {
					prefix := "song-" + strings.ReplaceAll(vn, "_", "-")
					if tmpl.ID == "bt-opening-song" {
						prefix = "bt-opening"
					} else if tmpl.ID == "bt-closing-song" {
						prefix = "bt-closing"
					} else if tmpl.ID == "ds-opening-song" {
						prefix = "ds-opening"
					} else if tmpl.ID == "ds-closing-song" {
						prefix = "ds-closing"
					} else {
						prefix = tmpl.ID
					}
					return songGroup(hymn, prefix, tmpl.ID)
				}
				return nil
			}
			if tmpl.BaseType == "ann-set-marker" {
				if tmpl.AnnSetID == nil {
					return nil
				}
				slides := snap.AnnouncementSlides[*tmpl.AnnSetID]
				if len(slides) == 0 {
					return nil
				}
				setLabel := snap.AnnouncementSetLabels[*tmpl.AnnSetID]
				if strings.TrimSpace(setLabel) == "" {
					setLabel = strings.TrimSpace(tmpl.Label)
				}
				if strings.TrimSpace(setLabel) == "" {
					setLabel = "Announcement"
				}

				groupID := fmt.Sprintf("%s-set-%d", tmpl.ID, *tmpl.AnnSetID)
				var children []groupChild
				fade := false
				for _, sl := range slides {
					if sl.Template.IsPlaceholder && sl.Template.PlaceholderSlot != nil {
						slot := *sl.Template.PlaceholderSlot
						var slotURL string
						if slot >= 1 && slot <= 4 && len(c.announcementInserts) >= slot {
							slotURL = strings.TrimSpace(c.announcementInserts[slot-1])
						}
						if slotURL == "" {
							// Empty slot: omit slide from the plan!
							continue
						}
					}
					childID := fmt.Sprintf("%s-ann-slide-%d", tmpl.ID, sl.ID)
					children = append(children, groupChild{
						role:      RoleAnnouncement,
						roleLabel: sl.Label,
						req: request{
							id:         childID,
							templateID: sl.Template.ID,
							values:     catalogValues(c),
							fade:       &fade,
						},
					})
				}
				if len(children) == 0 {
					return nil
				}
				return []node{{kind: "group", id: groupID, label: setLabel, children: children}}
			}
			if tmpl.BaseType == "general" {
				return leaf(request{id: id, templateID: id, values: catalogValues(c)})
			}
		}
		return nil
	}
}

func hasSongForCue(cueID string, snap Snapshot) bool {
	var targetVn string
	switch cueID {
	case "bt-opening-song-cue":
		targetVn = "opening_song_bt"
	case "bt-closing-song-cue":
		targetVn = "closing_song_bt"
	case "ds-opening-song-cue":
		targetVn = "opening_song_dw"
	case "ds-closing-song-cue":
		targetVn = "closing_song_dw"
	}
	if targetVn != "" {
		if _, ok := snap.SongInputs[targetVn]; ok {
			return true
		}
	}
	return false
}

func hydrateOne(snap Snapshot, r request, group *GroupRef, c ctx) (*DrawItem, error) {
	tmpl, ok := snap.ByID[r.templateID]
	if !ok {
		// Check AnnouncementSlides
		found := false
		for _, slides := range snap.AnnouncementSlides {
			for _, sl := range slides {
				if sl.Template.ID == r.templateID {
					tmpl = sl.Template
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			return nil, nil
		}
	}
	if tmpl.IsPlaceholder && tmpl.PlaceholderSlot != nil {
		slot := *tmpl.PlaceholderSlot
		var slotURL string
		if slot >= 1 && slot <= 4 && len(c.announcementInserts) >= slot {
			slotURL = strings.TrimSpace(c.announcementInserts[slot-1])
		}
		if slotURL == "" {
			return nil, nil
		}
		if tmpl.Layouts == nil {
			tmpl.Layouts = map[string]Layout{}
		}
		layout := tmpl.Layouts["default"]
		if layout.AspectRatio == "" {
			layout.AspectRatio = "16:9"
			layout.BackgroundColor = "#000000"
		}
		layout.BackgroundImage = &slotURL
		tmpl.Layouts["default"] = layout
	}
	values := r.values
	if tmpl.BaseType == "general" {
		values = mergeCatalogValues(c, r.values)
	}
	inst, err := hydrateArtifact(tmpl, r.id, r.layoutKey, values, group)
	if err != nil {
		return nil, err
	}
	item := DrawItem{Artifact: inst, Fade: r.fade}
	return &item, nil
}

func BuildSlidePlan(serviceDate string, parsed ParsedRundown, media Media, snap Snapshot) ([]DrawItem, error) {
	c := computeCtx(serviceDate, parsed, media)
	var items []DrawItem
	for _, id := range snap.Order {
		for _, n := range nodesFor(id, c, snap) {
			if n.kind == "group" {
				g := &GroupRef{ID: n.id, Label: n.label}
				for _, ch := range n.children {
					gg := *g
					gg.Role = ch.role
					gg.RoleLabel = ch.roleLabel
					item, err := hydrateOne(snap, ch.req, &gg, c)
					if err != nil {
						return nil, err
					}
					if item != nil {
						items = append(items, *item)
					}
				}
				continue
			}
			item, err := hydrateOne(snap, n.req, nil, c)
			if err != nil {
				return nil, err
			}
			if item != nil {
				items = append(items, *item)
			}
		}
	}
	return items, nil
}

type ServiceRow struct {
	ID            int
	Date          string
	ParsedData    sql.NullString
	ImagesPayload sql.NullString
}

func LoadService(db *sql.DB, id int) (*ServiceRow, error) {
	row := db.QueryRow(
		`SELECT id, date, parsed_data, images_payload FROM services WHERE id = ?`,
		id,
	)
	var s ServiceRow
	if err := row.Scan(&s.ID, &s.Date, &s.ParsedData, &s.ImagesPayload); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func ParseRundownJSON(s string) (ParsedRundown, error) {
	var parsed ParsedRundown
	if err := json.Unmarshal([]byte(s), &parsed); err != nil {
		return parsed, err
	}
	if parsed.Items == nil {
		return parsed, fmt.Errorf("items missing")
	}
	return parsed, nil
}

func PlanForService(db *sql.DB, serviceID int) (date string, items []DrawItem, transition string, err error) {
	svc, err := LoadService(db, serviceID)
	if err != nil {
		return "", nil, "", err
	}
	if svc == nil || !svc.ParsedData.Valid || svc.ParsedData.String == "" {
		return "", nil, "", sql.ErrNoRows
	}
	parsed, err := ParseRundownJSON(svc.ParsedData.String)
	if err != nil {
		return "", nil, "", err
	}
	snap, err := LoadSnapshot(db, serviceID)
	if err != nil {
		return "", nil, "", err
	}
	media := LoadMedia(db, serviceID, svc.ImagesPayload)
	items, planErr := BuildSlidePlan(svc.Date, parsed, media, snap)
	if planErr != nil {
		return "", nil, "", planErr
	}
	return svc.Date, items, LoadTransition(db), nil
}
