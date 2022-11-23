const axios = require('axios')
const cheerio = require('cheerio')
const { partitionDate } = require("./dateUtils")

const baseUrl = "https://coinmarketcap.com"

module.exports = { getTopCoins, getCoinInfo }

/**
 * 
 * @param {Number} limit 
 * @param {Number} page 
 * @returns {String[]} CoinPaths
 */
async function getTopCoins (limit, page = 1) {
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
    
/**
 * 
 * @param {String[]} coinList 
 * @returns {CoinInfo[]}
 */
async function getCoinInfo (coinList) {
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
            const coin = coinPath.replace("/currencies/", "").replace("/", "")
            const result = {
                coin,
                coinPath,
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

async function getHtml (url) {
    try {
        return (await axios.get(url)).data
    } catch(e) {
        console.log("errore axios: " + e);
    }
    return undefined
}

    
function terminalClearLastLine() {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
}