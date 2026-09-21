package parse

import "github.com/wiradeltaid/worship-deck/internal/plan"

func (p Rundown) ToPlan() plan.ParsedRundown {
	items := make([]plan.ParsedItem, 0, len(p.Items))
	for _, it := range p.Items {
		items = append(items, plan.ParsedItem{
			Type:       it.Type,
			Role:       it.Role,
			Name:       it.Name,
			Title:      it.Title,
			Number:     it.Number,
			Lyrics:     it.Lyrics,
			Incomplete: it.Incomplete,
		})
	}
	out := plan.ParsedRundown{
		Date:                p.Date,
		Items:               items,
		Sermon:              nil,
		SpecialSong:         p.SpecialSong,
		ClosingPrayerPerson: p.ClosingPrayerPerson,
		ThemeVerse:          nil,
		VerseReading:        nil,
		FamilyYouth:         p.FamilyYouth,
		FamilyPrayerRequest: p.FamilyPrayerRequest,
		YouthPrayerRequest:  p.YouthPrayerRequest,
		FamilyName:          p.FamilyName,
		YouthName:           p.YouthName,
	}
	if p.Sermon != nil {
		out.Sermon = &plan.ParsedSermon{Speaker: p.Sermon.Speaker, Title: p.Sermon.Title}
	}
	if p.ThemeVerse != nil {
		out.ThemeVerse = &plan.ParsedScripture{Reference: p.ThemeVerse.Reference, Text: p.ThemeVerse.Text}
	}
	if p.VerseReading != nil {
		out.VerseReading = &plan.ParsedScripture{Reference: p.VerseReading.Reference, Text: p.VerseReading.Text}
	}
	return out
}
