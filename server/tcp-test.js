import net from 'net';

const client = new net.Socket();
const port = 33335;
const host = 'brd.superproxy.io';

console.log(`Attempting to connect to ${host}:${port}...`);

client.connect(port, host, () => {
  console.log('✅ Connected to proxy server successfully!');
  client.write('CONNECT item.taobao.com:443 HTTP/1.1\r\nHost: item.taobao.com:443\r\n\r\n');
});

client.on('data', (data) => {
  console.log('Received data:', data.toString());
  client.destroy();
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err);
});
