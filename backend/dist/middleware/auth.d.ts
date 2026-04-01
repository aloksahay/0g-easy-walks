import { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            walletAddress?: string;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map