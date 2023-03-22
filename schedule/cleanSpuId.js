
var schedule = require('node-schedule');
// 导入数据库操作模块
const db = require('../db/index')

function cleanSpuId() {
    schedule.scheduleJob('0 0 0 * * *', function () {
        let list = []
        for (let index = 1; index < 100; index++) {
            const element = [
                PrefixInteger(index, 2),
                0
            ]
            list.push(element)
        }

        //同时删除所有数据
        const delSql = 'delete from daily_id_list'
        db.query(delSql, (err, results) => {
            if (err) {
                console.log(err)
                return
            }
            if (results.affectedRows !== 99) return
            //注入多条数据方法
            const sql = `insert into daily_id_list (index_spu_id,is_occupy)values ?`
            db.query(sql, [list], (err, results) => {
                if (err) {
                    console.log(err)
                    return
                }
                console.log('重置sku的id成功！')
            })
        })
    });
}

function PrefixInteger(num, length) {
    return (Array(length).join('0') + num).slice(-length);
}

module.exports = cleanSpuId;