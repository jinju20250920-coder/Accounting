import type { IndustryTemplate } from './index';

export const constructionTemplate: IndustryTemplate = {
  id: 'construction',
  name: '建筑施工',
  description: '适用于建筑施工、土木工程、装饰装修、市政工程等建筑行业企业，支持工程项目核算、合同成本管理、工程结算及机械作业等业务',
  icon: 'Building2',

  subjects: [
    // ==================== 资产类 ====================
    // 1001 库存现金
    { code: '1001', name: '库存现金', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 1002 银行存款
    { code: '1002', name: '银行存款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 1012 其他货币资金
    { code: '1012', name: '其他货币资金', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 1101 交易性金融资产
    { code: '1101', name: '交易性金融资产', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1122 应收账款
    { code: '1122', name: '应收账款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '112201', name: '应收工程款', parentId: '1122', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '112202', name: '应收质保金', parentId: '1122', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 1123 预付账款
    { code: '1123', name: '预付账款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },
    { code: '112301', name: '预付材料款', parentId: '1123', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },
    { code: '112302', name: '预付分包款', parentId: '1123', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },

    // 1221 其他应收款
    { code: '1221', name: '其他应收款', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: true },
    { code: '122101', name: '投标保证金', parentId: '1221', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '122102', name: '履约保证金', parentId: '1221', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '122103', name: '备用金', parentId: '1221', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: false },

    // 1403 原材料
    { code: '1403', name: '原材料', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '140301', name: '主要材料', parentId: '1403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '140302', name: '结构件', parentId: '1403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '140303', name: '机械配件', parentId: '1403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '140304', name: '其他材料', parentId: '1403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1408 委托加工物资
    { code: '1408', name: '委托加工物资', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1411 周转材料
    { code: '1411', name: '周转材料', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '141101', name: '在用周转材料', parentId: '1411', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '141102', name: '周转材料摊销', parentId: '1411', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1503 固定资产
    { code: '1503', name: '固定资产', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '150301', name: '施工机械', parentId: '1503', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '150302', name: '运输设备', parentId: '1503', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '150303', name: '生产设备', parentId: '1503', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1504 固定资产累计折旧
    { code: '1504', name: '累计折旧', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1601 工程施工（建筑行业核心科目）
    { code: '5401', name: '工程施工', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540101', name: '合同成本', parentId: '5401', level: 2, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010101', name: '人工费', parentId: '540101', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010102', name: '材料费', parentId: '540101', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010103', name: '机械使用费', parentId: '540101', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010104', name: '其他直接费', parentId: '540101', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010105', name: '分包成本', parentId: '540101', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: false },
    { code: '540102', name: '间接费用', parentId: '5401', level: 2, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010201', name: '管理人员工资', parentId: '540102', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: false },
    { code: '54010202', name: '办公费', parentId: '540102', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010203', name: '差旅费', parentId: '540102', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010204', name: '固定资产使用费', parentId: '540102', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '54010205', name: '临时设施摊销', parentId: '540102', level: 3, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540103', name: '毛利', parentId: '5401', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 5402 工程结算
    { code: '5402', name: '工程结算', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540201', name: '进度结算', parentId: '5402', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540202', name: '竣工结算', parentId: '5402', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 5403 机械作业
    { code: '5403', name: '机械作业', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540301', name: '自有机械作业', parentId: '5403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '540302', name: '租赁机械作业', parentId: '5403', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: false },

    // 1604 在建工程
    { code: '1604', name: '在建工程', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '160401', name: '待安装设备', parentId: '1604', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '160402', name: '在建工程成本', parentId: '1604', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 1606 固定资产清理
    { code: '1606', name: '固定资产清理', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ==================== 负债类 ====================
    // 2202 应付账款
    { code: '2202', name: '应付账款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },
    { code: '220201', name: '应付材料款', parentId: '2202', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },
    { code: '220202', name: '应付分包款', parentId: '2202', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },
    { code: '220203', name: '应付设备款', parentId: '2202', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: true },

    // 2203 预收账款
    { code: '2203', name: '预收账款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '220301', name: '预收工程款', parentId: '2203', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 2211 应付职工薪酬
    { code: '2211', name: '应付职工薪酬', parentId: null, level: 1, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: true },
    { code: '221101', name: '工资', parentId: '2211', level: 2, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: true },
    { code: '221102', name: '社保费', parentId: '2211', level: 2, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '221103', name: '住房公积金', parentId: '2211', level: 2, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '221104', name: '工会经费', parentId: '2211', level: 2, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '221105', name: '职工教育经费', parentId: '2211', level: 2, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 2221 应交税费
    { code: '2221', name: '应交税费', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222101', name: '应交增值税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '22210101', name: '进项税额', parentId: '222101', level: 3, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '22210102', name: '销项税额', parentId: '222101', level: 3, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '22210103', name: '进项税额转出', parentId: '222101', level: 3, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222102', name: '未交增值税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222103', name: '应交城建税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222104', name: '应交教育费附加', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222105', name: '应交地方教育附加', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222106', name: '应交所得税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222107', name: '个人所得税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: true },

    // 2241 其他应付款
    { code: '2241', name: '其他应付款', parentId: null, level: 1, direction: 'credit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: true },

    // 2501 长期借款
    { code: '2501', name: '长期借款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // ==================== 所有者权益类 ====================
    // 4001 实收资本
    { code: '4001', name: '实收资本', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 4002 资本公积
    { code: '4002', name: '资本公积', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 4101 盈余公积
    { code: '4101', name: '盈余公积', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 4103 本年利润
    { code: '4103', name: '本年利润', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 4104 利润分配
    { code: '4104', name: '利润分配', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ==================== 成本类 ====================
    // 5001 生产成本
    { code: '5001', name: '生产成本', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 5101 制造费用
    { code: '5101', name: '制造费用', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ==================== 损益类 ====================
    // 6001 主营业务收入
    { code: '6001', name: '主营业务收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '600101', name: '工程结算收入', parentId: '6001', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6051 其他业务收入
    { code: '6051', name: '其他业务收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '605101', name: '材料销售收入', parentId: '6051', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '605102', name: '机械作业收入', parentId: '6051', level: 2, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6301 营业外收入
    { code: '6301', name: '营业外收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6401 主营业务成本
    { code: '6401', name: '主营业务成本', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '640101', name: '工程结算成本', parentId: '6401', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6402 其他业务成本
    { code: '6402', name: '其他业务成本', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6403 税金及附加
    { code: '6403', name: '税金及附加', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 6601 管理费用
    { code: '6601', name: '管理费用', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660101', name: '办公费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660102', name: '差旅费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660103', name: '招待费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660104', name: '折旧费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660105', name: '无形资产摊销', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660106', name: '印花税', parentId: '6601', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 6602 销售费用
    { code: '6602', name: '销售费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660201', name: '投标费', parentId: '6602', level: 2, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660202', name: '业务招待费', parentId: '6602', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6603 财务费用
    { code: '6603', name: '财务费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '660301', name: '利息支出', parentId: '6603', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '660302', name: '手续费', parentId: '6603', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },

    // 6701 资产减值损失
    { code: '6701', name: '资产减值损失', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6711 营业外支出
    { code: '6711', name: '营业外支出', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // 6801 所得税费用
    { code: '6801', name: '所得税费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
  ],

  businessGroups: [
    {
      name: '材料采购',
      partnerType: 'supplier',
      debitSubject: '1403',
      debitSubjectName: '原材料',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '2202',
      creditSubjectName: '应付账款',
      keywords: ['钢材', '水泥', '混凝土', '砂石', '木材', '砖瓦', '管材', '电缆', '五金', '建材', '材料', '采购', '购入', '进货', '板料', '保温材料', '防水材料', '装饰材料'],
      priority: 10,
    },
    {
      name: '工程收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['工程款', '工程结算', '进度款', '竣工结算', '工程收入', '结算收入', '工程款收入', '合同收入', '验工计价'],
      priority: 10,
    },
    {
      name: '分包支出',
      partnerType: 'supplier',
      debitSubject: '5401',
      debitSubjectName: '工程施工',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '2202',
      creditSubjectName: '应付账款',
      keywords: ['分包', '劳务分包', '专业分包', '分包款', '分包工程', '劳务费', '人工费', '外包', '清包', '包工'],
      priority: 9,
    },
    {
      name: '机械租赁',
      partnerType: 'supplier',
      debitSubject: '5403',
      debitSubjectName: '机械作业',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '2202',
      creditSubjectName: '应付账款',
      keywords: ['机械租赁', '挖机', '吊车', '塔吊', '搅拌车', '泵车', '装载机', '推土机', '压路机', '机械台班', '设备租赁'],
      priority: 8,
    },
    {
      name: '员工薪酬',
      partnerType: 'employee',
      debitSubject: '5401',
      debitSubjectName: '工程施工',
      taxSubject: '',
      taxSubjectName: '',
      creditSubject: '2211',
      creditSubjectName: '应付职工薪酬',
      keywords: ['工资', '奖金', '津贴', '绩效', '加班费', '社保', '公积金', '薪酬', '发放工资', '计提工资'],
      priority: 7,
    },
    {
      name: '管理费用报销',
      partnerType: 'employee',
      debitSubject: '6601',
      debitSubjectName: '管理费用',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['报销', '差旅', '交通', '招待', '办公用品', '通信费', '会议费', '培训费', '办公费'],
      priority: 5,
    },
    {
      name: '设备采购',
      partnerType: 'supplier',
      debitSubject: '1503',
      debitSubjectName: '固定资产',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '2202',
      creditSubjectName: '应付账款',
      keywords: ['施工机械', '设备采购', '设备购置', '机械设备', '起重设备', '运输设备', '生产设备', '安装设备'],
      priority: 6,
    },
    {
      name: '工程投标',
      partnerType: 'other',
      debitSubject: '6602',
      debitSubjectName: '销售费用',
      taxSubject: '',
      taxSubjectName: '',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['投标', '投标保证金', '标书', '招标', '投标费', '中标服务费'],
      priority: 4,
    },
    {
      name: '工程物资退回',
      partnerType: 'supplier',
      debitSubject: '2202',
      debitSubjectName: '应付账款',
      taxSubject: '222101',
      taxSubjectName: '应交增值税',
      creditSubject: '1403',
      creditSubjectName: '原材料',
      keywords: ['材料退回', '退货', '退料', '材料退库'],
      priority: 3,
    },
  ],

  commonSummaries: [
    '收到工程进度款',
    '支付材料款',
    '支付分包工程款',
    '计提职工薪酬',
    '发放工资',
    '支付机械租赁费',
    '收到预收工程款',
    '支付投标保证金',
    '退回投标保证金',
    '领用工程材料',
    '工程竣工结算',
    '工程进度结算',
    '支付设备租赁费',
    '计提固定资产折旧',
    '支付水电费',
    '周转材料摊销',
    '临时设施摊销',
    '支付安全文明施工费',
    '缴纳各项税费',
    '收到退税款',
    '支付工程保险费',
    '支付检测费',
    '支付验收费',
    '工程质保金返还',
    '支付履约保证金',
    '收回履约保证金',
    '结转工程成本',
    '结转工程收入',
    '结转本年利润',
    '计提企业所得税',
    '分配利润',
  ],

  bankKeywords: [
    { keyword: '工程款', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '进度款', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '结算款', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '材料款', subject: '1403', subjectName: '原材料' },
    { keyword: '钢材', subject: '1403', subjectName: '原材料' },
    { keyword: '水泥', subject: '1403', subjectName: '原材料' },
    { keyword: '混凝土', subject: '1403', subjectName: '原材料' },
    { keyword: '分包款', subject: '5401', subjectName: '工程施工' },
    { keyword: '劳务费', subject: '5401', subjectName: '工程施工' },
    { keyword: '人工费', subject: '5401', subjectName: '工程施工' },
    { keyword: '机械租赁', subject: '5403', subjectName: '机械作业' },
    { keyword: '挖机', subject: '5403', subjectName: '机械作业' },
    { keyword: '吊车', subject: '5403', subjectName: '机械作业' },
    { keyword: '工资', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '社保', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '公积金', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '投标保证金', subject: '1221', subjectName: '其他应收款' },
    { keyword: '履约保证金', subject: '1221', subjectName: '其他应收款' },
    { keyword: '预收工程款', subject: '2203', subjectName: '预收账款' },
    { keyword: '报销', subject: '6601', subjectName: '管理费用' },
    { keyword: '差旅', subject: '6601', subjectName: '管理费用' },
    { keyword: '办公费', subject: '6601', subjectName: '管理费用' },
    { keyword: '招待费', subject: '6601', subjectName: '管理费用' },
    { keyword: '水电费', subject: '6601', subjectName: '管理费用' },
    { keyword: '保险', subject: '6601', subjectName: '管理费用' },
    { keyword: '设备采购', subject: '1503', subjectName: '固定资产' },
    { keyword: '利息', subject: '6603', subjectName: '财务费用' },
    { keyword: '手续费', subject: '6603', subjectName: '财务费用' },
    { keyword: '税', subject: '2221', subjectName: '应交税费' },
    { keyword: '增值税', subject: '2221', subjectName: '应交税费' },
    { keyword: '所得税', subject: '2221', subjectName: '应交税费' },
    { keyword: '质保金', subject: '1122', subjectName: '应收账款' },
    { keyword: '退保证金', subject: '1221', subjectName: '其他应收款' },
    { keyword: '安全文明施工', subject: '5401', subjectName: '工程施工' },
    { keyword: '检测费', subject: '5401', subjectName: '工程施工' },
  ],
};
