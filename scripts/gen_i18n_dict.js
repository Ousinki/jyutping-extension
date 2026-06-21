const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../_locales');
const langs = {
  'zh-HK': 'zh_TW',
  'en': 'en',
  'zh-CN': 'zh_CN',
  'ja': 'ja',
  'ko': 'ko'
};

const i18nDict = {};

for (const [key, dir] of Object.entries(langs)) {
  const filePath = path.join(localesDir, dir, 'messages.json');
  if (fs.existsSync(filePath)) {
    const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    i18nDict[key] = {};
    for (const [msgKey, msgObj] of Object.entries(messages)) {
      if (msgKey.startsWith('opt') || msgKey.startsWith('clTitle') || msgKey.startsWith('clDesc') || msgKey.startsWith('clItem')) {
        i18nDict[key][msgKey] = msgObj.message;
      }
    }
  }
}

// Write the output to a temporary file
fs.writeFileSync(path.join(__dirname, 'i18nDict_output.js'), 'const i18nDict = ' + JSON.stringify(i18nDict, null, 2) + ';\n');
console.log('Done!');
