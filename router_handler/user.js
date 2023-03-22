/**
 * 在这里定义和用户相关的路由处理函数，供 /router/user.js 模块进行调用
 */

//  导入数据库操作模块
const db = require('../db/index')

const bcrypt = require('bcryptjs')

// 用这个包来生成 Token 字符串
const jwt = require('jsonwebtoken')

// 导入配置文件
const config = require('../config')

// 注册用户的处理函数
exports.regUser = (req, res) => {
    // 接收表单数据
    const userinfo = req.body
    // 判断数据是否合法
    // if (!userinfo.userName || !userinfo.password) {
    //     return res.send({ status: 1, message: '用户名或密码不能为空！' })
    // }

    //执行 SQL 语句并根据结果判断用户名是否被占用
    const sql = `select * from users where userName=?`
    db.query(sql, [userinfo.userName], function (err, results) {
        // 执行 SQL 语句失败
        if (err) {
            // return res.send({ status: 1, message: err.message })
            return res.cc(err)
        }
        // 用户名被占用
        if (results.length > 0) {
            // return res.send({ status: 1, message: '用户名被占用，请更换其他用户名！' })
            return res.cc('用户名被占用，请更换其他用户名！')
        }
        // TODO: 用户名可用，继续后续流程...
        // 对用户的密码,进行 bcrype 加密，返回值是加密之后的密码字符串
        userinfo.password = bcrypt.hashSync(userinfo.password, 10)

        // 定义插入用户的 SQL 语句
        const sql = 'insert into users set ?'
        db.query(sql, { userName: userinfo.userName, password: userinfo.password }, function (err, results) {
            // 执行 SQL 语句失败
            // if (err) return res.send({ status: 1, message: err.message })
            if (err) return res.cc(err)
            // SQL 语句执行成功，但影响行数不为 1
            // if (results.affectedRows !== 1) {
            //     return res.send({ status: 1, message: '注册用户失败，请稍后再试！' })
            // }
            if (results.affectedRows !== 1) {
                return res.cc('注册用户失败，请稍后再试！')
            }
            // 注册成功
            // res.send({ status: 0, message: '注册成功！' })
            res.cc('注册成功！', 0)
        })
    })
}

// 登录的处理函数
exports.login = (req, res) => {
    const userinfo = req.body
    const sql = `select * from users where userName=?`
    // 执行 SQL 语句，查询用户的数据
    db.query(sql, userinfo.userName, function (err, results) {
        // 执行 SQL 语句失败
        if (err) return res.cc(err)
        // 执行 SQL 语句成功，但是查询到数据条数不等于 1
        if (results.length !== 1) return res.cc('登录失败！')
        // TODO：判断用户输入的登录密码是否和数据库中的密码一致
        // 如果对比的结果等于 false, 则证明用户输入的密码错误
        if (userinfo.password !== results[0].password) {
            return res.cc('密码错误！')
        }
        if(!results[0].status) return res.cc('该账号已被停用')
        
        // 剔除完毕之后，user 中只保留了用户的 id, userName, nickname, email 这四个属性的值
        const user = { ...results[0], password: '' }
        // 生成 Token 字符串
        const tokenStr = jwt.sign(user, config.jwtSecretKey, {
            expiresIn: '10h', // token 有效期为 10 个小时
        })
        // 将生成的 Token 字符串响应给客户端
        res.send({
            code: 200,
            message: '登录成功！',
            // 为了方便客户端使用 Token，在服务器端直接拼接上 Bearer 的前缀
            token: 'Bearer ' + tokenStr,
            id:results[0].id
        })
    })
}

// 获取用户基本信息的处理函数
exports.getUserInfo = (req, res) => {
    // 根据用户的 id，查询用户的基本信息
    // 注意：为了防止用户的密码泄露，需要排除 password 字段
    const sql = `select id, userName, nickname,department from users where id=?`

    // 注意：req 对象上的 user 属性，是 Token 解析成功，express-jwt 中间件帮我们挂载上去的
    db.query(sql, req.user.id, (err, results) => {
        // 1. 执行 SQL 语句失败
        if (err) return res.cc(err)

        // 2. 执行 SQL 语句成功，但是查询到的数据条数不等于 1
        if (results.length !== 1) return res.cc('获取用户信息失败！')

        // 3. 将用户信息响应给客户端
        res.send({
            code: 200,
            message: '获取用户基本信息成功！',
            data: results[0],
        })
    })
}