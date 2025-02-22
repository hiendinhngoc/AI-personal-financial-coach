import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBudgetSchema, insertExpenseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/budget/:month", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const budget = await storage.getBudget(req.user.id, req.params.month);
    res.json(budget || null);
  });

  app.post("/api/budget", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parseResult = insertBudgetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }
    const budget = await storage.createBudget(req.user.id, parseResult.data);
    res.status(201).json(budget);
  });

  app.get("/api/expenses/:month", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const expenses = await storage.getExpenses(req.user.id, req.params.month);
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parseResult = insertExpenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }
    const expense = await storage.createExpense(req.user.id, parseResult.data);
    
    // Update remaining budget
    const budget = await storage.getBudget(req.user.id, new Date().toISOString().slice(0, 7));
    if (budget) {
      await storage.updateBudget(budget.id, budget.remainingAmount - expense.amount);
      if (budget.remainingAmount - expense.amount < budget.totalAmount * 0.2) {
        await storage.createNotification(
          req.user.id,
          "Warning: You have less than 20% of your budget remaining"
        );
      }
    }
    
    res.status(201).json(expense);
  });

  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const notifications = await storage.getNotifications(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.markNotificationRead(parseInt(req.params.id));
    res.sendStatus(200);
  });

  const httpServer = createServer(app);
  return httpServer;
}
