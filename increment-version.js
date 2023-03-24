const fs = require('fs');
const path = require('path');

const versionFilePath = path.join(__dirname, 'public', 'version.json');

fs.readFile(versionFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading version.json:', err);
    return;
  }

  const versionData = JSON.parse(data);
  const versionParts = versionData.version.split('.').map(Number);
  versionParts[2] += 1;

  if (versionParts[2] >= 100) {
    versionParts[1] += 1;
    versionParts[2] = 0;
  }

  if (versionParts[1] >= 100) {
    versionParts[0] += 1;
    versionParts[1] = 0;
  }

  versionData.version = versionParts.join('.');

  fs.writeFile(versionFilePath, JSON.stringify(versionData, null, 2), (err) => {
    if (err) {
      console.error('Error writing version.json:', err);
      return;
    }
  });
});
