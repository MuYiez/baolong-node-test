// 导入数据库操作模块
const moment = require('moment/moment');
const db = require('../db/index')
const execTransection = require('../commom/execTransection')

//查询成员
exports.search = (req, res) => {
    const { id, createDate } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    let sql = `select i.* from users i where 1=1`
    let count = `select count(*) from users i where 1=1`
    let condition = ''
    if (createDate.length !== 0) {
        condition = condition + ` and str_to_date(i.createDate,'%Y-%m-%d') >= str_to_date('${createDate[0]}','%Y-%m-%d') and str_to_date(i.createDate,'%Y-%m-%d') <= str_to_date('${createDate[1]}','%Y-%m-%d')`
    }
    count = count + condition
    // 根据page参数进行查询
    if (pageNum === 1) {
        sql = sql + condition + ` limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = sql + condition + ` limit ${startPage},${pageSize}`;
    }
    db.query(count, (err, results1) => {
        if (err) return res.cc(err)

        db.query(sql, (err, results) => {
            if (err) return res.cc(err)
            const search_id = id.length ? id[id.length - 1] : req.user.id
            const current_list = [results.find(e => e.id === search_id)]
            const crew_list = findAllCrew(results, current_list)
            const user_index = crew_list.findIndex(e => e.id === req.user.id)
            if (user_index !== -1) crew_list.splice(crew_list.findIndex(e => e.id === req.user.id), 1)
            const exclude_list = crew_list.map(item => {
                return { ...item, password: '', createDate: moment(item.createDate).format("YYYY-MM-DD HH:mm:ss"), parentName: results.find(e => item.parent_id === e.id).nickname }
            })
            res.send({
                code: 200,
                message: '查询成员信息成功！',
                data: {
                    list: exclude_list,
                    total: results1[0].count
                }
            })
        })
    })
}

/**
 * 返回该成员下所有的成员
 * @param {array} list 数组
 * @param {array} hasList 
 */
const findAllCrew = (list, hasList) => {
    const reList = []
    list.forEach(item => {
        if (hasList.findIndex(element => element.id === item.parent_id) !== -1) {
            hasList.push(item)
        } else {
            reList.push(item)
        }
    })
    if (reList.length === list.length) {
        return hasList
    } else {
        return findAllCrew(reList, hasList)
    }
}

// 获取我的用户的基本信息
exports.getMyCrew = (req, res) => {
    let sql = `select i.* from users i`
    // 执行 SQL 语句查询用户是否存在
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        const current_list = [results.find(element => element.id === req.user.id)]
        const crew_list = findAllCrew(results, current_list).map(item => {
            const { id, parent_id, nickname } = item
            return {
                value: id, parent_id, label: nickname
            }
        })
        if (results.length === 0) return res.cc('获取用户信息失败！')
        res.send({
            code: 200,
            message: '获取用户信息成功！',
            data: toTree(crew_list, current_list[0].parent_id)
        })
    })
}

/**
 * 将数据构建成树
 * @param {array} list 数据
 * @param {array} pid 节点
 * @returns 树
 */
function toTree(list, pid) {
    let treeList = []
    treeList = list.filter(item => {
        return item.parent_id == pid
    })
    treeList.forEach(item => {
        item.children = toTree(list, item.value)
    });
    return treeList
}

// 获取成员菜单权限
exports.getCrewMenu = (req, res) => {
    const { id } = req.body
    const sql = `select primary_menu,secondary_menu,thirdary_menu,button_menu from users where id='${id}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        const { primary_menu, secondary_menu, button_menu } = results[0]
        //根据前端框架限制
        const secondary_menu_array = secondary_menu ? secondary_menu.split(',') : []
        const button_menu_array = button_menu ? button_menu.split(',') : []

        const sql = `select * from button_menu where id in ('${button_menu_array.join("','")}')`
        db.query(sql, (err, results) => {
            if (err) return res.cc(err)
            results.forEach(i => {
                const index = secondary_menu_array.findIndex(m => m === i.parent_name)
                if (index !== -1) secondary_menu_array.splice(index, 1)
            })
            res.send({
                code: 200,
                message: '获取成员菜单权限成功！',
                data: button_menu_array.concat(secondary_menu_array)
            })
        })
    })
}

// 新增成员
exports.addCrew = (req, res) => {
    const parent_id = req.user.id
    const userName = req.body.userName
    const createDate = moment(new Date()).format("YYYY-MM-DD HH:mm:ss")
    db.query(`select department from users where id = ${parent_id}`, (err, results) => {
        if (err) return res.cc(err)
        const department = results[0].department

        //检查账号是否重复
        db.query(`select 1 from users i where i.userName='${userName}' limit 1`, (err, results) => {
            if (err) return res.cc(err)
            if (results[0]) return res.cc('账号重复，请重新修改！')

            findMenu(req.body).then(updateData => {
                updateData.parent_id = parent_id
                updateData.createDate = createDate
                updateData.department = department
                db.query(`insert into users set ?`, [updateData], (err, results) => {
                    if (err) return res.cc(err)
                    const gross_columns = [
                        {
                            "column_key": "adRate",
                            "title": "广告费",
                            "req": 8,
                            "is_show": "1"
                        },
                        {
                            "column_key": "balancePoint",
                            "title": "盈亏点",
                            "req": 18,
                            "is_show": "1"
                        },
                        {
                            "column_key": "businessVolume",
                            "title": "营业额",
                            "req": 7,
                            "is_show": "1"
                        },
                        {
                            "column_key": "effect",
                            "title": "单成效",
                            "req": 19,
                            "is_show": "1"
                        },
                        {
                            "column_key": "estimatedProfit",
                            "title": "预估毛利",
                            "req": 20,
                            "is_show": "1"
                        },
                        {
                            "column_key": "freight",
                            "title": "运费",
                            "req": 10,
                            "is_show": "1"
                        },
                        {
                            "column_key": "gramPrice",
                            "title": "克重单价",
                            "req": 9,
                            "is_show": "1"
                        },
                        {
                            "column_key": "grossProfitRatio",
                            "title": "毛利占比",
                            "req": 14,
                            "is_show": "1"
                        },
                        {
                            "column_key": "name_cn",
                            "title": "sku商品名称",
                            "req": 1,
                            "is_show": "1"
                        },
                        {
                            "column_key": "orderQuantity",
                            "title": "订单量",
                            "req": 6,
                            "is_show": "1"
                        },
                        {
                            "column_key": "paypalCost",
                            "title": "paypal提现费",
                            "req": 17,
                            "is_show": "1"
                        },
                        {
                            "column_key": "perCustomerTransaction",
                            "title": "客单价",
                            "req": 13,
                            "is_show": "1"
                        },
                        {
                            "column_key": "procurementCost",
                            "title": "采购成本",
                            "req": 11,
                            "is_show": "1"
                        },
                        {
                            "column_key": "purchase_ref_price",
                            "title": "参考价",
                            "req": 2,
                            "is_show": "1"
                        },
                        {
                            "column_key": "roi",
                            "title": "roi",
                            "req": 15,
                            "is_show": "1"
                        },
                        {
                            "column_key": "salesVolume",
                            "title": "销量",
                            "req": 5,
                            "is_show": "1"
                        },
                        {
                            "column_key": "serviceCharge",
                            "title": "手续费",
                            "req": 12,
                            "is_show": "1"
                        },
                        {
                            "column_key": "size",
                            "title": "尺寸(cm)",
                            "req": 4,
                            "is_show": "1"
                        },
                        {
                            "column_key": "sku_goods_id",
                            "title": "sku编号",
                            "req": 0,
                            "is_show": "1"
                        },
                        {
                            "column_key": "unitProfit",
                            "title": "每单利润",
                            "req": 16,
                            "is_show": "1"
                        },
                        {
                            "column_key": "weight",
                            "title": "重量(g)",
                            "req": 3,
                            "is_show": "1"
                        }
                    ]
                    const updateColumns = []
                    gross_columns.forEach(item => {
                        const { column_key, title, req, is_show } = item
                        updateColumns.push([
                            column_key, title, results.insertId, req, is_show
                        ])
                    })
                    db.query(`insert into user_gross_sort (column_key,title,user_id,req,is_show)values ?`, [updateColumns], (err, results) => {
                        if (err) return res.cc(err)
                        res.send({
                            code: 200,
                            message: '新增成员信息成功！'
                        })
                    })
                })
            })
        })
    })

}

/**
 * 解析出插入的users表数据
 * @param {object} data 参数
 * @returns promise对象
 */
const findMenu = (data) => {
    let { email, nickname, phone, password, status, userName, home_page, menu } = data
    let primary_menu = []
    let secondary_menu = []
    const thirdary_menu = []
    let button_menu = []
    //查询button_menu中的数据
    return new Promise((resolve, reject) => {
        db.query(`select * from button_menu where id in ('${menu.join("','")}')`, (err, results) => {
            if (err) return reject(err)
            button_menu = results.map(i => { return i.id })
            results.forEach(i => {
                const link_router = i.link_router ? i.link_router.split(',') : []
                link_router.forEach(m => {
                    if (!thirdary_menu.includes(m)) thirdary_menu.push(m)
                })
            })
            menu = menu.concat(results.map(i => { return i.parent_name }))
            //查询secondary_menu中的数据
            db.query(`select * from secondary_menu where name in ('${menu.join("','")}')`, (err, results) => {
                if (err) return reject(err)
                secondary_menu = results.map(i => { return i.name })
                menu = menu.concat(results.map(i => { return i.parent_name }))
                //查询primary_menu中的数据
                db.query(`select * from primary_menu where name in ('${menu.join("','")}')`, (err, results) => {
                    if (err) return reject(err)
                    primary_menu = results.map(i => { return i.name })
                    const updateData = {
                        primary_menu: primary_menu.join(','),
                        secondary_menu: secondary_menu.join(','),
                        thirdary_menu: thirdary_menu.join(','),
                        button_menu: button_menu.join(','),
                        email, nickname, phone, status, userName, home_page
                    }
                    if (password) updateData.password = password
                    resolve(updateData)
                })
            })
        })
    })
}

// 修改成员
exports.editCrew = (req, res) => {
    let { id, userName } = req.body
    //检查账号是否重复
    db.query(`select i.id from users i where i.userName='${userName}'`, (err, results) => {
        if (err) return res.cc(err)
        if (results[0].id !== id) return res.cc('账号重复，请重新修改！')
        findMenu(req.body).then(updateData => {
            db.query(`update users set ? where id = '${id}'`, [updateData], (err, results) => {
                if (err) return res.cc(err)
                res.send({
                    code: 200,
                    message: '修改成员信息成功！'
                })
            })
        })
    })
}

// 获取主页列表
exports.getHomePage = (req, res) => {
    const sql1 = `select * from primary_menu`
    const sql2 = `select * from secondary_menu`
    const p1 = new Promise((resolve, reject) => {
        db.query(sql1, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    const p2 = new Promise((resolve, reject) => {
        db.query(sql2, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    Promise.all([p1, p2]).then(results => {
        const list = results[0].map(i => {
            return {
                label: i.title_name,
                value: i.path,
                name: i.name,
                parent_id: null,
                orderNo: i.orderNo
            }
        }).concat(results[1].map(i => {
            return {
                label: i.title_name,
                value: i.path,
                name: i.name,
                parent_id: i.parent_name
            }
        }))
        res.send({
            code: 200,
            message: '获取主页列表成功！',
            data: toMenuTree(list, null).sort((a, b) => {
                return a.orderNo - b.orderNo
            })
        })
    })
}

/**
 * 将数据构建成树
 * @param {array} list 数据
 * @param {array} pid 节点
 * @returns 树
 */
function toMenuTree(list, pid) {
    let treeList = []
    treeList = list.filter(item => {
        return item.parent_id == pid
    })
    treeList.forEach(item => {
        item.children = toMenuTree(list, item.name)
    });
    return treeList
}