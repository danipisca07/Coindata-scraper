module.exports = {
    compareWithPrevious: (lastValues, previousValues) => {
        var tuples = lastValues.map(x => {
            return { newValue: x, oldValue: previousValues.find(y => y.coin === x.coin) }
        })
        var newEntries = tuples.filter(x => x.oldValue === undefined).map(x => x.newValue)
        var improvements = tuples.filter(x => x.oldValue !== undefined).map(x => {
            const diffTime = Math.abs(x.newValue.date - x.oldValue.date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return {
                ...x.newValue,
                watchlistImprove: (x.newValue.watchlist - x.oldValue.watchlist) / diffDays,
                watchlistImprovePercentage: (x.newValue.watchlist / x.oldValue.watchlist - 1) * 100,
            }
        })
        return {
            newEntries,
            improvements
        }
    }
}