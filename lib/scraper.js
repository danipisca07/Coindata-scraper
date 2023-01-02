const axios = require('axios')
const cheerio = require('cheerio')
const { partitionDate } = require("./dateUtils")
const CONSTANTS = require("../constants")

module.exports = { getTopCoins, getCoinInfo }

/**
 * 
 * @param {Number} limit 
 * @param {Number} page 
 * @returns {Promise<String[]>} CoinPaths
 */
async function getTopCoins (limit, page = 1) {
    terminalClearLastLine()
    console.log("Getting page " + page + "...")
    const html = await getHtml(CONSTANTS.BASE_URL + "/?page=" + page)
    //await dumpToFile(html, "dumps", "topcoins.html")
    const $= cheerio.load(html);
    let coinList = []
    const topCoinItems= $(".cmc-table tr td:nth-child(3) a.cmc-link");
    topCoinItems.each((index, data) => {
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
    
/**
 * 
 * @param {String[]} coinList 
 * @returns {Promise<CoinData[]>}
 */
async function getCoinInfo (coinList) {
    var progress = 0
    var promises = coinList.map((coinPath) => {
        return new Promise(async (resolve, rej) => {
            const html = await getHtml(CONSTANTS.BASE_URL + coinPath)
            const $= cheerio.load(html);
            const displayName = $(".nameHeader > h2 > span > span").first().text();
            const rankItem = $(".namePillPrimary").first().text();
            const rank = parseInt(rankItem.replace(/\D/g,''));
            const watchlistItem= $(".namePill:last-of-type").first().text();
            const watchlist = parseInt(watchlistItem.replace(/\D/g,''));
            const marketCapItem= $(".statsContainer  .statsBlock:first-of-type .statsValue").first().text();
            const marketCap = parseFloat(marketCapItem.replace(/\D/g,''));
            const coin = coinPath.replace("/currencies/", "").replace("/", "")
            const result = {
                displayName: displayName,
                coin,
                coinPath,
                rank,
                watchlist,
                partitionDate : partitionDate(),
                date: new Date(),
                marketCap
            }
            const priceItems = $(".alternatePrices > p")
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

async function getHtml (url) {
    try {
        return (await axios.get(url)).data
    } catch(e) {
        throw "errore axios: " + e;
    }
}

    
function terminalClearLastLine() {
    if(process.stdout.moveCursor && process.stdout.clearLine) {
        process.stdout.moveCursor(0, -1) // up one line
        process.stdout.clearLine(1) // from cursor to end
    }
}