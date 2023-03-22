// 导入数据库操作模块
const db = require('../db/index')

// 获取用户基本信息的处理函数
exports.getUserInfo = (req, res) => {
    // 根据用户的 id，查询用户的基本信息
    // 注意：为了防止用户的密码泄露，需要排除 password 字段
    // const sql = `select id, userName, nickname,department from users where id=?`
    const sql = `select * from users where id=?`
    // 注意：req 对象上的 user 属性，是 Token 解析成功，express-jwt 中间件帮我们挂载上去的
    db.query(sql, req.user.id, (err, results) => {
        // 1. 执行 SQL 语句失败
        if (err) return res.cc(err)

        // 2. 执行 SQL 语句成功，但是查询到的数据条数不等于 1
        if (results.length !== 1) return res.cc('获取用户信息失败！')
        const { id, userName, nickname, department, home_page } = results[0]
        const userInfo = { id, userName, nickname, department }
        // 3. 将用户信息响应给客户端
        res.send({
            code: 200,
            message: '获取用户基本信息成功！',
            data: {
                ...userInfo,
                userInfo: {
                    userId: id,
                    username: userName,
                    realName: nickname,
                    avatar: 'https://q1.qlogo.cn/g?b=qq&nk=190848757&s=640',
                    homePath: home_page,
                }
            }
        })
    })
}

//获取路由信息
exports.getMenuList = (req, res) => {
    const sql = `select * from users where id=?`
    // 注意：req 对象上的 user 属性，是 Token 解析成功，express-jwt 中间件帮我们挂载上去的
    db.query(sql, req.user.id, (err, results) => {
        // 1. 执行 SQL 语句失败
        if (err) return res.cc(err)

        // 2. 执行 SQL 语句成功，但是查询到的数据条数不等于 1
        if (results.length !== 1) return res.cc('获取用户信息失败！')
        const { primary_menu, secondary_menu, thirdary_menu } = results[0]
        const primary_menu_sql = `select * from primary_menu where name in ('${primary_menu.split(',').join("','")}')`
        const secondary_menu_sql = `select * from secondary_menu where name in ('${secondary_menu.split(',').join("','")}')`
        const thirdary_menu_sql = `select * from thirdary_menu where name in ('${thirdary_menu.split(',').join("','")}')`
        const p1 = new Promise((resolve, reject) => {
            db.query(primary_menu_sql, (err, results) => {
                if (err) return reject(err)
                resolve(results)
            })
        })
        const p2 = new Promise((resolve, reject) => {
            db.query(secondary_menu_sql, (err, results) => {
                if (err) return reject(err)
                resolve(results)
            })
        })
        const p3 = new Promise((resolve, reject) => {
            db.query(thirdary_menu_sql, (err, results) => {
                if (err) return reject(err)
                resolve(results)
            })
        })
        Promise.all([p1, p2, p3]).then(results => {
            //回显一级菜单
            const router = results[0].map(item => {
                const { name, path, component, title, icon, redirect, orderNo } = item
                return {
                    name, path, component, redirect,
                    meta: { title, icon, orderNo },
                    children: []
                }
            }).sort(function (a, b) {
                return Number(a.meta.orderNo) - Number(b.meta.orderNo)
            })
            //回显二级菜单
            results[1].forEach(element => {
                const { name, parent_name, path, component, title, affix, hideChildrenInMenu, orderNo } = element
                const index = router.findIndex(i => i.name === parent_name)
                if (index !== -1) {
                    const info = {
                        name, path, component,
                        meta: { title, affix, hideChildrenInMenu, orderNo }
                    }
                    router[index].children.push(info)
                    router[index].children = router[index].children.sort(function (a, b) {
                        return Number(a.meta.orderNo) - Number(b.meta.orderNo)
                    })
                }
            });
            //回显三级菜单
            results[2].forEach(element => {
                const { name, parent_name, path, component, title, ignoreKeepAlive } = element
                for (let i = 0; i < router.length; i++) {
                    const list = router[i];
                    const index = list.children.findIndex(i => i.name === parent_name)
                    if (index !== -1) {
                        const info = {
                            name, path, component,
                            meta: { title, ignoreKeepAlive }
                        }
                        if (!router[i].children[index].children) router[i].children[index].children = []
                        router[i].children[index].children.push(info)
                        break
                    }
                }
            })
            // 3. 将用户信息响应给客户端
            res.send({
                code: 200,
                message: '获取路由信息成功！',
                data: router
            })
        })
    })
}

// 重置密码的处理函数
exports.updatePassword = (req, res) => {
    // 定义根据 id 查询用户数据的 SQL 语句
    const sql = `select * from users where id=?`

    // 执行 SQL 语句查询用户是否存在
    db.query(sql, req.user.id, (err, results) => {
        // 执行 SQL 语句失败
        if (err) return res.cc(err)

        // 检查指定 id 的用户是否存在
        if (results.length !== 1) return res.cc('用户不存在！')

        // TODO：判断提交的旧密码是否正确
        // 在头部区域导入 bcryptjs 后，
        // 即可使用 bcrypt.compareSync(提交的密码，数据库中的密码) 方法验证密码是否正确
        // compareSync() 函数的返回值为布尔值，true 表示密码正确，false 表示密码错误
        const bcrypt = require('bcryptjs')

        // 判断提交的旧密码是否正确
        const compareResult = bcrypt.compareSync(req.body.oldPwd, results[0].password)
        if (!compareResult) return res.cc('原密码错误！')

        // 定义更新用户密码的 SQL 语句
        const sql = `update users set password=? where id=?`

        // 对新密码进行 bcrypt 加密处理
        const newPwd = bcrypt.hashSync(req.body.newPwd, 10)

        // 执行 SQL 语句，根据 id 更新用户的密码
        db.query(sql, [newPwd, req.user.id], (err, results) => {
            // SQL 语句执行失败
            if (err) return res.cc(err)

            // SQL 语句执行成功，但是影响行数不等于 1
            if (results.affectedRows !== 1) return res.cc('更新密码失败！')

            // 更新密码成功
            res.cc('更新密码成功！', 0)
        })
    })
}

// 获取所有用户的基本信息
exports.getAllUser = (req, res) => {
    const sql = `select * from users`
    // 执行 SQL 语句查询用户是否存在
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        if (results.length === 0) return res.cc('获取用户信息失败！')
        res.send({
            code: 200,
            message: '获取用户信息成功！',
            data: results.map(item=>{
                return {
                    ...item
                }
            })
        })
    })
}

// 获取按钮权限
exports.getPermCode = (req, res) => {
    const sql = `select * from users where id = ?`
    // 执行 SQL 语句查询用户是否存在
    db.query(sql, req.user.id, (err, results) => {
        if (err) return res.cc(err)
        if (results.length === 0) return res.cc('获取按钮权限信息失败！')
        const data = results[0].button_menu.split(',')
        res.send({
            code: 200,
            message: '获取按钮权限信息成功！',
            data
        })
    })
}

//获取菜单
exports.getMenu = (req, res) => {
    const sql1 = `select * from primary_menu`
    const sql2 = `select * from secondary_menu`
    const sql3 = `select * from thirdary_menu`
    const sql4 = `select * from button_menu`
    const sql5 = `select * from users where id = ${req.user.id}`
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
    const p3 = new Promise((resolve, reject) => {
        db.query(sql3, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    const p4 = new Promise((resolve, reject) => {
        db.query(sql4, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    const p5 = new Promise((resolve, reject) => {
        db.query(sql5, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    Promise.all([p1, p2, p3, p4, p5]).then(results => {
        const { button_menu, primary_menu, secondary_menu } = results[4][0]
        const list = results[0].filter((item) => { return primary_menu.split(',').includes(item.name) }).map(i => {
            return {
                title: i.title_name,
                key: i.name,
                parent_name: null,
                orderNo: i.orderNo
            }
        }).concat(results[1].filter((item) => { return secondary_menu.split(',').includes(item.name) }).map(i => {
            return {
                title: i.title_name,
                key: i.name,
                parent_name: i.parent_name
            }
        })).concat(results[3].filter((item) => { return button_menu.split(',').includes(item.id) }).map(i => {
            return {
                title: i.name,
                key: i.id,
                parent_name: i.parent_name
            }
        }))
        res.send({
            code: 200,
            message: '获取菜单信息成功！',
            data: {
                menu: toTree(list, null).sort((a, b) => {
                    return a.orderNo - b.orderNo
                })
            }
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
        return item.parent_name == pid
    })
    treeList.forEach(item => {
        item.children = toTree(list, item.key)
    });
    return treeList
}