import dns from 'dns';

dns.lookup('brd.superproxy.io', (err, address, family) => {
  if (err) {
    console.error('DNS Lookup failed:', err);
  } else {
    console.log('DNS Lookup success:', address);
  }
});
