
var schedule = require('node-schedule');
const moment = require('moment')
// 导入数据库操作模块
const db = require('../db/index')

//每天23点获取当前参数，复制为下一天数据并填进数据库中
function getExchangeRate() {
    schedule.scheduleJob('0 0 23 * * *', function () {
        //先查询上一天数据
        const currentDate = moment(new Date()).format('YYYY-MM-DD')
        const sql = `select i.* from sku_parameter i where date = '${currentDate}'`
        db.query(sql, (err, results) => {
            if (err) {
                console.log(err)
                return
            }
            if (results.length !== 1) {
                console.log('获取当前日期参数失败')
                return
            }
            //获取后一天数据
            var now = new Date();
            var date = now.getDate();
            now.setDate(date + 1);  //获取下一天
            var y = now.getFullYear();
            var m = (now.getMonth() + 1).toString().padStart(2, "0");
            var d = now.getDate().toString().padStart(2, "0");
            var nextDate = y + "-" + m + "-" + d;
            const sql1 = `insert into sku_parameter set ?`
            const data = {
                ...results[0],
                date: nextDate
            }
            db.query(sql1, [data], (err, results) => {
                if (err) {
                    console.log(err)
                    return
                }
                console.log('生成下一天参数成功！')
            })
        })
    });
}
module.exports = getExchangeRate;