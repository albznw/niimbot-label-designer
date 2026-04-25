export function defaultHtmlForProfile(profileId: string): string {
  switch (profileId) {
    case 'simple-50x30':
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


    case 'double-30x15':
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

    case 'cable-40x30':
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 640px;
    height: 240px;
    background: #fff;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }
  .left {
    width: 320px;
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border-right: 2px solid #000;
    font-size: 20px;
    font-weight: bold;
    color: #000;
    text-align: center;
  }
  .right {
    width: 320px;
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    font-size: 16px;
    color: #444;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="left">{{name}}</div>
  <div class="right">{{tail}}</div>
</body>
</html>`

    default:
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
    align-items: center;
    justify-content: center;
    padding: 12px;
    overflow: hidden;
  }
  .name {
    font-size: 22px;
    font-weight: bold;
    color: #000;
  }
</style>
</head>
<body>
  <div class="name">{{name}}</div>
</body>
</html>`
  }
}
