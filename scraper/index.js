const puppeteer = require('puppeteer');

async function scrape_data(stock, exchange, user, pass) {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--headless'],
    });
    const page = await browser.newPage();
  
    process.on('unhandledRejection', (reason, p) => {
      console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
      browser.close();
    });
  
    await page.setViewport({ width: 1200, height: 720 });
    await page.goto('https://www.ortex.com/login', { waitUntil: 'networkidle0' });
    await page.type('#id_username', user);
    await page.type('#id_password', pass);
  
    await Promise.all([
      page.keyboard.press('Enter'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]); 
  
    // TODO: parameterize exchange code and stock symbol.
    await page.goto(`https://www.ortex.com/symbol/${exchange}/${stock}/short_interest`, { waitUntil: 'networkidle0' });
    // Get window object from short interest page
    const handle = await page.evaluateHandle(() => window);
    const properties = await handle.getProperties();
    // Get combined data object
    const dataHandle = properties.get('combined_data');
    const data_properties = await dataHandle.getProperties();
    const data = await dataHandle.jsonValue();

    // Get individual data objects
    const priceHandle = data_properties.get((data.length - 1).toString());
    const prices = await priceHandle.jsonValue();
  
    const ageHandle = data_properties.get('age');
    const age = await ageHandle.jsonValue();
  
    const c2bHandle = data_properties.get('c2b');
    const c2b = await c2bHandle.jsonValue();
  
    const ffolHandle = data_properties.get('ffol');
    const ffol = await ffolHandle.jsonValue();
  
    const onlHandle = data_properties.get('onl');
    const onl = await onlHandle.jsonValue();
  
    const shorts_dtc_NoneHandle = data_properties.get('shorts_dtc_None');
    const shorts_dtc_None = await shorts_dtc_NoneHandle.jsonValue();
  
    const sieHandle = data_properties.get('sie');
    const sie = await sieHandle.jsonValue();
  
    const sieffHandle = data_properties.get('sieff');
    const sieff = await sieffHandle.jsonValue();
  
    const ticketsHandle = data_properties.get('tickets');
    const tickets = await ticketsHandle.jsonValue();
  
    const utlHandle = data_properties.get('utl');
    const utl = await utlHandle.jsonValue();
  
    const volHandle = data_properties.get('vol');
    const vol = await volHandle.jsonValue();
  
    const xcrHandle = data_properties.get('xcr');
    const xcr = await xcrHandle.jsonValue();
  
    await handle.dispose();
  
    await browser.close();
  
    const data_grid = prices.map((i) => {
      result = {
        date: new Date(i[0]),
        open: i[1],
        high: i[2],
        low: i[3],
        close: i[4],
        vol: i[5],
        age: age.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        c2b: c2b.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        ffol: ffol.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        onl: onl.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        shorts_dtc: shorts_dtc_None.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        sie: sie.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        sieff: sieff.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        tickets: tickets.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        utl: utl.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        lend_vol: vol.filter((s) => s[0] === i[0])[0]?.[1] ?? '',
        xcr: xcr.filter((s) => s[0] === i[0])[0]?.[1] ?? ''
      }
      return result;
    })
    .filter((obj) => obj.sie != '')


    return data_grid;

};

module.exports = {
    scrape_data
};