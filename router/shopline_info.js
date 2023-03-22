const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/shopline_info')

// 新增店铺
router.post('/shopline/addShop', table.addShop)
// 查询店铺
router.post('/shopline/searchShop', table.searchShop)
// 删除店铺
router.post('/shopline/deleteShop', table.deleteShop)
// 更新店铺
router.post('/shopline/updateShop', table.updateShop)

module.exports = router