// Read the port in Node so package scripts work with both cmd.exe and Unix shells.
const nextCli = require.resolve('next/dist/bin/next');
process.argv = [
  process.execPath,
  nextCli,
  'dev',
  '--port',
  process.env.WEB_PORT || '3742',
  ...process.argv.slice(2),
];
require(nextCli);
