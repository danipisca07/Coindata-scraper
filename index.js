const axios = require('axios')
const cheerio = require('cheerio')

const coinList = [ "ark" ]
const baseUrl = "https://coinmarketcap.com/"
const currenciesPath = "currencies/"

async function main() {
    for(let i = 0; i < coinList.length; i++) {
        const coin = coinList[i]
        const html = await getHtml(baseUrl + currenciesPath + coin)
        const $= cheerio.load(html);

        const datarow= $(".cevGxl > .namePill:last-of-type");
        datarow.each((i, data) => {
            const item= $(data).text();
            const num = new Number(item.replace(/\D/g,''));
            console.log(`${coin} on ${num} watchlists`)
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