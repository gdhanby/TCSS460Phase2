import express, { Router } from 'express';

import { signinRouter } from './login';
import { registerRouter } from './register';
import { changePasswordRouter } from './change_password';
import { changePasswordRouter2 } from './changePassword';

const authRoutes: Router = express.Router();

authRoutes.use(
    signinRouter,
    registerRouter,
    changePasswordRouter,
    changePasswordRouter2
);

export { authRoutes };
