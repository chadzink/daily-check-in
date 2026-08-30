package dailycheckin

import (
	"embed"
	"io/fs"
)

//go:embed all:frontend/dist
var distFS embed.FS

// DistFS returns the embedded filesystem rooted at frontend/dist.
func DistFS() fs.FS {
	sub, err := fs.Sub(distFS, "frontend/dist")
	if err != nil {
		panic(err)
	}
	return sub
}
