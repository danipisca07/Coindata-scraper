const axios = require('axios')
const cheerio = require('cheerio')

const baseUrl = "https://coinmarketcap.com"

async function main() {
    const coinList = await getTopCoins(10)
    await getWatchlists(coinList)
}

async function getTopCoins() {
    const html = await getHtml(baseUrl)
    const $= cheerio.load(html);
    const coinList = []
    const coinItems= $(".eVOXbZ .LCOyB a");
    coinItems.each((index, data) => {
        coinList.push($(data).attr('href'))
    })
    return coinList
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

async function getHtml(url){
    try {

        return (await axios.get(url)).data
    } catch(e) {
        console.log("errore axios: " + e);
    }
    return undefined
}

main().catch(e => console.error)