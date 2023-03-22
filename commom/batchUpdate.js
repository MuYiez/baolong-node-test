
/**
 * 传入一个数据，返回一个更新数据库的sql语句
 * @param {表名} table 
 * @param {主键} key 
 * @param {数据列表} list 
 * @param {更新的数据名列表} keyArray 
 * @returns sql语句
 */
function batchUpdate(table, key, list, keyArray) {
    const keyList = []
    let sql = `UPDATE ${table} SET `
    keyArray.forEach((res, index) => {
        sql = sql + `${res}=case ${key} `
        list.forEach(element => {
            const m = element[key] ? element[key] : ''
            const n = element[res] ? element[res] : ''
            sql = sql + `WHEN '${m}' THEN '${n}' `
        });
        if (index === keyArray.length - 1) {
            sql = sql + `end`
        } else {
            sql = sql + `end,`
        }
    })
    list.forEach(element => {
        keyList.push(element[key])
    });
    const keyString = keyList.join("','")
    return sql + ` where ${key} in ('${keyString}')`
}

module.exports = batchUpdate;