const path = require('path')
require('dotenv').config({ path: __dirname + path.sep + ".env"})

const express = require('express')
const MongoClient = require('mongodb').MongoClient;
const cors = require('cors')

const CoinDataDb = require('./storage/CoinData')
const HistoryComparer = require('./lib/historyComparer')

var db = {}
/** @type {CoinDataDb} */ var coinDataDb = undefined

async function main() {
    db = await MongoClient.connect(process.env.MONGO_CONNSTRING)
    console.log("Connected to mongo")
    coinDataDb = new CoinDataDb(db.db(process.env.MONGO_DB))
    app.listen(process.env.BACKEND_PORT, (err) => {
        if(err){
            console.error(err)
            process.exit(1)
        }
        console.log("Server started on port " + process.env.BACKEND_PORT)
    })
}

var app = express()
app.use(cors())

app.get('/', (req, res) => {
    res.send({ok: true})
  })

app.get("/api/list", async function (req, res) {
    const lastPartitionDate = await coinDataDb.getLastPartitionDate()
    const lastValues = await coinDataDb.getAllOnPartitionDate(lastPartitionDate)
    const previousValues = await coinDataDb.getPreviousValueForCoins(lastValues.map(x => x.coin), lastPartitionDate)
    const result = HistoryComparer.compareWithPrevious(lastValues, previousValues);
    res.send(result)
})

app.get("/api/:coin", async function (req, res) {
    const result = await coinDataDb.getFullHistoryOfCoin(req.params.coin)
    HistoryComparer.addImproveToHistory(result, "watchlist")
    res.send(result)
})

app.get("/api/:coin/:property", async function (req, res) {
    if(req.params.property !== "watchlist" && req.params.property !== "marketCap")
        res.send("Prop not valid")

    function filterProperty(el, propName){
        return {
            partitionDate: el.partitionDate,
            date: el.date,
            [propName]: el[propName] 
        }
    }
    const result = await coinDataDb.getFullHistoryOfCoin(req.params.coin)
    res.send(result.map(el => filterProperty(el, req.params.property)))
})

main().catch(console.error)