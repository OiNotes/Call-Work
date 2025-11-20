#!/usr/bin/env node
/**
 * Generate JWT token for testing
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const userId = parseInt(process.argv[2]) || 1;
const telegramId = '1997815787';
const username = 'Sithil15';

const token = jwt.sign(
  {
    id: userId,
    telegramId: telegramId,
    username: username,
  },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

console.log('\n🔑 Generated JWT Token:\n');
console.log(token);
console.log('\n📋 User info:');
console.log(`   ID: ${userId}`);
console.log(`   Telegram ID: ${telegramId}`);
console.log(`   Username: ${username}`);
console.log(`   Expires in: ${process.env.JWT_EXPIRES_IN || '7d'}`);
console.log('');
