const crypto = require('crypto');

// ============== 配置区域 ==============
const JITU_PRIVATE_KEY = 'b12efc7de64e4eb9a18b0d27b0ae804e';
const FEISHU_APP_ID = 'cli_aa804c5685b81bc1';
const FEISHU_APP_SECRET = 'KL3AYrIyPOyysK5inJD2DguWXh7boXQX';
const FEISHU_APP_TOKEN = 'FZbzbzqcvaMyZgs43nEcUbSVn8c';
const FEISHU_TABLE_ID = 'tblmwKYJOX7MWX0q';

// 极兔状态 -> 飞书选项ID 映射
const STATUS_MAP = {
  '签收': 'optEgQHdB6',
  '快件签收': 'optEgQHdB6',
  '完结': 'optEgQHdB6',
  '快件揽收': 'optELIoh5Z',
  '发件扫描': 'optELIoh5Z',
  '到件扫描': 'optELIoh5Z',
  '出仓扫描': 'optELIoh5Z'
};
// ======================================

// ===== 工具函数 =====
function parseFormBody(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

// ===== 极兔签名验证 =====
function verifyJituSignature(bizContent, digest) {
  const md5 = crypto.createHash('md5').update(bizContent + JITU_PRIVATE_KEY).digest('hex');
  const expectedDigest = Buffer.from(md5).toString('base64');
  return expectedDigest === digest;
}

// ===== 获取飞书 Token =====
let feishuToken = null;
let tokenExpireTime = 0;

async function getFeishuToken() {
  const now = Date.now();
  if (feishuToken && now < tokenExpireTime) {
    return feishuToken;
  }
  
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    })
  });
  
  const data = await resp.json();
  feishuToken = data.tenant_access_token;
  tokenExpireTime = now + (data.expire - 60) * 1000;
  return feishuToken;
}

// ===== 写入飞书多维表格 =====
async function writeToFeishu(logisticsData) {
  const token = await getFeishuToken();
  const latest = logisticsData.details?.[0] || {};
  const statusName = latest.scanTypeName || '';
  const feishuStatusId = STATUS_MAP[statusName];
  
  const fields = {
    tracking_number: logisticsData.billCode
  };
  
  if (feishuStatusId) {
    fields.sample_status = feishuStatusId;
  }
  
  const record = { fields };
  
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(record)
  });
  
  return await resp.json();
}

// ===== Vercel Serverless 入口 =====
export default async function handler(req, res) {
  console.log('收到极兔推送');
  
  try {
    // 1. 解析数据
    const body = req.body || '';
    const data = parseFormBody(typeof body === 'string' ? body : JSON.stringify(body));
    const bizContent = data.bizContent;
    const digest = req.headers?.digest || req.headers?.Digest;
    
    // 2. 验证签名
    const isValid = verifyJituSignature(bizContent, digest);
    console.log('签名验证:', isValid ? '通过' : '失败');
    
    if (!isValid) {
      console.log('签名验证失败，拒绝处理');
    } else {
      // 3. 解析物流信息
      const logistics = JSON.parse(bizContent);
      const latest = logistics.details?.[0] || {};
      console.log('运单号:', logistics.billCode);
      console.log('状态:', latest.scanTypeName || '未知');
      
      // 4. 写入飞书
      console.log('写入飞书...');
      const result = await writeToFeishu(logistics);
      console.log('结果:', result.code === 0 ? '成功' : '失败');
      if (result.code !== 0) {
        console.log('错误:', result.msg);
      }
    }
    
  } catch (e) {
    console.log('处理出错:', e.message);
    console.log(e.stack);
  }
  
  // 返回响应（极兔要求必须返回这个格式）
  res.status(200).json({ code: '1', msg: 'success', data: null });
}