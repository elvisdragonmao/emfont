# [emfont document](https://emfont.com/docs)
## Folder structure
- `content/docs`: Document source files
- `public`: Static resource files
## Create a new page in document
### Create page
1. Add a new `.mdx` file in `content/docs`, for example `content/docs/foo.mdx`
2. Add the page name `foo` in `content/docs/meta.json` in the `pages` array
### Add an Icon to Sidebar Items

Each sidebar page should include an icon.This documentation uses `lucide-react` icons. Browse available icons at [lucide.dev](https://lucide.dev/icons/).Choose a suitable icon name and assign it in the corresponding metadata.  
## Run in local
```bash
git clone https://github.com/emfont/doc.git emfont-doc
cd emfont-doc
pnpm i
pnpm dev
```