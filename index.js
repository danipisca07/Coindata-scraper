require('dotenv').config()
require('./lib/typedef')

const MongoClient = require('mongodb').MongoClient;

const coinDataCollection = "CoinData"

const { partitionDate } = require("./lib/dateUtils")
const { getTopCoins, getCoinInfo } = require("./lib/scraper")

const TOP_N_COINS = 200

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


/**
 * @param {CoinInfo[]} coinData 
 */
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

main().catch(console.error)