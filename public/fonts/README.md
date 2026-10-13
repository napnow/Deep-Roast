# Self-hosted production fonts

The WOFF2 files are byte-for-byte copies of the Fraunces and Manrope assets from production build `3TOJMyy9ywzUF1jhppGav`. All original language subsets, styles and fallback metrics are retained in `src/app/fonts.css`. `manifest.json` records their SHA-256 values.

This removes the build-time dependency on Google Fonts without changing the deployed typefaces. Fonts are distributed under the included SIL Open Font Licenses. License source: the corresponding `@fontsource-variable/fraunces` and `@fontsource-variable/manrope` npm packages.
