const { scrape_data } = require('./scraper');
require('dotenv').config();
const { sql, poolPromise, insertData, processData } = require('./data');
const { Client, MessageEmbed, MessageAttachment } = require('discord.js');

const {
	ORTEX_USER,
	ORTEX_PASS,
	DISCORD_TOKEN,
} = process.env;

const client = new Client();
const prefix = '!';


function getUserFromMention(mention) {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return client.users.cache.get(mention);
	}
}

client.on('ready', () => {
	
});



client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	function sendInfo() {
		const exampleEmbed = new MessageEmbed()
			.setColor('GOLD')
			.setTitle('Squeeze-Bot Information')
			.setDescription('The Squeeze-Bot was made to help identify potential short squeezes.\nBelow you will find the support commands.')
			.addFields(
				{ name: '\u200B', value: '\u200B' },
				{ name: 'Supported Commands', value: 'Squeeze-Bot will respond to the following in any channel on the server.' },
				{ name: '\u200B', value: '\u200B' },
				{ name: '!info', value: 'Returns information on the Squeeze-Bot' },
				{ name: '!tech', value: 'Returns information on squeeze score generation' },
				{ name: '!add', value: 'Adds a new stock to the Ortex scanner. Requires two arguments: stock exchange. \nExample: !add AMC NYSE' },
				{ name: '!update', value: 'Updates the short interest data for a symbol. \nExample: !update AMC' },
				{ name: '!score', value: 'Returns the calculated squeeze score of a symbol. Score is 0-10, >= 5 means a squeeze is indicated, >=6 means  it\'s highly likely or in progress. \nExample: !score AMC\nFor the score at a specific date include it formatted as yyyy-mm-dd\nExample: !score AMC 2021-01-25' },
				{ name: '!latest', value: 'Retrieve the latest Short Interest data available on the provided symbol. \nExample: !latest AMC' },
				{ name: '!fomo', value: 'Call out a fellow member attempting to fomo their life savings into a soon to be worthless stock. \nExample: !fomo @hero' },
				{ name: '\u200B', value: '\u200B' },
			)
			.setTimestamp()
			.setFooter('Memestocks Discord');

		return message.channel.send(exampleEmbed);
	}

	function sendTech() {
		const exampleEmbed = new MessageEmbed()
			.setColor('WHITE')
			.setTitle('Squeeze Score Information')
			.setDescription('The Squeeze score uses a bunch of calculations. See the spreadsheet in the bot-chat channel for more details. Plus all the messages going back a while.')
			.addFields(
				{ name: '\u200B', value: '\u200B' },
				{ name: 'Algorithm', value: 
				`	
1. Utilization: ABS(z-score of utilization) > 5. MEDIUM WEIGHT.
2. Utilization has hit 100% at least once. MEDIUM WEIGHT.
3. Volume: POS(z-score of volume) > 10. VERY STRONG WEIGHT.
4. Cost to Borrow: POS(coefficient of CTB) > .5. MEDIUM WEIGHT.
5. Estimated Short Interest: POS(z-score of ESI) > 4. STRONG WEIGHT.
6. SI%FF: POS(z-score of SI%FF) > 2. MEDIUM WEIGHT.
7. Cost Basis: Crossover of CB by price. 10% Under. STRONG WEIGHT.
8. Cost to Borrow: Over 150%. MEDIUM WEIGHT.
9. Utilization: rolling mean > 90%. MEDIUM WEIGHT.
10. Utilization: POS(coefficient of utilization) > .1. MEDIUM WEIGHT.

Note: All components are calculated based on 30 day running averages. Furthermore, the score itself has a 14 day average over the components.
`
				},
				{ name: '\u200B', value: '\u200B' },
			)
			.setTimestamp()
			.setFooter('Memestocks Discord');

		return message.channel.send(exampleEmbed);
	}

	function sendSteelMessage() {
		const attach = new MessageAttachment('https://media1.tenor.com/images/1a9da897e2e77dd304f7a479720eb1b3/tenor.gif?itemid=11280947');
		return message.channel.send(attach);
	}

	function sendFomoMessage() {
		if (args[0]) {
			const user = getUserFromMention(args[0]);

			if (!user) {
				return message.reply('Please use a proper mention on the FOMO command.');
			}
			return message.channel.send(`${user} Please listen to the wise words of hero:
From my experience, just giving my two cents, if it feels like the boat left already better not to play and fomo into low reward risk ratio plays. 
Especially for companies you dont understand 100%. Gonna make less or lose chasing imo. 
If I just stuck with what I knew best (gme/amc) would be up bigly right now instead I lost and paid an even bigger opportunity cost.`);
		}
		return;
	}

	function sendHogsMessage() {
		return message.channel.send('In the immortal words of jn_ku, "Pigs get fat, hogs get slaughtered"');
	}

	async function addTicker() {
		/*
		First check if it already exists,
		second, call Ortex scraper
		third, insert data
		*/	
		if (!args[0] || !args[1]) {
			return message.channel.send(`${message.author}: Please include valid arguments in the form !add symbol exchange`);
		}

		message.channel.send(`Processing: Please wait...`);

		const pool = await poolPromise;
		const request = pool.request();
		const stock = args[0].toUpperCase();
		const exchange = args[1].toUpperCase();
    
		request.input('stock', stock);
		request.input('exchange', exchange);
		// check if already in database
		const result = await request.query('SELECT * FROM dbo.directory WHERE stock = @stock AND exchange = @exchange');
		const record = result.recordset?.[0] ?? null;
		// update data from Ortex
		try {
			const data = await scrape_data(stock, exchange, ORTEX_USER, ORTEX_PASS);
			insertData(sql, pool, exchange, stock, data);
			// processData(sql, pool, exchange, stock);
		}
		catch (error) {
			console.log(error)
			return message.channel.send(`Adding the ticker ${stock} has failed. Please contact @onboard-miami`);
		}
		if (record === null) {
			return message.channel.send(`${message.author}: Ticker ${stock}'s short interest data has been added to the database.`);
		}
		else {
			return message.channel.send(`${message.author}: Ticker ${stock} already exists, it's short interest data has been updated.`);
		}
	}

	async function updateTicker() {
		if (!args[0]) {
			return message.channel.send(`${message.author}: Please include valid arguments in the form !update symbol`);
		}

		message.channel.send(`Processing: Please wait...`);

		const pool = await poolPromise;
		const request = pool.request();
		const stock = args[0].toUpperCase();
    
		request.input('stock', stock);
		// check if already in database
		const result = await request.query('SELECT * FROM dbo.directory WHERE stock = @stock');
		const record = result.recordset?.[0] ?? null;
		// update data from Ortex
		try {
			const data = await scrape_data(stock, record.exchange, ORTEX_USER, ORTEX_PASS);
			insertData(sql, pool, record.exchange, stock, data);
			processData(sql, pool, record.exchange, stock);
		}
		catch (error) {
			console.log(error)
			return message.channel.send(`Updating the ticker ${stock} has failed. Please contact @onboard-miami`);
		}
		if (record === null) {
			return message.channel.send(`${message.author}: Ticker ${stock}'s short interest data has been added to the database.`);
		}
		else {
			return message.channel.send(`${message.author}: Ticker ${stock}'s short interest has been updated.`);
		}
	}

	async function getTickerScore() {
		if (!args[0]) {
			return message.channel.send(`${message.author}: Please include valid arguments in the form !score symbol`);
		}

		const pool = await poolPromise;
		const request = pool.request();
		const stock = args[0].toUpperCase();
    
		request.input('stock', stock);

		const result = await request.query('SELECT * FROM dbo.directory WHERE stock = @stock');
		const record = result.recordset?.[0] ?? null;
		
		if (record === null) {
			return message.channel.send(`${message.author}: Ticker ${stock} does not exist yet, please add it.`);
		}

		await processData(sql, pool, record.exchange, record.stock)

		const score = {};

		if (args[1]) {
			request.input('date', args[1]);
			try {
				const result2 = await request.query(`SELECT * FROM dbo.${record.stock}_${record.exchange} WHERE CAST(date as DATE) = @date `);
				score.record = result2.recordset?.[0] ?? null;
			}
			catch {
				return message.channel.send(`${message.author}: Please check your arguments.`);
			}
		}
		else {
			const result2 = await request.query(`SELECT TOP 1 * FROM dbo.${record.stock}_${record.exchange} ORDER BY date DESC `);
			score.record = result2.recordset?.[0] ?? null;
		}
		
		if (score.record === null) {
			return message.channel.send(`${message.author}: Squeeze score could not be found, please check your arguments.`);
		}
		return message.channel.send(`${message.author}\nTicker: ${stock}\nScore: ${score.record.squeeze_score}\nAs of: ${score.record.date.toUTCString()}`);
		

	}

	async function getLatestTicker() {
		if (!args[0]) {
			return message.channel.send(`${message.author}: Please include valid arguments in the form !latest symbol`);
		}

		const pool = await poolPromise;
		const request = pool.request();
		const stock = args[0].toUpperCase();
    
		request.input('stock', stock);

		const result = await request.query('SELECT * FROM dbo.directory WHERE stock = @stock');
		const record = result.recordset?.[0] ?? null;
		
		if (record === null) {
			return message.channel.send(`${message.author}: Ticker ${stock} does not exist yet, please add it.`);
		}

		const result2 = await request.query(`SELECT TOP 2 * FROM dbo.${record.stock}_${record.exchange} ORDER BY date DESC `);
		si = result2.recordset?.[0] ?? null;
		prev_si = result2.recordset?.[1] ?? null;

		
		if (si === null || prev_si === null) {
			return message.channel.send(`${message.author}: Data could not be found, please check your arguments.`);
		}
		const direction = (si.cost_basis - prev_si.cost_basis) > 0 ? 'Up' : 'Down'
		const exampleEmbed = new MessageEmbed()
			.setColor('GREEN')
			.setTitle(`Ortex data for: $${stock} AS OF ${si.date.toUTCString()}`)
			.setDescription('Latest Ortex Short Interest data. If not up to date, run the !update ticker command.\nReminder that the previous day\'s data may not be available yet.')
			.addFields(
				{ name: '\u200B', value: '\u200B' },
				{ name: 'Short Interest', value: `${new Intl.NumberFormat().format(si.short_interest)}\n ${Math.round(((si.short_interest / prev_si.short_interest) - 1) * 100)}% change` },
				{ name: 'SI% of Free Float', value: `${si.si_freefloat}%\n ${Math.round((si.si_freefloat - prev_si.si_freefloat) * 100) / 100} basis point change` },
				{ name: 'Shares on loan', value: `${new Intl.NumberFormat().format(si.on_loan)}\n ${Math.round(((si.on_loan / prev_si.on_loan) - 1) * 100)}% change` },
				{ name: 'Days to Cover', value: `${Math.round(si.shorts_dtc * 100) / 100}\n ${Math.round((si.shorts_dtc - prev_si.shorts_dtc) * 100) / 100} days change` },
				{ name: 'Utilization', value: `${si.utilization}%\n ${Math.round((si.utilization - prev_si.utilization) * 100) / 100} basis point change` },
				{ name: 'Lending Volume', value: `${new Intl.NumberFormat().format(si.lending_volume)}\n ${Math.round(((si.lending_volume / prev_si.lending_volume) - 1) * 100)}% change` },
				{ name: 'Closing Price', value: `${si.close}\nPrevious close ${prev_si.close}` },
				{ name: 'Estimated Cost Basis', value: `${si.cost_basis}\n ${direction} $${Math.round((si.cost_basis - prev_si.cost_basis) * 100) / 100}` },
				{ name: '\u200B', value: '\u200B' },
			)
			.setTimestamp()
			.setFooter('Memestocks Discord');

		return message.channel.send(exampleEmbed);

	}

	switch (command) {
	case 'info':
		sendInfo();
		break;
	case 'tech':
		sendTech();
		break;
	case 'add':
		addTicker();
		break;
	case 'score':
		getTickerScore();
		break;
	case 'latest':
		getLatestTicker();
		break;
	case 'update':
		updateTicker();
		break;
	case 'fomo':
		sendFomoMessage();
		break;
	case 'hogs':
		sendHogsMessage();
		break;
	case 'pigs':
		sendHogsMessage();
		break;
	case 'profit':
		message.channel.send('You can’t go broke taking profits!');
		break;
	case 'steel':
		message.channel.send('X gon give it to ya!');
		break;
	case 'steelx':
		sendSteelMessage();
		break;
	case 'profits':
		message.channel.send('You can’t go broke taking profits!');
		break;
	case 'clvs':
		message.channel.send(`"O' cruel fate, to be thusly boned! Ask not for whom the bone bones-it bones for thee." - Bender`);
		break;
	default:
		message.channel.send('Uknown command: Use !info to view accepted commands.');
	}

});

client.login(DISCORD_TOKEN);

