import cors from 'cors';
import express from 'express';
import { container } from './di/providers.js';
import { Routers } from './presentation/routers/routers.js';

function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(cors());
  app.use(express.json());
  const routers = container.get(Routers)

  routers.setup(app);
 
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main();
