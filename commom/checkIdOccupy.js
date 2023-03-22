// 导入数据库操作模块
const db = require('../db/index')
//判断id是否被占用
function checkIdOccupy(spu) {
    const id = spu.substring(spu.length - 2)
    const sql = 'select * from daily_id_list where is_occupy=0'
    return new Promise((resolve, reject) => {
        db.query(sql, (err, results) => {
            if (err) return reject(err)
            //判断该id是否存在未被占用id列表内
            if (results.findIndex(item => item.index_spu_id === id) === -1) {
                //不存在，已被占用
                resolve({
                    isOccupy: true,
                    id: results[0].index_spu_id
                })
            } else {
                //存在，不被占用
                resolve({
                    isOccupy: false,
                    id
                })
            }
        })
    })
}
module.exports = checkIdOccupy;