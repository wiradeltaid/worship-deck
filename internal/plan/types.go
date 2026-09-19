package plan

type Placeholder struct {
	Key          string      `json:"key"`
	Type         string      `json:"type"`
	Required     bool        `json:"required"`
	DefaultValue interface{} `json:"defaultValue"`
}

type MeasuredWith struct {
	FontFamily string  `json:"fontFamily"`
	FontSize   float64 `json:"fontSize"`
	FontWeight string  `json:"fontWeight"`
	FontStyle  string  `json:"fontStyle"`
}

type CanvasElement struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type"`
	Required       bool                   `json:"required"`
	X              float64                `json:"x"`
	Y              float64                `json:"y"`
	W              float64                `json:"w"`
	H              float64                `json:"h"`
	ZIndex         int                    `json:"zIndex"`
	Content        *string                `json:"content"`
	WrapLines      []string               `json:"wrapLines,omitempty"`
	LongestWordPx  *float64               `json:"longestWordPx,omitempty"`
	MeasuredWith   *MeasuredWith          `json:"measuredWith,omitempty"`
	PlaceholderKey *string                `json:"placeholderKey"`
	ImageRef       *string                `json:"imageRef"`
	Rotation       *int                   `json:"rotation,omitempty"`
	Style          map[string]interface{} `json:"style"`
}

type Layout struct {
	AspectRatio     string          `json:"aspectRatio"`
	BackgroundColor string          `json:"backgroundColor"`
	BackgroundImage *string         `json:"backgroundImage"`
	Elements        []CanvasElement `json:"elements"`
}

type Template struct {
	SchemaVersion int               `json:"schemaVersion"`
	ID            string            `json:"id"`
	Label         string            `json:"label"`
	BaseType      string            `json:"baseType"`
	VariableName    *string           `json:"variableName,omitempty"`
	AnnSetID        *int              `json:"annSetId,omitempty"`
	IsPlaceholder   bool              `json:"isPlaceholder,omitempty"`
	PlaceholderSlot *int              `json:"placeholderSlot,omitempty"`
	Placeholders    []Placeholder     `json:"placeholders"`
	Layouts       map[string]Layout `json:"layouts"`
}

type ResolvedElement struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type"`
	X              float64                `json:"x"`
	Y              float64                `json:"y"`
	W              float64                `json:"w"`
	H              float64                `json:"h"`
	ZIndex         int                    `json:"zIndex"`
	Text           *string                `json:"text,omitempty"`
	WrapLines      []string               `json:"wrapLines,omitempty"`
	LongestWordPx  *float64               `json:"longestWordPx,omitempty"`
	MeasuredWith   *MeasuredWith          `json:"measuredWith,omitempty"`
	ImageURL       *string                `json:"imageUrl,omitempty"`
	PlaceholderKey *string                `json:"placeholderKey,omitempty"`
	Rotation       *int                   `json:"rotation,omitempty"`
	Style          map[string]interface{} `json:"style"`
}

type ResolvedLayout struct {
	AspectRatio     string            `json:"aspectRatio"`
	BackgroundColor string            `json:"backgroundColor"`
	BackgroundImage *string           `json:"backgroundImage,omitempty"`
	Elements        []ResolvedElement `json:"elements"`
}

type GroupRole string

const (
	RoleTitle        GroupRole = "title"
	RoleLyric        GroupRole = "lyric"
	RoleAnnouncement GroupRole = "announcement"
)

type GroupRef struct {
	ID        string    `json:"id"`
	Label     string    `json:"label"`
	Role      GroupRole `json:"role"`
	RoleLabel string    `json:"roleLabel,omitempty"`
}

type ArtifactInstance struct {
	RuntimeVersion int            `json:"runtimeVersion"`
	InstanceID     string         `json:"instanceId"`
	TemplateID     string         `json:"templateId"`
	Label          string         `json:"label"`
	BaseType       string         `json:"baseType"`
	LayoutKey      string         `json:"layoutKey"`
	Layout         ResolvedLayout `json:"layout"`
	Group          *GroupRef      `json:"group,omitempty"`
}

type DrawItem struct {
	Artifact ArtifactInstance `json:"artifact"`
	Fade     *bool            `json:"fade,omitempty"`
}

type ParsedScripture struct {
	Reference   *string `json:"reference"`
	Text        string  `json:"text"`
	Translation string  `json:"translation,omitempty"`
}

type ParsedSermon struct {
	Speaker string `json:"speaker"`
	Title   string `json:"title"`
}

type ParsedItem struct {
	Type       string `json:"type"`
	Role       string `json:"role"`
	Name       string `json:"name"`
	Title      string `json:"title"`
	Number     int    `json:"number"`
	Lyrics     string `json:"lyrics"`
	Incomplete bool   `json:"incomplete"`
}

type ParsedRundown struct {
	Date                *string          `json:"date"`
	Items               []ParsedItem     `json:"items"`
	Sermon              *ParsedSermon    `json:"sermon"`
	SpecialSong         *string          `json:"specialSong"`
	ClosingPrayerPerson *string          `json:"closingPrayerPerson"`
	ThemeVerse          *ParsedScripture `json:"themeVerse"`
	VerseReading        *ParsedScripture `json:"verseReading"`
	FamilyYouth         *string          `json:"familyYouth"`
	FamilyPrayerRequest *string          `json:"familyPrayerRequest"`
	YouthPrayerRequest  *string          `json:"youthPrayerRequest"`
	FamilyName          *string          `json:"familyName,omitempty"`
	YouthName           *string          `json:"youthName,omitempty"`
}

type Media struct {
	Flyers              []string
	SermonGraphicURL    *string
	FamilyPhotoURL      *string
	YouthPhotoURL       *string
	AnnouncementInserts []string
}

type HymnItem struct {
	BookCode   string
	Number     int
	Title      string
	Lyrics     string
	Incomplete bool
}

type AnnouncementSlide struct {
	ID        int
	AnnSetID  int
	Label     string
	Position  int
	Template  Template
}

type Snapshot struct {
	Order                 []string
	ByID                  map[string]Template
	SongInputs            map[string]HymnItem
	AnnouncementSlides    map[int][]AnnouncementSlide
	AnnouncementSetLabels map[int]string
	FieldValues           map[string]string
}

func (s Snapshot) Has(id string) bool {
	_, ok := s.ByID[id]
	return ok
}
