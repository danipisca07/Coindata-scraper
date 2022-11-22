require('dotenv').config()
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const MongoClient = require('mongodb').MongoClient;
const baseUrl = "https://coinmarketcap.com"
const coinDataCollection = "CoinData"

const TOP_N_COINS = 5

async function main() {
    console.log("Retrieving top coins...\n")
    const coinList = await getTopCoins(TOP_N_COINS)
    console.log("Top " + TOP_N_COINS + " retrieved.\nDone\n-------")
    console.log("Retrieving coins data...\n")
    const res = await getCoinInfo(coinList)
    console.log("Done\n-------")
    console.log("Storing on mongoDb...")
    await storeCoinData(res)
    console.log("Done\n-------")
    console.log("Comparing with last entry...")
    await compareWithPreviousEntry(res)
    console.log("Done\n-------")
    process.exit()
}

async function getTopCoins(limit, page = 1) {
    terminalClearLastLine()
    console.log("Getting page " + page + "...")
    const html = await getHtml(baseUrl + "/?page=" + page)
    //await dumpToFile(html, "dumps", "topcoins.html")
    const $= cheerio.load(html);
    let coinList = []
    //Elementi visualizzati al load
    const topCoinItems= $(".cmc-table .LCOyB a");
    topCoinItems.each((index, data) => {
        coinList.push($(data).attr('href'))
    })
    //elementi trasformati man mano che si scrolla (l'anchor è già caricato)
    const lazyCoinItems= $(".cmc-table .bKFMfg a");
    lazyCoinItems.each((index, data) => {
        coinList.push($(data).attr('href'))
    })
    if(limit == undefined)
        return coinList
    else if(coinList.length < limit) {
        const nextPage = await getTopCoins(limit - coinList.length, ++page)
        coinList = coinList.concat(nextPage)
    }
    return coinList.slice(0, limit)
}

async function getCoinInfo(coinList){
    var progress = 0
    var promises = coinList.map((coinPath) => {
        return new Promise(async (resolve, rej) => {
            const html = await getHtml(baseUrl + coinPath)
            const $= cheerio.load(html);
            const rankItem = $(".cevGxl > .namePillPrimary").first().text();
            const rank = parseInt(rankItem.replace(/\D/g,''));
            const watchlistItem= $(".cevGxl > .namePill:last-of-type").first().text();
            const watchlist = parseInt(watchlistItem.replace(/\D/g,''));
            const marketCapItem= $(".statsContainer  .statsBlock:first-of-type .statsValue").first().text();
            const marketCap = parseFloat(marketCapItem.replace(/\D/g,''));
            const result = {
                coin: coinPath,
                rank,
                watchlist,
                partitionDate : partitionDate(),
                date: new Date(),
                marketCap
            }
            const priceItems = $(".alternatePrices > .lgtBod")
            priceItems.each((_, data) => {
                const text = $(data).text()
                if(text.match(/([^\s]*)\s/g)){
                    const value = parseFloat(text.match(/([^\s]*)\s/g).find(_ => true))
                    if(text.includes("BTC"))
                        result.btcPrice = value
                    else if(text.includes("ETH"))
                        result.ethPrice = value
                }
            })
            resolve(result)
        }).then((res) => {
            progress++
            return res
        })
    })
    var interval = setInterval(() => {
        terminalClearLastLine()
        console.log(progress + " / " + promises.length)
    }, 200)
    var res = await Promise.all(promises)
    clearInterval(interval)
    return res
}

async function storeCoinData(coinData){
    try {
        const db = await MongoClient.connect(process.env.MONGO_CONNSTRING)
        const coins = coinData.map(x => x.coin)
        const clear = await db.db(process.env.MONGO_DB).collection(coinDataCollection).deleteMany({
            partitionDate: partitionDate(), 
            coin: {$in:coins}
        })
        if(clear?.deletedCount)
            console.log("Overwriting " + clear.deletedCount)
        const res = await db.db(process.env.MONGO_DB).collection(coinDataCollection).insertMany(coinData)
        console.log("Inserted " + res.insertedCount)
    } catch(e)
    {
        console.error(e)
    }
}

async function compareWithPreviousEntry(coinData){
    try {
        const db = await MongoClient.connect(process.env.MONGO_CONNSTRING)

        const aggregation = [
            //FILTRO
              {
                '$match': {
                  'partitionDate': { '$lt': partitionDate() },
                  'coin': { $in: coinData.map(x => x.coin) }
                }
              }, 
            //ORDINAMENTO
            {
                '$sort': {
                  'partitionDate': -1
                }
              }, 
            //GROUPING CON SELEZIONE INTERO ELEMENTO
            {
                '$group': {
                  '_id': '$coin', 
                  'lastDocument': {
                    '$first': '$$CURRENT'
                  }
                }
              },
            //REWRITE DELLA ROOT PER ESPORRE DOCUMENTO AS ORIGINAL
            {
                '$replaceRoot': {
                  'newRoot': '$lastDocument'
                }
            }
        ];
        const previousValues = await db.db(process.env.MONGO_DB).collection(coinDataCollection).aggregate(aggregation).toArray();
        
        var tuples = coinData.map(x => {
            return { newValue: x, oldValue: previousValues.find(y => y.coin === x.coin) }
        })

        var newEntries = tuples.filter(x => x.oldValue === undefined)
        var improvements = tuples.filter(x => x.oldValue !== undefined).map(x => {
            const diffTime = Math.abs(x.newValue.date - x.oldValue.date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return {
                coin: x.newValue.coin,
                watchlist: (x.newValue.watchlist - x.oldValue.watchlist) / diffDays
            }
        })
        improvements.forEach(x => console.log(x.coin + " - WatchList: " + x.watchlist + "/day"));
    } catch(e)
    {
        console.error(e)
    }
}

async function dumpToFile(data, dir, file){
    const dump = data //JSON.stringify(data, null, "\t")
    return new Promise((resolve, reject) => {
        const dumpPath = path.resolve(__dirname, dir, file)
        fs.writeFile(dumpPath, dump, 'utf8', resolve)
    })
}

function partitionDate(date = undefined) {
    var d = date ? new Date(date) : new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return parseInt([year, month, day].join(''));
}

async function getHtml(url){
    try {
        return (await axios.get(url)).data
    } catch(e) {
        console.log("errore axios: " + e);
    }
    return undefined
}

const terminalClearLastLine = () => {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
  }
  

main().catch(console.error)