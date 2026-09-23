# Framefolk

A client-side Gallery Wall designer built with React, TypeScript, Vite and the browser Canvas API.

## Run locally

```bash
npm install
npm run dev
```

## MVP workflow

1. Set wall dimensions in centimetres.
2. Add one or more frames and select a frame on the wall.
3. Add images and click an image thumbnail to assign it to the selected frame.
4. Adjust frame dimensions/position and image zoom/crop in the inspector.
5. Choose 150, 200 or 300 DPI and inspect the print-size/quality warning.
6. Download one prepared JPEG or download all assigned frames as a ZIP.

The project is stored in `localStorage`; exported images are processed locally in the browser. Print pixels are calculated as `cm / 2.54 * DPI`. The current MVP uses cover cropping and JPEG output; it does not perform AI upscaling.
