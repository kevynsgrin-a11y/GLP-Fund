# Font licences

Both self-hosted faces under `public/assets/fonts/` are SIL Open Font License
1.1. The OFL requires the licence to travel with the font files, which is why
these two files exist.

| File | Family | Licence | Copyright |
| --- | --- | --- | --- |
| `public/assets/fonts/ibm-plex-sans-v23-latin.woff2` | IBM Plex Sans (variable, wght 100–700, latin subset) | OFL 1.1 | IBM Corp. |
| `public/assets/fonts/archivo-black-v23-latin.woff2` | Archivo Black (latin subset) | OFL 1.1 | The Archivo Black Project Authors |

They live here rather than under `public/` on purpose: `test/integrity.test.js`
requires every `https://` URL inside the deployed tree to be a primary source on
its allowlist, and both licence texts cite their project's repository. Outside
`public/` that is a licence citation; inside it, it would be a failing build.

Neither file was modified. Both are the latin subsets served by the Google Fonts
API, downloaded once at design time and committed. Nothing on the site requests
anything from a third party at runtime — verified at 16 requests across one host
in `docs/design-pass-2026-09-15.md`.
