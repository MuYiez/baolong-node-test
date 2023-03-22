const express = require('express')
const bodyParser = require('body-parser')
// 创建 express 的服务器实例
const app = express()
const morgan = require('morgan');
const rfs = require('rotating-file-stream') // version 2.x
const path = require('path');
const port = 3020;
const joi = require('joi')
// 一定要在路由之前配置解析 Token 的中间件
const expressJWT = require('express-jwt')
const config = require('./config')

//配置跨域
const cors = require('cors')
app.use(cors())
// 跨域请求处理
app.all('*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'X-Requested-With')
    res.header('Access-Control-Allow-Headers', '`Content`-Type, Content-Length, Authorization, Accept, X-Requested-With, X_Requested_With')
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS')
    //允许接收的请求头上加上一个Authorization，这样我们才能够将数据发送过去
    res.header('X-Powered-By', '3.2.1')

    // OPTIONS类型的请求 复杂请求的预请求
    if (req.method == 'OPTIONS') {
        res.send(200)
    } else {
        /*让options请求快速返回*/
        next()
    }
})

// 一定要在路由之前，封装 res.cc 函数
app.use((req, res, next) => {
    // code 默认值为 500，表示失败的情况
    // err 的值，可能是一个错误对象，也可能是一个错误的描述字符串
    res.cc = function (err, code = 500) {
        res.send({
            code,
            message: err instanceof Error ? err.message : err,
        })
    }
    next()
})

// 公开静态文件夹，匹配`虚拟路径img` 到 `真实路径public` 注意这里  /img/ 前后必须都要有斜杠！！！
app.use('/img/', express.static('./public/'))

// 挂载处理post请求的插件
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// 配置解析表单数据的中间件
app.use(express.urlencoded({ extended: false }))

// 通过 express.json() 这个中间件，解析表单中的 JSON 格式的数据
app.use(express.json())

//配置日志
var accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // rotate daily
    path: path.join(__dirname, 'log')
})
app.use(morgan('[:date[iso]] [:remote-addr] :url - :status - :total-time[2] ', {
    skip: function (req, res) {
        return res.statusCode < 400;
    },
    stream: accessLogStream
}));

// 使用 .unless({ path: [/^\/user\//] }) 指定哪些接口不需要进行 Token 的身份认证
app.use(expressJWT({ secret: config.jwtSecretKey }).unless({ path: [/^\/user/] }))


// 导入注册用户路由模块 
const userRouter = require('./router/user')
app.use('/user', userRouter)

// 导入并使用用户信息路由模块
const userinfoRouter = require('./router/userinfo')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', userinfoRouter)

// 导入并使用参数信息路由模块
const gross_profit_table = require('./router/gross_profit_table')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', gross_profit_table)

// 导入并使用商品信息路由模块
const sku_goods = require('./router/sku_goods')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', sku_goods)

// 导入并使用spu路由模块
const spu = require('./router/spu')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', spu)

// 导入并使用upload_goods_info路由模块
const upload_goods_info = require('./router/upload_goods_info')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', upload_goods_info)

// 导入并使用account_table路由模块
const account_table = require('./router/account_table')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', account_table)

// 导入并使用order_module路由模块
const order_module = require('./router/order_module')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', order_module)

// 导入并使用shopline_info路由模块
const shopline_info = require('./router/shopline_info')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', shopline_info)

// 导入并使用crew_info路由模块
const crew_info = require('./router/crew_info')
// 注意：以 /api 开头的接口，都是有权限的接口，需要进行 Token 身份认证
app.use('/api', crew_info)

// 定义错误级别的中间件
app.use((err, req, res, next) => {
    // 验证失败导致的错误
    if (err instanceof joi.ValidationError) return res.cc(err)
    // 身份认证失败后的错误
    if (err.name === 'UnauthorizedError') return res.cc('身份认证失败！', 401)
    // 未知的错误
    return res.cc(err)
})

//每天定时将sequence表中的seq_index_spu_id重置
const cleanSpuId = require("./schedule/cleanSpuId")
cleanSpuId();
//每天10点获取最新汇率
const getExchangeRate = require("./schedule/getExchangeRate")
getExchangeRate();
//每天23点获取当前参数，复制为下一天数据并填进数据库中
const createParameter = require("./schedule/createParameter")
createParameter();
//每小时获取shopline最新订单
const getShoplineOrders = require("./schedule/getShoplineOrders")
getShoplineOrders();

//启动WebSocket服务器
const webSocketService = require('./shopline/web_socket_service')
// 开启服务端的监听, 监听客户端的连接
// 当某一个客户端连接成功之后, 就会对这个客户端进行message事件的监听
webSocketService.listen()

// 调用 app.listen 方法，指定端口号并启动web服务器
app.listen(port, function () {
    console.log('api server running at http://127.0.0.1:' + port)
})