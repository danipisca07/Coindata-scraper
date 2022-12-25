module.exports = {
    compareWithPrevious: (lastValues, previousValues) => {
        var tuples = lastValues.map(x => {
            return { newValue: x, oldValue: previousValues.find(y => y.coin === x.coin) }
        })
        var newEntries = tuples.filter(x => x.oldValue === undefined).map(x => x.newValue)
        var improvements = tuples.filter(x => x.oldValue !== undefined).map(x => {
            const improvements = getImprovements(x.newValue, x.oldValue, "watchlist")
            return {
                ...x.newValue,
                watchlistImprove: improvements.absolute,
                watchlistImprovePercentage: improvements.percentage,
            }
        })
        return {
            newEntries,
            improvements
        }
    },
    addImproveToHistory: (values, property = "watchlist") => {
        for(let i = 1; i<values.length; i++){
            var improvement = getImprovements(values[i-1], values[i], property)
            values[i].watchlistImprove = improvement.absolute
            values[i].watchlistImprovePercentage = improvement.percentage
        }
    }
}

function getImprovements(previous, next, property = "watchlist"){
    const diffTime = Math.abs(next.date - previous.date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return {
        absolute: (next[property] - previous[property]) / diffDays,
        percentage: (next[property] / previous[property] - 1) * 100,
    }
}