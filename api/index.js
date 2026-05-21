export default async function handler(req, res) {
  // 支持 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // 支持 GET 请求（健康检查用）
  if (req.method === 'GET') {
    res.status(200).json({ code: '1', msg: 'success', data: null });
    return;
  }
  
  console.log('收到极兔推送:', req.method);
  
  try {
    // 先返回响应，避免极兔超时
    res.status(200).json({ code: '1', msg: 'success', data: null });
    
    // 然后再处理业务逻辑
    const body = req.body || '';
    console.log('Body:', typeof body, body);
    
  } catch (e) {
    console.log('处理出错:', e.message);
  }
}
