async function processData(sql, pool, exchange, stock) {
  const re = /^[a-z]+$/i;
    if (!stock.match(re) || !exchange.match(re)){
      return
    }
  const request = await pool.request();
  request.input('exchange', sql.VarChar(50), exchange);
  request.input('stock', sql.VarChar(50), stock);
  let i = 1;
  while (i < 5) {
    await request.execute('runStoredProcs')
    .then(result => {
      console.log("SUCCESS");
      i = 5;
    })
    .catch(err => {
      console.log("ERROR")
    })
    i++;
  }
}

async function insertData(sql, pool, exchange, stock, data) {
    // get data from ortex
    const re = /^[a-z]+$/i;
    if (!stock.match(re) || !exchange.match(re)){
      return
    }
   
    const request = await pool.request();
    
    request.input('exchange', sql.VarChar(50), exchange);
    request.input('stock', sql.VarChar(50), stock);

    // check if already in database and filter out records already processed
    const result = await request.query('SELECT * FROM dbo.directory WHERE stock = @stock AND exchange = @exchange');
    const record = result.recordset?.[0] ?? null;
  
    if (record !== null){
      const result2 = await request.query(`SELECT TOP 1 * FROM dbo.${record.stock}_${record.exchange} ORDER BY date DESC`);
      const latest = result2.recordset?.[0]?.date ?? null;
      request.input('id', record.id);
      if (latest !== null){
        data = data.filter((i) => i.date > latest);
      }
    }
  
    const count = Object.keys(data).length;
    if (count === 0 ) {
      return;
    }
  
    // create bulk insert statement for data
    const table = new sql.Table(`[dbo].[${stock}_${exchange}`);
    table.create = true;
  
    table.columns.add('date', sql.DateTime, { nullable: false });
    table.columns.add('open', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('high', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('low', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('close', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('age', sql.Float, { nullable: false });
    table.columns.add('borrow_cost', sql.Float, { nullable: false });
    table.columns.add('freefloat_ol', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('on_loan', sql.BigInt, { nullable: false });
    table.columns.add('shorts_dtc', sql.Float, { nullable: false });
    table.columns.add('short_interest', sql.BigInt, { nullable: false });
    table.columns.add('si_freefloat', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('tickets', sql.Int, { nullable: false });
    table.columns.add('utilization', sql.Decimal(28, 2), { nullable: false });
    table.columns.add('volume', sql.BigInt, { nullable: false });
    table.columns.add('lending_volume', sql.BigInt, { nullable: false });
    table.columns.add('exchange_reported', sql.BigInt, { nullable: false });
    // Utilization z-score
    table.columns.add('crit1', sql.Decimal(28, 4), { nullable: true });
    // Utilization over 100%
    table.columns.add('crit2', sql.Int, { nullable: true });
    // Volume z-score
    table.columns.add('crit3', sql.Decimal(28, 4), { nullable: true });
    // CTB coefficient
    table.columns.add('crit4', sql.Decimal(28, 4), { nullable: true });
    // ESI z-score
    table.columns.add('crit5', sql.Decimal(28, 4), { nullable: true });
    // SI%FF z-score
    table.columns.add('crit6', sql.Decimal(28, 4), { nullable: true });
    // CB crossover of price
    table.columns.add('crit7', sql.Decimal(28, 4), { nullable: true });
    // CTB over 150%
    table.columns.add('crit8', sql.Decimal(28, 4), { nullable: true });
    // Utiliation average over 90%
    table.columns.add('crit9', sql.Decimal(28, 4), { nullable: true });
    // Utilization coefficient
    table.columns.add('crit10', sql.Decimal(28, 4), { nullable: true });
    table.columns.add('cost_basis', sql.Decimal(28, 4), { nullable: true });
    table.columns.add('squeeze_score', sql.Decimal(28, 2), { nullable: true });
  
    
    for (i = 0; i < count; i++) {
        table.rows.add(new Date(data[i].date), data[i].open, data[i].high, data[i].low, data[i].close, 
          data[i].age, data[i].c2b, data[i].ffol, Math.round(data[i].onl), data[i].shorts_dtc, 
          Math.round(data[i].sie), data[i].sieff, data[i].tickets, data[i].utl, 
          Math.round(data[i].vol), Math.round(data[i].lend_vol), Math.round(data[i].xcr),
          null, null, null, null, null, null, null, null, null, null, null);
    } 
    await request.bulk(table, (err, result) => {
        if (err) {
            console.log(err);
        }
    })
  
    // update directory table
    if (record === null){
      await request.query(`INSERT INTO dbo.directory (stock, exchange, new_data, processed) VALUES (@stock, @exchange, 1, 0)`);
    }
    else {
      await request.query(`UPDATE dbo.directory SET processed = 0, last_update = GETDATE() WHERE id = @id`)
    }

};

module.exports = {
    insertData,
    processData
}