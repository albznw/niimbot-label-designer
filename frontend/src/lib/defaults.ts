import type { LabelSize } from '../types/label'

export function defaultHtmlForSize(labelSize: LabelSize): string {
  switch (labelSize) {
    case '50x30':
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 400px;
    height: 240px;
    background: #fff;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    gap: 12px;
    overflow: hidden;
  }
  .qr-placeholder {
    width: 80px;
    height: 80px;
    border: 2px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #666;
    flex-shrink: 0;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .name {
    font-size: 22px;
    font-weight: bold;
    color: #000;
    line-height: 1.1;
  }
  .location {
    font-size: 14px;
    color: #444;
  }
</style>
</head>
<body>
  <div class="qr-placeholder">QR</div>
  <div class="info">
    <div class="name">{{name}}</div>
    <div class="location">{{location}}</div>
  </div>
</body>
</html>`

    case '30x50':
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 240px;
    height: 400px;
    background: #fff;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    gap: 10px;
    overflow: hidden;
  }
  .qr-placeholder {
    width: 80px;
    height: 80px;
    border: 2px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #666;
    flex-shrink: 0;
  }
  .name {
    font-size: 20px;
    font-weight: bold;
    color: #000;
    text-align: center;
    line-height: 1.2;
  }
  .location {
    font-size: 13px;
    color: #444;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="qr-placeholder">QR</div>
  <div class="name">{{name}}</div>
  <div class="location">{{location}}</div>
</body>
</html>`

    case '30x30':
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 240px;
    height: 240px;
    background: #fff;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px;
    gap: 6px;
    overflow: hidden;
  }
  .name {
    font-size: 22px;
    font-weight: bold;
    color: #000;
    text-align: center;
    line-height: 1.1;
  }
  .location {
    font-size: 13px;
    color: #444;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="name">{{name}}</div>
  <div class="location">{{location}}</div>
</body>
</html>`
  }
}
