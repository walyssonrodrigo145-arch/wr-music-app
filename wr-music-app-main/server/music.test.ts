import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database helpers
vi.mock("./db", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalStudents: 12,
    activeStudents: 10,
    weekLessons: 14,
    completionRate: 82,
    monthlyRevenue: 2340,
  }),
  getMonthlyStats: vi.fn().mockResolvedValue([
    { month: 3, year: 2026, activeStudents: 12, lessonsGiven: 44, revenue: "2340.00" },
    { month: 2, year: 2026, activeStudents: 13, lessonsGiven: 46, revenue: "2380.00" },
  ]),
  getStudentsWithInstrument: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Lucas Ferreira",
      email: "lucas@test.com",
      phone: "(11) 99123-4567",
      level: "intermediario",
      status: "ativo",
      monthlyFee: "180.00",
      startDate: new Date("2024-03-01"),
      instrumentName: "Violão",
      instrumentColor: "#6366f1",
      instrumentIcon: "guitar",
    },
  ]),
  getRecentLessons: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "Acordes básicos",
      scheduledAt: new Date("2026-03-27T14:00:00"),
      duration: 60,
      status: "concluida",
      rating: 5,
      studentName: "Lucas Ferreira",
      studentId: 1,
    },
  ]),
  getInstrumentsWithCount: vi.fn().mockResolvedValue([
    { id: 1, name: "Violão", category: "Cordas", icon: "guitar", color: "#6366f1", studentCount: 2 },
    { id: 2, name: "Piano", category: "Teclado", icon: "piano", color: "#8b5cf6", studentCount: 2 },
  ]),
  getLessonsByDayOfWeek: vi.fn().mockResolvedValue([
    { dayOfWeek: 2, count: 3 },
    { dayOfWeek: 4, count: 5 },
    { dayOfWeek: 6, count: 4 },
  ]),
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        orderBy: vi.fn().mockResolvedValue([]),
        leftJoin: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getSettingsByUserId: vi.fn().mockResolvedValue(null),
  upsertSettings: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("dashboard router", () => {
  it("returns dashboard stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toBeDefined();
    expect(stats?.totalStudents).toBe(12);
    expect(stats?.completionRate).toBe(82);
    expect(stats?.monthlyRevenue).toBe(2340);
  });

  it("returns monthly stats formatted", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.dashboard.monthlyStats();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("month");
    expect(data[0]).toHaveProperty("alunos");
    expect(data[0]).toHaveProperty("aulas");
    expect(data[0]).toHaveProperty("receita");
  });

  it("returns lessons by day of week with 7 days", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.dashboard.lessonsByDay();
    expect(data).toHaveLength(7);
    const days = data.map(d => d.day);
    expect(days).toContain("Seg");
    expect(days).toContain("Sex");
  });

  it("returns recent lessons", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const lessons = await caller.dashboard.recentLessons();
    expect(Array.isArray(lessons)).toBe(true);
    expect(lessons[0]).toHaveProperty("title");
    expect(lessons[0]).toHaveProperty("status");
    expect(lessons[0]).toHaveProperty("studentName");
  });
});

describe("students router", () => {
  it("returns list of students with instrument info", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const students = await caller.students.list();
    expect(Array.isArray(students)).toBe(true);
    expect(students[0]).toHaveProperty("name");
    expect(students[0]).toHaveProperty("instrumentName");
    expect(students[0]).toHaveProperty("level");
  });

  it("returns recent students", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const students = await caller.students.recent();
    expect(Array.isArray(students)).toBe(true);
  });
});

describe("instruments router", () => {
  it("returns instruments with student count", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const instruments = await caller.instruments.list();
    expect(Array.isArray(instruments)).toBe(true);
    expect(instruments.length).toBe(2);
    expect(instruments[0]).toHaveProperty("name");
    expect(instruments[0]).toHaveProperty("studentCount");
  });
});

describe("students CRUD", () => {
  it("searches students by query", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const results = await caller.students.search({ q: "Lucas" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("creates a new student", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.students.create({
      name: "Maria Silva",
      email: "maria@test.com",
      phone: "(11) 98765-4321",
      level: "iniciante",
      monthlyFee: 200,
      status: "ativo",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("updates a student status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.students.update({ id: 1, status: "pausado" });
    expect(result).toHaveProperty("success", true);
  });

  it("deletes a student", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.students.delete({ id: 99 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("lessons CRUD", () => {
  it("creates a new lesson", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lessons.create({
      title: "Escala pentatônica",
      studentId: 1,
      scheduledAt: new Date().toISOString(),
      duration: 60,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("updates lesson status to concluida", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.lessons.create({
      studentId: 1, title: 'Guitar Lesson', scheduledAt: new Date(Date.now() + 86400000).toISOString(), duration: 60, instrumentId: null 
    });
    const result = await caller.lessons.updateStatus({ id: 1, status: "concluida", rating: 5 });
    expect(result).toHaveProperty("success", true);
  });

  it("deletes a lesson", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lessons.delete({ id: 99 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("instruments CRUD", () => {
  it("creates a new instrument", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.instruments.create({
      name: "Cavaquinho",
      category: "Cordas",
      color: "#f97316",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("updates an instrument", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.instruments.update({ id: 1, name: "Violão Clássico" });
    expect(result).toHaveProperty("success", true);
  });

  it("deletes an instrument", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.instruments.delete({ id: 99 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("settings exportData", () => {
  it("returns CSV strings for students and lessons", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.exportData();
    expect(result).toHaveProperty("studentsCsv");
    expect(result).toHaveProperty("lessonsCsv");
    expect(typeof result.studentsCsv).toBe("string");
    expect(typeof result.lessonsCsv).toBe("string");
    // Headers must be present
    expect(result.studentsCsv).toContain("Nome");
    expect(result.lessonsCsv).toContain("Titulo");
  });
});

describe("auth router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.name).toBe("Test User");
    expect(user?.role).toBe("admin");
  });

  it("clears session cookie on logout", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});
