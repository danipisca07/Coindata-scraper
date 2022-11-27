const express = require('express')
require('dotenv').config()
const CoinDataDb = require('./storage/CoinData')
const HistoryComparer = require('./lib/historyComparer')
const MongoClient = require('mongodb').MongoClient;
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
    res.send(result)
})

main().catch(console.error)