const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/crew_info')

// 查询成员信息
router.post('/crew/search', table.search)

// 获取我的成员
router.get('/crew/getMyCrew', table.getMyCrew)

// 获取成员菜单权限
router.post('/crew/getCrewMenu', table.getCrewMenu)

// 编辑成员
router.post('/crew/editCrew', table.editCrew)

// 新增成员
router.post('/crew/addCrew', table.addCrew)

// 获取主页列表
router.get('/crew/getHomePage', table.getHomePage)

module.exports = router