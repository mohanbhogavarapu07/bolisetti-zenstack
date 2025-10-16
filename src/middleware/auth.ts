import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '.prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth token, continue without user
      req.user = undefined;
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          role: true,
          constituency: true,
        },
      });

      if (!user || !user.isActive) {
        req.user = undefined;
        return next();
      }

      req.user = user;
    } catch (jwtError) {
      // Invalid token, continue without user
      req.user = undefined;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.user = undefined;
    next();
  }
};
