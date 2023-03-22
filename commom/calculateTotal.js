
//由于有可能需要添加字段，所以将每日毛利详情内所有数据在这个函数内做处理，统一处理方式
function calculateTotal(list = []) {
    return {
        salesVolumeTotal: sum(list, 'salesVolume', true),
        orderQuantityTotal: sum(list, 'orderQuantity', true),
        adRateTotal: sum(list, 'adRate'),
        paypalCostTotal: sum(list, 'paypalCost'),
        businessVolumeTotal: sum(list, 'businessVolume'),
        freightTotal: sum(list, 'freight'),
        procurementCostTotal: sum(list, 'procurementCost'),
        serviceChargeTotal: sum(list, 'serviceCharge'),
        estimatedProfitTotal: sum(list, 'estimatedProfit')
    }
}

//计算数组总额
const sum = (arr, key, type = false) => {
    let num = 0;
    arr.forEach((res) => {
        num = num + Number(res[key] ? res[key] : 0);
    });
    if (type) {
        return num;
    }
    return num.toFixed(2);
};

module.exports = calculateTotal;