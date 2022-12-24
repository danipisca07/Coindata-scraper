/**
 * @typedef {Object} CoinData
 * @property {String} coin
 * @property {String} coinPath
 * @property {Number} rank
 * @property {Number} watchlist
 * @property {Number} partitionDate
 * @property {Date} date
 * @property {Number} marketCap
 */

const CONSTANTS = require('../constants')

module.exports = class CoinDataDb {
    constructor (db) {
        this.db = db;
        this.collection = db.collection(CONSTANTS.COIN_DATA_COLLECTION)
    }

    /**
     * @returns {Promise<Number>}
     */
    async getLastPartitionDate() {
        var query = await this.collection.find({}).sort({partitionDate: -1}).limit(1).toArray()
        return query[0].partitionDate
    }

    /**
     * @param {Number} partitionDate
     * @returns {Promise<CoinData[]>}
     */
    async getAllOnPartitionDate(partitionDate) {
        return this.collection.find({partitionDate}).toArray();
    }

    /**
     * @param {String[]} coins 
     * @param {Number} lastPartitionDate 
     * @returns {Promise<CoinData[]>}
     */
    async getPreviousValueForCoins (coins, lastPartitionDate) {
        const aggregation = [
            //FILTRO
              { '$match': {'partitionDate': { '$lt': lastPartitionDate },'coin': { $in: coins }} }, 
            //ORDINAMENTO
            { '$sort': {'partitionDate': -1} }, 
            //GROUPING CON SELEZIONE INTERO ELEMENTO
            { '$group': {
                '_id': '$coin', 
                'lastDocument': { '$first': '$$CURRENT' }
            }},
            //REWRITE DELLA ROOT PER ESPORRE DOCUMENTO AS ORIGINAL
            { '$replaceRoot': { 'newRoot': '$lastDocument' } }
        ];
        return await this.collection.aggregate(aggregation).toArray();    
    }

    /**
     * 
     * @param {String} coin 
     * @returns {Promise<CoinData[]>}
     */
    async getFullHistoryOfCoin (coin) {
        return await this.collection.find({coin}).sort({partitionDate: 1}).toArray();
    }

     /**
     * 
     * @param {CoinData[]} coinData
     * @param {Number} partitionDate PartitionDate sul quale verranno sovrascritti i valori
     * @typedef {Object} SaveCoinDataResult
     * @property {Number} overwrittenCount
     * @property {Number} insertedCount
     * @returns {Promise<SaveCoinDataResult>}
     */
    async saveCoinData (coinData, partitionDate) {
        const coins = coinData.map(x => x.coin)
        const clear = await this.collection.deleteMany({
            partitionDate: partitionDate, 
            coin: {$in:coins}
        })
        const res = await this.collection.insertMany(coinData)
        return {
            insertedCount: res.insertedCount - clear?.deletedCount ?? 0,
            overwrittenCount: clear?.deletedCount ?? 0
        }
    }
    
    
}