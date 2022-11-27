require('dotenv').config()
require('./lib/typedef')

const MongoClient = require('mongodb').MongoClient;
const { Table } = require('console-table-printer')

const CONSTANTS = require("./constants")
const CoinDataDb = require("./storage/CoinData")
const { partitionDate } = require("./lib/dateUtils")
const Scraper = require("./lib/scraper")
const HistoryComparer = require("./lib/historyComparer")

/** @type {CoinDataDb} */let coinDataDb = undefined

async function main() {
  const db = await MongoClient.connect(process.env.MONGO_CONNSTRING)
  coinDataDb = new CoinDataDb(db.db(process.env.MONGO_DB))
  console.log("Retrieving top coins...\n")
  const coinList = await Scraper.getTopCoins(CONSTANTS.TOP_N_COINS)
  console.log("Top " + CONSTANTS.TOP_N_COINS + " retrieved.\nDone\n-------")
  console.log("Retrieving coins data...\n")
  const res = await Scraper.getCoinInfo(coinList)
  console.log("Done\n-------")
  console.log("Storing on mongoDb...")
  const saveRes = await coinDataDb.saveCoinData(res, partitionDate())
  if(saveRes.overwrittenCount>0)
    console.log("Overwritten " + saveRes.overwrittenCount)
  console.log("Inserted " + saveRes.insertedCount)
  console.log("Done\n-------")
  console.log("Comparing with last entry...")
  await outputTable(res)
  console.log("Done\n-------")
  process.exit()
}

/**
 * @param {CoinData[]} coinData 
 */
async function outputTable(coinData){
    try {
      const previousValues = await coinDataDb.getPreviousValueForCoins(coinData.map(x => x.coin), partitionDate())
      const {newEntries, improvements} = HistoryComparer.compareWithPrevious(coinData, previousValues);

      /**
       * @function buildRowElement 
       * @param {CoinData} x
       * @returns {RowCoinData} Row element
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