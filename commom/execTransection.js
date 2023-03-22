const pool = require("../db/index")  // 导入pool对象

//事务管理
const execTransection = (sqlArr) => {
    return new Promise((resolve, reject) => {
        var promiseArr = [];
        pool.getConnection(function (err, connection) {
            if (err) {
                return reject(err)
            }
            connection.beginTransaction(err => {
                if (err) {
                    return reject('开启事务失败')
                }
                // 将所有需要执行的sql封装为数组
                promiseArr = sqlArr.map(({ sql, values }) => {
                    return new Promise((resolve, reject) => {
                        connection.query(sql, values, (e, rows, fields) => {
                            e ? reject(e) : resolve({ rows, success: true })
                        })
                    })
                })
                // Promise调用所有sql，一旦出错，回滚，否则，提交事务并释放链接
                Promise.all(promiseArr).then(res => {
                    connection.commit((error) => {
                        connection.release()  // 释放链接
                        if (error) {
                            console.log('事务提交失败')
                            reject(error)
                        }
                        resolve(res)
                    })
                }).catch(err => {
                    connection.rollback(() => {
                        connection.release()  // 释放链接
                        console.log('数据操作回滚')
                    })
                    reject(err)
                })
            })
        });
    })
}

module.exports = execTransection