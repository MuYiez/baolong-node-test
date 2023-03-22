const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/account_table')

// 查询参数表
router.get('/account/parameterSearch', table.parameterSearch)
// 新增参数
router.post('/account/parameterAdd', table.parameterAdd)
// 删除参数
router.post('/account/parameterDel', table.parameterDel)
// 修改参数
router.post('/account/parameterEdit', table.parameterEdit)

// 新增账单
router.post('/account/accountAdd', table.accountAdd)
// 修改账单
router.post('/account/accountEdit', table.accountEdit)
// 删除账单
router.post('/account/accountDelete', table.accountDelete)
// 查询账单
router.post('/account/accountSearch', table.accountSearch)
// 修改付款情况
router.post('/account/changePaymentReady', table.changePaymentReady)

module.exports = router