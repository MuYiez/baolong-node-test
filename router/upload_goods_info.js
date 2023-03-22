const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/upload_goods_info')

//上传商品信息
router.post('/uploadGoods/uploadExcel', table.uploadExcel)
//初次导入商品信息
router.post('/uploadGoods/uploadAllExcel', table.uploadAllExcel)
//上传仓库信息
router.post('/uploadGoods/uploadWarehouseExcel', table.uploadWarehouseExcel)

module.exports = router