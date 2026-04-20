export type LabelSize = '50x30' | '30x50' | '30x30'
export type SubLabel = 'top' | 'bottom'

export interface Template {
  id: string
  name: string
  html: string
  ts: string
  labelSize: LabelSize
  subLabel: SubLabel
}

const STORAGE_KEY = 'niimbot_templates'

const DEFAULT_50x30 = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 400px;
    height: 240px;
    overflow: hidden;
    font-family: Arial, sans-serif;
    background: white;
    display: flex;
    align-items: center;
    padding: 14px 18px;
    gap: 14px;
  }
  .qr {
    width: 90px;
    height: 90px;
    border: 2px solid #333;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #999;
  }
  .info { flex: 1; min-width: 0; }
  .info h1 { font-size: 20px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .loc { font-size: 13px; color: #555; margin-top: 5px; }
  .info .mpn { font-size: 11px; color: #888; margin-top: 3px; font-family: monospace; }
</style>
</head>
<body>
  <div class="qr">QR</div>
  <div class="info">
    <h1>Part Name</h1>
    <div class="loc">Location: A1 · Shelf B2</div>
    <div class="mpn">MPN: ABC-1234</div>
  </div>
</body>
</html>`

const DEFAULT_30x50 = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 240px;
    height: 400px;
    overflow: hidden;
    font-family: Arial, sans-serif;
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 12px;
    gap: 12px;
  }
  .qr {
    width: 100px;
    height: 100px;
    border: 2px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #999;
  }
  h1 { font-size: 18px; font-weight: bold; text-align: center; }
  .sub { font-size: 11px; color: #555; text-align: center; }
</style>
</head>
<body>
  <div class="qr">QR</div>
  <h1>Part Name</h1>
  <div class="sub">A1 · ABC-1234</div>
</body>
</html>`

const DEFAULT_30x15 = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 240px;
    height: 120px;
    overflow: hidden;
    font-family: Arial, sans-serif;
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    text-align: center;
  }
  h1 { font-size: 18px; font-weight: bold; }
  .sub { font-size: 11px; color: #666; margin-top: 4px; }
</style>
</head>
<body>
  <h1>Part Name</h1>
  <div class="sub">A1 · ABC-1234</div>
</body>
</html>`

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Template[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return makeDefaults()
}

export function saveTemplates(templates: Template[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

const DEFAULT_HTML: Record<LabelSize, string> = {
  '50x30': DEFAULT_50x30,
  '30x50': DEFAULT_30x50,
  '30x30': DEFAULT_30x15,
}

export const DEFAULT_TS = `// Runs inside the label iframe after HTML renders.
// Manipulate document, draw to canvas elements, etc.
// For async work, assign a Promise to window.__done.

// Example:
// const el = document.querySelector<HTMLElement>('h1');
// if (el) el.textContent = 'Dynamic Title';
`

export function createTemplate(name: string, labelSize: LabelSize): Template {
  return {
    id: crypto.randomUUID(),
    name,
    html: DEFAULT_HTML[labelSize],
    ts: DEFAULT_TS,
    labelSize,
    subLabel: 'top',
  }
}

function makeDefaults(): Template[] {
  return [
    createTemplate('50x30 Default', '50x30'),
    createTemplate('30x30 Default', '30x30'),
  ]
}
