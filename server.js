const { createApp } = require('./index');

const port = Number(process.env.PORT) || 3000;
const app = createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${port}`);
});
server.on('error', (error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exitCode = 1;
});
