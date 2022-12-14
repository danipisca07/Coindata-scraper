module.exports = {
    partitionDate(date = undefined) {
        var d = date ? new Date(date) : new Date(),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
    
        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;
    
        return parseInt([year, month, day].join(''));
    }
}