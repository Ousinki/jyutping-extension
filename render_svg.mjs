import puppeteer from 'puppeteer';
import path from 'path';

async function render() {
  const browser = await puppeteer.launch({ headless: 'new' });
  
  // Render Marquee (1400x560)
  const pageMarquee = await browser.newPage();
  await pageMarquee.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await pageMarquee.goto('file://' + path.resolve('promo_marquee.svg'));
  await pageMarquee.screenshot({ path: 'promo_marquee.png', omitBackground: true });
  
  // Render Small (440x280)
  const pageSmall = await browser.newPage();
  await pageSmall.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await pageSmall.goto('file://' + path.resolve('promo_small.svg'));
  await pageSmall.screenshot({ path: 'promo_small.png', omitBackground: true });

  await browser.close();
}

render();
