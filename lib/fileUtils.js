const fs = require('fs')
const path = require('path')

module.exports = {
    dumpToFile: async (data, dir, file) => {
        const dump = data
        return new Promise((resolve, reject) => {
            const dumpPath = path.resolve(__dirname, dir, file)
            fs.writeFile(dumpPath, dump, 'utf8', resolve)
        })
    }
}