const { JSDOM } = require('jsdom');
const dom = new JSDOM();
const el = dom.window.document.createElement('div');
el.style.setProperty('--my-var', "'HanaMinB', serif");
console.log(el.outerHTML);
