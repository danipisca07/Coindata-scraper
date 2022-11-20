const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const baseUrl = "https://coinmarketcap.com"

async function main() {
    const coinList = await getTopCoins(200)
    await getWatchlists(coinList)
}

async function getTopCoins(limit, page = 1) {
    const html = await getHtml(baseUrl + "/?page=" + page)
    //await dumpToFile(html, "dumps", "topcoins.html")
    const $= cheerio.load(html);
    let coinList = []
    //Elementi visualizzati al load
    const topCoinItems= $(".eVOXbZ .LCOyB a");
    topCoinItems.each((index, data) => {
        coinList.push($(data).attr('href'))
    })
    //elementi trasformati man mano che si scrolla (l'anchor è già caricato)
    const lazyCoinItems= $(".eVOXbZ .bKFMfg a");
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

async function getWatchlists(coinList){
    for(let i = 0; i < coinList.length; i++) {
        const coinPath = coinList[i]
        const html = await getHtml(baseUrl + coinPath)
        const $= cheerio.load(html);

        const datarow= $(".cevGxl > .namePill:last-of-type");
        datarow.each((index, data) => {
            const item= $(data).text();
            const num = new Number(item.replace(/\D/g,''));
            console.log(`${coinPath} on ${num} watchlists`)
        })
    }
}

async function dumpToFile(data, dir, file){
    const dump = data //JSON.stringify(data, null, "\t")
    return new Promise((resolve, reject) => {
        const dumpPath = path.resolve(__dirname, dir, file)
        fs.writeFile(dumpPath, dump, 'utf8', resolve)
    })
}

async function getHtml(url){
    try {
        return (await axios.get(url)).data
    } catch(e) {
        console.log("errore axios: " + e);
    }
    return undefined
}

main().catch(console.error)