"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGIN_REDIRECT_URL = void 0;
exports.LOGIN_REDIRECT_URL = Deno.env.get('LOGIN_REDIRECT_URL') || 'http://localhost:3000/';
