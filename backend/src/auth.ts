import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: number;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  let token: string | undefined;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  }
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) {
    res.status(401).json({ code: 401, message: '未登录' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ code: 401, message: '登录已过期' });
    return;
  }
  req.user = payload;
  next();
}
