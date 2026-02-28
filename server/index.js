import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try { fs.writeFileSync(path.join(__dirname, 'server_start.log'), 'STARTING ' + new Date().toISOString() + '\n'); } catch (e) {}
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
  try { fs.appendFileSync(path.join(__dirname, 'server_crash.log'), `CRITICAL ERROR: ${err.message}\n${err.stack}\n`); } catch (e) {}
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  try { fs.appendFileSync(path.join(__dirname, 'server_crash.log'), `CRITICAL REJECTION: ${reason}\n`); } catch (e) {}
});

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import compression from 'compression';
import https from 'https';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import prisma from './prismaClient.js';
import { normalizeArabic } from './services/aiService.js';
import { calculateOrderShipping, calculateProductShipping, getAdjustedPrice } from './services/shippingService.js';
import { setupLinkCheckerCron, checkAllProductLinks } from './services/linkCheckerService.js';
import { scrapeProduct } from './services/scraperService.js';
import { createClient } from '@supabase/supabase-js';

const { PrismaClient } = pkg;
// Note: We use the singleton 'prisma' from prismaClient.js instead of creating new instances

// Explicitly load .env and log status
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('.env file loaded successfully from:', envPath);
    console.log('Keys found in .env:', Object.keys(result.parsed));
  }
} else {
  console.error('.env file NOT found at:', envPath);
}

// Supabase Client Initialization
const supabaseUrl = process.env.SUPABASE_URL || 'https://puxjtecjxfjldwxiwzrk.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eGp0ZWNqeGZqbGR3eGl3enJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NDEyNjMsImV4cCI6MjA4MzUxNzI2M30.r9TxaSGhOEWeb3RP_BEsHGQ1GOBpI0-mkU0XdW3FEOc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generates an embedding for a search query using DeepInfra
 */
async function generateSearchEmbedding(text) {
  if (!process.env.DEEPINFRA_API_KEY) return null;
  try {
    const response = await axios.post(
      'https://api.deepinfra.com/v1/inference/google/embeddinggemma-300m',
      { inputs: [text] },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPINFRA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    let embedding = response.data.embeddings[0];
    if (embedding && embedding.length > 384) {
      embedding = embedding.slice(0, 384);
    }
    return embedding;
  } catch (error) {
    console.error('[Search] Failed to generate embedding:', error.message);
    return null;
  }
}

// --- Global Helpers ---

const safeParseFloat = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
};

const applyDynamicPricingToProduct = (product, rates) => {
  try {
    if (!product) return product;

    // Helper to calculate price for a specific target (product or variant)
    const calcPrice = (target, method) => {
      try {
        const basePrice = target.price || 0;
        // Use target's basePriceIQD if available, else product's
        const basePriceIQD = (target.basePriceIQD && target.basePriceIQD > 0) ? target.basePriceIQD : (product.basePriceIQD || null);
        const domesticShippingFee = product.domesticShippingFee || 0;

        // Ensure getAdjustedPrice is available
        if (typeof getAdjustedPrice !== 'function') {
          console.warn('getAdjustedPrice is not a function, using fallback price');
          return basePrice;
        }

        return getAdjustedPrice(
          basePrice, 
          domesticShippingFee, 
          basePriceIQD
        );
      } catch (err) {
        console.error('Error in calcPrice:', err);
        return target.price || 0;
      }
    };

    // 1. Calculate for all variants if they exist
    let newVariants = [];
    if (product.variants && Array.isArray(product.variants)) {
      newVariants = product.variants.map(v => {
        const seaPrice = calcPrice(v, 'sea');
        const airPrice = calcPrice(v, 'air');
        return {
          ...v,
          price: seaPrice, // Default to Sea
          inclusivePrice: seaPrice,
          seaPrice,
          airPrice
        };
      });
    }

    // 2. Find min variant from the *newly calculated* prices
    let minVariant = null;
    if (newVariants.length > 0) {
      minVariant = newVariants.reduce((min, curr) => {
        if (!curr.price) return min;
        if (!min) return curr;
        return curr.price < min.price ? curr : min;
      }, null);
    }

    // 3. Calculate main product prices
    let seaPrice, airPrice;
    
    if (minVariant) {
      seaPrice = minVariant.seaPrice;
      airPrice = minVariant.airPrice;
    } else {
      seaPrice = calcPrice(product, 'sea');
      airPrice = calcPrice(product, 'air');
    }

    return {
      ...product,
      variants: newVariants,
      price: seaPrice, // Update price to match default (sea)
      inclusivePrice: seaPrice, // Default to sea price as per requirement
      airPrice,
      seaPrice
    };
  } catch (error) {
    console.error(`Error calculating dynamic price for product ${product?.id}:`, error);
    // Fallback: return product as is to avoid breaking the entire list
    return product;
  }
};

const bulkImportJobQueue = [];
const bulkImportJobs = new Map();
let bulkImportJobRunning = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getHttpStatusFromError = (err) => {
  if (!err) return null;
  const direct = err.status ?? err.statusCode;
  if (typeof direct === 'number') return direct;
  const resp = err.response?.status;
  if (typeof resp === 'number') return resp;
  const msg = String(err.message || '');
  const match = msg.match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
};

/**
 * Standard SSE Middleware to ensure headers are set correctly
 * Use this for any long-running event streams
 */
const sseMiddleware = (req, res, next) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for proxy servers
  next();
};

// Robust numeric extractor for strings like "300 جرام" or "15.5 cm"
const extractNumber = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  
  const str = String(val);
  // Matches the first sequence of digits and decimals
  const match = str.match(/(\d+\.?\d*)/);
  if (match) {
    const parsed = parseFloat(match[1]);
    
    // If unit is grams, or if no unit is specified but the number is large (> 10), assume grams and convert to kg
    const isGramUnit = (str.includes('جرام') || str.toLowerCase().includes('gram')) && !str.toLowerCase().includes('kg');
    const isLikelyGrams = !str.toLowerCase().includes('kg') && parsed > 10;
    
    if (isGramUnit || isLikelyGrams) {
      return parsed / 1000;
    }
    
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Calculates the product price with appropriate markup based on shipping method.
 * Used during bulk import and creation.
 */
const calculateBulkImportPrice = (rawPrice, domesticFee, weight, length, width, height, explicitMethod, rates) => {
  const weightInKg = extractNumber(weight) || 0.5; // Default 0.5kg if missing
  
  let method = explicitMethod?.toLowerCase();
  
  if (!method) {
    // Default logic matching frontend: < 1kg is AIR, >= 1kg is SEA
    method = (weightInKg > 0 && weightInKg < 1) ? 'air' : 'sea';
  }

  const domestic = domesticFee || 0;

  if (method === 'air') {
    const airRate = (rates?.airShippingRate ?? rates?.airRate ?? 15400);
    // No minimum floor for air shipping as per user request
    const shippingCost = weightInKg * airRate;
    
    // Treat rawPrice as IQD (no heuristic conversion)
    const basePrice = rawPrice;
    
    // Formula: (Base + Domestic) * 1.0 (No profit added as requested)
    const finalPrice = (basePrice + domestic);
    return Math.ceil(finalPrice / 10) * 10;
  } else {
    // Sea logic matches Air now
    const basePrice = rawPrice;
    const finalPrice = (basePrice + domestic);
    return Math.ceil(finalPrice / 10) * 10;
  }
};

const estimateRawPriceFromStoredPrice = (storedPrice, domesticFee, weight, length, width, height, rates) => {
  const stored = Number(storedPrice) || 0;
  if (stored <= 0) return 0;

  const domestic = Number(domesticFee) || 0;
  
  // Inverse of (Base + Domestic) * 1.0 = Stored
  // Base + Domestic = Stored
  // Base = Stored - Domestic
  
  const raw = stored - domestic;
  return raw > 0 ? raw : 0;
};

// removed legacy applyDynamicPricingToProduct

async function recalculateExistingProductPrices(oldRates, newRates) {
  const batchSize = 150;
  let lastId = 0;
  let updatedProducts = 0;
  let updatedVariants = 0;
  const startedAt = Date.now();

  console.log('[Settings] Recalculating product prices...', { oldRates, newRates });

  while (true) {
    const products = await prisma.product.findMany({
      where: { id: { gt: lastId }, status: { not: 'DELETED' } },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        price: true,
        basePriceIQD: true,
        domesticShippingFee: true,
        variants: {
          select: {
            id: true,
            price: true
          }
        }
      }
    });

    if (products.length === 0) break;
    lastId = products[products.length - 1].id;

    const tasks = [];

    for (const product of products) {
      const domesticFee = Number(product.domesticShippingFee) || 0;

      const hasBase = Number(product.basePriceIQD) > 0;
      // Only reprice if basePriceIQD is low (assume RMB if < 1000). 
      // If it's > 1000, we treat it as IQD/Combined and respect the stored price.
      const shouldRepriceProduct = (hasBase && Number(product.basePriceIQD) < 1000);

      if (shouldRepriceProduct) {
        const raw = hasBase
          ? Number(product.basePriceIQD)
          : estimateRawPriceFromStoredPrice(product.price, domesticFee, 0, 0, 0, 0, oldRates);

        if (raw > 0) {
          const priceInput = raw;
          const newPrice = calculateBulkImportPrice(priceInput, domesticFee, 0, 0, 0, 0, null, newRates);
          if (Number.isFinite(newPrice) && newPrice > 0 && newPrice !== product.price) {
            tasks.push(() => prisma.product.update({
              where: { id: product.id },
              data: hasBase ? { price: newPrice } : { price: newPrice, basePriceIQD: raw }
            }).then(() => { updatedProducts += 1; }));
          } else if (!hasBase) {
            tasks.push(() => prisma.product.update({
              where: { id: product.id },
              data: { basePriceIQD: raw }
            }).catch(() => {}).then(() => {}));
          }
        }
      }

      for (const v of product.variants) {
        // Variants also follow the < 1000 logic for recalculation
        const vRaw = estimateRawPriceFromStoredPrice(v.price, domesticFee, 0, 0, 0, 0, oldRates);
        if (vRaw > 0 && vRaw < 1000) {
          const vNewPrice = calculateBulkImportPrice(vRaw, domesticFee, 0, 0, 0, 0, null, newRates);
          if (Number.isFinite(vNewPrice) && vNewPrice > 0 && vNewPrice !== v.price) {
            tasks.push(() => prisma.productVariant.update({
              where: { id: v.id },
              data: { price: vNewPrice }
            }).then(() => { updatedVariants += 1; }));
          }
        }
      }
    }

    const concurrency = 20;
    for (let i = 0; i < tasks.length; i += concurrency) {
      const slice = tasks.slice(i, i + concurrency);
      await Promise.allSettled(slice.map(fn => fn()));
    }

    await new Promise((r) => setImmediate(r));
  }

  console.log('[Settings] Price recalculation finished', {
    updatedProducts,
    updatedVariants,
    elapsedMs: Date.now() - startedAt
  });
}

// Helper to parse variant-specific values from a string like "200g (S), 300g (XL)"
const parseVariantValues = (str) => {
  if (!str || typeof str !== 'string') return {};
  
  const results = {};
  // Split by comma or semicolon
  const parts = str.split(/[,;]/);
  
  parts.forEach(part => {
    // Look for a number and a value in parentheses, e.g., "200 جرام (S)" or "300g (XL)"
    const match = part.match(/(\d+\.?\d*)\s*[^(\n]*\(([^)]+)\)/);
    if (match) {
      const val = parseFloat(match[1]);
      const key = match[2].trim();
      
      // Convert grams to kg if "gram" or "جرام" is present in the part
      let finalVal = val;
      if ((part.includes('جرام') || part.toLowerCase().includes('gram')) && !part.toLowerCase().includes('kg')) {
        finalVal = val / 1000;
      }
      
      results[key] = finalVal;
    }
  });
  
  return results;
};

const cleanStr = (s) => {
  if (!s || typeof s !== 'string') return s || '';
  return s.replace(/\bempty\b/gi, '').trim();
};

const extractGeneratedOptionEntries = (opt) => {
  const out = [];
  if (!opt || typeof opt !== 'object') return out;

  const maybeParseJson = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const metaKeys = new Set(['price', 'image', 'shippingmethod', 'method', 'stock']);

  const pushEntry = (rawKey, rawVal) => {
    const cleanedKey = cleanStr(String(rawKey));
    if (!cleanedKey) return;
    const lower = cleanedKey.toLowerCase();
    if (metaKeys.has(lower)) return;

    if (lower === 'options' || lower === 'combination' || lower === 'variant' || lower === 'variants') {
      const nested = maybeParseJson(rawVal);
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        for (const [k, v] of Object.entries(nested)) pushEntry(k, v);
        return;
      }
    }

    out.push([cleanedKey, rawVal]);
  };

  for (const [k, v] of Object.entries(opt)) pushEntry(k, v);
  return out;
};

const fieldMapping = {
  'size': 'المقاس',
  'Size': 'المقاس',
  '尺码': 'المقاس',
  'color': 'اللون',
  'Color': 'اللون',
  '颜色': 'اللون',
  '颜色分类': 'اللون',
  'اللون': 'اللون',
  'تصنيف الألوان': 'اللون',
  'المقاس': 'المقاس',
  'style': 'الستايل',
  'material': 'الخامة',
  'type': 'النوع',
  'model': 'الموديل',
  'Model': 'الموديل',
  '型号': 'الموديل'
};

const productVariantSelect = {
  id: true,
  productId: true,
  combination: true,
  price: true,
  basePriceIQD: true,
  image: true
};

// Server start - Build Trigger: 2026-01-26 22:00
const app = express();

// IMMEDIATELY define health check for Hugging Face to prevent 503/timeouts
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

console.log('-------------------------------------------');
console.log('--- UPDATED VARIANT LOGIC LOADED (v4 - FINAL FIX) ---');
console.log('--- STRICTLY NO CURRENCY CONVERSION ---');
console.log('-------------------------------------------');
const httpServer = createServer(app);

// Test Database Connection (moved to background)
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to the database');
  })
  .catch(err => {
    console.error('DATABASE CONNECTION ERROR:', err);
  });

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let sharpModule;
async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default ?? mod;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

// --- Image Processing Helpers ---
const convertToWebP = async (base64String) => {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String;
  }

  // Skip if already webp and reasonably sized
  if (base64String.startsWith('data:image/webp') && base64String.length < 50000) {
    return base64String;
  }

  try {
    const sharp = await getSharp();
    if (!sharp) return base64String;

    const base64Data = base64String.split(';base64,').pop();
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check buffer size - if very small, don't bother converting
    if (buffer.length < 10240) { // 10KB
      return base64String;
    }

    const webpBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }) // Added resize for optimization
      .webp({ quality: 75 }) // Slightly lower quality for better speed/size
      .toBuffer();
      
    return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Image conversion error:', error);
    return base64String;
  }
};

// --- Socket.io ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_admin_room', () => {
    socket.join('admin_notifications');
    console.log(`Socket ${socket.id} joined admin room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const JWT_SECRET = process.env.JWT_SECRET || 'c2hhbnNoYWw2Ni1teS1zaG9wLWJhY2tlbmQtc2VjcmV0LTIwMjY=';

// --- Normalization Helpers ---
const normalizePhone = (phone) => {
  if (!phone) return '';
  // Remove all non-numeric characters including '+'
  let clean = phone.replace(/\D/g, '');
  
  // Handle Iraq numbers (+964 or 07...)
  if (clean.startsWith('0')) {
    clean = '964' + clean.substring(1);
  } else if (clean.startsWith('9640')) {
    clean = '964' + clean.substring(4);
  } else if (!clean.startsWith('964') && clean.length === 10 && (clean.startsWith('77') || clean.startsWith('78') || clean.startsWith('75') || clean.startsWith('79'))) {
    // If it's a 10 digit number starting with a mobile prefix, assume it's Iraq
    clean = '964' + clean;
  }
  
  return clean;
};

const normalizeEmail = (email) => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

// --- Email Configuration ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

let testAccount = null;
let testTransporter = null;

const sendEmail = async ({ to, subject, html }) => {
  const isSmtpConfigured = process.env.SMTP_USER && 
                          process.env.SMTP_USER !== 'your_user' && 
                          process.env.SMTP_USER !== '';
  
  if (!isSmtpConfigured) {
    if (!testAccount) {
      try {
        testAccount = await nodemailer.createTestAccount();
        testTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('--- TEST EMAIL SERVICE INITIALIZED ---');
        console.log('User:', testAccount.user);
        console.log('--------------------------------------');
      } catch (err) {
        console.error('Failed to create test account:', err.message);
        return { success: false, error: 'Could not initialize email service' };
      }
    }
    
    try {
      const info = await testTransporter.sendMail({
        from: '"Chinak Test" <noreply@chinak.com>',
        to,
        subject: `[TEST] ${subject}`,
        html
      });
      const url = nodemailer.getTestMessageUrl(info);
      console.log('--- TEST EMAIL SENT ---');
      console.log('To:', to);
      console.log('Preview URL:', url);
      console.log('-----------------------');
      return { success: true, test: true, url };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Chinak" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    return { success: true, test: false };
  } catch (err) {
    console.error('SMTP Error:', err.message);
    return { success: false, error: err.message };
  }
};

const emailTemplate = (name, otpCode) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">CHINAK</h1>
    </div>
    <div style="color: #1e293b; line-height: 1.6;">
      <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Verify your email</h2>
      <p>Hello ${name},</p>
      <p>Thank you for joining Chinak. Please use the following verification code to complete your registration:</p>
      <div style="background: #f1f5f9; padding: 24px; text-align: center; font-size: 36px; font-weight: 800; letter-spacing: 8px; margin: 30px 0; border-radius: 12px; color: #2563eb; border: 1px solid #e2e8f0;">
        ${otpCode}
      </div>
      <p style="font-size: 14px; color: #64748b;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
      <p>&copy; ${new Date().getFullYear()} Chinak. All rights reserved.</p>
    </div>
  </div>
`;

const forgotPasswordTemplate = (otp) => `
  <div dir="rtl" style="font-family: sans-serif; text-align: right; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
    <h2 style="color: #2563eb;">إعادة تعيين كلمة المرور</h2>
    <p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بك في تطبيق شيناك.</p>
    <p>كود التحقق الخاص بك هو:</p>
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
      ${otp}
    </div>
    <p style="color: #6b7280; font-size: 14px;">هذا الكود صالح لمدة 30 دقيقة فقط.</p>
    <p>إذا لم تطلب هذا الكود، يمكنك تجاهل هذا البريد بأمان.</p>
  </div>
`;

app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins in development
    if (!origin || 
        origin.startsWith('http://localhost') || 
        origin.startsWith('https://localhost') || 
        origin.startsWith('http://127.0.0.1') || 
        origin.includes('ngrok-free.dev') || 
        origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      // For production, you should be more specific, but for now we allow to debug
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  if (req.path.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.path}`);
  }
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const duration = Date.now() - start;
      console.log(`[API Response] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

app.use(compression({
  filter: (req, res) => {
    // Never compress SSE streams as it breaks real-time delivery
    const contentType = res.getHeader('Content-Type');
    const accept = req.headers['accept'];
    
    if (accept === 'text/event-stream' || (contentType && String(contentType).includes('text/event-stream'))) {
      return false;
    }
    
    // Default filter logic
    if (compression.filter) {
      return compression.filter(req, res);
    }
    return true;
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the 'dist' directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// --- Authentication Middleware ---
const authenticateToken = async (req, res, next) => {
  try { fs.appendFileSync(path.join(__dirname, 'perf.log'), `[Auth] Checking token at ${new Date().toISOString()}\n`); } catch (e) {}
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[Auth] No token provided');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Try Supabase Auth first
    console.log('[Auth] Checking Supabase token...');
    let supabaseUser = null;
    let supabaseError = null;
    
    try {
      // Only try Supabase if it looks like a Supabase token or if we want to be safe
      // Supabase tokens are usually very long JWTs
      const result = await supabase.auth.getUser(token);
      supabaseUser = result.data?.user;
      supabaseError = result.error;
    } catch (sbErr) {
      console.log('[Auth] Supabase getUser threw error (probably not a Supabase token):', sbErr.message);
    }
    
    if (supabaseUser) {
      console.log('[Auth] Supabase user found:', supabaseUser.email);
      // Find or create local user synced with Supabase
      let user = await prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id }
      });

      if (!user) {
        console.log('[Auth] Syncing new Supabase user to local DB...');
        // Try finding by email
        user = await prisma.user.findUnique({
          where: { email: supabaseUser.email }
        });

        if (user) {
          // Update existing user with supabaseId and name if missing
          user = await prisma.user.update({
            where: { id: user.id },
            data: { 
              supabaseId: supabaseUser.id,
              name: user.name || supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0]
            }
          });
        } else {
          // Create new local user
          user = await prisma.user.create({
            data: {
              email: supabaseUser.email,
              supabaseId: supabaseUser.id,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0] || 'User',
              role: 'USER',
              isVerified: true
            }
          });
        }
      } else if (!user.name || user.name === 'User') {
        // Update name if it's missing or just 'User'
        const sbName = supabaseUser.user_metadata?.full_name;
        if (sbName && sbName !== user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: sbName }
          });
        }
      }

      req.user = { 
        id: user.id, 
        role: user.role, 
        name: user.name,
        supabaseId: supabaseUser.id
      };
      return next();
    }

    // Fallback to local JWT if Supabase fails or returns no user
    console.log('[Auth] Supabase check failed, trying local JWT...');
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      console.log('[Auth] Local JWT verified for user ID:', verified.id);
      
      // Ensure ID is a number if it's stored as a number in DB
      const userId = typeof verified.id === 'string' ? parseInt(verified.id) : verified.id;
      
      if (!userId || isNaN(userId)) {
        console.log('[Auth] Invalid user ID in token');
        return res.status(401).json({ error: 'Invalid token payload' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (user) {
        // Update verified object with the numeric ID to be safe
        req.user = { ...verified, id: userId };
        next();
      } else {
        console.log('[Auth] User not found in local DB for ID:', userId);
        return res.status(401).json({ error: 'User not found' });
      }
    } catch (jwtError) {
      console.log('[Auth] Local JWT verification failed:', jwtError.message);
      // Debug: Log secret length/prefix to check consistency (DO NOT LOG FULL SECRET)
      console.log('[Auth] JWT_SECRET prefix:', JWT_SECRET.substring(0, 5) + '...');
      return res.status(401).json({ error: `Authentication failed: ${jwtError.message}` });
    }
  } catch (error) {
    console.error('[Auth] Unexpected error during authentication:', error);
    if (error.stack) console.error(error.stack);
    return res.status(401).json({ 
      error: 'Authentication failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

// --- WhatsApp OTP (OTPIQ) Endpoints ---
app.get('/api/auth/check-user/:phone', async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const email = `${phone}@whatsapp.user`;
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Check User Error:', error);
    res.status(500).json({ error: 'Failed to check user' });
  }
});

// --- Email Auth Endpoints ---
app.post('/api/auth/sync-supabase-user', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { name, supabaseId } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        supabaseId,
        name: name || undefined,
        isVerified: true 
      },
      create: {
        email,
        name: name || email.split('@')[0] || 'User',
        supabaseId,
        role: 'USER',
        isVerified: true
      }
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '36500d' }
    );

    res.json({
      token,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Sync Supabase User Error:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

app.get('/api/auth/check-email/:email', async (req, res) => {
  const email = normalizeEmail(req.params.email);
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // For simplicity in this demo, we check if they are in our DB.
    // In a real app with Supabase, we'd also check if they are in Supabase.
    // But since listUsers() is expensive and needs pagination, we'll stick to Prisma
    // and let the frontend handle "User already exists" from Supabase if needed.
    
    // Don't count WhatsApp fallback emails as "real" emails for this flow
    const isRealEmail = user && !user.email.endsWith('@whatsapp.user');
    res.json({ 
      exists: !!isRealEmail,
      hasPassword: !!(user && user.password)
    });
  } catch (error) {
    console.error('Check Email Error:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

app.post('/api/auth/email-login', async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  email = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '36500d' }
    );

    res.json({
      token,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Email Login Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/email-signup', async (req, res) => {
  let { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }
  email = email.toLowerCase().trim();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        name,
        otpCode,
        otpExpires,
        isVerified: false
      },
      create: {
        email,
        password: hashedPassword,
        name,
        otpCode,
        otpExpires,
        role: 'USER',
        isVerified: false
      }
    });

    // Send OTP via Email
    const result = await sendEmail({
      to: email,
      subject: 'Verify your email - Chinak',
      html: emailTemplate(name, otpCode)
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ 
      message: 'تم إرسال كود التحقق بنجاح',
      testUrl: result.url 
    });
  } catch (error) {
    console.error('Email Signup Error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/resend-email-otp', async (req, res) => {
  let { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  email = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Account already verified' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpCode, otpExpires }
    });

    const result = await sendEmail({
      to: email,
      subject: 'Verify your email - Chinak',
      html: emailTemplate(user.name || 'User', otpCode)
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.json({ message: 'تم إعادة إرسال الكود بنجاح', testUrl: result.url });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ error: 'Resend failed' });
  }
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
  let { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  email = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.otpCode !== code || new Date() > user.otpExpires) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        otpCode: null,
        otpExpires: null,
        isVerified: true
      }
    });

    const token = jwt.sign(
      { id: updatedUser.id, role: updatedUser.role, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: '36500d' }
    );

    res.json({
      token,
      user: {
        id: updatedUser.id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Verify Email OTP Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  let { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  email = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'لا يوجد حساب مرتبط بهذا البريد الإلكتروني' });
    }
    
    // If user exists but has no password, they likely signed up via social login
    if (!user.password) {
      return res.status(400).json({ error: 'هذا الحساب يستخدم تسجيل الدخول عبر Google أو WhatsApp. يرجى استخدام الطريقة الأصلية لتسجيل الدخول.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordOTP: otp,
        resetPasswordExpires: expires
      }
    });

    // Send Email
    const result = await sendEmail({
      to: email,
      subject: 'إعادة تعيين كلمة المرور - شيناك',
      html: forgotPasswordTemplate(otp)
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send reset email' });
    }

    res.json({ 
      message: 'تم إرسال كود إعادة التعيين إلى بريدك الإلكتروني',
      testUrl: result.url 
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Forgot password failed' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  let { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  email = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.resetPasswordOTP !== otp || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ error: 'كود التحقق غير صحيح أو منتهي الصلاحية' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetPasswordOTP: null,
        resetPasswordExpires: null
      }
    });

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'فشل إعادة تعيين كلمة المرور' });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  // --- Google Play Test Account Logic ---
  const TEST_PHONE = '9647700000000'; // Normalized test phone
  const TEST_OTP = '123456';
  
  if (phone === TEST_PHONE) {
    console.log(`[TEST MODE] OTP requested for test account ${TEST_PHONE}`);
    const email = `${phone}@whatsapp.user`;
    const otpExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for test account
    
    await prisma.user.upsert({
      where: { email },
      update: { otpCode: TEST_OTP, otpExpires },
      create: { 
        email, 
        otpCode: TEST_OTP, 
        otpExpires,
        role: 'USER',
        isVerified: false,
        name: name || 'Google Reviewer'
      }
    });
    
    return res.json({ message: 'OTP sent successfully (Test Mode)' });
  }
  // --- End Test Account Logic ---

  const email = `${phone.replace('+', '')}@whatsapp.user`;

  try {
    // ... (Limit logic remains same) ...
    const user = await prisma.user.findUnique({ where: { email } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (user) {
      const lastDate = user.lastWhatsappOtpDate ? new Date(user.lastWhatsappOtpDate) : null;
      if (lastDate) lastDate.setHours(0, 0, 0, 0);

      const isSameDay = lastDate && lastDate.getTime() === today.getTime();
      
      if (isSameDay && user.whatsappOtpCount >= 3) {
        return res.status(429).json({ error: 'لقد تجاوزت الحد الأقصى لطلبات الكود لهذا اليوم. يرجى المحاولة غداً.' });
      }

      // Update count
      await prisma.user.update({
        where: { email },
        data: {
          whatsappOtpCount: isSameDay ? { increment: 1 } : 1,
          lastWhatsappOtpDate: new Date()
        }
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert user and save OTP using email as the unique identifier
    await prisma.user.upsert({
      where: { email },
      update: { otpCode, otpExpires, name: name || undefined, phone },
      create: { 
        email, 
        phone,
        otpCode, 
        otpExpires,
        role: 'USER',
        isVerified: false,
        name: name || phone
      }
    });

    // Send via OTPIQ
    try {
      const otpiqResponse = await axios.post('https://api.otpiq.com/api/sms', { 
        "phoneNumber": phone.replace('+', ''), 
        "smsType": "verification", 
        "provider": "whatsapp", 
        "verificationCode": otpCode 
      }, { 
        headers: { 
          'Authorization': 'Bearer sk_live_f891c78edd44691d580e53a95f9e8d138df94c3c', 
          'Content-Type': 'application/json' 
        } 
      });
      console.log('OTPIQ Response:', otpiqResponse.data);
    } catch (otpiqError) {
      console.error('OTPIQ sending failed, but continuing for development:', otpiqError.response?.data || otpiqError.message);
      console.log('-------------------------------------------');
      console.log(`DEVELOPMENT WHATSAPP OTP FOR ${phone}: ${otpCode}`);
      console.log('-------------------------------------------');
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { code, fullName } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });
  const email = `${phone}@whatsapp.user`;

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.otpCode !== code || new Date() > user.otpExpires) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Clear OTP and verify user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        otpCode: null, 
        otpExpires: null, 
        isVerified: true,
        name: fullName || user.name || 'User'
      }
    });

    // --- Supabase Sync (Optional but recommended) ---
    // Try to find or create this user in Supabase too
    let supabaseId = updatedUser.supabaseId;
    if (!supabaseId) {
      try {
        // We use admin API to create the user without email confirmation
        const { data: sbData, error: sbError } = await supabase.auth.admin.createUser({
          email: updatedUser.email,
          email_confirm: true,
          user_metadata: { full_name: updatedUser.name },
          password: Math.random().toString(36).slice(-12) // Random password for WhatsApp users
        });

        if (!sbError && sbData.user) {
          supabaseId = sbData.user.id;
          await prisma.user.update({
            where: { id: updatedUser.id },
            data: { supabaseId }
          });
        }
      } catch (e) {
        console.warn('Supabase WhatsApp sync failed (non-fatal):', e);
      }
    }

    // Generate JWT for our app
    const token = jwt.sign(
      { id: updatedUser.id, role: updatedUser.role, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: '36500d' }
    );

    res.json({ 
      token, 
      user: {
        id: updatedUser.id.toString(), // Convert to string for consistency with frontend User interface
        name: updatedUser.name,
        phone: updatedUser.email.split('@')[0], // Extract phone from fallback email
        email: updatedUser.email,
        role: updatedUser.role
      } 
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.delete('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabaseId = req.user.supabaseId;

    // Delete from local database
    await prisma.user.delete({
      where: { id: userId }
    });

    // If there's a Supabase user, delete it from Supabase as well
    if (supabaseId) {
      const { error } = await supabase.auth.admin.deleteUser(supabaseId);
      if (error) {
        console.error('Supabase user deletion error (non-fatal):', error);
      }
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatar: true,
        role: true,
        permissions: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      ...user,
      id: user.id.toString(), // Consistency with frontend
      phone: user.phone || user.email?.split('@')[0] || '' // Use phone field if available, fallback to email-based phone
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

app.put('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let { name, email, avatar } = req.body;
    const userId = req.user.id;

    if (avatar && avatar.startsWith('data:image')) {
      avatar = await convertToWebP(avatar);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, email, avatar },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true
      }
    });
    res.json({
      ...updatedUser,
      id: updatedUser.id.toString(),
      phone: updatedUser.email?.split('@')[0] || ''
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

const isAdmin = async (req, res, next) => {
  // Temporary: allow everyone to be admin
  next();
  return;
  
  try {
    // Check if user exists and has ADMIN role in DB to ensure role changes are immediate
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });

    if (user && user.role === 'ADMIN') {
      req.user.role = 'ADMIN'; // Sync token role with DB role for subsequent middlewares
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
};

const hasPermission = (permission) => {
  return async (req, res, next) => {
    // Temporary: allow everyone to have all permissions
    next();
    return;

    try {
      if (req.user.role === 'ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { permissions: true, name: true }
        });
        
        req.user.name = user.name;
        const permissions = JSON.parse(user.permissions || '[]');
        // Super admins (no permissions set or "*" in permissions) have full access
        if (permissions.length === 0 || permissions.includes('*') || permissions.includes(permission)) {
          return next();
        }
        return res.status(403).json({ error: `Access denied. Required permission: ${permission}` });
      }
      res.status(403).json({ error: 'Access denied. Admin role required.' });
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

// --- Logging and Notifications Helpers ---
const safeParseId = (id) => {
  if (id === null || id === undefined) return id;
  const stringId = String(id);
  if (/^\d+$/.test(stringId)) {
    return parseInt(stringId, 10);
  }
  return stringId;
};

const logActivity = async (adminId, adminName, action, details, targetType, targetId) => {
  try {
    await prisma.activityLog.create({
      data: {
        adminId,
        adminName,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        targetType,
        targetId: targetId ? safeParseId(targetId) : null
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// --- Debug: Check Recent Products ---
app.get('/api/debug/recent-products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { options: true }
      });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const createNotification = async (title, message, type, link) => {
  try {
    await prisma.adminNotification.create({
      data: { title, message, type, link }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// ADMIN: Get stats
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  console.log('GET /api/admin/stats hit by user:', req.user.id, req.user.name);
  try {
    const [
      totalProducts, 
      totalOrders, 
      totalUsers, 
      recentOrders,
      pendingOrders,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
      }),
      prisma.order.count({ where: { status: 'PENDING' } }),
    ]);

    const totalSales = await prisma.order.aggregate({
      _sum: { total: true },
      _count: { id: true },
      _avg: { total: true },
      where: { status: 'DELIVERED' }
    });

    // Get sales by month for the last 12 months
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    
    const ordersByMonth = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: lastYear }
      },
      select: {
        total: true,
        createdAt: true
      }
    });

    // Group by month
    const monthlySales = Array(12).fill(0).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const month = d.getMonth();
      const year = d.getFullYear();
      
      const monthTotal = ordersByMonth
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getMonth() === month && od.getFullYear() === year;
        })
        .reduce((sum, o) => sum + o.total, 0);
        
      return {
        month: d.toLocaleString('en-US', { month: 'short' }),
        total: monthTotal
      };
    });

    res.json({
      totalProducts,
      totalOrders,
      totalUsers,
      totalSales: totalSales._sum.total || 0,
      averageOrderValue: totalSales._avg.total || 0,
      deliveredOrders: totalSales._count.id || 0,
      recentOrders,
      monthlySales,
      pendingOrders
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// ADMIN: Get all orders
app.get('/api/admin/orders', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, startDate, endDate, minPrice, maxPrice, province, search } = req.query;
    
    let where = {};
    
    if (status && status !== 'ALL') {
      where.status = status;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    if (minPrice || maxPrice) {
      where.total = {};
      if (minPrice) where.total.gte = parseFloat(minPrice);
      if (maxPrice) where.total.lte = parseFloat(maxPrice);
    }
    
    if (province && province !== 'ALL') {
      where.address = {
        province: province
      };
    }
    
    if (search) {
      where.OR = [
        { id: safeParseId(search) },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { address: { phone: { contains: search } } }
      ].filter(condition => Object.values(condition)[0] !== undefined);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true }
          },
          address: true
          // Items removed for list performance
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ADMIN: Get single order details
app.get('/api/admin/orders/:id', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: safeParseId(id) },
      include: {
        user: {
          select: { name: true, email: true }
        },
        address: true,
        items: {
          include: { 
            product: {
              include: {
                options: true
              }
            },
            variant: { select: productVariantSelect }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// --- User Notifications ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { 
        id: safeParseId(id),
        userId: req.user.id // Security: ensure notification belongs to user
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { 
        userId: req.user.id,
        isRead: false 
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({
      where: { 
        id: safeParseId(id),
        userId: req.user.id // Security
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

app.delete('/api/notifications', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Helper for user notifications
const createUserNotification = async (userId, title, description, type, icon, color, link) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        description,
        type,
        icon,
        color,
        link
      }
    });
    // Optional: Emit via socket.io for real-time update
    io.emit(`user_notification_${userId}`, notification);
    return notification;
  } catch (error) {
    console.error('Failed to create user notification:', error);
  }
};

const sendOrderStatusNotification = async (orderId, status, userId) => {
  try {
    let title = '';
    let description = '';
    let icon = '';
    let color = 'blue';

    switch (status) {
      case 'AWAITING_PAYMENT':
        title = 'بانتظار الدفع 💳';
        description = `طلبك رقم #${orderId} بانتظار إتمام عملية الدفع للمباشرة بالتجهيز.`;
        icon = 'payments';
        color = 'orange';
        break;
      case 'PREPARING':
        title = 'جاري تجهيز طلبك 📦';
        description = `طلبك رقم #${orderId} قيد التجهيز الآن في مستودعاتنا.`;
        icon = 'inventory_2';
        color = 'indigo';
        break;
      case 'SHIPPED':
        title = 'خرج طلبك للشحن! 🚢';
        description = `بشرى سارة! طلبك رقم #${orderId} تم شحنه من المصدر وهو في طريقه إلى مستودعاتنا.`;
        icon = 'ship';
        color = 'blue';
        break;
      case 'ARRIVED_IRAQ':
        title = 'وصل طلبك إلى العراق 🇮🇶';
        description = `وصل طلبك رقم #${orderId} إلى العراق، سيتم تسليمه للمندوب قريباً.`;
        icon = 'location_on';
        color = 'cyan';
        break;
      case 'DELIVERED':
        title = 'تم توصيل طلبك بنجاح ✅';
        description = `تم تسليم الطلب رقم #${orderId}. شكراً لثقتك بنا، نتمنى أن تنال المنتجات إعجابك!`;
        icon = 'verified';
        color = 'green';
        break;
      case 'CANCELLED':
        title = 'تم إلغاء الطلب ❌';
        description = `تم إلغاء طلبك رقم #${orderId}. إذا لم تكن أنت من قام بالإلغاء، يرجى التواصل مع الدعم.`;
        icon = 'cancel';
        color = 'red';
        break;
      default:
        title = 'تحديث في حالة الطلب';
        description = `هناك تحديث جديد لطلبك رقم #${orderId}. يمكنك التحقق من التفاصيل الآن.`;
        icon = 'notifications';
        color = 'blue';
    }

    await createUserNotification(
      userId,
      title,
      description,
      'order',
      icon,
      color,
      `/shipping-tracking?id=${orderId}`
    );

    // Emit real-time order update event
    io.emit(`order_status_updated_${orderId}`, { 
      orderId, 
      status,
      timestamp: new Date().toISOString()
    });

    io.emit('order_status_update', { id: safeParseId(orderId), status });
  } catch (error) {
    console.error('Failed to send order status notification:', error);
  }
};

// ADMIN: Update order status
app.put('/api/admin/orders/:id/status', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = await prisma.order.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: safeParseId(id) },
      data: { status }
    });
    
    await sendOrderStatusNotification(id, status, order.userId);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ADMIN: Update order internal note
app.put('/api/admin/orders/:id/note', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const order = await prisma.order.update({
      where: { id: safeParseId(id) },
      data: { internalNote: note }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order note' });
  }
});

app.put('/api/admin/orders/:id/international-fee', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fee } = req.body;
    const newFee = parseFloat(fee) || 0;

    // Get current order to calculate new total
    const currentOrder = await prisma.order.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldFee = currentOrder.internationalShippingFee || 0;
    const newTotal = Math.ceil((currentOrder.total - oldFee + newFee) / 10) * 10;
    
    // Automatically move to AWAITING_PAYMENT when fee is set, but only if it was PENDING
    let newStatus = currentOrder.status;
    if (currentOrder.status === 'PENDING') {
      newStatus = 'AWAITING_PAYMENT';
    }

    const order = await prisma.order.update({
      where: { id: safeParseId(id) },
      data: { 
        internationalShippingFee: newFee,
        total: newTotal,
        status: newStatus
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        address: true,
        items: {
          include: { product: true, variant: { select: productVariantSelect } }
        }
      }
    });

    // Send notification about status change if it actually changed
    if (newStatus !== currentOrder.status) {
      await sendOrderStatusNotification(id, newStatus, order.user.id);
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating international fee:', error);
    res.status(500).json({ error: 'Failed to update international shipping fee' });
  }
});

// ADMIN: Get all reviews
app.get('/api/admin/reviews', authenticateToken, isAdmin, hasPermission('manage_reviews'), async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, image: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ADMIN: Delete review
app.delete('/api/admin/reviews/:id', authenticateToken, isAdmin, hasPermission('manage_reviews'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.delete({
      where: { id: safeParseId(id) }
    });
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Bulk update orders status
app.post('/api/admin/orders/bulk-status', authenticateToken, isAdmin, hasPermission('manage_orders'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });
    
    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_UPDATE_ORDER_STATUS',
      { ids, status },
      'ORDER'
    );
    
    // Notify about bulk status update
    io.emit('bulk_order_status_update', { ids, status });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk update orders' });
  }
});

// ADMIN: Fetch all activity logs
app.get('/api/admin/activity-logs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// ADMIN: Get notifications
app.get('/api/admin/notifications', authenticateToken, isAdmin, async (req, res) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ADMIN: Mark notification as read
app.put('/api/admin/notifications/:id/read', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.adminNotification.update({
      where: { id: safeParseId(id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ADMIN: Mark all notifications as read
app.put('/api/admin/notifications/read-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ADMIN: Trigger AI processing for a product
app.post('/api/admin/products/:id/process-ai', authenticateToken, isAdmin, async (req, res) => {
  res.json({ success: true, message: 'AI processing is disabled' });
});

// ADMIN: Bulk update products status
app.post('/api/admin/products/bulk-status', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { ids, isActive } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    const parsedIds = ids.map(id => safeParseId(id)).filter(id => typeof id === 'number');

    if (parsedIds.length === 0) {
      return res.json({ success: true });
    }

    await prisma.product.updateMany({
      where: { id: { in: parsedIds } },
      data: { isActive }
    });
    
    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_UPDATE_PRODUCT_STATUS',
      { ids: parsedIds, isActive },
      'PRODUCT'
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Bulk status update error:', error);
    res.status(500).json({ error: 'Failed to bulk update products' });
  }
});

// ADMIN: Bulk delete products
app.post('/api/admin/products/bulk-delete', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No product IDs provided' });
    }

    // Parse IDs to ensure they are numbers
    const productIds = ids.map(id => safeParseId(id));

    console.log(`[Bulk Delete] Deleting ${productIds.length} products:`, productIds);
    
    // Delete related records for all products in bulk
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } }), // Delete OrderItems first
      prisma.productImage.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.productOption.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.review.deleteMany({ where: { productId: { in: productIds } } }),
    ]);

    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    
    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_DELETE_PRODUCTS',
      { ids: productIds },
      'PRODUCT'
    );
    
    res.json({ success: true, count: productIds.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete products: ' + error.message });
  }
});

// ADMIN: Get all users
app.get('/api/admin/users', authenticateToken, isAdmin, hasPermission('manage_users'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const isArabicSearch = typeof search === 'string' && /[\u0600-\u06FF]/.test(search);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          permissions: true,
          createdAt: true,
          _count: {
            select: { orders: true }
          },
          orders: {
            select: {
              total: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const usersWithTotalSpend = users.map(user => {
      const totalSpend = user.orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const { orders, ...userWithoutOrders } = user;
      return {
        ...userWithoutOrders,
        totalSpend
      };
    });

    res.json({
      users: usersWithTotalSpend,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Fetch admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ADMIN: Update user role
app.put('/api/admin/users/:id/role', authenticateToken, isAdmin, hasPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id: safeParseId(id) },
      data: { role }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// ADMIN: Update user permissions
app.put('/api/admin/users/:id/permissions', authenticateToken, isAdmin, hasPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    const user = await prisma.user.update({
      where: { id: safeParseId(id) },
      data: { permissions: JSON.stringify(permissions) }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user permissions' });
  }
});

// ADMIN: Get all coupons
app.get('/api/admin/coupons', authenticateToken, isAdmin, hasPermission('manage_coupons'), async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        NOT: {
          code: { startsWith: 'DELETED_' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// ADMIN: Create coupon
app.post('/api/admin/coupons', authenticateToken, isAdmin, hasPermission('manage_coupons'), async (req, res) => {
  try {
    const { 
      code, 
      discountType, 
      discountValue, 
      minOrderAmount, 
      maxDiscount, 
      endDate, 
      usageLimit,
      isPublic 
    } = req.body;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderAmount: parseFloat(minOrderAmount) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        endDate: new Date(endDate),
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        isPublic: isPublic !== undefined ? isPublic : true
      }
    });
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// ADMIN: Update coupon
app.put('/api/admin/coupons/:id', authenticateToken, isAdmin, hasPermission('manage_coupons'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, 
      discountType, 
      discountValue, 
      minOrderAmount, 
      maxDiscount, 
      endDate, 
      usageLimit, 
      isActive,
      isPublic 
    } = req.body;
    const coupon = await prisma.coupon.update({
      where: { id: safeParseId(id) },
      data: {
        code,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderAmount: parseFloat(minOrderAmount) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        endDate: new Date(endDate),
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        isActive,
        isPublic: isPublic !== undefined ? isPublic : true
      }
    });
    res.json(coupon);
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// ADMIN: Delete coupon
app.delete('/api/admin/coupons/:id', authenticateToken, isAdmin, hasPermission('manage_coupons'), async (req, res) => {
  try {
    const { id } = req.params;
    const couponId = safeParseId(id);

    // Check if coupon is used in any orders
    const ordersWithCoupon = await prisma.order.count({
      where: { couponId }
    });

    if (ordersWithCoupon > 0) {
      // If used in orders, we can't delete it without breaking order history
      // Instead, we deactivate it and mark it as deleted (using a naming convention or isActive)
      await prisma.coupon.update({
        where: { id: couponId },
        data: { 
          isActive: false,
          code: `DELETED_${Date.now()}_${couponId}` // Rename to free up the code
        }
      });
      return res.json({ message: 'Coupon used in orders, deactivated instead of deleted' });
    }

    // Also delete coupon usage records if any
    await prisma.couponUsage.deleteMany({
      where: { couponId }
    });

    await prisma.coupon.delete({ where: { id: couponId } });
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Failed to delete coupon: ' + error.message });
  }
});

// ADMIN: Generate summary report for dashboard
app.get('/api/admin/reports/summary', authenticateToken, isAdmin, hasPermission('view_reports'), async (req, res) => {
  try {
    const now = new Date();
    
    // Daily stats
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const dailyOrders = await prisma.order.findMany({
      where: { createdAt: { gte: todayStart }, status: 'DELIVERED' },
      select: { total: true }
    });
    
    // Weekly stats
    const lastWeek = new Date(new Date().setDate(new Date().getDate() - 7));
    const weeklyOrders = await prisma.order.findMany({
      where: { createdAt: { gte: lastWeek }, status: 'DELIVERED' },
      select: { total: true }
    });
    
    // Monthly stats
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));
    const monthlyOrders = await prisma.order.findMany({
      where: { createdAt: { gte: lastMonth }, status: 'DELIVERED' },
      select: { total: true }
    });

    // Top Products (Monthly)
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: { order: { createdAt: { gte: lastMonth }, status: 'DELIVERED' } },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    let topProductsWithDetails = [];
    if (topProducts && topProducts.length > 0) {
      const productDetails = await prisma.product.findMany({
        where: { id: { in: topProducts.map(p => p.productId) } },
        select: { id: true, name: true }
      });

      topProductsWithDetails = topProducts.map(p => {
        const details = productDetails.find(pd => pd.id === p.productId);
        // Calculate revenue for this product
        // For simplicity in this mock, we'll just use quantity
        return {
          id: p.productId,
          name: details?.name || 'Unknown',
          count: p._sum.quantity,
          revenue: p._sum.quantity * 30000 // Mock revenue calculation
        };
      });
    }

    res.json({
      daily: {
        totalSales: dailyOrders.reduce((sum, o) => sum + o.total, 0),
        orderCount: dailyOrders.length
      },
      weekly: {
        totalSales: weeklyOrders.reduce((sum, o) => sum + o.total, 0),
        orderCount: weeklyOrders.length
      },
      monthly: {
        totalSales: monthlyOrders.reduce((sum, o) => sum + o.total, 0),
        orderCount: monthlyOrders.length
      },
      topProducts: topProductsWithDetails
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ADMIN: Send test automated report
app.post('/api/admin/reports/send-test', authenticateToken, isAdmin, hasPermission('view_reports'), async (req, res) => {
  try {
    await sendAutomatedReports();
    res.json({ message: 'Reports sent successfully to all admins' });
  } catch (error) {
    console.error('Test report error:', error);
    res.status(500).json({ error: 'Failed to send test reports' });
  }
});

// --- User Interaction Tracking ---
app.post('/api/track', async (req, res) => {
  try {
    const { productId, type, weight, sessionId } = req.body;
    
    // Get user ID if authenticated
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {}
    }

    if (!productId || !type) {
      return res.status(400).json({ error: 'Product ID and Type are required' });
    }

    await prisma.userInteraction.create({
      data: {
        userId: userId ? safeParseId(userId) : null,
        sessionId: sessionId || 'guest',
        productId: safeParseId(productId),
        type,
        weight: weight || 1.0
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

// --- Agent / Scraper Routes ---
app.post('/api/products/fetch-external', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const productData = await scrapeProduct(url);
    
    const product = await prisma.product.create({
      data: {
        name: productData.name,
        price: productData.price || 0,
        originalPrice: productData.originalPrice,
        image: productData.image,
        originalUrl: productData.originalUrl,
        provider: productData.provider,
        sellerName: productData.sellerName,
        status: 'DRAFT',
        isActive: true,
        images: {
          create: (productData.images || []).map((img, idx) => ({ url: img, order: idx }))
        }
      }
    });

    res.json(product);
  } catch (error) {
    console.error('Fetch external failed:', error);
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

// Automated Reports Logic
const generateWeeklyReport = async () => {
  const lastWeek = new Date(new Date().setDate(new Date().getDate() - 7));
  const weeklyOrders = await prisma.order.findMany({
    where: { createdAt: { gte: lastWeek }, status: 'DELIVERED' },
    select: { total: true }
  });

  const totalSales = weeklyOrders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = weeklyOrders.length;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
      <h2 style="color: #4f46e5;">تقرير الأداء الأسبوعي للمتجر</h2>
      <p>إليك ملخص لأداء المتجر خلال الأسبوع الماضي:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p><strong>إجمالي المبيعات:</strong> ${totalSales.toLocaleString()} ج.م</p>
        <p><strong>عدد الطلبات المكتملة:</strong> ${orderCount}</p>
        <p><strong>متوسط قيمة الطلب:</strong> ${orderCount > 0 ? (totalSales / orderCount).toLocaleString() : 0} ج.م</p>
      </div>
      <p>يمكنك عرض المزيد من التفاصيل من خلال <a href="${frontendUrl}/admin" style="color: #4f46e5; text-decoration: none;">لوحة تحكم المشرف</a>.</p>
    </div>
  `;
};

const sendAutomatedReports = async () => {
  try {
    const admins = await prisma.user.findMany({ 
      where: { 
        role: 'ADMIN',
        // In a real app, you might check if they've opted in for reports
      } 
    });
    
    if (admins.length === 0) return;

    console.log(`[Automated Report] Generating weekly performance summary for ${admins.length} admins...`);
    
    const reportHtml = await generateWeeklyReport();
    
    for (const admin of admins) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"My Store" <noreply@mystore.com>',
          to: admin.email,
          subject: 'تقرير الأداء الأسبوعي للمتجر',
          html: reportHtml
        });
        console.log(`[Automated Report] Report sent to ${admin.email}`);
      } catch (err) {
        console.error(`[Automated Report] Failed to send to ${admin.email}:`, err.message);
      }
    }
    
    console.log('[Automated Report] Weekly report process completed.');
  } catch (error) {
    console.error('[Automated Report] Global failure:', error);
  }
};

// Run every week (simulated with 7 days in ms)
// setInterval(sendAutomatedReports, 7 * 24 * 60 * 60 * 1000);
// Also run once on startup after a delay
// setTimeout(sendAutomatedReports, 10000);

// USER: Validate coupon
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    const coupon = await prisma.coupon.findUnique({
      where: { code }
    });

    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ error: 'كود الخصم غير صحيح أو غير فعال' });
    }

    // Check if user has already used this coupon
    const usage = await prisma.couponUsage.findFirst({
      where: {
        couponId: coupon.id,
        userId: req.user.id
      }
    });

    if (usage) {
      return res.status(400).json({ error: 'لقد استخدمت هذا الكوبون مسبقاً' });
    }

    // For private coupons, check if it's already used by anyone
    if (!coupon.isPublic && coupon.usageCount >= 1) {
      return res.status(400).json({ error: 'تم استخدام هذا الكوبون من قبل مستخدم آخر' });
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return res.status(400).json({ error: 'انتهت صلاحية هذا الكوبون' });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'تم الوصول للحد الأقصى لاستخدام هذا الكوبون' });
    }

    if (orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({ error: `الحد الأدنى للطلب لاستخدام هذا الكوبون هو ${coupon.minOrderAmount.toLocaleString()} د.ع` });
    }

    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      id: coupon.id,
      code: coupon.code,
      discountAmount: discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscount: coupon.maxDiscount
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل التحقق من الكوبون' });
  }
});

// USER: Get all available coupons
app.get('/api/coupons', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    // Get all active coupons within date range
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        usedBy: {
          where: { userId }
        }
      }
    });

    // Filter based on usage logic
    const availableCoupons = coupons.filter(c => {
      // 1. Check if user has already used it (if public, once per user)
      if (c.usedBy.length > 0) return false;

      // 2. Check global usage limit for private coupons
      if (!c.isPublic && c.usageCount >= 1) return false;

      // 3. Check custom usage limit if set
      if (c.usageLimit && c.usageCount >= c.usageLimit) return false;

      return true;
    });

    // Transform to exclude usage info from response
    const sanitizedCoupons = availableCoupons.map(({ usedBy, ...coupon }) => coupon);

    res.json(sanitizedCoupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

app.get('/api/admin/reports/abandoned-carts', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Abandoned carts are users who have items in their cart but haven't placed an order in the last 24 hours
    // or simply have items in cart while their last order is older than their cart items.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const abandonedCarts = await prisma.user.findMany({
      where: {
        cart: {
          some: {
            updatedAt: { lte: twentyFourHoursAgo }
          }
        },
        OR: [
          { orders: { none: {} } },
          { orders: { some: { createdAt: { lte: twentyFourHoursAgo } } } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        cart: {
          include: {
            product: true
          }
        },
        updatedAt: true
      }
    });

    const formattedCarts = abandonedCarts.map(user => {
      const total = user.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const itemCount = user.cart.reduce((sum, item) => sum + item.quantity, 0);
      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userAvatar: user.avatar,
        itemCount,
        total,
        items: user.cart.map(item => ({
          productId: item.productId,
          productName: item.product.name,
          productImage: item.product.image,
          price: item.product.price,
          quantity: item.quantity
        })),
        lastActivity: user.updatedAt
      };
    });

    res.json(formattedCarts);
  } catch (error) {
    console.error('Failed to fetch abandoned carts:', error);
    res.status(500).json({ error: 'Failed to fetch abandoned carts' });
  }
});

app.post('/api/shipping/calculate', authenticateToken, async (req, res) => {
  try {
    const { items, method = 'air' } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items are required' });
    }
    
    const shippingInfo = await calculateOrderShipping(items, method);
    res.json(shippingInfo);
  } catch (error) {
    console.error('Shipping calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate shipping' });
  }
});

// Products routes
let cachedStoreSettings = null;
let cachedStoreSettingsTime = 0;

app.get('/api/products/search', async (req, res) => {
  console.log('[Products] GET /api/products/search request received. Query:', req.query);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const queryValue = typeof req.query.q === 'string' && req.query.q.trim()
      ? req.query.q
      : req.query.search;
    const search = String(queryValue || '').trim();
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

    if (!search) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!cachedStoreSettings || (Date.now() - cachedStoreSettingsTime > 60000)) {
      cachedStoreSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
      cachedStoreSettingsTime = Date.now();
    }
    const storeSettings = cachedStoreSettings;

    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    // Try Hybrid Search (Vector + Keyword)
    let products = [];
    let total = 0;
    let engine = 'db';

    const embedding = await generateSearchEmbedding(search);

    if (embedding) {
      try {
        const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_search_products', {
          query_text: search,
          query_embedding: embedding,
          match_count: limit
        });

        if (!hybridError && hybridResults) {
          products = hybridResults;
          total = hybridResults.length; // Approximate total for now
          engine = 'hybrid';
          
          // Enrich with variants since RPC returns partial data
          const productIds = products.map(p => p.id);
          const enrichedProducts = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              name: true,
              price: true,
              basePriceIQD: true,
              image: true,
              isFeatured: true,
              domesticShippingFee: true,
              deliveryTime: true,
              variants: {
                select: {
                  id: true,
                  combination: true,
                  price: true,
                  basePriceIQD: true,
                  image: true,
                }
              }
            }
          });
          
          // Sort back to match hybrid score order
          products = products.map(hp => {
            const enriched = enrichedProducts.find(ep => ep.id === hp.id);
            return enriched || hp;
          });
        } else {
          console.error('[Search] Supabase RPC error:', hybridError);
        }
      } catch (err) {
        console.error('[Search] Hybrid search failed, falling back:', err);
      }
    }

    // Fallback to standard DB search if hybrid failed or no embedding
    if (products.length === 0) {
      const where = { 
        isActive: true,
        status: 'PUBLISHED',
        OR: [
          { name: { contains: search } },
          { purchaseUrl: { contains: search } }
        ]
      };

      if (maxPrice !== null) {
        where.price = { lte: maxPrice };
      }

      const [dbProducts, dbTotal] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            price: true,
            basePriceIQD: true,
            image: true,
            isFeatured: true,
            domesticShippingFee: true,
            deliveryTime: true,
            variants: {
              select: {
                id: true,
                combination: true,
                price: true,
                basePriceIQD: true,
                image: true,
              }
            }
          },
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' }
        }),
        prisma.product.count({ where })
      ]);
      
      products = dbProducts;
      total = dbTotal;
      engine = 'db';
    }

    if (!products || products.length === 0) {
      return res.json({
        products: [],
        total: 0,
        page,
        totalPages: 0,
        engine
      });
    }

    res.json({
      products: products.map(p => applyDynamicPricingToProduct(p, shippingRates)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      engine
    });
  } catch (error) {
    console.error('[Products] Failed to search products:', error);
    res.status(500).json({ 
      error: 'Failed to search products', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/products', async (req, res) => {
  const requestStart = Date.now();
  console.log(`[Products] GET /api/products request received. Query:`, req.query);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const isArabicSearch = typeof search === 'string' && /[\u0600-\u06FF]/.test(search);
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

    // Cache Store Settings for 60 seconds to reduce DB round-trips
    if (!cachedStoreSettings || (Date.now() - cachedStoreSettingsTime > 60000)) {
       cachedStoreSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
       cachedStoreSettingsTime = Date.now();
    }
    const storeSettings = cachedStoreSettings;

    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    const where = { 
      isActive: true,
      status: 'PUBLISHED'
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { purchaseUrl: { contains: search } }
      ];
    }

    if (maxPrice !== null) {
      where.price = { lte: maxPrice };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          price: true,
          basePriceIQD: true,
          image: true,
          isFeatured: true,
          domesticShippingFee: true,
          deliveryTime: true,
          variants: {
            select: {
              id: true,
              combination: true,
              price: true,
              basePriceIQD: true,
              image: true,
            }
          }
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    // If no products found, return empty result immediately to avoid processing overhead
    if (!products || products.length === 0) {
      return res.json({
        products: [],
        total: 0,
        page,
        totalPages: 0,
        engine: 'db'
      });
    }

    res.json({
      products: products.map(p => applyDynamicPricingToProduct(p, shippingRates)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      engine: 'db'
    });
  } catch (error) {
    console.error('[Products] Failed to fetch products:', error);
    try {
      // Write error to log file
      const logPath = path.join(__dirname, 'server_error_full.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] Error in /api/products: ${error.message}\n${error.stack}\nQuery: ${JSON.stringify(req.query)}\n\n`);
    } catch (e) {
      console.error('Failed to write to error log:', e);
    }
    
    try {
      // Write error to public folder for debugging - ensure directory exists
      const publicDirPath = path.join(__dirname, 'public');
      if (!fs.existsSync(publicDirPath)) {
        fs.mkdirSync(publicDirPath, { recursive: true });
      }
      const publicErrorPath = path.join(publicDirPath, 'server_error.txt');
      fs.writeFileSync(publicErrorPath, `[${new Date().toISOString()}] Error in /api/products: ${error.message}\n${error.stack}\n`);
    } catch (e) {
      console.error('Failed to write to public error log:', e);
    }

    res.status(500).json({ 
      error: 'Failed to fetch products', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ADMIN: Get all products (including inactive and drafts)
app.get('/api/admin/products/check-existence', authenticateToken, isAdmin, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        purchaseUrl: true
      }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check product existence' });
  }
});

app.get('/api/admin/products', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  const startTime = Date.now();
  console.log('GET /api/admin/products hit', req.query);
  try { fs.appendFileSync(path.join(__dirname, 'perf.log'), `GET /api/admin/products hit at ${new Date().toISOString()}\n`); } catch (e) {}
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 21;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'ALL';

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } }
      ];
      
      const searchAsInt = parseInt(search);
      if (!isNaN(searchAsInt)) {
        where.OR.push({ id: searchAsInt });
      }
    }
    
    if (status !== 'ALL') {
      where.status = status;
    } else {
      where.status = { not: 'DELETED' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { 
          options: true,
          variants: { select: productVariantSelect },
          images: {
            orderBy: {
              order: 'asc'
            }
          }
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);
    console.log(`DB Query took: ${Date.now() - startTime}ms`);
    try { fs.appendFileSync(path.join(__dirname, 'perf.log'), `DB Query took: ${Date.now() - startTime}ms\n`); } catch (e) {}

    // Handle empty products array gracefully
    if (!products || products.length === 0) {
      return res.json({
        products: [],
        total: total || 0,
        page,
        totalPages: 0
      });
    }

    res.json({
      products: products.map(p => applyDynamicPricingToProduct(p, shippingRates)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Fetch admin products error:', error);
    res.status(500).json({ error: 'Failed to fetch admin products' });
  }
});

app.post('/api/admin/check-links', authenticateToken, isAdmin, async (req, res) => {
  checkAllProductLinks();
  res.json({ message: 'Link check started in background' });
});

function emitBulkImportJobEvent(payload) {
  io.to('admin_notifications').emit('bulk_import_job', payload);
}

function getBulkImportJobSnapshot(job) {
  if (!job) return null;
  return {
    id: job.id,
    userId: job.userId,
    status: job.status,
    total: job.total,
    processed: job.processed,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    results: job.results,
    error: job.error
  };
}

async function runBulkProductsImport(products, { onProgress } = {}) {
  const results = {
    total: products.length,
    imported: 0,
    skipped: 0,
    requeued: 0,
    failed: 0,
    errors: [],
    skippedDetails: []
  };

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const shippingRates = {
    airShippingRate: storeSettings?.airShippingRate,
    seaShippingRate: storeSettings?.seaShippingRate,
    airShippingMinFloor: storeSettings?.airShippingMinFloor,
    seaShippingMinFloor: storeSettings?.seaShippingMinFloor,
    minFloor: storeSettings?.seaShippingMinFloor // Alias for compatibility
  };

  const parsePriceCandidate = (val) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    const matches = String(val).match(/(\d+(\.\d+)?)/g);
    if (!matches) return 0;
    let max = 0;
    for (const m of matches) {
      const n = parseFloat(m);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
  };

  const isUnnamed = (val) => {
    const s = String(val || '').trim().toLowerCase();
    if (!s) return true;
    if (s === 'unnamed') return true;
    if (s === 'unnamed product') return true;
    if (s.includes('unnamed')) return true;
    if (s === 'n/a' || s === 'na' || s === '-' || s === 'null' || s === 'undefined') return true;
    return false;
  };

  const cleanDeliveryTime = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (s === '10-15 يوم' || s === '3' || s === '10-15 days' || s === '10-15') return null;
    return s;
  };

  const RESTRICTED_KEYWORDS = [
    // Dangerous Goods (Batteries, Liquids, etc.)
    'battery', 'lithium', 'power bank', 'powerbank', 'batteries',
    'بطارية', 'ليثيوم', 'باور بانك', 'شاحن متنقل',
    'liquid', 'oil', 'cream', 'gel', 'paste', 'shampoo', 'perfume', 'spray', 'aerosol',
    'سائل', 'زيت', 'كريم', 'جل', 'معجون', 'شامبو', 'عطر', 'بخاخ',
    'powder', 'dust', 'مسحوق', 'بودرة',
    'magnet', 'magnetic', 'مغناطيس', 'مغناطيسي',
    'knife', 'sword', 'dagger', 'weapon', 'gun', 'rifle',
    'سكين', 'سيف', 'خنجر', 'سلاح', 'بندقية',
    'flammable', 'lighter', 'gas', 'قابل للاشتعال', 'ولاعة', 'غاز',
    // Furniture / Bulky Items
    'furniture', 'sofa', 'couch', 'chair', 'table', 'desk', 'wardrobe', 'cabinet', 'cupboard', 
    'bed', 'mattress', 'bookshelf', 'shelf', 'shelves', 'dresser', 'sideboard', 'stool', 'bench',
    'armchair', 'recliner', 'ottoman', 'bean bag', 'dining set', 'tv stand', 'shoe rack',
    'أثاث', 'كنبة', 'أريكة', 'كرسي', 'طاولة', 'مكتب', 'دولاب', 'خزانة', 'سرير', 'مرتبة', 
    'رف', 'ارفف', 'تسريحة', 'كومودينو', 'بوفيه', 'مقعد', 'بنش', 'طقم جلوس', 'طاولة طعام', 
    'حامل تلفزيون', 'جزامة', 'طقم صالون', 'غرفة نوم'
  ];
  const EXCEPTIONS = [
    'cover', 'cloth', 'slipcover', 'cushion case', 'pillow case', 'protector', 'accessory', 'accessories', 'toy', 'miniature', 'model',
    'غطاء', 'مفرش', 'تلبيسة', 'كيس وسادة', 'حماية', 'اكسسوار', 'لعبة', 'نموذج', 'مجسم'
  ];

  const detectAirRestriction = (text) => {
    if (!text) return false;
    const lowerText = String(text).toLowerCase();
    for (const keyword of RESTRICTED_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        const isException = EXCEPTIONS.some(ex => lowerText.includes(ex.toLowerCase()));
        if (!isException) return true;
      }
    }
    return false;
  };

  const fieldMapping = {
    'size': 'المقاس',
    'Size': 'المقاس',
    '尺码': 'المقاس',
    'color': 'اللون',
    'Color': 'اللون',
    '颜色': 'اللون',
    '颜色分类': 'اللون',
    'اللون': 'اللون',
    'تصنيف الألوان': 'اللون',
    'المقاس': 'المقاس',
    'style': 'الستايل',
    'material': 'الخامة',
    'type': 'النوع',
    'model': 'المقاس',
    'models': 'المقاس',
    'colors': 'اللون',
    'colours': 'اللون',
    'color': 'اللون',
    'colour': 'اللون',
    'size': 'المقاس',
    'sizes': 'المقاس'
  };

  const maybeReportProgress = () => {
    if (typeof onProgress !== 'function') return;
    const processed = results.imported + results.skipped + results.failed;
    onProgress({
      results,
      processed,
      total: results.total,
      progress: results.total > 0 ? Math.round((processed / results.total) * 100) : 100
    });
  };

  for (const p of products) {
    try {
      const name = cleanStr(p.name || p.product_name || 'Unnamed').replace(/\n/g, ' ').trim();
      const purchaseUrl = (p.purchaseUrl || p.url || '').replace(/[`"']/g, '').trim();
      const chineseName = cleanStr(p.chineseName) || '';
      const parseJsonObject = (val) => {
        if (!val) return null;
        if (typeof val === 'object') return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return parsed && typeof parsed === 'object' ? parsed : null;
          } catch {
            return null;
          }
        }
        return null;
      };
      const aiMetadata = parseJsonObject(p.aiMetadata) || parseJsonObject(p.marketing_metadata) || parseJsonObject(p.aimetatags);
      
      let existingProduct = null;
      if (purchaseUrl && !isUnnamed(name)) {
        existingProduct = await prisma.product.findFirst({ where: { purchaseUrl, name } });
        if (!existingProduct && chineseName) {
          existingProduct = await prisma.product.findFirst({ where: { purchaseUrl, chineseName } });
        }
      } else if (purchaseUrl) {
        existingProduct = await prisma.product.findFirst({ where: { purchaseUrl } });
      } else if (chineseName && !isUnnamed(name)) {
        existingProduct = await prisma.product.findFirst({ where: { name, chineseName } });
      } else if (!isUnnamed(name)) {
        existingProduct = await prisma.product.findFirst({ where: { name } });
      }

      if (existingProduct) {
        results.skipped++;
        results.requeued++;
        if (Array.isArray(results.skippedDetails) && results.skippedDetails.length < 25) {
          const matchedBy = [];
          if (purchaseUrl && existingProduct.purchaseUrl === purchaseUrl) matchedBy.push('purchaseUrl');
          if (chineseName && existingProduct.chineseName === chineseName) matchedBy.push('chineseName');
          if (!isUnnamed(name) && existingProduct.name === name) matchedBy.push('name');
          results.skippedDetails.push({
            name,
            existingId: existingProduct.id,
            matchedBy: matchedBy.length ? matchedBy : ['unknown']
          });
        }
        maybeReportProgress();
        continue;
      }

      const parsePrice = parsePriceCandidate;

      const parseNum = (val, isWeight = false) => {
        if (val === undefined || val === null || val === '') return null;
        let cleanVal = String(val).replace(/[^\d.]/g, '');
        let num = parseFloat(cleanVal);
        if (isNaN(num)) return null;
        
        if (isWeight && num > 100) {
          num = num / 1000;
        }
        return num;
      };
      
      const domesticShippingFee = parsePrice(p.domestic_shipping_fee || p.domesticShippingFee || p.domestic_shipping) || 0;

      let rawPrice = 0;
      rawPrice = Math.max(
        rawPrice,
        parsePrice(p.general_price),
        parsePrice(p.price),
        parsePrice(p.basePriceIQD),
        parsePrice(p.rawPrice),
        parsePrice(p.rawRmbPrice)
      );

      if (rawPrice <= 0 && p.priceModel && typeof p.priceModel === 'object') {
        if (Array.isArray(p.priceModel.currentPrices)) {
          rawPrice = Math.max(rawPrice, ...p.priceModel.currentPrices.map(parsePrice));
        }
        if (Array.isArray(p.priceModel.skuPrices)) {
          rawPrice = Math.max(rawPrice, ...p.priceModel.skuPrices.map(parsePrice));
        }
      }

      if (rawPrice <= 0 && Array.isArray(p.variants_data)) {
        rawPrice = Math.max(rawPrice, ...p.variants_data.map(v => parsePrice(v?.price)));
      }

      if (rawPrice <= 0 && Array.isArray(p.generated_options)) {
        rawPrice = Math.max(rawPrice, ...p.generated_options.map(v => parsePrice(v?.price)));
      }

      const isPriceCombined = true;

      const priceInput = rawPrice;
      const price = isPriceCombined 
        ? rawPrice 
        : calculateBulkImportPrice(priceInput, domesticShippingFee, p.weight || p['重量'] || p.grossWeight, p.length || p['长'] || p['长度'], p.width || p['宽'] || p['宽度'], p.height || p['高'] || p['高度'], p.shippingMethod, shippingRates);

      if (price <= 0 || rawPrice <= 0) {
        console.log(`[Bulk Import] Failed product with 0 price: ${name}`);
        results.failed++;
        results.errors.push({ name, error: 'Invalid or missing price' });
        maybeReportProgress();
        continue;
      }

      const extractGeneratedOptionEntries = (opt) => {
        const out = [];
        if (!opt || typeof opt !== 'object') return out;

        const maybeParseJson = (val) => {
          if (!val) return null;
          if (typeof val === 'object') return val;
          if (typeof val === 'string') {
            try {
              const parsed = JSON.parse(val);
              return parsed && typeof parsed === 'object' ? parsed : null;
            } catch {
              return null;
            }
          }
          return null;
        };

        const metaKeys = new Set(['price', 'image', 'shippingmethod', 'method']);

        const pushEntry = (rawKey, rawVal) => {
          const cleanedKey = cleanStr(String(rawKey));
          if (!cleanedKey) return;
          const lower = cleanedKey.toLowerCase();
          if (metaKeys.has(lower)) return;

          if (lower === 'options' || lower === 'combination' || lower === 'variant' || lower === 'variants') {
            const nested = maybeParseJson(rawVal);
            if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
              for (const [k, v] of Object.entries(nested)) pushEntry(k, v);
              return;
            }
          }

          out.push([cleanedKey, rawVal]);
        };

        for (const [k, v] of Object.entries(opt)) pushEntry(k, v);
        return out;
      };

      let rawOptions = [];
      if (Array.isArray(p.options)) {
        rawOptions = [...p.options];
      } else if (p.variants && typeof p.variants === 'object') {
        for (const [rawKey, rawVal] of Object.entries(p.variants)) {
          const cleanedKey = cleanStr(String(rawKey));
          if (!cleanedKey) continue;
          if (!Array.isArray(rawVal)) continue;
          const mappedName = (() => {
            const lower = cleanedKey.toLowerCase();
            if (lower === 'color' || lower === 'colour') return 'اللون';
            if (lower === 'size' || lower === 'sizes') return 'المقاس';
            return fieldMapping[cleanedKey] || cleanedKey;
          })();
          const values = rawVal.map(v => cleanStr(String(v))).filter(Boolean);
          if (values.length > 0) rawOptions.push({ name: mappedName, values });
        }
      } else if (Array.isArray(p.generated_options)) {
        const valuesByName = new Map();
        for (const opt of p.generated_options) {
          for (const [cleanedKey, rawVal] of extractGeneratedOptionEntries(opt)) {
            const lower = cleanedKey.toLowerCase();
            const mappedName = (() => {
              if (lower === 'color' || lower === 'colour') return 'اللون';
              if (lower === 'size' || lower === 'sizes') return 'المقاس';
              return fieldMapping[cleanedKey] || cleanedKey;
            })();

            const rawValues = Array.isArray(rawVal) ? rawVal : [rawVal];
            const cleanedValues = rawValues
              .map(v => {
                if (v === null || v === undefined) return '';
                if (typeof v === 'object') return cleanStr(String(v.value ?? v.name ?? JSON.stringify(v)));
                return cleanStr(String(v));
              })
              .filter(Boolean);

            if (cleanedValues.length === 0) continue;
            if (!valuesByName.has(mappedName)) valuesByName.set(mappedName, new Set());
            for (const cv of cleanedValues) valuesByName.get(mappedName).add(cv);
          }
        }
        for (const [name, values] of valuesByName.entries()) {
          const list = [...values];
          if (list.length > 0) rawOptions.push({ name, values: list });
        }
      }

      Object.entries(fieldMapping).forEach(([field, standardName]) => {
        const val = p[field];
        if (val) {
          const existingOpt = rawOptions.find(o => o.name === standardName || o.name?.toLowerCase() === field.toLowerCase());
          const newValues = String(val).split(',').map(v => cleanStr(v)).filter(v => v !== '');
          if (newValues.length > 0) {
            if (!existingOpt) {
              rawOptions.push({ name: standardName, values: newValues });
            } else if (!existingOpt.values || existingOpt.values.length === 0) {
              existingOpt.values = newValues;
              existingOpt.name = standardName;
            }
          }
        }
      });

      let processedOptions = rawOptions.map(opt => {
        const optName = cleanStr(opt.name);
        return {
          name: fieldMapping[optName] || optName,
          values: (Array.isArray(opt.values) ? opt.values : [])
                  .map(v => cleanStr(String(v)))
                  .filter(v => v !== '')
        };
      }).filter(opt => opt.name !== '' && opt.values.length > 0);
      
      console.log(`[Bulk Debug] Product: ${name}`);
      console.log(`[Bulk Debug] Raw Options:`, JSON.stringify(rawOptions));
      console.log(`[Bulk Debug] Processed Options (before unique):`, JSON.stringify(processedOptions));
      
      // Ensure unique option names by merging values
      const uniqueOptionsMap = new Map();
      for (const opt of processedOptions) {
        if (!uniqueOptionsMap.has(opt.name)) {
          uniqueOptionsMap.set(opt.name, new Set(opt.values));
        } else {
          for (const v of opt.values) uniqueOptionsMap.get(opt.name).add(v);
        }
      }
      processedOptions = Array.from(uniqueOptionsMap.entries()).map(([name, valuesSet]) => ({
        name,
        values: Array.from(valuesSet)
      }));
      console.log(`[Bulk Debug] Processed Options (final):`, JSON.stringify(processedOptions));

      let specs = cleanStr(p.specs);
      if (!specs && p.product_details && typeof p.product_details === 'object') {
        specs = Object.entries(p.product_details)
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');
      }

      const hasReviews = (p.reviews && p.reviews.length > 0) || (p.detailedReviews && p.detailedReviews.length > 0);
      if (!specs?.includes('---REVIEW_SUMMARY---') && (p.reviewCountText || p.positiveRate || hasReviews)) {
        const reviewSummary = {
          countText: p.reviewCountText || (Array.isArray(p.reviews) ? String(p.reviews.length) : '0'),
          positiveRate: p.positiveRate || '100%',
          tags: Array.isArray(p.reviews) && typeof p.reviews[0] === 'string' ? p.reviews : [],
          reviews: Array.isArray(p.reviews) && typeof p.reviews[0] === 'object' ? p.reviews : [],
          detailedReviews: p.detailedReviews || []
        };
        specs = (specs || '') + '\n---REVIEW_SUMMARY---\n' + JSON.stringify(reviewSummary);
      }

      const rawImages = p.main_images || p.images || (p.image ? [p.image] : []);
      const imageUrls = (Array.isArray(rawImages) ? rawImages : [])
        .map(url => typeof url === 'string' ? url.replace(/[`"']/g, '').trim() : url)
        .filter(url => url && typeof url === 'string' && url.startsWith('http'));
      
      const mainImage = imageUrls.length > 0 ? imageUrls[0] : (p.image || '');

      let weight = parseNum(p.weight || p['重量'] || p.grossWeight, true);
      let length = parseNum(p.length || p['长'] || p['长度']);
      let width = parseNum(p.width || p['宽'] || p['宽度']);
      let height = parseNum(p.height || p['高'] || p['高度']);

      if (p.dimensions && (!length || !width || !height)) {
        const parts = String(p.dimensions).toLowerCase().split(/[x*]/).map(s => parseFloat(s.trim()));
        if (parts.length === 3) {
          if (!length) length = parts[0];
          if (!width) width = parts[1];
          if (!height) height = parts[2];
        }
      }

      // Determine effective shipping method for consistency across variants
      // (Moved calculation below to capture all data)

      const variantsInput = Array.isArray(p.variants_data) ? p.variants_data : [];
      if (variantsInput.length === 0 && Array.isArray(p.generated_options)) {
        const generated = [];
        for (const opt of p.generated_options) {
          if (!opt || typeof opt !== 'object') continue;
          const optPrice = parsePrice(opt.price) || rawPrice;
          const optImage = cleanStr(opt.image);

          const dimensionsMap = new Map();
          for (const [cleanedKey, rawVal] of extractGeneratedOptionEntries(opt)) {
            const lower = cleanedKey.toLowerCase();
            const mappedName = (() => {
              if (lower === 'color' || lower === 'colour') return 'اللون';
              if (lower === 'size' || lower === 'sizes') return 'المقاس';
              return fieldMapping[cleanedKey] || cleanedKey;
            })();

            const rawValues = Array.isArray(rawVal) ? rawVal : [rawVal];
            const cleanedValues = rawValues
              .map(v => {
                if (v === null || v === undefined) return '';
                if (typeof v === 'object') return cleanStr(String(v.value ?? v.name ?? JSON.stringify(v)));
                return cleanStr(String(v));
              })
              .filter(Boolean);

            if (cleanedValues.length === 0) continue;
            if (!dimensionsMap.has(mappedName)) dimensionsMap.set(mappedName, []);
            dimensionsMap.get(mappedName).push(...cleanedValues);
          }

          const dimensions = [...dimensionsMap.entries()]
            .map(([k, vals]) => [k, [...new Set(vals)]])
            .filter(([, vals]) => vals.length > 0);

          if (dimensions.length === 0) continue;

          let combinations = [{}];
          for (const [dimName, dimVals] of dimensions) {
            const next = [];
            for (const combo of combinations) {
              for (const val of dimVals) {
                next.push({ ...combo, [dimName]: val });
              }
            }
            combinations = next;
          }

          for (const combo of combinations) {
            if (Object.keys(combo).length === 0) continue;
            generated.push({ 
              options: combo, 
              price: optPrice, 
              basePriceIQD: optPrice, // Explicitly set basePriceIQD
              isPriceCombined: false, // Explicitly allow dynamic pricing
              currency: 'IQD',
              image: optImage || null 
            });
          }
        }
        variantsInput.push(...generated);
      }
      
      const optionMap = new Map();
      const normalizeOptionName = (optName) => cleanStr(optName).toLowerCase();
      const addOptionValue = (optName, optValue) => {
        const name = cleanStr(optName);
        if (!name) return;
        const value = cleanStr(optValue);
        if (!value) return;
        const key = normalizeOptionName(name);
        if (!optionMap.has(key)) optionMap.set(key, { name, values: new Set() });
        optionMap.get(key).values.add(value);
      };
      
      for (const opt of processedOptions) {
        if (!opt?.name) continue;
        const vals = Array.isArray(opt.values) ? opt.values : [];
        for (const v of vals) addOptionValue(opt.name, v);
      }
      
      for (const v of variantsInput) {
        let combo = v?.options ?? v?.combination ?? {};
        if (typeof combo === 'string') {
          try { combo = JSON.parse(combo); } catch { combo = {}; }
        }
        if (!combo || typeof combo !== 'object') continue;
        for (const [k, rawVal] of Object.entries(combo)) {
          const valString = typeof rawVal === 'object' && rawVal !== null
            ? (rawVal.value ?? rawVal.name ?? JSON.stringify(rawVal))
            : String(rawVal);
          addOptionValue(fieldMapping[cleanStr(k)] || k, valString);
        }
      }
      
      processedOptions = [...optionMap.values()]
        .map((entry) => ({ name: entry.name, values: [...entry.values] }))
        .filter(opt => opt.name !== '' && opt.values.length > 0);

      // Determine effective shipping method for consistency across variants
      let effectiveMethod = p.shippingMethod;
      if (!effectiveMethod) {
        const volCbm = (length || 0) * (width || 0) * (height || 0) / 1000000;
        const w = weight || 0.5;
        console.log(`[Bulk Debug] ${name}: VolCBM=${volCbm}, Weight=${w}, Dims=${length}x${width}x${height}`);
        // If explicitly heavy or large volume, default to SEA
        if (w >= 1 || volCbm > 0.02) {
          effectiveMethod = 'sea';
        } else {
          effectiveMethod = 'air';
        }
        console.log(`[Bulk Debug] Effective Method: ${effectiveMethod}`);
      }

      // Extract new fields
      const shippingPriceIncluded = p.shipping_price_included !== undefined ? (p.shipping_price_included === true || String(p.shipping_price_included) === 'true') : true;

      // Re-calculate main price with resolved dimensions and effective method
      const finalPriceInput = rawPrice;
      let finalPrice;
      
      if (isPriceCombined) {
        finalPrice = rawPrice;
      } else if (!shippingPriceIncluded) {
        // Exclude shipping cost but keep domestic fee
        // Formula: (Base + Domestic)
        const domestic = domesticShippingFee || 0;
        const price = (finalPriceInput + domestic);
        finalPrice = Math.ceil(price / 10) * 10;
      } else {
        finalPrice = calculateBulkImportPrice(finalPriceInput, domesticShippingFee, weight, length, width, height, effectiveMethod, shippingRates);
      }
      console.log(`[Bulk Debug] Final Main Price: ${finalPrice} (Raw=${rawPrice})`);

      const product = await prisma.product.create({
        data: {
          name,
          // chineseName, // Removed as it is not in schema
          // description: cleanStr(p.description) || '',
          price: finalPrice,
          basePriceIQD: rawPrice,
          image: mainImage,
          purchaseUrl,
          status: 'PUBLISHED',
          isActive: true,
          isFeatured: !!p.isFeatured,
          specs: specs,
          // storeEvaluation: p.storeEvaluation && typeof p.storeEvaluation === 'object' ? JSON.stringify(p.storeEvaluation) : (p.storeEvaluation || null),
          // reviewsCountShown: p.reviewsCountShown || null,
          // // videoUrl: p.videoUrl || null,
          aiMetadata: aiMetadata || null,
          // weight,
          // length,
          // width,
          // height,
          domesticShippingFee,
          isAirRestricted: p.isAirRestricted === true || p.isAirRestricted === 'true' || p.isAirRestricted === 1 || p.is_air_restricted === true || p.is_air_restricted === 'true' || p.is_air_restricted === 1 || p.IsAirRestricted === true || p.IsAirRestricted === 'true' || p.IsAirRestricted === 1 || detectAirRestriction(`${name} ${specs || ''}`),
          deliveryTime: cleanDeliveryTime(p.deliveryTime || p.delivery_time || p.Delivery_time),
          // shippingPriceIncluded: shippingPriceIncluded, // Removed as it is not in schema
          options: {
            create: processedOptions.map(opt => ({
              name: opt.name,
              values: JSON.stringify(opt.values)
            }))
          },
          variants: {
            create: variantsInput.map(v => {
              let variantRawPrice = parsePrice(v.price) || rawPrice;
              let variantBaseRaw = parsePrice(v.basePriceIQD);
              // Use explicit basePriceIQD if available (e.g. from generated options), otherwise fall back to price
              const finalBasePrice = (variantBaseRaw && variantBaseRaw > 0) ? variantBaseRaw : variantRawPrice;
              
              const isGenerated = v.currency === 'IQD';
              const variantIsPriceCombined = true !== undefined 
                 ? (String(true) === 'true' || true === true) 
                 : (isGenerated ? false : (isPriceCombined || variantRawPrice > 1000));
              
              const variantWeight = v.weight || weight || p['重量'] || p.grossWeight;
              
              let vPrice;
              if (variantIsPriceCombined) {
                 vPrice = finalBasePrice;
              } else if (!shippingPriceIncluded) {
                 const domestic = domesticShippingFee || 0;
                 const price = (finalBasePrice + domestic);
                 vPrice = Math.ceil(price / 10) * 10;
              } else {
                 vPrice = calculateBulkImportPrice(finalBasePrice, domesticShippingFee, variantWeight, v.length || length, v.width || width, v.height || height, v.shippingMethod || effectiveMethod, shippingRates);
              }

              console.log(`[Bulk Debug] Variant Price: ${vPrice} (Raw=${variantRawPrice}, Method=${v.shippingMethod || effectiveMethod}, Dims=${v.length || length}x${v.width || width}x${v.height || height})`);

              return {
                combination: typeof v.options === 'object' ? JSON.stringify(v.options) : 
                            (typeof v.combination === 'object' ? JSON.stringify(v.combination) : (v.combination || '{}')),
                price: vPrice,
                basePriceIQD: finalBasePrice,
                image: v.image || null,
                weight: variantWeight ? parseFloat(variantWeight) : null,
                length: v.length ? parseFloat(v.length) : null,
                width: v.width ? parseFloat(v.width) : null,
                height: v.height ? parseFloat(v.height) : null
              };
            })
          },
          images: {
            create: imageUrls.map((url, index) => ({
              url: url,
              order: index,
              type: 'GALLERY'
            }))
          }
        }
      });

      results.imported++;
      maybeReportProgress();
    } catch (err) {
      console.error(`Failed to process bulk import product ${p.name || p.product_name}:`, err);
      results.failed++;
      if (results.errors.length < 50) {
        results.errors.push({ name: p.name || p.product_name, error: err.message });
      } else {
        results.errorsTruncated = true;
      }
      maybeReportProgress();
    }
  }

  return results;
}

function enqueueBulkImportJob({ userId, products }) {
  const id = randomUUID();
  const job = {
    id,
    userId,
    status: 'queued',
    total: Array.isArray(products) ? products.length : 0,
    processed: 0,
    products: Array.isArray(products) ? products : [],
    lastProgressEmitAt: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    results: null,
    error: null
  };

  bulkImportJobs.set(id, job);
  bulkImportJobQueue.push(id);

  emitBulkImportJobEvent(getBulkImportJobSnapshot(job));
  runBulkImportJobWorker();

  return getBulkImportJobSnapshot(job);
}

async function runBulkImportJobWorker() {
  if (bulkImportJobRunning) return;
  bulkImportJobRunning = true;

  try {
    while (bulkImportJobQueue.length > 0) {
      const jobId = bulkImportJobQueue.shift();
      const job = bulkImportJobs.get(jobId);
      if (!job) continue;

      job.status = 'processing';
      job.startedAt = new Date().toISOString();
      job.processed = 0;
      job.error = null;
      job.results = null;
      job.lastProgressEmitAt = 0;
      emitBulkImportJobEvent(getBulkImportJobSnapshot(job));

      try {
        const results = await runBulkProductsImport(job.products, {
          onProgress: ({ processed, total, progress }) => {
            job.processed = processed;
            const now = Date.now();
            const shouldEmit = processed === total || now - (job.lastProgressEmitAt || 0) >= 750;
            if (shouldEmit) {
              job.lastProgressEmitAt = now;
              emitBulkImportJobEvent({
                ...getBulkImportJobSnapshot(job),
                progress
              });
            }
          }
        });

        job.results = results;
        job.processed = results.imported + results.skipped + results.failed;
        job.status = 'completed';
        job.finishedAt = new Date().toISOString();
        emitBulkImportJobEvent({
          ...getBulkImportJobSnapshot(job),
          progress: 100
        });
      } catch (err) {
        job.status = 'failed';
        job.finishedAt = new Date().toISOString();
        job.error = String(err?.message || err);
        emitBulkImportJobEvent({
          ...getBulkImportJobSnapshot(job),
          progress: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
        });
      }
    }
  } finally {
    bulkImportJobRunning = false;
  }
}

app.post('/api/admin/products/bulk-import-jobs', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const job = enqueueBulkImportJob({ userId: req.user.id, products });
    res.json({ success: true, job });
  } catch (error) {
    console.error('[Bulk Import Jobs] Error:', error);
    res.status(500).json({ error: 'Failed to enqueue bulk import job' });
  }
});

app.get('/api/admin/products/bulk-import-jobs/:jobId', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  const { jobId } = req.params;
  const job = bulkImportJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true, job: getBulkImportJobSnapshot(job) });
});

app.post('/api/products/bulk', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  const { products, useSSE = false } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Invalid products data' });
  }

  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  }
  try {
    const results = await runBulkProductsImport(products, {
      onProgress: ({ results: r, processed, total }) => {
        if (!useSSE) return;
        if (processed % 5 !== 0 && processed !== total) return;
        res.write(`data: ${JSON.stringify({ 
          progress: total > 0 ? Math.round((processed / total) * 100) : 100,
          imported: r.imported,
          total
        })}\n\n`);
      }
    });

    if (useSSE) {
      res.write(`data: ${JSON.stringify({ complete: true, results })}\n\n`);
      res.end();
    } else {
      res.json(results);
    }
  } catch (error) {
    console.error('[Bulk Import] Error:', error);
    if (useSSE) {
      res.write(`data: ${JSON.stringify({ complete: true, error: error.message || 'Failed to bulk import products' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || 'Failed to bulk import products' });
    }
  }
});

app.post('/api/products', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { 
      name, chineseName, description, price, basePriceIQD, image, 
      isFeatured, isActive, status, purchaseUrl, videoUrl, 
      specs, images, detailImages,
      weight, length, width, height, domesticShippingFee, options, variants, aiMetadata, deliveryTime, isAirRestricted
    } = req.body;

    const parsedAiMetadata = (() => {
      const candidate = aiMetadata ?? req.body.marketing_metadata ?? req.body.aimetatags;
      if (!candidate) return null;
      if (typeof candidate === 'object') return candidate;
      if (typeof candidate === 'string') {
        try {
          const parsed = JSON.parse(candidate);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    })();
    
    // Process main images (gallery)
    let processedGalleryImages = [];
    let processedDetailImages = [];

    const rawImages = Array.isArray(images) ? images : (image ? [image] : []);
    
    for (const img of rawImages) {
      let url = typeof img === 'string' ? img : img.url;
      let type = typeof img === 'object' ? img.type : 'GALLERY';
      
      if (!url || typeof url !== 'string') continue;
      
      const cleanedUrl = url.replace(/[`"']/g, '').trim();
      let finalUrl = cleanedUrl;
      
      if (cleanedUrl.startsWith('data:image')) {
        finalUrl = await convertToWebP(cleanedUrl);
      }
      
      if (finalUrl && (finalUrl.startsWith('http') || finalUrl.startsWith('data:image'))) {
        if (type === 'DETAIL') {
          processedDetailImages.push(finalUrl);
        } else {
          processedGalleryImages.push(finalUrl);
        }
      }
    }

    // Process explicit detail images if provided
    if (Array.isArray(detailImages)) {
      for (const img of detailImages) {
        let url = typeof img === 'string' ? img : img.url;
        if (!url || typeof url !== 'string') continue;
        
        const cleanedUrl = url.replace(/[`"']/g, '').trim();
        let finalUrl = cleanedUrl;
        
        if (cleanedUrl.startsWith('data:image')) {
          finalUrl = await convertToWebP(cleanedUrl);
        }
        
        if (finalUrl && (finalUrl.startsWith('http') || finalUrl.startsWith('data:image'))) {
          processedDetailImages.push(finalUrl);
        }
      }
    }
    
    // Deduplicate and limit
    let imageUrls = [...new Set(processedGalleryImages)].slice(0, 200);
    let detailImageUrls = [...new Set(processedDetailImages)].slice(0, 200);
    
    const mainImage = imageUrls.length > 0 ? imageUrls[0] : (image || '');

    if (status === 'DRAFT') {
      return res.status(200).json({
        name,
        chineseName,
        description,
        price,
        basePriceIQD,
        image: mainImage,
        purchaseUrl,
        // videoUrl,
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        status: 'DRAFT',
        specs: specs && typeof specs === 'object' ? JSON.stringify(specs) : (specs || null),
        // storeEvaluation: storeEvaluation && typeof storeEvaluation === 'object' ? JSON.stringify(storeEvaluation) : (storeEvaluation || null),
        // reviewsCountShown: reviewsCountShown || null,
        weight: safeParseFloat(weight),
        length: safeParseFloat(length),
        width: safeParseFloat(width),
        height: safeParseFloat(height),
        domesticShippingFee: safeParseFloat(domesticShippingFee),
        deliveryTime: deliveryTime || null,
        images: [
          ...imageUrls.map((url, i) => ({ url, order: i, type: 'GALLERY' })),
          ...detailImageUrls.map((url, i) => ({ url, order: i, type: 'DETAIL' }))
        ]
      });
    }

    if (!name) {
      return res.status(400).json({ error: 'اسم المنتج مطلوب' });
    }

    const domesticFee = safeParseFloat(domesticShippingFee) || 0;
    // Determine if price is combined using explicit flag or heuristic (price > 1000 implies IQD final price)
    const isPriceCombined = true;
    
    // Extract new fields for shipping exclusion
    const shippingPriceIncluded = req.body.shippingPriceIncluded !== undefined ? (req.body.shippingPriceIncluded === true || String(req.body.shippingPriceIncluded) === 'true') : true;

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };
    
    // Use the same markup logic as bulk import
    const rawPrice = safeParseFloat(price) || 0;
    let finalPrice;
    
    if (isPriceCombined) {
      finalPrice = rawPrice;
    } else if (!shippingPriceIncluded) {
      // Exclude shipping cost but keep domestic fee
      // Formula: (Base + Domestic)
      const domestic = domesticFee || 0;
      const calculatedPrice = (rawPrice + domestic);
      finalPrice = Math.ceil(calculatedPrice / 10) * 10;
    } else {
      finalPrice = calculateBulkImportPrice(rawPrice, domesticFee, weight, length, width, height, req.body.shippingMethod, shippingRates);
    }

    const cleanDeliveryTime = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      if (s === '10-15 يوم' || s === '3' || s === '10-15 days' || s === '10-15') return null;
      return s;
    };

    const product = await prisma.product.create({
      data: {
        name,
        // chineseName,
        // description,
        price: finalPrice,
        basePriceIQD: safeParseFloat(basePriceIQD),
        image: mainImage,
        purchaseUrl,
        // videoUrl,
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        status: status || 'PUBLISHED',
        specs: specs && typeof specs === 'object' ? JSON.stringify(specs) : (specs || null),
        // storeEvaluation: storeEvaluation && typeof storeEvaluation === 'object' ? JSON.stringify(storeEvaluation) : (storeEvaluation || null),
        // reviewsCountShown: reviewsCountShown || null,
        // weight: safeParseFloat(weight),
        // length: safeParseFloat(length),
        // width: safeParseFloat(width),
        // height: safeParseFloat(height),
        domesticShippingFee: domesticFee,
        // shippingPriceIncluded: shippingPriceIncluded,
        isAirRestricted: isAirRestricted === true || isAirRestricted === 'true' || isAirRestricted === 1,
        aiMetadata: parsedAiMetadata,
        deliveryTime: cleanDeliveryTime(deliveryTime),
        images: {
          create: [
            ...imageUrls.map((url, i) => ({
              url,
              order: i,
              type: 'GALLERY'
            })),
            ...detailImageUrls.map((url, i) => ({
              url,
              order: i,
              type: 'DETAIL'
            }))
          ]
        },
        options: {
          create: (Array.isArray(options) ? options : []).map(opt => ({
            name: opt.name || 'Unnamed Option',
            values: Array.isArray(opt.values) ? JSON.stringify(opt.values) : (opt.values || '[]')
          }))
        },
        variants: {
          create: (Array.isArray(variants) ? variants : []).map(v => {
            const variantRawPrice = safeParseFloat(v.price) || 0;
            // Determine if variant price is combined using explicit flag or heuristic
            const variantIsPriceCombined = true !== undefined 
                ? (String(true) === 'true' || true === true) 
                : (isPriceCombined || variantRawPrice > 1000);
            
            let vPrice;
            if (variantIsPriceCombined) {
               vPrice = variantRawPrice;
            } else if (!shippingPriceIncluded) {
               const domestic = domesticFee || 0;
               const calculatedPrice = (variantRawPrice + domestic);
               vPrice = Math.ceil(calculatedPrice / 10) * 10;
            } else {
               vPrice = calculateBulkImportPrice(variantRawPrice, domesticFee, v.weight || weight, v.length || length, v.width || width, v.height || height, v.shippingMethod, shippingRates);
            }

            return {
              combination: typeof v.options === 'object' ? JSON.stringify(v.options) : 
                          (typeof v.combination === 'object' ? JSON.stringify(v.combination) : (v.combination || '{}')),
              price: vPrice,
              image: v.image || null,
              weight: v.weight ? safeParseFloat(v.weight) : null,
              height: v.height ? safeParseFloat(v.height) : null,
              length: v.length ? safeParseFloat(v.length) : null,
              width: v.width ? safeParseFloat(v.width) : null,
            };
          })
        }
      }
    });


    res.status(201).json(product);
  } catch (error) {
    console.error('[Create Product] Error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ADMIN: Bulk Import Products (Step 1)
app.post('/api/admin/products/bulk-import', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  // Increase timeout for bulk import to prevent connection timeout
  req.setTimeout(0);
  
  try {
    const { products } = req.body;
    console.log(`[Bulk Import] Request received for ${products?.length} products`);
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      console.warn('[Bulk Import] No products provided in request');
      return res.status(400).json({ error: 'No products provided' });
    }

    // --- Duplicate Check ---
    const normalizeUrl = (u) => (typeof u === 'string' ? u.replace(/[`"']/g, '').trim() : u);
    const purchaseUrls = [...new Set(products
      .map(p => normalizeUrl(p.purchaseUrl ?? p.url))
      .filter(url => !!url))];
    const chineseNames = [...new Set(products
      .map(p => cleanStr(p.chineseName))
      .filter(name => !!name))];

    const duplicateWhereOr = [];
    if (purchaseUrls.length > 0) duplicateWhereOr.push({ purchaseUrl: { in: purchaseUrls } });
    if (chineseNames.length > 0) duplicateWhereOr.push({ chineseName: { in: chineseNames } });

    const existingProducts = duplicateWhereOr.length > 0
      ? await prisma.product.findMany({
          where: { OR: duplicateWhereOr },
          select: { purchaseUrl: true, chineseName: true, name: true }
        })
      : [];

    const existingUrlsSet = new Set(existingProducts.map(p => p.purchaseUrl).filter(Boolean));
    const existingNamesSet = new Set(existingProducts.flatMap(p => [p.chineseName, p.name]).filter(Boolean));

    const seenInRequest = new Set();
    const uniqueProductsToImport = [];

    for (const p of products) {
      const normalizedPurchaseUrl = normalizeUrl(p.purchaseUrl ?? p.url);
      const candidateName = cleanStr(p.chineseName) || cleanStr(p.name) || cleanStr(p.product_name);
      const isDuplicateInDB =
        (!!candidateName && existingNamesSet.has(candidateName)) ||
        (normalizedPurchaseUrl && existingUrlsSet.has(normalizedPurchaseUrl) && !!candidateName && existingNamesSet.has(candidateName));
      
      const urlId = normalizedPurchaseUrl;
      const nameId = candidateName;
      const productLocalId = cleanStr(p.product_id || p.productId || p.id);
      const requestDedupKey = urlId && productLocalId ? `${urlId}::${productLocalId}` : (urlId || nameId);
      
      const isDuplicateInRequest = requestDedupKey ? seenInRequest.has(requestDedupKey) : false;
      
      if (!isDuplicateInDB && !isDuplicateInRequest) {
        uniqueProductsToImport.push(p);
        if (requestDedupKey) seenInRequest.add(requestDedupKey);
      }
    }

    console.log(`[Bulk Import] Filtered out ${products.length - uniqueProductsToImport.length} duplicates. Processing ${uniqueProductsToImport.length} new products.`);

    if (uniqueProductsToImport.length === 0) {
      return res.json({ success: true, count: 0, message: 'All products already exist' });
    }

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    // Create products as DRAFT in batches
    const drafts = [];
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < uniqueProductsToImport.length; i += BATCH_SIZE) {
      const batch = uniqueProductsToImport.slice(i, i + BATCH_SIZE);
      console.log(`[Bulk Import] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueProductsToImport.length / BATCH_SIZE)} (${batch.length} products)`);
      
      const batchResults = await Promise.all(batch.map(async (p, idx) => {
        const productIndex = i + idx;
        try {
          // ... (same processing logic as before, but without prisma.product.create)
          // I will simplify the replacement by just changing the return behavior
          
          // Actually, I should probably keep this one as is if it's meant for "bulk publishing"
          // but the user said "don't add it to supabase database untill i hit publish".
          // So even bulk imports should be local drafts.
          
          // I'll skip modifying this one for now unless I'm sure it's used for drafts.
          // In lines 2987-2988: status: 'DRAFT', isActive: false.
          // Yes, it creates drafts. So it SHOULD be moved to local storage too.
          // Enhanced price parsing to handle various formats
          const parsePrice = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const cleanVal = String(val).replace(/[^\d.]/g, '');
            return parseFloat(cleanVal) || 0;
          };
          const parseJsonObject = (val) => {
            if (!val) return null;
            if (typeof val === 'object') return val;
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                return parsed && typeof parsed === 'object' ? parsed : null;
              } catch {
                return null;
              }
            }
            return null;
          };
          
          const domesticFee = parsePrice(p.domestic_shipping_fee || p.domesticShippingFee || p.domestic_shipping) || 0;
          
          let rawPrice = 0;
          rawPrice = Math.max(
            rawPrice,
            parsePrice(p.general_price),
            parsePrice(p.price),
            parsePrice(p.basePriceIQD),
            parsePrice(p.rawPrice),
            parsePrice(p.rawRmbPrice)
          );
          
          if (rawPrice <= 0 && p.priceModel && typeof p.priceModel === 'object') {
            if (Array.isArray(p.priceModel.currentPrices)) {
              rawPrice = Math.max(rawPrice, ...p.priceModel.currentPrices.map(parsePrice));
            }
            if (Array.isArray(p.priceModel.skuPrices)) {
              rawPrice = Math.max(rawPrice, ...p.priceModel.skuPrices.map(parsePrice));
            }
          }
          
          if (rawPrice <= 0 && Array.isArray(p.variants_data)) {
            rawPrice = Math.max(rawPrice, ...p.variants_data.map(v => parsePrice(v?.price)));
          }
          
          if (rawPrice <= 0 && Array.isArray(p.generated_options)) {
            rawPrice = Math.max(rawPrice, ...p.generated_options.map(v => parsePrice(v?.price)));
          }
          
          // Determine if price is combined (default to true if not specified, based on user feedback)
          // Heuristic: If explicitly set, use it. If > 1000, assume final IQD to avoid inflation.
          const isPriceCombined = true;
           
          // Extract new fields
          const shippingPriceIncluded = p.shipping_price_included !== undefined ? (p.shipping_price_included === true || String(p.shipping_price_included) === 'true') : true;
          const estimatedShippingCost = p.estimated_shipping_cost ? parseFloat(p.estimated_shipping_cost) : null;

           // Use the new calculation logic with 20% markup
          // WARNING: rawPrice is typically RMB from 1688. calculateBulkImportPrice expects IQD if we want to add IQD shipping.
          // But calculateBulkImportPrice adds domestic (IQD) and shipping (IQD) to rawPrice.
          // So rawPrice MUST be converted to IQD before passing if it is RMB.
          // heuristic: if !isPriceCombined (meaning rawPrice < 1000), it is likely RMB.
          // UPDATE: User requested to REMOVE automatic conversion. Input is guaranteed to be IQD.
          const priceInput = rawPrice;
          
          let price;
          if (isPriceCombined) {
            price = rawPrice;
          } else if (!shippingPriceIncluded) {
            const domestic = domesticFee || 0;
            const calculatedPrice = (priceInput + domestic);
            price = Math.ceil(calculatedPrice / 10) * 10;
          } else {
            price = calculateBulkImportPrice(priceInput, domesticFee, p.weight, p.length, p.width, p.height, p.shippingMethod, shippingRates);
          }
          
          // Skip products with 0 price
          if (price <= 0 || rawPrice <= 0) {
            console.log(`[Bulk Import] Skipping product with 0 price: ${p.name || 'Unnamed'}`);
            return null;
          }
          
          console.log(`[Bulk Import] Processing product ${productIndex + 1}/${uniqueProductsToImport.length}: "${p.name?.substring(0, 30)}...", price=${price} (original=${rawPrice}, domestic=${domesticFee})`);
          
          // Use original names/descriptions without translation and clean 'empty'
          const name = cleanStr(p.name) || cleanStr(p.product_name) || `Draft ${Date.now()}`;
          const description = cleanStr(p.description);
          const chineseName = cleanStr(p.chineseName) || cleanStr(p.name) || cleanStr(p.product_name);
          const aiMetadata = parseJsonObject(p.aiMetadata) || parseJsonObject(p.marketing_metadata);

          // Map Delivery_time from input to deliveryTime
          const deliveryTime = cleanStr(p.Delivery_time || p.deliveryTime || p.delivery_time);

          // Enhanced Options processing - extract from p.options OR p.variants OR direct properties
          let rawOptions = [];
          if (Array.isArray(p.options)) {
            rawOptions = [...p.options];
          } else if (typeof p.options === 'string' && p.options.trim().startsWith('[')) {
            try {
              rawOptions = JSON.parse(p.options);
            } catch (e) {
              console.warn(`[Bulk Import] Failed to parse options string for product ${productIndex + 1}`);
            }
          } else if (p.variants && typeof p.variants === 'object') {
            // Support user's "variants": { "sizes": [...], "colors": [...] } format
            for (const [rawKey, rawVal] of Object.entries(p.variants)) {
              const cleanedKey = cleanStr(String(rawKey));
              if (!cleanedKey) continue;
              if (!Array.isArray(rawVal)) continue;

              const lower = cleanedKey.toLowerCase();
              const mappedName =
                (lower === 'color' || lower === 'colour' || lower === 'colors' || lower === 'colours') ? 'اللون'
                  : (lower === 'size' || lower === 'sizes') ? 'المقاس'
                    : cleanedKey;

              const values = rawVal.map(v => cleanStr(String(v))).filter(Boolean);
              if (values.length > 0) rawOptions.push({ name: mappedName, values });
            }
          } else if (Array.isArray(p.generated_options)) {
            const valuesByName = new Map();
            for (const opt of p.generated_options) {
              if (!opt || typeof opt !== 'object') continue;
              for (const [rawKey, rawVal] of Object.entries(opt)) {
                const cleanedKey = cleanStr(String(rawKey));
                if (!cleanedKey) continue;
                const lower = cleanedKey.toLowerCase();
                if (lower === 'price' || lower === 'image' || lower === 'shippingmethod' || lower === 'method') continue;

                const mappedName =
                  (lower === 'color' || lower === 'colour' || lower === 'colors' || lower === 'colours') ? 'اللون'
                    : (lower === 'size' || lower === 'sizes') ? 'المقاس'
                      : cleanedKey;

                const rawValues = Array.isArray(rawVal) ? rawVal : [rawVal];
                const cleanedValues = rawValues
                  .map(v => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') return cleanStr(String(v.value ?? v.name ?? JSON.stringify(v)));
                    return cleanStr(String(v));
                  })
                  .filter(Boolean);

                if (cleanedValues.length === 0) continue;
                if (!valuesByName.has(mappedName)) valuesByName.set(mappedName, new Set());
                for (const cv of cleanedValues) valuesByName.get(mappedName).add(cv);
              }

              const dimensions = [...dimensionsMap.entries()]
                .map(([k, vals]) => [k, [...new Set(vals)]])
                .filter(([, vals]) => vals.length > 0);

              if (dimensions.length === 0) continue;

              let combinations = [{}];
              for (const [dimName, dimVals] of dimensions) {
                const next = [];
                for (const combo of combinations) {
                  for (const val of dimVals) {
                    next.push({ ...combo, [dimName]: val });
                  }
                }
                combinations = next;
              }

              for (const combo of combinations) {
                if (Object.keys(combo).length === 0) continue;
                generated.push({ 
                  options: combo, 
                  price: optPrice, 
                  basePriceIQD: optPrice, // Explicitly set basePriceIQD
                  currency: 'IQD',
                  image: optImage || null 
                });
              }
            }
            for (const [name, values] of valuesByName.entries()) {
              const list = [...values];
              if (list.length > 0) rawOptions.push({ name, values: list });
            }
          }
          
          // Mapping of common fields to standardized names (Arabic preferred)
          const fieldMapping = {
            'size': 'المقاس',
            'sizes': 'المقاس',
            'Size': 'المقاس',
            '尺码': 'المقاس',
            'color': 'اللون',
            'colour': 'اللون',
            'Color': 'اللون',
            '颜色': 'اللون',
            '颜色分类': 'اللون',
            'اللون': 'اللون',
            'تصنيف الألوان': 'اللون',
            'المقاس': 'المقاس',
            'model': 'الموديل',
            'Model': 'الموديل',
            '型号': 'الموديل',
            'style': 'الستايل',
            'material': 'الخامة',
            'type': 'النوع'
          };

          // Try to extract from direct properties if not already present or if present but empty
          Object.entries(fieldMapping).forEach(([field, standardName]) => {
            const val = p[field];
            if (val) {
              const existingOpt = rawOptions.find(o => o.name === standardName || o.name?.toLowerCase() === field.toLowerCase());
              const newValues = String(val).split(',').map(v => cleanStr(v)).filter(v => v !== '');
              
              if (newValues.length > 0) {
                if (!existingOpt) {
                  rawOptions.push({ name: standardName, values: newValues });
                } else if (!existingOpt.values || existingOpt.values.length === 0) {
                  existingOpt.values = newValues;
                  existingOpt.name = standardName; // Standardize name
                }
              }
            }
          });

          let processedOptions = rawOptions.map((opt, optIdx) => {
            const name = cleanStr(opt.name);
            // Standardize name if it matches our mapping
            const standardName = fieldMapping[name] || name;
            return {
              id: `opt-${Date.now()}-${productIndex}-${optIdx}-${Math.floor(Math.random() * 1000)}`,
              name: standardName,
              values: (Array.isArray(opt.values) ? opt.values : [])
                      .map(v => cleanStr(String(v)))
                      .filter(v => v !== '')
            };
          }).filter(opt => opt.name !== '' && opt.values.length > 0);

          // Specifications - clean 'empty'
          let specs = cleanStr(p.specs);
          
          // Handle product_details if it's an object (user's format)
          if (!specs && p.product_details && typeof p.product_details === 'object') {
            specs = Object.entries(p.product_details)
              .map(([key, val]) => `${key}: ${val}`)
              .join('\n');
          }
          
          // If we have review summary data, and it's not already in specs, append it
          const hasReviews = (p.reviews && p.reviews.length > 0) || (p.detailedReviews && p.detailedReviews.length > 0);
          if (!specs?.includes('---REVIEW_SUMMARY---') && (p.reviewCountText || p.positiveRate || hasReviews)) {
            const isDetailedReviews = Array.isArray(p.reviews) && 
                                     p.reviews.length > 0 && 
                                     typeof p.reviews[0] === 'object';
                                     
            const reviewSummary = {
              countText: p.reviewCountText || (Array.isArray(p.reviews) ? String(p.reviews.length) : '0'),
              positiveRate: p.positiveRate || '100%',
              tags: isDetailedReviews ? [] : (p.reviews || []),
              reviews: isDetailedReviews ? p.reviews : [],
              comments: p.reviewComments || [],
              images: p.reviewImages || [],
              detailedReviews: p.detailedReviews || []
            };
            specs = (specs || '') + '\n---REVIEW_SUMMARY---\n' + JSON.stringify(reviewSummary);
          }

          // Handle multiple images - Max 200
          const rawImages = p.images || p.main_images || (p.image ? [p.image] : []);
          let imageUrls = (Array.isArray(rawImages) ? rawImages : [])
            .map(url => typeof url === 'string' ? url.replace(/[`"']/g, '').trim() : url)
            .filter(url => url && typeof url === 'string' && url.startsWith('http'));
            
          if (imageUrls.length > 200) imageUrls = imageUrls.slice(0, 200);
          
          let detailImageUrls = (Array.isArray(p.detailImages) ? p.detailImages : [])
            .map(url => typeof url === 'string' ? url.replace(/[`"']/g, '').trim() : url)
            .filter(url => url && typeof url === 'string' && url.startsWith('http'));
            
          if (detailImageUrls.length > 200) detailImageUrls = detailImageUrls.slice(0, 200);
          
          const mainImage = imageUrls.length > 0 ? imageUrls[0] : (typeof p.image === 'string' ? p.image.replace(/[`"']/g, '').trim() : '');
          
          const basePriceIQD = extractNumber(p.basePriceIQD) || extractNumber(p.base_price) || rawPrice || 0;
          
          // Try to parse dimensions and weight using robust extractor
          const productWeight = extractNumber(p.weight) || extractNumber(p.shipping_weight);
          const weightVariations = parseVariantValues(p.weight) || {};
          
          let length = extractNumber(p.length) || extractNumber(p.shipping_length);
          let width = extractNumber(p.width) || extractNumber(p.shipping_width);
          let height = extractNumber(p.height) || extractNumber(p.shipping_height);
          
          if (!length && !width && !height && p.dimensions && typeof p.dimensions === 'string') {
            const dimMatch = p.dimensions.match(/(\d+(\.\d+)?)\s*[x*×]\s*(\d+(\.\d+)?)\s*[x*×]\s*(\d+(\.\d+)?)/i);
            if (dimMatch) {
              length = parseFloat(dimMatch[1]);
              width = parseFloat(dimMatch[3]);
              height = parseFloat(dimMatch[5]);
            }
          }

          const variantsInput = Array.isArray(p.variants_data) ? p.variants_data : [];
          if (variantsInput.length === 0 && Array.isArray(p.generated_options)) {
            const generated = [];
            for (const opt of p.generated_options) {
              if (!opt || typeof opt !== 'object') continue;
              const optPrice = parsePrice(opt.price) || rawPrice;
              const optImage = cleanStr(opt.image);
              const dimensionsMap = new Map();
              for (const [rawKey, rawVal] of Object.entries(opt)) {
                const cleanedKey = cleanStr(String(rawKey));
                if (!cleanedKey) continue;
                const lower = cleanedKey.toLowerCase();
                if (lower === 'price' || lower === 'image' || lower === 'shippingmethod' || lower === 'method') continue;

                const mappedName = fieldMapping[cleanedKey] || (lower === 'color' || lower === 'colour' ? 'اللون' : (lower === 'size' || lower === 'sizes' ? 'المقاس' : cleanedKey));
                const rawValues = Array.isArray(rawVal) ? rawVal : [rawVal];
                const cleanedValues = rawValues
                  .map(v => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') return cleanStr(String(v.value ?? v.name ?? JSON.stringify(v)));
                    return cleanStr(String(v));
                  })
                  .filter(Boolean);

                if (cleanedValues.length === 0) continue;
                if (!dimensionsMap.has(mappedName)) dimensionsMap.set(mappedName, []);
                dimensionsMap.get(mappedName).push(...cleanedValues);
              }

              const dimensions = [...dimensionsMap.entries()]
                .map(([k, vals]) => [k, [...new Set(vals)]])
                .filter(([, vals]) => vals.length > 0);

              if (dimensions.length === 0) continue;

              let combinations = [{}];
              for (const [dimName, dimVals] of dimensions) {
                const next = [];
                for (const combo of combinations) {
                  for (const val of dimVals) {
                    next.push({ ...combo, [dimName]: val });
                  }
                }
                combinations = next;
              }

              for (const combo of combinations) {
                if (Object.keys(combo).length === 0) continue;
                generated.push({ 
                  options: combo, 
                  price: optPrice, 
                  basePriceIQD: optPrice, // Explicitly set basePriceIQD
                  isPriceCombined: false, // Explicitly allow dynamic pricing
                  currency: 'IQD',
                  image: optImage || null 
                });
              }
            }
            variantsInput.push(...generated);
          }
          
          const optionMap = new Map();
          const normalizeOptionName = (optName) => cleanStr(optName).toLowerCase();
          const addOptionValue = (optName, optValue, optId) => {
            const name = cleanStr(optName);
            if (!name) return;
            const value = cleanStr(optValue);
            if (!value) return;
            const key = normalizeOptionName(name);
            if (!optionMap.has(key)) {
              optionMap.set(key, { id: optId || null, name, values: new Set() });
            } else if (!optionMap.get(key).id && optId) {
              optionMap.get(key).id = optId;
            }
            optionMap.get(key).values.add(value);
          };
          
          for (const opt of processedOptions) {
            if (!opt?.name) continue;
            const vals = Array.isArray(opt.values) ? opt.values : [];
            for (const v of vals) addOptionValue(opt.name, v, opt.id);
          }
          
          for (const v of variantsInput) {
            let combo = v?.options ?? v?.combination ?? {};
            if (typeof combo === 'string') {
              try { combo = JSON.parse(combo); } catch { combo = {}; }
            }
            if (!combo || typeof combo !== 'object') continue;
            for (const [k, rawVal] of Object.entries(combo)) {
              const mappedName = fieldMapping[cleanStr(k)] || k;
              const valString = typeof rawVal === 'object' && rawVal !== null
                ? (rawVal.value ?? rawVal.name ?? JSON.stringify(rawVal))
                : String(rawVal);
              addOptionValue(mappedName, valString);
            }
          }
          
          processedOptions = [...optionMap.values()]
            .map((entry, optIdx) => ({
              id: entry.id || `opt-${Date.now()}-${productIndex}-${optIdx}-${Math.floor(Math.random() * 1000)}`,
              name: entry.name,
              values: [...entry.values]
            }))
            .filter(opt => opt.name !== '' && opt.values.length > 0);

          // Return as a draft object instead of creating in database
          return {
            id: `local-${Date.now()}-${productIndex}-${Math.floor(Math.random() * 1000000)}`,
            name: name,
            chineseName: chineseName,
            description: description,
            price: price,
            shippingPriceIncluded: shippingPriceIncluded,
            estimatedShippingCost: estimatedShippingCost,
            basePriceIQD: basePriceIQD,
            image: mainImage,
            purchaseUrl: p.purchaseUrl ? p.purchaseUrl.replace(/[`"']/g, '').trim() : (p.url ? p.url.replace(/[`"']/g, '').trim() : null),
            videoUrl: p.videoUrl ? p.videoUrl.replace(/[`"']/g, '').trim() : null,
            status: 'DRAFT',
            isActive: false,
            isFeatured: !!p.isFeatured,
            isLocal: true,
            specs: specs,
            aiMetadata: aiMetadata || null,
            deliveryTime: deliveryTime || null,
            weight: productWeight,
            length: length,
            width: width,
            height: height,
            domesticShippingFee: domesticFee,
            images: imageUrls.map((url, i) => ({ url, order: i, type: 'GALLERY' })),
            detailImages: detailImageUrls.map((url, i) => ({ url, order: i, type: 'DETAIL' })),
            options: processedOptions,
            variants: variantsInput.map(v => {
              const variantRawPrice = parsePrice(v.price) || rawPrice;
              const variantBaseRaw = parsePrice(v.basePriceIQD);
              // Use explicit basePriceIQD if available (e.g. from generated options), otherwise fall back to price
              const finalBasePrice = (variantBaseRaw && variantBaseRaw > 0) ? variantBaseRaw : variantRawPrice;
              
              // Find weight for this variant if specified in variations
              let variantWeight = v.weight || null;
              if (!variantWeight && typeof v.options === 'object') {
                // Try to match any option value (e.g., "S", "XL", "Red") to weight variations
                for (const optVal of Object.values(v.options)) {
                  if (weightVariations[optVal] !== undefined) {
                    variantWeight = weightVariations[optVal];
                    break;
                  }
                }
              }

              // Respect explicit isPriceCombined flag
              // If v.currency is 'IQD' (generated), default to false unless explicitly true
              const isGenerated = v.currency === 'IQD';
              const variantIsPriceCombined = true !== undefined 
                ? (String(true) === 'true' || true === true) 
                : (isGenerated ? false : (isPriceCombined || variantRawPrice > 1000));

              let vPrice;
              if (variantIsPriceCombined) {
                 vPrice = finalBasePrice;
              } else if (!shippingPriceIncluded) {
                 const domestic = domesticFee || 0;
                 const calculatedPrice = (finalBasePrice + domestic);
                 vPrice = Math.ceil(calculatedPrice / 10) * 10;
              } else {
                 vPrice = calculateBulkImportPrice(finalBasePrice, domesticFee, variantWeight || productWeight, v.length || p.length, v.width || p.width, v.height || p.height, v.shippingMethod || p.shippingMethod, shippingRates);
              }

              return {
                combination: typeof v.options === 'object' ? v.options : {},
                basePriceIQD: finalBasePrice,
                price: vPrice,
                image: v.image || null,
                weight: variantWeight,
                height: v.height || null,
                length: v.length || null,
                width: v.width || null
              };
            })
          };
        } catch (err) {
          console.error(`[Bulk Import] Error processing product at index ${productIndex}:`, err);
          return null;
        }
      }));
      
      drafts.push(...batchResults.filter(p => p !== null));
      
      // Minimal delay between batches to allow the event loop to breathe - further reduced
      if (i + BATCH_SIZE < uniqueProductsToImport.length) {
        await new Promise(r => setTimeout(r, 100)); // Reduced from 200ms to 100ms
      }
    }

    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_IMPORT_DRAFTS',
      { count: drafts.length },
      'PRODUCT'
    );

    res.json({ 
      success: true, 
      count: drafts.length, 
      imported: drafts.length,
      skipped: products.length - uniqueProductsToImport.length,
      failed: uniqueProductsToImport.length - drafts.length,
      drafts 
    });
  } catch (error) {
    console.error('[Bulk Import] Critical error:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import products' });
  }
});

// ADMIN: Bulk Import Reviews
app.post('/api/admin/products/bulk-import-reviews', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { reviews } = req.body;
    console.log(`[Bulk Import Reviews] Request received for ${reviews?.length} review objects`);

    if (!reviews || !Array.isArray(reviews)) {
      return res.status(400).json({ error: 'Invalid reviews data' });
    }

    let updatedCount = 0;
    const results = [];

    for (const reviewData of reviews) {
      // Find the product by purchaseUrl or name
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { purchaseUrl: reviewData.purchaseUrl ? reviewData.purchaseUrl : undefined },
            { chineseName: reviewData.chineseName ? reviewData.chineseName : undefined },
            { name: reviewData.name ? reviewData.name : undefined }
          ].filter(Boolean)
        },
        include: { images: true },
        orderBy: { createdAt: 'desc' } // Get the most recently imported one if multiple exist
      });

      if (product) {
        // If reviews is an array of objects, it's detailed reviews
        const isDetailedReviews = Array.isArray(reviewData.reviews) && 
                                 reviewData.reviews.length > 0 && 
                                 typeof reviewData.reviews[0] === 'object';

        const summary = {
          countText: reviewData.reviewCountText || (Array.isArray(reviewData.reviews) ? String(reviewData.reviews.length) : '0'),
          positiveRate: reviewData.positiveRate || '100%',
          tags: isDetailedReviews ? [] : (reviewData.reviews || []),
          reviews: isDetailedReviews ? reviewData.reviews : [],
          comments: reviewData.reviewComments || [],
          images: reviewData.reviewImages || [],
          detailedReviews: reviewData.detailedReviews || []
        };

        // Clear existing summary if present and replace
        let newSpecs = product.specs || '';
        if (newSpecs.includes('---REVIEW_SUMMARY---')) {
          newSpecs = newSpecs.split('---REVIEW_SUMMARY---')[0].trim();
        }
        newSpecs += '\n---REVIEW_SUMMARY---\n' + JSON.stringify(summary);

        // Only publish if it already has extra photos (DETAIL images) or is already published
        const hasExtraPhotos = product.images.some(img => img.type === 'DETAIL');
        const isAlreadyPublished = product.status === 'PUBLISHED';

        await prisma.product.update({
          where: { id: product.id },
          data: { 
            specs: newSpecs,
            ...((hasExtraPhotos || isAlreadyPublished) ? { isActive: true, status: 'PUBLISHED' } : {})
          }
        });

        updatedCount++;
        results.push({ productName: product.name, status: 'success' });
      } else {
        results.push({ productName: reviewData.name, status: 'not_found' });
      }
    }

    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_IMPORT_REVIEWS',
      { count: updatedCount },
      'PRODUCT'
    );

    res.json({ success: true, count: updatedCount, results });
  } catch (error) {
    console.error('[Bulk Import Reviews] Error:', error);
    res.status(500).json({ error: 'Failed to import reviews' });
  }
});

// ADMIN: Save Product Options and Variants (Step 4)
app.put('/api/admin/products/:id/options', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { id } = req.params;
    const { options = [], variants = [] } = req.body;

    // Clear existing options and variants
    await prisma.productVariant.deleteMany({ where: { productId: safeParseId(id) } });
    await prisma.productOption.deleteMany({ where: { productId: safeParseId(id) } });

    // Use original names/values without translation and clean 'empty'
    const processedOptions = options.map(opt => ({
      name: opt.name.replace(/\bempty\b/gi, '').trim(),
      values: (Array.isArray(opt.values) ? opt.values : [])
               .map(v => {
                 const val = typeof v === 'object' ? (v.value || JSON.stringify(v)) : String(v);
                 return val.replace(/\bempty\b/gi, '').trim();
               })
               .filter(v => v !== '')
    })).filter(opt => opt.name !== '' && opt.values.length > 0);

    // Create new options
    if (processedOptions && processedOptions.length > 0) {
      await prisma.productOption.createMany({
        data: processedOptions.map(opt => ({
          productId: safeParseId(id),
          name: opt.name,
          values: JSON.stringify(opt.values)
        }))
      });
    }

    // Create new variants
    if (variants && Array.isArray(variants)) {
      const product = await prisma.product.findUnique({
        where: { id: safeParseId(id) },
        select: {
          weight: true,
          length: true,
          width: true,
          height: true,
          domesticShippingFee: true
        }
      });
      const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
      const shippingRates = {
        airShippingRate: storeSettings?.airShippingRate,
        seaShippingRate: storeSettings?.seaShippingRate,
        airShippingMinFloor: storeSettings?.airShippingMinFloor
      };

      await prisma.productVariant.createMany({
        data: variants.map(v => ({
          productId: safeParseId(id),
          combination: JSON.stringify(v.combination),
          price: (() => {
            const raw = safeParseFloat(v.basePriceIQD);
            if (raw && raw > 0) {
              const domesticFee = safeParseFloat(product?.domesticShippingFee) || 0;
              const vWeight = safeParseFloat(v.weight) ?? product?.weight;
              const vLength = safeParseFloat(v.length) ?? product?.length;
              const vWidth = safeParseFloat(v.width) ?? product?.width;
              const vHeight = safeParseFloat(v.height) ?? product?.height;
              return calculateBulkImportPrice(raw, domesticFee, vWeight, vLength, vWidth, vHeight, null, shippingRates);
            }
            return safeParseFloat(v.price) || 0;
          })(),
          weight: v.weight ? parseFloat(v.weight) : null,
          height: v.height ? parseFloat(v.height) : null,
          length: v.length ? parseFloat(v.length) : null,
          width: v.width ? parseFloat(v.width) : null,
          image: v.image,
        }))
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save options error:', error);
    res.status(500).json({ error: 'Failed to save options and variants' });
  }
});

app.put('/api/admin/products/update-price', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { productId, variantId, newPrice, orderItemId } = req.body;
    console.log('[UpdatePrice] Request:', { productId, variantId, newPrice, orderItemId });

    const parsedProductId = safeParseId(productId);
    const parsedVariantId = (variantId !== undefined && variantId !== null && variantId !== '') ? safeParseId(variantId) : null;

    // 1. Get current product and its variants
    const product = await prisma.product.findUnique({
      where: { id: parsedProductId },
      include: { variants: { select: productVariantSelect } }
    });

    if (!product) {
      console.error('[UpdatePrice] Product not found:', parsedProductId);
      return res.status(404).json({ error: 'Product not found' });
    }

    let oldPrice;
    if (parsedVariantId) {
      const targetVariant = product.variants.find(v => v.id === parsedVariantId);
      if (!targetVariant) {
        console.error('[UpdatePrice] Variant not found in product variants:', parsedVariantId);
        const v = await prisma.productVariant.findUnique({ where: { id: parsedVariantId }, select: productVariantSelect });
        if (!v) return res.status(404).json({ error: 'Variant not found' });
        oldPrice = v.price;
      } else {
        oldPrice = targetVariant.price;
      }
    } else {
      oldPrice = product.price;
    }

    console.log('[UpdatePrice] Found old price:', oldPrice);

    const roundedNewPrice = Math.ceil(newPrice / 10) * 10;

    // 2. Update the specific variant OR product first
    if (parsedVariantId) {
      await prisma.productVariant.update({
        where: { id: parsedVariantId },
        data: { price: roundedNewPrice }
      });
    } else {
      await prisma.product.update({
        where: { id: parsedProductId },
        data: { price: roundedNewPrice }
      });
    }

    // 3. Update all other variants with the same old price
    const priceTolerance = 0.01;
    await prisma.productVariant.updateMany({
      where: {
        productId: parsedProductId,
        price: {
          gte: oldPrice - priceTolerance,
          lte: oldPrice + priceTolerance
        },
        NOT: parsedVariantId ? { id: parsedVariantId } : undefined
      },
      data: { price: roundedNewPrice }
    });

    // 4. Update product base price if it matches the old price
    if (parsedVariantId && Math.abs(product.price - oldPrice) < priceTolerance) {
      await prisma.product.update({
        where: { id: parsedProductId },
        data: { price: roundedNewPrice }
      });
    }

    // 5. Update the specific OrderItem if provided and recalculate total
    if (orderItemId) {
      const updatedOrderItem = await prisma.orderItem.update({
        where: { id: safeParseId(orderItemId) },
        data: { price: roundedNewPrice },
        include: { order: true }
      });

      // Recalculate order total
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: updatedOrderItem.orderId }
      });
      
      const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const total = subtotal + (updatedOrderItem.order.internationalShippingFee || 0);
      
      await prisma.order.update({
        where: { id: updatedOrderItem.orderId },
        data: { total }
      });
    }

    console.log('[UpdatePrice] Successfully updated prices to:', newPrice);
    res.json({ success: true, message: 'Prices updated successfully' });
  } catch (error) {
    console.error('Error updating product prices:', error);
    res.status(500).json({ error: 'Failed to update product prices' });
  }
});

app.post('/api/admin/products/bulk-ai-metadata', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { products, overwrite = false } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const cleanUrl = (u) => (typeof u === 'string' ? u.replace(/[`"']/g, '').trim() : '');
    const parseJsonObject = (val) => {
      if (!val) return null;
      if (typeof val === 'object') return val;
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    };
    const extractOfferId = (u) => {
      if (!u) return null;
      const match = String(u).match(/[?&]offerId=(\d+)/i);
      return match ? match[1] : null;
    };

    const results = {
      total: products.length,
      matched: 0,
      updated: 0,
      skipped: 0,
      notFound: 0
    };

    for (const p of products) {
      const purchaseUrlRaw = p?.purchaseUrl ?? p?.url ?? '';
      const purchaseUrl = cleanUrl(purchaseUrlRaw);
      const offerId = extractOfferId(purchaseUrl) || extractOfferId(purchaseUrlRaw);
      const aiMetadata = parseJsonObject(p?.aiMetadata) || parseJsonObject(p?.marketing_metadata);

      if (!purchaseUrl || !aiMetadata) {
        results.skipped++;
        continue;
      }

      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { purchaseUrl: purchaseUrl },
            { purchaseUrl: String(purchaseUrlRaw) },
            ...(offerId ? [{ purchaseUrl: { contains: `offerId=${offerId}` } }] : [])
          ]
        },
        select: { id: true, aiMetadata: true, purchaseUrl: true }
      });

      if (!product) {
        results.notFound++;
        continue;
      }

      results.matched++;

      const alreadyHasMetadata = product.aiMetadata !== null && product.aiMetadata !== undefined;
      if (alreadyHasMetadata && !overwrite) {
        results.skipped++;
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: {
          aiMetadata,
          purchaseUrl: purchaseUrl
        }
      });

      results.updated++;
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error('[Bulk AI Metadata] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update aiMetadata' });
  }
});

app.post('/api/admin/products/queue-missing-embeddings', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  res.json({ success: true, message: 'Embedding generation is disabled' });
});

// ADMIN: Bulk Publish (Step 5)
app.post('/api/admin/products/bulk-publish', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const rawIds = req.body.ids;
    if (!Array.isArray(rawIds)) return res.status(400).json({ error: 'Invalid IDs' });
    
    // Ensure all IDs are numbers (Prisma requires Int for ID field)
    const ids = rawIds.map(id => safeParseId(id)).filter(id => typeof id === 'number');

    if (ids.length === 0) {
      return res.json({ success: true });
    }

    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { 
        status: 'PUBLISHED',
        isActive: true
      }
    });

    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_PUBLISH_PRODUCTS',
      { ids },
      'PRODUCT'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk publish error:', error);
    res.status(500).json({ error: 'Failed to bulk publish products' });
  }
});

// ADMIN: Bulk Create Products (Optimized for publishing local drafts)
app.post('/api/admin/products/bulk-create', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const createdResults = [];
    
    // 1. Process images SEQUENTIALLY to avoid timeouts/memory issues during bulk
    const processedProducts = [];
    console.log(`Starting bulk processing for ${products.length} products...`);
    
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const product = { ...p };
      
      if (product.image && (product.image.startsWith('data:') || product.image.length > 1000)) {
        try {
          console.log(`Processing image for product ${i + 1}/${products.length}: ${product.name}`);
          product.image = await convertToWebP(product.image);
        } catch (err) {
          console.error(`Failed to convert image for product ${product.name}:`, err);
          // Keep original image if conversion fails
        }
      }
      
      // Also process secondary images if they are base64
      if (product.images && Array.isArray(product.images)) {
        const processedImages = [];
        for (let j = 0; j < product.images.length; j++) {
          let img = product.images[j];
          let url = typeof img === 'string' ? img : img?.url;
          
          if (url && (url.startsWith('data:') || url.length > 1000)) {
            try {
              url = await convertToWebP(url);
              if (typeof img === 'string') {
                img = url;
              } else {
                img.url = url;
              }
            } catch (err) {
              console.error(`Failed to convert secondary image ${j} for ${product.name}:`, err);
            }
          }
          processedImages.push(img);
        }
        product.images = processedImages;
      }
      
      processedProducts.push(product);
    }

    console.log('Images processed. Starting database transaction...');

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    // 2. We process DB operations in a transaction to ensure data consistency
    // Added explicit timeout for large bulk operations (60 seconds)
    await prisma.$transaction(async (tx) => {
      for (const p of processedProducts) {
        // Exclude local-only fields and relational fields
        let { 
          id, 
          productId,
          isLocal, 
          createdAt, 
          updatedAt, 
          options = [], 
          variants = [], 
          images = [], 
          ...rawProductData 
        } = p;

        // Map alias fields from scraper payloads
        if (!rawProductData.name && rawProductData.product_name) rawProductData.name = rawProductData.product_name;
        if (!rawProductData.price && rawProductData.general_price) rawProductData.price = rawProductData.general_price;
        if (!rawProductData.purchaseUrl && rawProductData.url) rawProductData.purchaseUrl = rawProductData.url;
        // Fix: Restore domesticShippingFee if it was destructured out, or map from snake_case
        if (!rawProductData.domesticShippingFee) {
          if (domesticShippingFee) rawProductData.domesticShippingFee = domesticShippingFee;
          else if (rawProductData.domestic_shipping) rawProductData.domesticShippingFee = rawProductData.domestic_shipping;
        }

        const extractGeneratedOptionEntries = (opt) => {
          const out = [];
          if (!opt || typeof opt !== 'object') return out;
          
          const metaKeys = new Set(['price', 'image', 'shippingmethod', 'method', 'stock', 'weight', 'sku', 'skuid', 'specid']);
          
          const pushEntry = (rawKey, rawVal) => {
            const cleanedKey = cleanStr(String(rawKey));
            if (!cleanedKey) return;
            const lower = cleanedKey.toLowerCase();
            if (metaKeys.has(lower)) return;
            
            // Recurse into nested objects like "combination" or "options"
            if (lower === 'options' || lower === 'combination' || lower === 'variant' || lower === 'variants') {
               if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal)) {
                 for (const [k, v] of Object.entries(rawVal)) pushEntry(k, v);
                 return;
               }
            }
            
            out.push([cleanedKey, rawVal]);
          };
          
          for (const [k, v] of Object.entries(opt)) pushEntry(k, v);
          return out;
        };

        // Handle generated_options - Prioritize it if available as it contains detailed pricing/combinations
        if (Array.isArray(rawProductData.generated_options) && rawProductData.generated_options.length > 0) {
          const valuesByName = new Map();
          const genVariants = [];
          
          for (const opt of rawProductData.generated_options) {
            if (!opt || typeof opt !== 'object') continue;
            
            const optPrice = safeParseFloat(opt.price);
            const optImage = cleanStr(opt.image);
            const combination = {};
            
            for (const [cleanedKey, rawVal] of extractGeneratedOptionEntries(opt)) {
            const lower = cleanedKey.toLowerCase();
            const mappedName = (() => {
              // Force common English terms to Arabic
              if (lower.includes('color') || lower.includes('colour') || lower === 'yanse') return 'اللون';
              if (lower.includes('size') || lower.includes('chima')) return 'المقاس';
              
              if (lower === 'model' || lower === 'models') return 'المقاس';
              if (lower === 'style' || lower === 'styles') return 'الستايل';
              
              return fieldMapping[cleanedKey] || fieldMapping[lower] || cleanedKey;
            })();
              
              const rawValues = Array.isArray(rawVal) ? rawVal : [rawVal];
              const cleanedValues = rawValues.map(v => {
                 if (v === null || v === undefined) return '';
                 if (typeof v === 'object') return cleanStr(String(v.value ?? v.name ?? JSON.stringify(v)));
                 return cleanStr(String(v));
              }).filter(Boolean);
              
              if (cleanedValues.length > 0) {
                if (!valuesByName.has(mappedName)) valuesByName.set(mappedName, new Set());
                for (const cv of cleanedValues) valuesByName.get(mappedName).add(cv);
                
                // For variant combination, take the first value
                combination[mappedName] = cleanedValues[0];
              }
            }
            
            if (Object.keys(combination).length > 0) {
              const rmbPrice = (optPrice && optPrice > 0) ? optPrice : (safeParseFloat(opt.price) || 0);
            
            // Check for explicit currency/unit instruction
            // User guarantees input is IQD. No x200 conversion.
            const iqdBase = rmbPrice;
            
            console.log(`[DEBUG V4 GenVariant] optPriceRaw=${opt.price}, parsed=${optPrice}, iqdBase=${iqdBase}`);

            // Calculate initial price using product dimensions as fallback
              // This ensures the stored price is reasonably accurate even before user interaction
              const initialPrice = calculateBulkImportPrice(
                iqdBase, 
                rawProductData.domesticShippingFee || 0,
                rawProductData.weight,
                rawProductData.length,
                rawProductData.width,
                rawProductData.height,
                null, // Auto-detect Air/Sea based on weight
                shippingRates
              );
              
              // Ensure basePriceIQD is never null if we have a price
              const finalBasePrice = iqdBase > 0 ? iqdBase : (initialPrice > 0 ? initialPrice : 0);

              genVariants.push({
                combination,
                price: initialPrice,
                image: optImage, // Allow dynamic pricing based on shipping method
                basePriceIQD: finalBasePrice, // Always store IQD value in basePriceIQD for consistency with frontend logic
                currency: 'IQD' // Explicitly flag as IQD so variants loop doesn't double-convert
              });
            }
          }
          
          // Populate options
          if (valuesByName.size > 0) {
            options = [];
            for (const [name, values] of valuesByName.entries()) {
              options.push({ name, values: [...values] });
            }
          }
          
          // Populate variants
          if (genVariants.length > 0) {
            variants = genVariants;
          }
        }
        
        const domesticFee = safeParseFloat(rawProductData.domesticShippingFee) || 0;
        // Determine if price is combined using explicit flag
        const isPriceCombined = true;
        
        const parsedAiMetadata = (() => {
          const candidate = rawProductData.aiMetadata ?? rawProductData.marketing_metadata;
          if (!candidate) return null;
          if (typeof candidate === 'object') return candidate;
          if (typeof candidate === 'string') {
            try {
              const parsed = JSON.parse(candidate);
              return parsed && typeof parsed === 'object' ? parsed : null;
            } catch {
              return null;
            }
          }
          return null;
        })();
        
        // Use the new calculation logic with 90% markup for air items
        const rawPrice = safeParseFloat(rawProductData.price) || 0;
        
        console.log(`[DEBUG] Pricing calc for ${rawProductData.name}: rawPrice=${rawPrice}, domestic=${domesticFee}=${isPriceCombined}, weight=${rawProductData.weight}`);

        // Determine if input is IQD or RMB
        // User guarantees input is IQD. No x200 conversion.
        const iqdPrice = rawPrice;

        const calculatedPrice = isPriceCombined ? rawPrice : calculateBulkImportPrice(iqdPrice, domesticFee, rawProductData.weight, rawProductData.length, rawProductData.width, rawProductData.height, rawProductData.shippingMethod, shippingRates);

        // Skip products with 0 price
        if (calculatedPrice <= 0 || rawPrice <= 0) {
          console.log(`[Bulk Create] Skipping product with 0 price: ${rawProductData.name || 'Unnamed'}`);
          continue;
        }

        // Determine final basePriceIQD in IQD (User confirmed input is IQD)
        let finalBasePriceRMB = safeParseFloat(rawProductData.basePriceIQD);
        if (!finalBasePriceRMB) {
           finalBasePriceRMB = rawPrice;
        }
        
        console.log(`[DEBUG] BasePriceRMB calc: raw=${rawProductData.basePriceIQD}, final=${finalBasePriceRMB} (Force IQD)`);

        // Pick only valid Prisma fields to avoid "Unknown arg" errors
        const productData = {
          name: rawProductData.name || 'Untitled Product',
          chineseName: rawProductData.chineseName || null,
          description: rawProductData.description || '',
          price: calculatedPrice,
          basePriceIQD: finalBasePriceRMB,
          image: rawProductData.image || (images && images[0]) || '',
          purchaseUrl: rawProductData.purchaseUrl || null,
          videoUrl: rawProductData.videoUrl || null,
          status: 'PUBLISHED',
          isFeatured: rawProductData.isFeatured || false,
          isActive: rawProductData.isActive !== undefined ? rawProductData.isActive : true,
          specs: rawProductData.specs || '',
          storeEvaluation: rawProductData.storeEvaluation || null,
          reviewsCountShown: rawProductData.reviewsCountShown || null,
          weight: safeParseFloat(rawProductData.weight),
          length: safeParseFloat(rawProductData.length),
          width: safeParseFloat(rawProductData.width),
          height: safeParseFloat(rawProductData.height),
          domesticShippingFee: domesticFee,
          aiMetadata: parsedAiMetadata,
          deliveryTime: rawProductData.deliveryTime || rawProductData.delivery_time || rawProductData.Delivery_time || null
        };
        
        // Create the product
        const product = await tx.product.create({
          data: productData
        });

        // Create secondary images if they exist
        if (images && Array.isArray(images) && images.length > 0) {
          const processedImages = images.map((img, index) => {
            const url = typeof img === 'string' ? img : img.url;
            const type = typeof img === 'object' ? (img.type || 'GALLERY') : 'GALLERY';
            const order = typeof img === 'object' ? (img.order !== undefined ? img.order : index) : index;
            return { url, type, order };
          }).filter(img => img.url && typeof img.url === 'string' && img.url.length > 0);

          if (processedImages.length > 0) {
            await tx.productImage.createMany({
              data: processedImages.map(img => ({
                productId: product.id,
                url: img.url,
                order: img.order,
                type: img.type
              }))
            });
          }
        }

        const optionMap = new Map();
        const normalizeOptionName = (optName) => {
          const cleaned = cleanStr(optName);
          const lower = cleaned.toLowerCase();
          
          if (lower.includes('color') || lower.includes('colour')) return 'اللون';
          if (lower.includes('size') || lower.includes('chima')) return 'المقاس';
          
          if (lower === 'model' || lower === 'models') return 'المقاس';
          
          return fieldMapping[cleaned] || fieldMapping[lower] || cleaned;
        };
        const addOptionValue = (optName, optValue) => {
          const name = cleanStr(optName);
          if (!name) return;
          const value = cleanStr(optValue);
          if (!value) return;
          const key = normalizeOptionName(name);
          // Use 'key' (normalized name) as the display name to ensure consistency and Arabic output
          if (!optionMap.has(key)) optionMap.set(key, { name: key, values: new Set() });
          optionMap.get(key).values.add(value);
        };

        if (options && Array.isArray(options)) {
          for (const opt of options) {
            const optName = cleanStr(opt?.name);
            if (!optName) continue;
            let vals = opt?.values;
            if (typeof vals === 'string') {
              try { vals = JSON.parse(vals); } catch { vals = []; }
            }
            if (!Array.isArray(vals)) vals = [];
            for (const v of vals) addOptionValue(optName, String(v));
          }
        }

        const normalizeVariantKey = (rawKey) => {
          const cleaned = cleanStr(String(rawKey));
          const lower = cleaned.toLowerCase();
          
          if (lower.includes('color') || lower.includes('colour')) return 'اللون';
          if (lower.includes('size') || lower.includes('chima')) return 'المقاس';
          
          if (lower === 'model' || lower === 'models') return 'المقاس';
          
          if (fieldMapping[cleaned]) return fieldMapping[cleaned];
          if (fieldMapping[lower]) return fieldMapping[lower];
          return cleaned;
        };

        if (variants && Array.isArray(variants)) {
          for (const v of variants) {
            let combo = v?.combination ?? v?.options ?? v?.variant ?? {};
            if (typeof combo === 'string') {
              try { combo = JSON.parse(combo); } catch { combo = {}; }
            }
            if (!combo || typeof combo !== 'object' || Array.isArray(combo)) continue;
            for (const [k, rawVal] of Object.entries(combo)) {
              const valString = typeof rawVal === 'object' && rawVal !== null
                ? (rawVal.value ?? rawVal.name ?? JSON.stringify(rawVal))
                : String(rawVal);
              addOptionValue(normalizeVariantKey(k), valString);
            }
          }
        }

        const normalizedOptions = [...optionMap.values()]
          .map((entry) => ({ name: entry.name, values: [...entry.values] }))
          .filter(opt => opt.name !== '' && opt.values.length > 0);

        if (normalizedOptions.length > 0) {
          await tx.productOption.createMany({
            data: normalizedOptions.map(opt => ({
              productId: product.id,
              name: opt.name,
              values: JSON.stringify(opt.values)
            }))
          });
        }

        // Create variants
        if (variants && Array.isArray(variants) && variants.length > 0) {
          const validVariants = variants.filter(v => v && (v.combination || v.options));
          if (validVariants.length > 0) {
            await tx.productVariant.createMany({
              data: validVariants.map(v => {
                const variantRawPrice = safeParseFloat(v.price) || 0;
                const variantBaseRaw = safeParseFloat(v.basePriceIQD);
                const rawVal = (variantBaseRaw && variantBaseRaw > 0) ? variantBaseRaw : variantRawPrice;
                
                // User guarantees input is IQD. No x200 conversion.
                const iqdBase = rawVal;
                
                // FORCE isPriceCombined to FALSE if this is a generated variant (currency='IQD')
                // This overrides any accidental inheritance from the main product
                // Also ensure we handle the string/boolean type mismatch correctly
                const isGeneratedVariant = v.currency === 'IQD';
                const variantIsPriceCombined = isGeneratedVariant 
                  ? false 
                  : (true !== undefined 
                      ? (String(true) === 'true' || true === true) 
                      : (isPriceCombined));

                console.log(`[DEBUG V4 Variant] price=${v.price}, iqdBase=${iqdBase}, isCombined=${variantIsPriceCombined} (Was: ${isPriceCombined})`);

                // FORCE basePriceIQD to be present if iqdBase is present
                // This handles the case where safeParseFloat might have returned null/0 but we have a rawVal
                const finalVariantBasePrice = iqdBase > 0 ? iqdBase : (safeParseFloat(product.basePriceIQD) || rawVal || 0);

                // Use safeParseFloat(product.price) as fallback, not product.price directly
                const fallbackPrice = safeParseFloat(product.price) || 0;

                const finalVariantPrice = (() => {
                  // If base price is valid, use it for calculation
                  if (finalVariantBasePrice && finalVariantBasePrice > 0) {
                     // If explicit instruction to combine price, return base
                     if (variantIsPriceCombined) return finalVariantBasePrice;
                     
                     // Otherwise calculate dynamic price
                     return calculateBulkImportPrice(
                        finalVariantBasePrice, 
                        domesticFee, 
                        v.weight || rawProductData.weight, 
                        v.length || rawProductData.length, 
                        v.width || rawProductData.width, 
                        v.height || rawProductData.height, 
                        v.shippingMethod || rawProductData.shippingMethod, 
                        shippingRates
                     );
                  }
                  
                  // Fallback to product price if no variant base price
                  return fallbackPrice;
                })();

                return {
                  productId: product.id,
                  combination: (() => {
                    let combo = v.combination ?? v.options ?? {};
                    if (typeof combo === 'string') {
                      try { combo = JSON.parse(combo); } catch { return combo; }
                    }
                    if (!combo || typeof combo !== 'object' || Array.isArray(combo)) return '{}';
                    const normalizedCombo = {};
                    for (const [k, rawVal] of Object.entries(combo)) {
                      const valString = typeof rawVal === 'object' && rawVal !== null
                        ? (rawVal.value ?? rawVal.name ?? JSON.stringify(rawVal))
                        : String(rawVal);
                      normalizedCombo[normalizeVariantKey(k)] = cleanStr(valString);
                    }
                    return JSON.stringify(normalizedCombo);
                  })(),
                  price: finalVariantPrice,
                  weight: safeParseFloat(v.weight),
                  height: safeParseFloat(v.height),
                  length: safeParseFloat(v.length),
                  width: safeParseFloat(v.width),
                  basePriceIQD: finalVariantBasePrice,
                  image: v.image || product.image || ''
                };
              })
            });
          }
        }

        createdResults.push(product);
      }
    }, {
      timeout: 60000 
    });

    await logActivity(
      req.user.id,
      req.user.name,
      'BULK_CREATE_PRODUCTS',
      { count: products.length },
      'PRODUCT'
    );

    res.json({ success: true, count: createdResults.length, products: createdResults });
  } catch (error) {
    console.error('Detailed Bulk Create Error:', error);
    res.status(500).json({ 
      error: 'Failed to bulk create products', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching product ${id}`);
    const product = await prisma.product.findUnique({
      where: { id: safeParseId(id) },
      include: { 
        options: true,
        variants: { select: productVariantSelect },
        images: {
          orderBy: {
            order: 'asc'
          }
        },
        reviews: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    console.log('[DEBUG] Product found, applying pricing...');
    try {
        const processed = applyDynamicPricingToProduct(product, null);
        console.log('[DEBUG] Pricing applied successfully');
        res.json(processed);
    } catch (pricingError) {
        console.error('[DEBUG] Pricing error:', pricingError);
        throw pricingError;
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Check if user has purchased a product
app.get('/api/products/:id/check-purchase', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        productId: safeParseId(id),
        order: {
          userId: userId,
          // We allow reviews if the order is COMPLETED or SHIPPED or DELIVERED
          status: { in: ['COMPLETED', 'SHIPPED', 'DELIVERED'] }
        }
      }
    });

    res.json({ purchased: !!orderItem });
  } catch (error) {
    console.error('Error checking purchase status:', error);
    res.json({ purchased: false }); // Fallback to false on error
  }
});

// Search products
app.get('/api/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();
    const log = (stage, data = {}) => {
      console.log(`[SEARCH ${requestId}] ${stage}`, { ...data, elapsedMs: Date.now() - startTime });
    };

    if (!q || typeof q !== 'string') {
      log('invalid_query', { qType: typeof q });
      return res.json({ products: [], total: 0, engine: 'none' });
    }
    const isArabicQuery = /[\u0600-\u06FF]/.test(q);
    const cleanQuery = q.replace(/[\\\/.,()!?;:]/g, ' ').trim();
    const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 1);
    log('start', { qLength: q.length, page: pageNum, limit: limitNum, isArabicQuery, keywordsCount: keywords.length });

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    const useFastArabicSearch = isArabicQuery && (keywords.length > 3 || cleanQuery.length > 24);
    if (useFastArabicSearch) {
      log('fast_arabic_start', { cleanQueryLength: cleanQuery.length, keywordsCount: keywords.length });
      const where = {
        status: 'PUBLISHED',
        isActive: true,
        OR: [
          { name: { contains: cleanQuery } },
          { specs: { contains: cleanQuery } },
          ...keywords.flatMap(term => [
            { name: { contains: term } },
            { specs: { contains: term } }
          ])
        ]
      };
      const fastStart = Date.now();
      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          include: {
            variants: { select: productVariantSelect },
            images: {
              take: 1,
              orderBy: { order: 'asc' }
            }
          },
          skip,
          take: limitNum
        })
      ]);
      log('fast_arabic_done', { total, returned: products.length, dbMs: Date.now() - fastStart });
      return res.json({
        products: products.map(p => applyDynamicPricingToProduct(p, shippingRates)),
        total,
        hasMore: skip + limitNum < total,
        engine: 'db'
      });
    }

    // Highly flexible Arabic and Iraqi Dialect normalization and variation generation
    const getVariations = (word) => {
      const variations = new Set([word]);
      
      // Basic normalization function
      const normalize = (w) => w
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/ناسائ/g, 'نسائ')
      .replace(/ناسا/g, 'نسا');

      const base = normalize(word);
      variations.add(base);
      if (base.includes('ناسائ')) {
        variations.add(base.replace(/ناسائ/g, 'نسائ'));
      }
    if (base.includes('ناسا')) {
      variations.add(base.replace(/ناسا/g, 'نسا'));
    }

      // 1. Iraqi Dialect & Character-level variations
      const generateCharVariations = (w) => {
        let results = [w];
        
        // Alef variations
        const alefs = ['ا', 'أ', 'إ', 'آ'];
        alefs.forEach(a => {
          const currentLen = results.length;
          for (let i = 0; i < currentLen; i++) {
            const item = results[i];
            if (item.includes(a)) {
              alefs.forEach(targetA => {
                results.push(item.replace(new RegExp(a, 'g'), targetA));
              });
            }
          }
        });

        // Teh Marbuta / Heh variations
        const tehs = ['ة', 'ه'];
        tehs.forEach(t => {
          const currentLen = results.length;
          for (let i = 0; i < currentLen; i++) {
            const item = results[i];
            if (item.endsWith(t)) {
              tehs.forEach(targetT => {
                results.push(item.slice(0, -1) + targetT);
              });
            }
          }
        });

        // Yeh / Alef Maqsura variations
        const yehs = ['ي', 'ى'];
        yehs.forEach(y => {
          const currentLen = results.length;
          for (let i = 0; i < currentLen; i++) {
            const item = results[i];
            if (item.endsWith(y)) {
              yehs.forEach(targetY => {
                results.push(item.slice(0, -1) + targetY);
              });
            }
          }
        });

        // Iraqi / Persian / Urdu character mappings to Standard Arabic
        // گ (Gaf) -> ق or ك
        // چ (Che) -> ج or ك
        // پ (Pe) -> ب
        // ڤ (Ve) -> ف
        const currentLenBeforeIraqi = results.length;
        for (let i = 0; i < currentLenBeforeIraqi; i++) {
          const item = results[i];
          if (item.includes('گ')) {
            results.push(item.replace(/گ/g, 'ق'));
            results.push(item.replace(/گ/g, 'ك'));
          }
          if (item.includes('چ')) {
            results.push(item.replace(/چ/g, 'ج'));
            results.push(item.replace(/چ/g, 'ك'));
          }
          if (item.includes('پ')) results.push(item.replace(/پ/g, 'ب'));
          if (item.includes('ڤ')) results.push(item.replace(/ڤ/g, 'ف'));
          
          // Phonetic swaps common in Iraqi dialect
          if (item.includes('ق')) {
            results.push(item.replace(/ق/g, 'ك'));
            results.push(item.replace(/ق/g, 'گ'));
            results.push(item.replace(/ق/g, 'ج')); // Iraqi 'G' sound sometimes written as J or pronounced close to it
          }
          if (item.includes('ك')) {
            results.push(item.replace(/ك/g, 'ق'));
            results.push(item.replace(/ك/g, 'چ')); // k -> ch swap (e.g. kaff -> chaff)
          }
          if (item.includes('ج')) {
            results.push(item.replace(/ج/g, 'ي')); // j -> y swap (e.g. dajaj -> dayay)
            results.push(item.replace(/ج/g, 'چ'));
          }

          // More Iraqi phonetic swaps
          if (item.includes('ط')) results.push(item.replace(/ط/g, 'ت'));
          if (item.includes('ت')) results.push(item.replace(/ت/g, 'ط'));
          if (item.includes('ض')) results.push(item.replace(/ض/g, 'د'));
          if (item.includes('د')) results.push(item.replace(/د/g, 'ض'));
          if (item.includes('ظ')) results.push(item.replace(/ظ/g, 'ض'));
          if (item.includes('ث')) {
            results.push(item.replace(/ث/g, 'ت'));
            results.push(item.replace(/ث/g, 'س'));
          }
          if (item.includes('ذ')) {
            results.push(item.replace(/ذ/g, 'د'));
            results.push(item.replace(/ذ/g, 'ز'));
          }
          if (item.includes('ص')) results.push(item.replace(/ص/g, 'س'));
          if (item.includes('س')) results.push(item.replace(/س/g, 'ص'));
          
          // Additional Iraqi dialect character swaps
          if (item.includes('غ')) results.push(item.replace(/غ/g, 'ق')); // Common in some Iraqi regions
          if (item.includes('ق') && !results.includes(item.replace(/ق/g, 'غ'))) results.push(item.replace(/ق/g, 'غ'));
          
          // Hamza on Yeh/Waw common variations
          if (item.includes('ئ')) results.push(item.replace(/ئ/g, 'ي'));
          if (item.includes('ؤ')) results.push(item.replace(/ؤ/g, 'و'));
          if (item.includes('ي') && !results.includes(item.replace(/ي/g, 'ئ'))) results.push(item.replace(/ي/g, 'ئ'));
          if (item.includes('و') && !results.includes(item.replace(/و/g, 'ؤ'))) results.push(item.replace(/و/g, 'ؤ'));
        }

        return Array.from(new Set(results));
      };

      // 1.5 Word-level Iraqi dialect mappings
      const dialectMappings = {
        'شلون': ['كيف', 'حالة'],
        'خوش': ['جيد', 'ممتاز', 'اصلي'],
        'هوايه': ['كثير', 'جدا'],
        'ماكو': ['ليس', 'لا يوجد'],
        'اكو': ['يوجد', 'موجود'],
        'هسه': ['الان', 'حاليا'],
        'اريد': ['اطلب', 'احتاج'],
        'بلاش': ['مجاني', 'رخيص'],
        'هدوم': ['ملابس', 'ازياء'],
        'قندرة': ['حذاء'],
        'جواتي': ['حذاء', 'رياضي'],
        'دشدشة': ['ثوب', 'ملابس'],
        'عركية': ['قبعة'],
        'ياخة': ['ياقة', 'قميص']
      };

      if (dialectMappings[base]) {
        dialectMappings[base].forEach(m => variations.add(m));
      }
      
      // Check if word is a standard word that has an Iraqi dialect equivalent
      Object.entries(dialectMappings).forEach(([dialect, standards]) => {
        if (standards.includes(base)) {
          variations.add(dialect);
        }
      });

      // Apply character variations
      generateCharVariations(word).forEach(v => variations.add(v));
      generateCharVariations(base).forEach(v => variations.add(v));

      // 2. Handle Common Prefixes (ال، و، ب)
      const currentTermsForPrefix = Array.from(variations);
      currentTermsForPrefix.forEach(v => {
        // Al- (ال)
        if (v.startsWith('ال')) {
          variations.add(v.substring(2));
        } else if (v.length > 2) {
          variations.add('ال' + v);
        }
        
        // W- (و) conjunction
        if (v.startsWith('و') && v.length > 3) {
          variations.add(v.substring(1));
        }
        
        // Bi- (ب) preposition (common in Iraqi)
        if (v.startsWith('ب') && v.length > 3) {
          variations.add(v.substring(1));
        }
      });

      // 3. Handle Common Suffixes (Plurals, Gender, Possessives)
      const currentTermsForSuffix = Array.from(variations);
      currentTermsForSuffix.forEach(v => {
        // Feminine/Adjective suffixes: 'يه', 'ية' -> 'ي'
        if (v.endsWith('يه') || v.endsWith('ية')) {
          variations.add(v.slice(0, -2));
          variations.add(v.slice(0, -2) + 'ي');
          variations.add(v.slice(0, -1)); // Keep base but change teh to heh/vice versa via variations
        }
        
        // 'ي' -> 'يه', 'ية' (e.g., رجالي -> رجاليه)
        if (v.endsWith('ي')) {
          variations.add(v + 'ه');
          variations.add(v + 'ة');
        }

        // Plural suffixes: 'ات', 'ون', 'ين', 'ية'
        const pluralSuffixes = ['ات', 'ون', 'ين', 'ية'];
        for (const suffix of pluralSuffixes) {
          if (v.endsWith(suffix) && v.length > suffix.length + 2) {
            variations.add(v.slice(0, -suffix.length));
          }
        }

        // Iraqi specific plural/possessive or common endings
        // 'ات' is very common for plurals in Iraq even for masculine items sometimes in slang
        if (v.length > 3 && !v.endsWith('ات')) {
          variations.add(v + 'ات');
        }
        
        // Removing common Iraqi possessive 'نا' (our) or 'كم' (your) - rare in search but possible
        if (v.endsWith('نا') && v.length > 4) variations.add(v.slice(0, -2));
        if (v.endsWith('كم') && v.length > 4) variations.add(v.slice(0, -2));
      });

      // 4. Final step: ensure all generated terms are normalized to avoid duplicates and missing matches
      const finalVariations = new Set();
      variations.forEach(v => {
        if (v && v.length > 1) {
          finalVariations.add(v);
          finalVariations.add(normalize(v));
        }
      });

      const finalArray = Array.from(finalVariations);
      if (finalArray.length > 80) {
        return finalArray.slice(0, 80);
      }
      return finalArray;
    };

    // Better keyword extraction: handle slashes and remove punctuation
    const useReducedSearch = isArabicQuery || keywords.length > 3 || cleanQuery.length > 24;
    
    // Generate all search terms including variations
    const allSearchTerms = new Set([q, cleanQuery]);
    keywords.forEach(k => {
      if (useReducedSearch) {
        allSearchTerms.add(k);
      } else {
        getVariations(k).forEach(v => allSearchTerms.add(v));
      }
    });

    let searchTermsArray = Array.from(allSearchTerms);
    const maxTerms = useReducedSearch ? (isArabicQuery ? 30 : 40) : 120;
    if (searchTermsArray.length > maxTerms) {
      searchTermsArray = searchTermsArray.slice(0, maxTerms);
    }
    log('keyword_terms_ready', { useReducedSearch, termsCount: searchTermsArray.length });

    const normalizeForSearch = (text) => 
      (text || '').toLowerCase()
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/[گ]/g, 'ق')
          .replace(/[چ]/g, 'ج')
          .replace(/ناسائ/g, 'نسائ')
          .replace(/ناسا/g, 'نسا')
          .replace(/[\u064B-\u0652]/g, '')
          .replace(/[\\\/.,()!?;:]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

    const normalizedQ = normalizeForSearch(q);
    const stopWords = ['ال', 'في', 'من', 'على', 'مع', 'لـ', 'بـ', 'و', 'عن', 'الى', 'او'];
    const normalizedKeywords = keywords
      .map(k => normalizeForSearch(k))
      .filter(k => k.length > 1 && !stopWords.includes(k));

    const scoreAndSortProducts = (products) => {
      const scoringStart = Date.now();
      const scoredProducts = products.map(product => {
        let score = 0;
        const name = normalizeForSearch(product.name);
        const chineseName = normalizeForSearch(product.chineseName);
        const desc = normalizeForSearch(product.description);
        const specs = normalizeForSearch(product.specs);
        
        if (name === normalizedQ) score += 10000;
        if (chineseName === normalizedQ) score += 8000;
        
        if (name.includes(normalizedQ)) score += 5000;
        if (chineseName && chineseName.includes(normalizedQ)) score += 4000;
        if (desc.includes(normalizedQ)) score += 2000;
        if (specs && specs.includes(normalizedQ)) score += 1500;
        
        let nameMatches = 0;
        let otherMatches = 0;
        
        normalizedKeywords.forEach((k, idx) => {
          if (name.includes(k)) {
            nameMatches++;
            score += 600; 
            if (name.startsWith(k)) score += 200;
            
            if (idx < normalizedKeywords.length - 1) {
              const nextK = normalizedKeywords[idx + 1];
              if (name.includes(k + ' ' + nextK) || name.includes(k + nextK)) {
                score += 1200;
              }
            }
          }

          if (chineseName && chineseName.includes(k)) {
            score += 400;
            otherMatches++;
          }

          if (desc.includes(k)) {
            score += 50;
            otherMatches++;
          }
          if (specs && specs.includes(k)) {
            score += 40;
            otherMatches++;
          }
        });

        const nameCoverage = normalizedKeywords.length > 0 ? nameMatches / normalizedKeywords.length : 0;
        score += nameCoverage * 4000;

        const totalUniqueMatches = new Set();
        normalizedKeywords.forEach(k => {
          if (name.includes(k) || (chineseName && chineseName.includes(k)) || desc.includes(k) || (specs && specs.includes(k))) {
            totalUniqueMatches.add(k);
          }
        });
        const totalCoverage = normalizedKeywords.length > 0 ? totalUniqueMatches.size / normalizedKeywords.length : 0;
        score += totalCoverage * 2000;

        if (normalizedKeywords.length >= 2 && totalCoverage >= 0.8) {
          score += 1000;
        }

        if (product.id.toString() === q.trim()) score += 15000;

        return { ...product, searchScore: score };
      });
      log('keyword_scoring_done', { scored: scoredProducts.length, scoringMs: Date.now() - scoringStart });
      return scoredProducts
        .filter(p => p.searchScore > 0)
        .sort((a, b) => {
          if (b.searchScore !== a.searchScore) {
            return b.searchScore - a.searchScore;
          }
          return b.id - a.id;
        });
    };

    if (isArabicQuery && useReducedSearch) {
      const buildArabicVariants = (term) => {
        const variations = new Set();
        const base = normalizeForSearch(term);
        if (base) variations.add(base);
        if (base.endsWith('ه')) variations.add(base.slice(0, -1) + 'ة');
        if (base.endsWith('ة')) variations.add(base.slice(0, -1) + 'ه');
        if (base.endsWith('ه') || base.endsWith('ة')) {
          const stem = base.slice(0, -1);
          if (stem.length > 1) variations.add(stem + 'ات');
        }
        if (base.endsWith('ات')) {
          const stem = base.slice(0, -2);
          if (stem.length > 1) {
            variations.add(stem + 'ه');
            variations.add(stem + 'ة');
            variations.add(stem);
          }
        }
        return Array.from(variations).filter(v => v.length > 1);
      };

      const seedTerms = Array.from(new Set([cleanQuery, ...keywords])).filter(t => t && t.length > 1).slice(0, 2);
      const prefixTerms = Array.from(new Set(seedTerms.flatMap(buildArabicVariants))).slice(0, 6);
      if (prefixTerms.length > 0) {
        const prefixStart = Date.now();
        const prefixProducts = await prisma.product.findMany({
          where: {
            status: 'PUBLISHED',
            isActive: true,
            OR: prefixTerms.map(term => ({ name: { startsWith: term } }))
          },
          include: { 
            variants: { select: productVariantSelect },
            images: {
              take: 1,
              orderBy: { order: 'asc' }
            }
          },
          take: Math.max(limitNum * 3, 60)
        });
        log('arabic_prefix_done', { returned: prefixProducts.length, dbMs: Date.now() - prefixStart, termsCount: prefixTerms.length });
        if (prefixProducts.length > 0) {
          const sortedProducts = scoreAndSortProducts(prefixProducts);
          const total = sortedProducts.length;
          const paginatedProducts = sortedProducts.slice(0, limitNum);
          log('keyword_done', { total, returned: paginatedProducts.length });
          return res.json({ 
            products: paginatedProducts.map(p => applyDynamicPricingToProduct(p, shippingRates)), 
            total,
            hasMore: total > limitNum,
            engine: 'db'
          });
        }

        const containsStart = Date.now();
        const containsProducts = await prisma.product.findMany({
          where: {
            status: 'PUBLISHED',
            isActive: true,
            OR: prefixTerms.map(term => ({ name: { contains: term } }))
          },
          include: { 
            variants: { select: productVariantSelect },
            images: {
              take: 1,
              orderBy: { order: 'asc' }
            }
          },
          take: Math.max(limitNum * 3, 60)
        });
        log('arabic_contains_done', { returned: containsProducts.length, dbMs: Date.now() - containsStart, termsCount: prefixTerms.length });
        if (containsProducts.length > 0) {
          const sortedProducts = scoreAndSortProducts(containsProducts);
          const total = sortedProducts.length;
          const paginatedProducts = sortedProducts.slice(0, limitNum);
          log('keyword_done', { total, returned: paginatedProducts.length });
          return res.json({ 
            products: paginatedProducts.map(p => applyDynamicPricingToProduct(p, shippingRates)), 
            total,
            hasMore: total > limitNum,
            engine: 'db'
          });
        }
      }
    }

    const searchFields = isArabicQuery && useReducedSearch ? ['name'] : ['name', 'specs'];
    const keywordFetchStart = Date.now();
    const products = await prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        isActive: true,
        OR: [
          { name: { contains: q } },
          ...searchTermsArray.flatMap(term =>
            searchFields.map(field => ({ [field]: { contains: term } }))
          )
        ]
      },
      include: { 
        variants: { select: productVariantSelect },
        images: {
          take: 1,
          orderBy: { order: 'asc' }
        }
      },
      take: useReducedSearch ? (isArabicQuery ? 120 : 200) : 500
    });
    log('keyword_products_done', { returned: products.length, dbMs: Date.now() - keywordFetchStart });

    const sortedProducts = scoreAndSortProducts(products);
    const total = sortedProducts.length;
    const paginatedProducts = sortedProducts.slice(skip, skip + limitNum);

    log('keyword_done', { total, returned: paginatedProducts.length });
    res.json({ 
      products: paginatedProducts.map(p => applyDynamicPricingToProduct(p, shippingRates)), 
      total,
      hasMore: skip + limitNum < total,
      engine: 'db'
    });
  } catch (error) {
    console.error('Search error:', error);
    console.log(`[SEARCH ${typeof requestId === 'string' ? requestId : 'unknown'}] error`, { message: error?.message, name: error?.name });
    res.status(500).json({ error: 'Search failed' });
  }
});

// ADMIN: Create Product
// ADMIN: Update Product
app.put('/api/products/:id', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, chineseName, price, basePriceIQD, description, image, 
      isFeatured, isActive, status, purchaseUrl, videoUrl, 
      specs, images, detailImages,
      weight, length, width, height, domesticShippingFee, deliveryTime
    } = req.body;
    
    // Handle main image conversion if needed
    let finalMainImage = image;
    if (image && typeof image === 'string' && image.startsWith('data:image')) {
      finalMainImage = await convertToWebP(image);
    }

    // Handle additional images conversion in parallel
    let processedGalleryImages = images;
    if (images && Array.isArray(images)) {
      processedGalleryImages = await Promise.all(images.map(async (img) => {
        const url = typeof img === 'string' ? img : img.url;
        if (url && typeof url === 'string' && url.startsWith('data:image')) {
          const webpUrl = await convertToWebP(url);
          return typeof img === 'string' ? webpUrl : { ...img, url: webpUrl };
        }
        return img;
      }));
    }

    let processedDetailImages = detailImages;
    if (detailImages && Array.isArray(detailImages)) {
      processedDetailImages = await Promise.all(detailImages.map(async (img) => {
        const url = typeof img === 'string' ? img : img.url;
        if (url && typeof url === 'string' && url.startsWith('data:image')) {
          const webpUrl = await convertToWebP(url);
          return typeof img === 'string' ? webpUrl : { ...img, url: webpUrl };
        }
        return img;
      }));
    }

    const updateData = {
      name,
      chineseName,
      price: price !== undefined ? parseFloat(price) : undefined,
      basePriceIQD: basePriceIQD !== undefined ? (basePriceIQD ? parseFloat(basePriceIQD) : null) : undefined,
      description,
      image: finalMainImage,
      purchaseUrl,
      videoUrl,
      isFeatured: isFeatured !== undefined ? !!isFeatured : undefined,
      isActive: isActive !== undefined ? !!isActive : undefined,
      status: status !== undefined ? status : undefined,
      specs: specs !== undefined ? (specs && typeof specs === 'object' ? JSON.stringify(specs) : specs) : undefined,
      weight: weight !== undefined ? (weight === '' ? null : parseFloat(weight)) : undefined,
      length: length !== undefined ? (length === '' ? null : parseFloat(length)) : undefined,
      width: width !== undefined ? (width === '' ? null : parseFloat(width)) : undefined,
      height: height !== undefined ? (height === '' ? null : parseFloat(height)) : undefined,
      domesticShippingFee: domesticShippingFee !== undefined ? (domesticShippingFee === '' ? null : parseFloat(domesticShippingFee)) : undefined,
      deliveryTime: deliveryTime !== undefined ? (deliveryTime === '' ? null : deliveryTime) : undefined
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const product = await prisma.$transaction(async (tx) => {
      console.log('[Update Product] Updating ID:', id, 'Data:', updateData);
      const updated = await tx.product.update({
        where: { id: safeParseId(id) },
        data: updateData
      });

      // Handle images update if provided
      if ((processedGalleryImages && Array.isArray(processedGalleryImages)) || (processedDetailImages && Array.isArray(processedDetailImages))) {
        console.log('[Update Product] Updating images for product:', id);
        
        // Simple approach: delete existing and recreate
        await tx.productImage.deleteMany({
          where: { productId: safeParseId(id) }
        });

        const imagesToCreate = [];
        
        if (processedGalleryImages && Array.isArray(processedGalleryImages)) {
          processedGalleryImages.forEach((img, idx) => {
            imagesToCreate.push({
              productId: safeParseId(id),
              url: typeof img === 'string' ? img : img.url,
              type: typeof img === 'string' ? 'GALLERY' : (img.type || 'GALLERY'),
              order: typeof img === 'string' ? idx : (img.order || idx)
            });
          });
        }
        
        if (processedDetailImages && Array.isArray(processedDetailImages)) {
          processedDetailImages.forEach((img, idx) => {
            imagesToCreate.push({
              productId: safeParseId(id),
              url: typeof img === 'string' ? img : img.url,
              type: 'DETAIL',
              order: (processedGalleryImages ? processedGalleryImages.length : 0) + idx
            });
          });
        }
        
        if (imagesToCreate.length > 0) {
          await tx.productImage.createMany({
            data: imagesToCreate
          });
        }
      }

      return updated;
    });

    res.json(product);
  } catch (error) {
    console.error('[Update Product] Error:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// ADMIN: Delete Product
app.delete('/api/products/:id', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  try {
    const { id } = req.params;
    const productId = safeParseId(id);

    // Delete related records first (Prisma doesn't have cascade delete for all relations by default)
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { productId } }), // Delete OrderItems first to satisfy foreign key constraints
      prisma.productImage.deleteMany({ where: { productId } }),
      prisma.productOption.deleteMany({ where: { productId } }),
      prisma.productVariant.deleteMany({ where: { productId } }),
      prisma.cartItem.deleteMany({ where: { productId } }),
      prisma.wishlistItem.deleteMany({ where: { productId } }),
      prisma.review.deleteMany({ where: { productId } }),
    ]);

    await prisma.product.delete({ where: { id: productId } });

    await logActivity(
      req.user.id,
      req.user.name,
      'DELETE_PRODUCT',
      { id: productId },
      'PRODUCT'
    );

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Bulk delete products
// Bulk update products status (isActive)


// ADMIN: Trigger AI dimension estimation for products without them
app.post('/api/admin/products/estimate-dimensions', authenticateToken, isAdmin, hasPermission('manage_products'), async (req, res) => {
  res.json({ success: true, message: 'AI dimension estimation is disabled' });
});

// --- Addresses routes ---
app.get('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; 
    const addresses = await prisma.address.findMany({
      where: { userId }
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

app.post('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, name, phone, street, city, buildingNo, floorNo, isDefault } = req.body;
    
    console.log('Creating address for user:', userId, 'Data:', { type, name, phone, street, city, buildingNo, floorNo, isDefault });

    // Check if address already exists for this user to avoid duplicates
    const existing = await prisma.address.findFirst({
      where: {
        userId,
        street,
        city,
        phone
      }
    });

    if (existing) {
      console.log('Address already exists, returning existing:', existing.id);
      return res.status(200).json(existing);
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        type: type || 'المنزل',
        name,
        phone,
        street,
        city,
        buildingNo: buildingNo || '',
        floorNo: floorNo || '',
        isDefault: !!isDefault
      }
    });
    res.status(201).json(address);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

app.delete('/api/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Ensure address belongs to user
    const address = await prisma.address.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!address || address.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.address.delete({
      where: { id: safeParseId(id) }
    });

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

app.put('/api/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { type, name, phone, street, city, buildingNo, floorNo, isDefault } = req.body;

    // Ensure address belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!existingAddress || existingAddress.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id: safeParseId(id) },
      data: {
        type,
        name,
        phone,
        street,
        city,
        buildingNo,
        floorNo,
        isDefault: !!isDefault
      }
    });
    res.json(updatedAddress);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// --- Cart routes ---
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { 
        product: true,
        variant: { select: productVariantSelect }
      }
    });
    res.json(cartItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1, variantId, selectedOptions, shippingMethod = 'air' } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const pId = typeof productId === 'number' ? productId : parseInt(productId);
    let vId = variantId ? (typeof variantId === 'number' ? variantId : parseInt(variantId)) : null;
    if (isNaN(vId)) vId = null;
    const qty = parseInt(quantity) || 1;
    
    const sOptions = typeof selectedOptions === 'object' ? JSON.stringify(selectedOptions) : (selectedOptions || null);

    if (!pId || isNaN(pId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await prisma.product.findUnique({
      where: { id: pId },
      include: { variants: { select: productVariantSelect } }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const variant = vId ? product.variants.find(v => v.id === vId) : null;

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    // Calculate inclusive price (base price + shipping)
    const dbPrice = variant ? variant.price : product.price;
    const adjustedBasePrice = getAdjustedPrice(
      dbPrice,
      variant?.weight || product.weight,
      variant?.length || product.length);
    const shippingFee = await calculateProductShipping(product, shippingMethod, true, variant);
    const inclusivePrice = Math.ceil((adjustedBasePrice + shippingFee) / 10) * 10;

    // Use a more robust approach since Prisma upsert doesn't like nulls in compound unique keys
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId: pId,
        variantId: vId,
        selectedOptions: sOptions,
        shippingMethod: shippingMethod
      }
    });

    let cartItem;
    if (existingItem) {
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { 
          quantity: existingItem.quantity + qty,
          price: inclusivePrice
        },
        include: { 
          product: true,
          variant: { select: productVariantSelect }
        }
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          userId,
          productId: pId,
          variantId: vId,
          selectedOptions: sOptions,
          quantity: qty,
          price: inclusivePrice,
          shippingMethod: shippingMethod
        },
        include: { 
          product: true,
          variant: { select: productVariantSelect }
        }
      });
    }
    
    res.json(cartItem);
  } catch (error) {
    console.error('Add to cart error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?.id
    });
    res.status(500).json({ error: `Failed to add to cart: ${error.message}` });
  }
});

app.put('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const qty = parseInt(req.body.quantity);
    const userId = req.user.id;
    
    if (isNaN(qty)) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    
    // Ensure item belongs to user
    const itemId = safeParseId(id);
    const existingItem = await prisma.cartItem.findUnique({
      where: { id: itemId }
    });

    if (!existingItem || existingItem.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (qty <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
      return res.json({ message: 'Item removed from cart' });
    }

    const cartItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: qty },
      include: { 
        product: true,
        variant: { select: productVariantSelect }
      }
    });
    res.json(cartItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Ensure item belongs to user
    const existingItem = await prisma.cartItem.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!existingItem || existingItem.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.cartItem.delete({
      where: { id: safeParseId(id) }
    });
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

// --- Order routes ---
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId, shippingMethod = 'air', paymentMethod = 'zain_cash', couponCode, items: bodyItems } = req.body;

    if (!addressId) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // 1. Get cart items with variants (prefer bodyItems if provided, else fallback to DB)
    let cartItems;
    if (bodyItems && Array.isArray(bodyItems) && bodyItems.length > 0) {
      // If items are passed in body, we need to ensure they have product/variant data
      // For security and data integrity, we should ideally fetch the latest prices from DB
      cartItems = await Promise.all(bodyItems.map(async (item) => {
        const product = await prisma.product.findUnique({ where: { id: parseInt(item.productId) } });
        let variant = null;
        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({ where: { id: parseInt(item.variantId) }, select: productVariantSelect });
        }
        return {
          ...item,
          productId: parseInt(item.productId),
          variantId: item.variantId ? parseInt(item.variantId) : null,
          product,
          variant
        };
      }));
    } else {
      cartItems = await prisma.cartItem.findMany({
        where: { 
          userId,
          shippingMethod: shippingMethod // Filter by shipping method in fallback too
        },
        include: { 
          product: true,
          variant: { select: productVariantSelect }
        }
      });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const shippingRates = {
      airShippingRate: storeSettings?.airShippingRate,
      seaShippingRate: storeSettings?.seaShippingRate,
      airShippingMinFloor: storeSettings?.airShippingMinFloor
    };

    // 2. Prepare items with correct prices (adjusted based on shipping method)
    const processedItems = cartItems.map(item => {
      const product = item.product;
      const variant = item.variant;

      if (!product) {
        throw new Error(`Product not found for item with ID ${item.id}`);
      }

      const dbPrice = variant?.price || product.price || 0;
      const method = item.shippingMethod || shippingMethod || 'air';
      
      const adjustedPrice = getAdjustedPrice(
        dbPrice,
        variant?.weight || product.weight,
        variant?.length || product.length);
      
      // Ensure selectedOptions is a string for Prisma
      let sOptions = item.selectedOptions;
      if (sOptions && typeof sOptions === 'object') {
        sOptions = JSON.stringify(sOptions);
      }

      return { 
        ...item, 
        price: adjustedPrice,
        selectedOptions: sOptions
      };
    });

    // 3. Calculate international shipping fee for the entire order
    const shippingInfo = await calculateOrderShipping(processedItems, shippingMethod);
    
    // Check minimum order thresholds
    if (!shippingInfo.isThresholdMet) {
      return res.status(400).json({ 
        error: `الحد الأدنى للطلب هو ${shippingInfo.threshold?.toLocaleString() || '30,000'} د.ع. مجموع طلبك الحالي هو ${shippingInfo.subtotal.toLocaleString()} د.ع.`
      });
    }

    const internationalShippingFee = shippingInfo.fee;

    // 4. Calculate subtotal using item prices
    const subtotal = processedItems.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // 5. Handle Coupon
    let discountAmount = 0;
    let couponId = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode, isActive: true }
      });

      if (coupon) {
        // Check if user has already used this coupon
        const usage = await prisma.couponUsage.findFirst({
          where: {
            couponId: coupon.id,
            userId: userId
          }
        });

        const now = new Date();
        const isExpired = now < coupon.startDate || now > coupon.endDate;
        const isBelowMinAmount = subtotal < coupon.minOrderAmount;
        const isAlreadyUsedByUser = !!usage;
        const isPrivateAndUsed = !coupon.isPublic && coupon.usageCount >= 1;
        const isLimitReached = coupon.usageLimit && coupon.usageCount >= coupon.usageLimit;

        if (!isExpired && !isBelowMinAmount && !isAlreadyUsedByUser && !isPrivateAndUsed && !isLimitReached) {
          if (coupon.discountType === 'PERCENTAGE') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
              discountAmount = coupon.maxDiscount;
            }
          } else {
            discountAmount = coupon.discountValue;
          }
          couponId = coupon.id;
        }
      }
    }

    // 6. Calculate Final Total
    const total = Math.ceil((subtotal + internationalShippingFee - discountAmount) / 10) * 10;

    console.log('[Order Creation] Data:', {
      userId,
      addressId: safeParseId(addressId),
      total,
      discountAmount,
      couponId,
      shippingMethod,
      paymentMethod,
      internationalShippingFee,
      itemCount: processedItems.length
    });

    // 6. Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      try {
        // Create order
        const newOrder = await tx.order.create({
          data: {
            userId,
            addressId: safeParseId(addressId),
            total,
            discountAmount,
            couponId,
            status: 'PENDING',
            shippingMethod,
            paymentMethod,
            internationalShippingFee,
            items: {
              create: processedItems.map(item => ({
                productId: item.productId,
                variantId: item.variantId,
                selectedOptions: item.selectedOptions,
                quantity: item.quantity,
                price: item.price,
                shippingMethod: item.shippingMethod || 'air'
              }))
            }
          },
          include: { 
            items: {
              include: {
                product: true,
                variant: { select: productVariantSelect }
              }
            } 
          }
        });

        // Handle Coupon Usage Tracking
        if (couponId) {
          // Increment usage count
          await tx.coupon.update({
            where: { id: couponId },
            data: { usageCount: { increment: 1 } }
          });

          // Record usage for this user
          await tx.couponUsage.create({
            data: {
              couponId: couponId,
              userId: userId
            }
          });
        }

        // 7. Clear cart items for the specific shipping method that was ordered
        await tx.cartItem.deleteMany({ 
          where: { 
            userId,
            shippingMethod: shippingMethod 
          } 
        });

        return newOrder;
      } catch (txError) {
        console.error('[Transaction Error Details]:', txError);
        // Write error to a temporary file for debugging if console is not accessible
        fs.appendFileSync('order_error.log', `[${new Date().toISOString()}] Transaction Error: ${txError.message}\n${txError.stack}\n`);
        throw txError;
      }
    });

    // Notify admins of new order
    io.to('admin_notifications').emit('new_order', order);

    // Create notification for user
    await createUserNotification(
      userId,
      'تم استلام طلبك بنجاح! 🎉',
      `طلبك رقم #${order.id} قيد المراجعة الآن. سنقوم بإبلاغك فور تحديث حالته.`,
      'order',
      'shopping_bag',
      'blue',
      `/shipping-tracking?id=${order.id}`
    );

    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    fs.appendFileSync('order_error.log', `[${new Date().toISOString()}] Global Error: ${error.message}\n${error.stack}\n`);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: { 
          include: { 
            product: true,
            variant: { select: productVariantSelect }
          } 
        },
        address: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const order = await prisma.order.findUnique({
      where: { id: safeParseId(id) },
      include: {
        items: { 
          include: { 
            product: true,
            variant: { select: productVariantSelect }
          } 
        },
        address: true
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.put('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: safeParseId(id) }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'PENDING') return res.status(400).json({ error: 'Only pending orders can be cancelled' });

    const updatedOrder = await prisma.order.update({
      where: { id: safeParseId(id) },
      data: { status: 'CANCELLED' }
    });

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

app.put('/api/orders/:id/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const orderId = safeParseId(id);

    console.log(`[Payment] Confirmation request for order ${id} from user ${userId}`);

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      console.log(`[Payment] Order ${id} not found`);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.userId !== userId) {
      console.log(`[Payment] Order ${id} does not belong to user ${userId}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update order status to PREPARING (or a status that indicates payment is being verified)
    // We'll use PREPARING as it's the next logical step after AWAITING_PAYMENT
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PREPARING' }
    });

    console.log(`[Payment] Order ${id} status updated to PREPARING`);

    // Notify admins via socket
    io.to('admin_notifications').emit('order_status_update', {
      id: orderId,
      status: 'PREPARING',
      message: `تم استلام إشعار دفع للطلب #${id}`
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('[Payment] Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// --- Wishlist routes ---
/* Replaced by local storage
app.get('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true }
    });
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});
*/

// --- Review routes ---
app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        productId: safeParseId(id),
        userId
      },
      include: { user: { select: { name: true } } }
    });

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = safeParseId(id);
    
    // Get reviews from the review table
    const dbReviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Get product to check for reviews in specs field and aiMetadata and scrapedReviews
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { specs: true, aiMetadata: true, scrapedReviews: true }
    });
    
    let importedReviews = [];

    // Extract reviews from new 'scrapedReviews' field (Primary Source)
    if (product?.scrapedReviews && Array.isArray(product.scrapedReviews)) {
      product.scrapedReviews.forEach((r, i) => {
        importedReviews.push({
          id: -3000 - i, // Different ID range to avoid conflicts
          rating: 5,
          comment: r.comment || 'صور من تقييمات العملاء',
          createdAt: new Date().toISOString(),
          user: { name: r.name || 'تقييمات المتجر' },
          images: r.photos || r.images || []
        });
      });
    }
    
    // Extract reviews from aiMetadata (Legacy Scraped Reviews) - Only if no new reviews
    if (importedReviews.length === 0 && product?.aiMetadata?.reviews && Array.isArray(product.aiMetadata.reviews)) {
      product.aiMetadata.reviews.forEach((r, i) => {
        if (r.images && r.images.length > 0) {
          importedReviews.push({
            id: -2000 - i,
            rating: 5,
            comment: 'صور من تقييمات العملاء',
            createdAt: new Date().toISOString(),
            user: { name: 'تقييمات المتجر' },
            images: r.images
          });
        }
      });
    }

    // Extract reviews from specs field if they exist
    if (product && product.specs && typeof product.specs === 'string' && product.specs.includes('---REVIEW_SUMMARY---')) {
      try {
        const parts = product.specs.split('---REVIEW_SUMMARY---');
        if (parts.length >= 2) {
          const reviewSummary = JSON.parse(parts[1].trim());
          
          // Handle both formats: direct reviews array and detailedReviews format
          let rawReviews = [];
          if (reviewSummary.reviews && Array.isArray(reviewSummary.reviews)) {
            rawReviews = reviewSummary.reviews;
          } else if (reviewSummary.tags && Array.isArray(reviewSummary.tags) && reviewSummary.tags.length > 0 && typeof reviewSummary.tags[0] === 'object' && (reviewSummary.tags[0].user || reviewSummary.tags[0].comment)) {
            // Sometimes reviews are incorrectly saved in tags during bulk import
            rawReviews = reviewSummary.tags;
          }

          if (rawReviews.length > 0) {
            // Direct reviews format: "reviews": [ { "user": "...", "comment": "..." } ]
            const newReviews = rawReviews.map((review, index) => ({
              id: -index - 1, // Negative IDs to distinguish from database reviews
              rating: 5, // Default rating for imported reviews
              comment: review.comment || '',
              createdAt: new Date().toISOString(),
              user: { name: review.user || 'عميل' },
              images: []
            }));
            importedReviews = [...importedReviews, ...newReviews];
          } else if (reviewSummary.detailedReviews && Array.isArray(reviewSummary.detailedReviews)) {
            // detailedReviews format (legacy)
            const newReviews = reviewSummary.detailedReviews.map((review, index) => ({
              id: -index - 1, // Negative IDs to distinguish from database reviews
              rating: 5, // Default rating for imported reviews
              comment: review.comments ? (Array.isArray(review.comments) ? review.comments.join(' ') : review.comments) : '',
              createdAt: new Date().toISOString(),
              user: { name: review.user || 'عميل' },
              images: review.images || []
            }));
            importedReviews = [...importedReviews, ...newReviews];
          }
        }
      } catch (parseError) {
        console.error('Failed to parse review summary from specs:', parseError);
      }
    }
    
    // Combine database reviews with imported reviews
    const allReviews = [...dbReviews, ...importedReviews];
    
    res.json(allReviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/* Replaced by local storage
app.post('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;
    
    const wishlistItem = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: { userId, productId: safeParseId(productId) }
      },
      update: {}, // No update needed if already exists
      create: {
        userId,
        productId: safeParseId(productId)
      },
      include: { product: true }
    });
    res.json(wishlistItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

app.delete('/api/wishlist/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    
    await prisma.wishlistItem.delete({
      where: {
        userId_productId: { userId, productId: safeParseId(productId) }
      }
    });
    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});
*/

// --- Admin: Banners ---
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

app.post('/api/admin/banners', authenticateToken, isAdmin, hasPermission('manage_content'), async (req, res) => {
  try {
    const { title, subtitle, image, link, order, isActive } = req.body;
    const banner = await prisma.banner.create({
      data: { title, subtitle, image, link, order: parseInt(order) || 0, isActive: !!isActive }
    });
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

app.put('/api/admin/banners/:id', authenticateToken, isAdmin, hasPermission('manage_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image, link, order, isActive } = req.body;
    const banner = await prisma.banner.update({
      where: { id: safeParseId(id) },
      data: { title, subtitle, image, link, order: parseInt(order) || 0, isActive: !!isActive }
    });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

app.delete('/api/admin/banners/:id', authenticateToken, isAdmin, hasPermission('manage_content'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.banner.delete({ where: { id: safeParseId(id) } });
    res.json({ message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

// --- Admin: Settings ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await prisma.storeSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    });
    res.json(settings);
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/admin/settings', authenticateToken, isAdmin, hasPermission('manage_settings'), async (req, res) => {
  try {
    const { 
      storeName, 
      contactEmail, 
      contactPhone, 
      currency, 
      socialLinks, 
      footerText,
      airShippingRate,
      seaShippingRate,
      airShippingMinFloor,
      airShippingThreshold,
      seaShippingThreshold
    } = req.body;

    const previousSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    const oldRates = {
      airShippingRate: previousSettings?.airShippingRate ?? 15400,
      seaShippingRate: previousSettings?.seaShippingRate ?? 182000,
      airShippingMinFloor: previousSettings?.airShippingMinFloor ?? 0
    };

    const parseFiniteFloat = (val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const n = typeof val === 'number' ? val : parseFloat(val);
      return Number.isFinite(n) ? n : undefined;
    };

    const updateData = {
      ...(storeName !== undefined ? { storeName } : {}),
      ...(contactEmail !== undefined ? { contactEmail } : {}),
      ...(contactPhone !== undefined ? { contactPhone } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(footerText !== undefined ? { footerText } : {}),
      ...(socialLinks !== undefined ? { socialLinks: typeof socialLinks === 'object' ? JSON.stringify(socialLinks) : socialLinks } : {})
    };

    const parsedAirShippingRate = parseFiniteFloat(airShippingRate);
    const parsedSeaShippingRate = parseFiniteFloat(seaShippingRate);
    const parsedAirMinFloor = parseFiniteFloat(airShippingMinFloor);
    const parsedAirThreshold = parseFiniteFloat(airShippingThreshold);
    const parsedSeaThreshold = parseFiniteFloat(seaShippingThreshold);

    if (parsedAirShippingRate !== undefined) updateData.airShippingRate = parsedAirShippingRate;
    if (parsedSeaShippingRate !== undefined) updateData.seaShippingRate = parsedSeaShippingRate;
    if (parsedAirMinFloor !== undefined) updateData.airShippingMinFloor = parsedAirMinFloor;
    if (parsedAirThreshold !== undefined) updateData.airShippingThreshold = parsedAirThreshold;
    if (parsedSeaThreshold !== undefined) updateData.seaShippingThreshold = parsedSeaThreshold;
    
    const settings = await prisma.storeSettings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { 
        id: 1, 
        storeName, 
        contactEmail, 
        contactPhone, 
        currency, 
        socialLinks: typeof socialLinks === 'object' ? JSON.stringify(socialLinks) : socialLinks, 
        footerText,
        airShippingRate: parsedAirShippingRate ?? 15400,
        seaShippingRate: parsedSeaShippingRate ?? 182000,
        airShippingMinFloor: parsedAirMinFloor ?? 0,
        airShippingThreshold: parsedAirThreshold ?? 30000,
        seaShippingThreshold: parsedSeaThreshold ?? 30000
      }
    });

    const newRates = {
      airShippingRate: settings.airShippingRate,
      seaShippingRate: settings.seaShippingRate,
      airShippingMinFloor: settings.airShippingMinFloor
    };
    const ratesChanged =
      oldRates.airShippingRate !== newRates.airShippingRate ||
      oldRates.seaShippingRate !== newRates.seaShippingRate ||
      oldRates.airShippingMinFloor !== newRates.airShippingMinFloor;

    if (ratesChanged) {
      recalculateExistingProductPrices(oldRates, newRates).catch((e) => {
        console.error('[Settings] Price recalculation failed:', e);
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// --- Admin: User Profile Details ---
app.get('/api/admin/users/:id', authenticateToken, isAdmin, hasPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: safeParseId(id) },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { orders: true }
        }
      }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const totalSpend = user.orders.reduce((sum, order) => sum + order.total, 0);
    
    res.json({ ...user, totalSpend });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// --- Message functions ---
app.get('/api/messages/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    // Check if order belongs to user or user is admin
    const order = await prisma.order.findUnique({
      where: { id: safeParseId(orderId) }
    });
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: { orderId: safeParseId(orderId) },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/admin/messages', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all messages grouped by order, with order and user details
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        user: true
      }
    });

    // Group by orderId to show conversations
    const conversations = messages.reduce((acc, msg) => {
      if (!acc[msg.orderId]) {
        acc[msg.orderId] = {
          orderId: msg.orderId,
          order: msg.order,
          user: msg.user,
          lastMessage: msg,
          unreadCount: 0 // We could implement unread status later
        };
      }
      return acc;
    }, {});

    res.json(Object.values(conversations));
  } catch (error) {
    console.error('Fetch admin messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { orderId, text } = req.body;
    const userId = req.user.id;
    const sender = req.user.role === 'ADMIN' ? 'ADMIN' : 'USER';

    // Check if order belongs to user or user is admin
    const order = await prisma.order.findUnique({
      where: { id: safeParseId(orderId) }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await prisma.message.create({
      data: {
        orderId: safeParseId(orderId),
        userId,
        sender,
        text
      }
    });

    // Notify other party via socket if needed
    io.emit('new_message', message);

    // If admin sent message, notify user
    if (sender === 'ADMIN') {
      await createUserNotification(
        order.userId,
        'رسالة جديدة من الدعم الفني 💬',
        `لديك رسالة جديدة بخصوص الطلب #${orderId}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        'system',
        'chat',
        'purple',
        `/chat?orderId=${orderId}`
      );
    } else {
      // If user sent message, notify admin (using the existing createNotification helper for admins)
      await createNotification(
        'رسالة جديدة من عميل 💬',
        `العميل ${req.user.name || 'مجهول'} أرسل رسالة بخصوص الطلب #${orderId}`,
        'info',
        `/admin/orders/${orderId}`
      );
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const PORT = process.env.PORT || 7860;

// Root route - MUST be before any other routes that might conflict
app.get('/', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('E-commerce API is running... (Frontend build not found)');
  }
});

// API routes should go here...

// Catch-all route for SPA - MUST be after all API routes
app.get('/*any', (req, res) => {
  // Check if the request is for an API route - if so, don't serve index.html
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('E-commerce API is running... (Frontend build not found)');
  }
});

if (process.env.RUN_CRON_TASKS === 'true') {
  setupLinkCheckerCron();
} else {
  console.log('[Cron] Automated tasks are DISABLED (RUN_CRON_TASKS is not "true")');
}

console.log('Attempting to start server on port:', process.env.PORT || 5001);

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} (accessible from network)`);
  
  // MeiliSearch indexing removed
  setTimeout(() => {
    console.log('[Search Debug] Search system ready');
  }, 5000);
});

server.on('error', (e) => {
  console.error('SERVER LISTEN ERROR:', e);
});

