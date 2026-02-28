process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Credentials provided by user (New Proxy)
const HOST = '120.26.52.35';
const PORT = 3128;
const USERNAME = ''; 
const PASSWORD = '';

let proxyUrl;
if (USERNAME && PASSWORD) {
    proxyUrl = `http://${USERNAME}:${PASSWORD}@${HOST}:${PORT}`;
} else {
    proxyUrl = `http://${HOST}:${PORT}`;
}

console.log('---------------------------------------------------');
console.log('🧪 Testing Proxy Authentication');
console.log('---------------------------------------------------');
console.log(`Host: ${HOST}`);
console.log(`Port: ${PORT}`);
console.log(`User: ${USERNAME}`);
console.log('---------------------------------------------------');

async function testProxy() {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    
    console.log('🚀 Sending request to ipinfo.io...');
    
    const response = await axios.get('https://ipinfo.io/json', { 
      httpsAgent: agent,
      timeout: 15000 
    });
    
    console.log('\n✅ Proxy Connection SUCCESSFUL!');
    console.log('---------------------------------------------------');
    console.log('IP:', response.data.ip);
    console.log('City:', response.data.city);
    console.log('Region:', response.data.region);
    console.log('Country:', response.data.country);
    console.log('Org:', response.data.org);
    console.log('---------------------------------------------------');

  } catch (error) {
    console.error('\n❌ Proxy Connection FAILED!');
    console.error('---------------------------------------------------');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    console.error('---------------------------------------------------');
  }
}

testProxy();
