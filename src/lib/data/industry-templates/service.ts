export const serviceTemplate = {
  id: 'service',
  name: '服务业',
  description: '适用于咨询、技术服务、广告、物流、餐饮等服务行业企业，简化存货科目，侧重劳务收入与费用核算',
  icon: 'Headphones',
  subjects: [
    // ========== 资产类 (1xxx) ==========
    // 库存现金
    { code: '1001', name: '库存现金', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    // 银行存款
    { code: '1002', name: '银行存款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    // 应收账款
    { code: '1122', name: '应收账款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 预付账款
    { code: '1123', name: '预付账款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: false },
    // 其他应收款
    { code: '1221', name: '其他应收款', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: false },
    // 坏账准备
    { code: '1231', name: '坏账准备', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 原材料
    { code: '1403', name: '原材料', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 低值易耗品
    { code: '1411', name: '低值易耗品', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 待摊费用
    { code: '1503', name: '待摊费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 固定资产
    { code: '1601', name: '固定资产', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 累计折旧
    { code: '1602', name: '累计折旧', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 无形资产
    { code: '1701', name: '无形资产', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 累计摊销
    { code: '1702', name: '累计摊销', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 长期待摊费用
    { code: '1801', name: '长期待摊费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ========== 负债类 (2xxx) ==========
    // 短期借款
    { code: '2001', name: '短期借款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    // 应付账款
    { code: '2202', name: '应付账款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: true, isEmployee: false, enableCashFlow: false },
    // 预收账款
    { code: '2203', name: '预收账款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: true, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 应付职工薪酬
    { code: '2211', name: '应付职工薪酬', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '221101', name: '工资', parentId: '2211', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '221102', name: '社保', parentId: '2211', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '221103', name: '公积金', parentId: '2211', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 应交税费
    { code: '2221', name: '应交税费', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '222101', name: '应交增值税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '22210101', name: '进项税额', parentId: '222101', level: 3, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '22210102', name: '销项税额', parentId: '222101', level: 3, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222102', name: '未交增值税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222103', name: '应交企业所得税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222104', name: '应交个人所得税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222105', name: '应交城市维护建设税', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '222106', name: '应交教育费附加', parentId: '2221', level: 2, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 其他应付款
    { code: '2241', name: '其他应付款', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: true, enableCashFlow: false },

    // ========== 所有者权益类 (4xxx) ==========
    // 实收资本
    { code: '4001', name: '实收资本', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 资本公积
    { code: '4002', name: '资本公积', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 盈余公积
    { code: '4101', name: '盈余公积', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 本年利润
    { code: '4103', name: '本年利润', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 利润分配
    { code: '4104', name: '利润分配', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ========== 成本类 (5xxx) ==========
    // 劳务成本
    { code: '5001', name: '劳务成本', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },

    // ========== 损益类 (6xxx) ==========
    // 主营业务收入
    { code: '6001', name: '主营业务收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 其他业务收入
    { code: '6051', name: '其他业务收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 主营业务成本
    { code: '6401', name: '主营业务成本', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: true, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 其他业务成本
    { code: '6402', name: '其他业务成本', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 税金及附加
    { code: '6403', name: '税金及附加', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 销售费用
    { code: '6601', name: '销售费用', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660101', name: '广告宣传费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660102', name: '业务招待费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660103', name: '差旅费', parentId: '6601', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 管理费用
    { code: '6602', name: '管理费用', parentId: null, level: 1, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660201', name: '办公费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660202', name: '差旅费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660203', name: '业务招待费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660204', name: '通讯费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660205', name: '交通费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660206', name: '折旧费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660207', name: '摊销费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660208', name: '租赁费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660209', name: '水电费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660210', name: '物业管理费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    { code: '660211', name: '修理费', parentId: '6602', level: 2, direction: 'debit', enableDept: true, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 财务费用
    { code: '6603', name: '财务费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '660301', name: '利息支出', parentId: '6603', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    { code: '660302', name: '手续费', parentId: '6603', level: 2, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
    // 资产减值损失
    { code: '6701', name: '资产减值损失', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 信用减值损失
    { code: '6702', name: '信用减值损失', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 营业外收入
    { code: '6301', name: '营业外收入', parentId: null, level: 1, direction: 'credit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 营业外支出
    { code: '6711', name: '营业外支出', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: false },
    // 所得税费用
    { code: '6801', name: '所得税费用', parentId: null, level: 1, direction: 'debit', enableDept: false, enableProject: false, disabled: false, isCustomer: false, isSupplier: false, isEmployee: false, enableCashFlow: true },
  ],
  businessGroups: [
    {
      name: '技术服务收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '22210102',
      taxSubjectName: '销项税额',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['技术服务', '技术开发', '技术咨询', '软件开发', '系统开发', '技术支持', 'IT服务', '信息化'],
      priority: 10,
    },
    {
      name: '咨询服务收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '22210102',
      taxSubjectName: '销项税额',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['咨询', '顾问', '管理咨询', '财务咨询', '法律咨询', '审计', '评估'],
      priority: 9,
    },
    {
      name: '设计服务收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '22210102',
      taxSubjectName: '销项税额',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['设计', '广告设计', '平面设计', 'UI设计', '装潢设计', '品牌设计', '创意'],
      priority: 8,
    },
    {
      name: '物流运输收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '22210102',
      taxSubjectName: '销项税额',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['运输', '物流', '配送', '货运', '快递', '仓储', '装卸'],
      priority: 7,
    },
    {
      name: '餐饮服务收入',
      partnerType: 'customer',
      debitSubject: '1122',
      debitSubjectName: '应收账款',
      taxSubject: '22210102',
      taxSubjectName: '销项税额',
      creditSubject: '6001',
      creditSubjectName: '主营业务收入',
      keywords: ['餐饮', '餐费', '宴会', '外卖', '茶歇', '团餐'],
      priority: 7,
    },
    {
      name: '办公费报销',
      partnerType: 'employee',
      debitSubject: '660201',
      debitSubjectName: '办公费',
      taxSubject: '22210101',
      taxSubjectName: '进项税额',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['办公用品', '文具', '打印', '复印', '纸张', '墨盒', '耗材'],
      priority: 6,
    },
    {
      name: '差旅费报销',
      partnerType: 'employee',
      debitSubject: '660202',
      debitSubjectName: '差旅费',
      taxSubject: '',
      taxSubjectName: '',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['差旅', '机票', '火车票', '酒店', '住宿', '打车', '出行', '滴滴'],
      priority: 5,
    },
    {
      name: '招待费报销',
      partnerType: 'employee',
      debitSubject: '660203',
      debitSubjectName: '业务招待费',
      taxSubject: '',
      taxSubjectName: '',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['招待', '宴请', '餐饮报销', '礼品', '客户接待'],
      priority: 4,
    },
    {
      name: '租金支出',
      partnerType: 'supplier',
      debitSubject: '660208',
      debitSubjectName: '租赁费',
      taxSubject: '22210101',
      taxSubjectName: '进项税额',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['租金', '房租', '租赁', '物业租金', '场地费', '仓储租金'],
      priority: 3,
    },
    {
      name: '物业水电费',
      partnerType: 'supplier',
      debitSubject: '660209',
      debitSubjectName: '水电费',
      taxSubject: '22210101',
      taxSubjectName: '进项税额',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['水费', '电费', '水电', '物业', '物业管理', '取暖', '暖气'],
      priority: 2,
    },
    {
      name: '通讯网络费',
      partnerType: 'supplier',
      debitSubject: '660204',
      debitSubjectName: '通讯费',
      taxSubject: '22210101',
      taxSubjectName: '进项税额',
      creditSubject: '1002',
      creditSubjectName: '银行存款',
      keywords: ['话费', '通讯', '网络', '宽带', '电话费', '手机费', '流量'],
      priority: 1,
    },
  ],
  commonSummaries: [
    '收到客户服务费',
    '收到技术咨询费',
    '支付办公费',
    '支付差旅费',
    '支付员工工资',
    '缴纳社保公积金',
    '支付租金',
    '支付水电费',
    '收到预收款',
    '退回预收款',
    '支付广告宣传费',
    '支付业务招待费',
    '计提本月折旧',
    '计提本月摊销',
    '支付银行手续费',
    '收到利息收入',
    '缴纳增值税',
    '缴纳企业所得税',
    '计提工资',
    '发放工资',
    '劳务成本结转',
    '确认服务收入',
    '支付物业管理费',
    '支付通讯费',
    '收到往来款',
    '支付往来款',
    '采购办公用品',
    '支付修理费',
    '计提坏账准备',
    '结转本期损益',
  ],
  bankKeywords: [
    { keyword: '服务费', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '咨询费', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '技术服务', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '技术开发', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '设计费', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '运输费', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '物流费', subject: '6001', subjectName: '主营业务收入' },
    { keyword: '广告费', subject: '660101', subjectName: '广告宣传费' },
    { keyword: '宣传费', subject: '660101', subjectName: '广告宣传费' },
    { keyword: '招待费', subject: '660203', subjectName: '业务招待费' },
    { keyword: '差旅费', subject: '660202', subjectName: '差旅费' },
    { keyword: '机票', subject: '660202', subjectName: '差旅费' },
    { keyword: '住宿', subject: '660202', subjectName: '差旅费' },
    { keyword: '办公费', subject: '660201', subjectName: '办公费' },
    { keyword: '文具', subject: '660201', subjectName: '办公费' },
    { keyword: '租金', subject: '660208', subjectName: '租赁费' },
    { keyword: '房租', subject: '660208', subjectName: '租赁费' },
    { keyword: '水电费', subject: '660209', subjectName: '水电费' },
    { keyword: '电费', subject: '660209', subjectName: '水电费' },
    { keyword: '水费', subject: '660209', subjectName: '水电费' },
    { keyword: '物业', subject: '660210', subjectName: '物业管理费' },
    { keyword: '工资', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '社保', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '公积金', subject: '2211', subjectName: '应付职工薪酬' },
    { keyword: '手续费', subject: '660302', subjectName: '手续费' },
    { keyword: '利息', subject: '660301', subjectName: '利息支出' },
    { keyword: '通讯费', subject: '660204', subjectName: '通讯费' },
    { keyword: '网络费', subject: '660204', subjectName: '通讯费' },
    { keyword: '修理费', subject: '660211', subjectName: '修理费' },
    { keyword: '维修费', subject: '660211', subjectName: '修理费' },
  ],
};
