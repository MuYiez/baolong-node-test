const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/order_module')

// 同步shopline订单
router.post('/order/getShoplineOrder', table.getShoplineOrder)
// 获取订单
router.post('/order/getOrder', table.getOrder)
// 匹配sku
router.post('/order/matchSku', table.matchSku)
// 查询
router.post('/order/searchShop', table.searchShop)
// 查询sku
router.post('/order/searchOrderSku', table.searchOrderSku)

module.exports = router