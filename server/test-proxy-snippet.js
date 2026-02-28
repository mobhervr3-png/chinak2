process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

console.log('---------------------------------------------------');
console.log('🛠️ Proxy Test Script');
console.log('---------------------------------------------------');

console.log('Type of HttpsProxyAgent:', typeof HttpsProxyAgent);
// console.log('HttpsProxyAgent value:', HttpsProxyAgent);

const url = 'https://geo.brdtest.com/welcome.txt?product=resi&method=native';
const proxy = 'http://brd-customer-hl_064762f4-zone-residential_proxy1-country-cn:hhnxzyh1nez4@brd.superproxy.io:33335';

console.log(`🔗 Target: ${url}`);
console.log(`🛡️ Proxy: ${proxy}`);

async function run() {
  try {
    const agent = new HttpsProxyAgent(proxy);
    console.log('✅ Agent created successfully.');
    
    console.log('🚀 Sending Axios request...');
    const response = await axios.get(url, { 
      httpsAgent: agent,
      timeout: 30000 // 30s
    });
    
    console.log('✅ Response Received!');
    console.log('---------------------------------------------------');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
    console.log('---------------------------------------------------');
  } catch (error) {
    console.error('❌ Request Failed!');
    console.error('---------------------------------------------------');
    console.error('Message:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    if (error.cause) console.error('Cause:', error.cause);
    console.error('---------------------------------------------------');
  }
}

run();
