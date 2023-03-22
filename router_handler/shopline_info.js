// 导入数据库操作模块
const db = require('../db/index')

//新增店铺
exports.addShop = (req, res) => {
    const sql = `insert into shopline_info set ?`
    db.query(sql, [req.body], (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '新增店铺信息成功！',
        })
    })
}

//查询店铺
exports.searchShop = (req, res) => {
    const { user, createDate } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    let sql = `select i.*,j.nickname from shopline_info i join users j on i.user=j.id where 1=1`
    let count = `select count(*) from shopline_info i join users j on i.user=j.id where 1=1`
    if (user) {
        sql = sql + ` and i.user='${user}'`
        count = count + ` and i.user='${user}'`
    }
    if (createDate.length !== 0) {
        sql = sql + `  and str_to_date(i.createDate,'%Y-%m-%d') >= str_to_date('${createDate[0]}','%Y-%m-%d') and str_to_date(i.createDate,'%Y-%m-%d') <= str_to_date('${createDate[1]}','%Y-%m-%d')`
        count = count + `  and str_to_date(i.createDate,'%Y-%m-%d') >= str_to_date('${createDate[0]}','%Y-%m-%d') and str_to_date(i.createDate,'%Y-%m-%d') <= str_to_date('${createDate[1]}','%Y-%m-%d')`
    }
    // 根据page参数进行查询
    if (pageNum === 1) {
        sql = sql + ` limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = sql + ` limit ${startPage},${pageSize}`;
    }
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        db.query(count, (err, results1) => {
            if (err) return res.cc(err)
            res.send({
                code: 200,
                message: '查询店铺信息成功！',
                data: {
                    list: results,
                    total: results1[0].count,
                }
            })
        })
    })
}

//删除店铺
exports.deleteShop = (req, res) => {
    const { shopline_name } = req.body
    const sql = `delete from shopline_info where shopline_name="${shopline_name}"`
    db.query(sql, (err, results1) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '删除店铺信息成功！'
        })
    })
}

//修改店铺
exports.updateShop = (req, res) => {
    const { shopline_name } = req.body
    const sql = `update shopline_info set ? where shopline_name='${shopline_name}'`
    db.query(sql, [req.body], (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '修改店铺信息成功！',
        })
    })
}