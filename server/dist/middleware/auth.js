"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticate = async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Attach user to request
        // @ts-ignore
        request.user = { id: decoded.userId };
    }
    catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
