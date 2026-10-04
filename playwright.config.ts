import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({testDir:'evals/browser',workers:1,timeout:30000,reporter:'list',use:{baseURL:'http://127.0.0.1:3001',headless:true,launchOptions:existsSync(chrome)?{executablePath:chrome}:{}},webServer:{command:'node --experimental-transform-types scripts/test-server.ts --synthetic-fixtures',url:'http://127.0.0.1:3001/health/live',reuseExistingServer:false,timeout:20000},outputDir:'runtime-data/playwright-results'});
