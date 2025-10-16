import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Default error
  let status = 500;
  let message = 'Internal server error';

  // Prisma errors
  if (err.code === 'P2002') {
    status = 400;
    message = 'Unique constraint violation';
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err.code === 'P2003') {
    status = 400;
    message = 'Foreign key constraint violation';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
};