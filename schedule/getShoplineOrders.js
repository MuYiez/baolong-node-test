const schedule = require('node-schedule');
// 导入数据库操作模块
const db = require('../db/index')
const async = require('async');
const getOrder = require('../shopline/getOrder')

function getShoplineOrders() {
    schedule.scheduleJob('0 0 * * * *', function () {
        let sql = `select i.* from shopline_info i`

        const task = []
        db.query(sql, (err, results) => {
            if (err) return console.log("订单同步失败！")
            const shop_info = results
            shop_info.forEach(element => {
                task.push((cb) => {
                    getOrder(element, cb)
                })
            });
            async.waterfall(task, function (err, result) {
                if (err) {
                    console.log(err);
                }
                console.log("订单同步完成！")
            })
        })
    });
}

module.exports = getShoplineOrders;