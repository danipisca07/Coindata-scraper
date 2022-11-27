require('dotenv').config()
require('./lib/typedef')

const MongoClient = require('mongodb').MongoClient;
const { Table } = require('console-table-printer')

const CONSTANTS = require("./constants")
const { partitionDate } = require("./lib/dateUtils")
const { getTopCoins, getCoinInfo } = require("./lib/scraper")

async function main() {
    console.log("Retrieving top coins...\n")
    const coinList = await getTopCoins(CONSTANTS.TOP_N_COINS)
    console.log("Top " + CONSTANTS.TOP_N_COINS + " retrieved.\nDone\n-------")
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
        const clear = await db.db(process.env.MONGO_DB).collection(CONSTANTS.COIN_DATA_COLLECTION).deleteMany({
            partitionDate: partitionDate(), 
            coin: {$in:coins}
        })
        if(clear?.deletedCount)
            console.log("Overwriting " + clear.deletedCount)
        const res = await db.db(process.env.MONGO_DB).collection(CONSTANTS.COIN_DATA_COLLECTION).insertMany(coinData)
        console.log("Inserted " + res.insertedCount)
    } catch(e)
    {
        console.error(e)
    }
}


/**
 * @param {CoinInfo[]} coinData 
 */
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
        /**@type CoinInfo[] */ const previousValues = await db.db(process.env.MONGO_DB).collection(CONSTANTS.COIN_DATA_COLLECTION).aggregate(aggregation).toArray();
        
        var tuples = coinData.map(x => {
            return { newValue: x, oldValue: previousValues.find(y => y.coin === x.coin) }
        })

        /**
         * @function buildRowElement 
         * @param {CoinInfo} x
         * @returns {RowCoinInfo} Row element
         * @property {String} coin
         * @property {Number} rank
         * @property {Number} watchlist
         * @property {Number} marketCap
         * @property {String} coinPath
         */
        let buildRowElement = (x) => {
          return {
            rank: x.rank,
            coin: x.coin,
            watchlist: x.watchlist.toLocaleString() + " #",
            marketCap: x.marketCap.toLocaleString() + " $",
            coinPath: CONSTANTS.BASE_URL + x.coinPath
          }
        }

        var newEntries = tuples.filter(x => x.oldValue === undefined).map(x => x.newValue)
        var improvements = tuples.filter(x => x.oldValue !== undefined).map(x => {
            const diffTime = Math.abs(x.newValue.date - x.oldValue.date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return {
                ...x.newValue,
                watchlistImprove: (x.newValue.watchlist - x.oldValue.watchlist) / diffDays,
                watchlistImprovePercentage: (x.newValue.watchlist / x.oldValue.watchlist - 1) * 100,
            }
        })

        const tableColorMap = {colorMap: {gray: '\x1b[90m'}}//https://gist.github.com/raghav4/48716264a0f426cf95e4342c21ada8e7
        const t = new Table({colorMap: tableColorMap}) 
        var alternating = 0
        var alternatingColors = [ 'white', 'gray' ]
        improvements.forEach(x => {
          let color = x.watchlistImprovePercentage > 0.1
            ? 'green'
            : x.watchlistImprovePercentage < - 0.05
              ? 'red'
              : alternatingColors[alternating++ % alternatingColors.length]
          t.addRow({
            ...buildRowElement(x),
            "watchlist/day": x.watchlistImprove,
          }, { color })
        })
        t.printTable()

        if(newEntries.length > 0)
        {
          console.log("\n\n NEW ENTRIES \n")
          const newEntriesTable = new Table({colorMap: tableColorMap})
          newEntries.forEach(x => {
            newEntriesTable.addRow(buildRowElement(x), { color: 'green' })
          })
          newEntriesTable.printTable()
        }

    } catch(e)
    {
        console.error(e)
    }
}  

main().catch(console.error)