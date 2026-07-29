import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { paymentDues, settings, billingAuditLogs } from "../../drizzle/schema";

export interface SchoolBillingSettings {
  lateFeeEnabled: boolean;
  lateFeeType: "fixed" | "percentage";
  lateFeeValue: number;
  interestEnabled: boolean;
  interestType: "daily" | "monthly";
  interestRate: number;
  graceDays: number;
  autoUpdateInvoice: boolean;
  showFeeBreakdown: boolean;
  earlyDiscountEnabled: boolean;
  earlyDiscountType: "fixed" | "percentage";
  earlyDiscountValue: number;
  earlyDiscountDays: number;
}

export interface CalculationResult {
  invoiceId: number;
  originalAmount: number;
  updatedAmount: number;
  lateFeeAmount: number;
  interestAmount: number;
  earlyDiscountAmount: number;
  daysOverdue: number;
  graceDays: number;
  totalDiscount: number;
  calculationDate: Date;
  schoolSettingsUsed: SchoolBillingSettings;
}

export interface CalculateInvoiceOptions {
  origin?: "Financeiro" | "WhatsApp" | "Área do Aluno" | "API" | "PIX" | "System";
  userId?: number;
  forceRecalculate?: boolean;
  targetDate?: Date;
}

// Memory Cache (5 minutes TTL)
interface CacheEntry {
  result: CalculationResult;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export class BillingEngine {
  /**
   * Extrai e normaliza as configurações financeiras do objeto de settings da escola
   */
  public static extractSchoolSettings(schoolSettingsObj: any): SchoolBillingSettings {
    if (!schoolSettingsObj) {
      return {
        lateFeeEnabled: true,
        lateFeeType: "percentage",
        lateFeeValue: 2.0,
        interestEnabled: true,
        interestType: "daily",
        interestRate: 0.33,
        graceDays: 3,
        autoUpdateInvoice: true,
        showFeeBreakdown: true,
        earlyDiscountEnabled: false,
        earlyDiscountType: "percentage",
        earlyDiscountValue: 5.0,
        earlyDiscountDays: 0,
      };
    }

    return {
      lateFeeEnabled: schoolSettingsObj.lateFeeEnabled !== 0,
      lateFeeType: (schoolSettingsObj.lateFeeType === "fixed" ? "fixed" : "percentage") as "fixed" | "percentage",
      lateFeeValue: Number(schoolSettingsObj.lateFeeValue ?? 2.0),
      interestEnabled: schoolSettingsObj.interestEnabled !== 0,
      interestType: (schoolSettingsObj.interestType === "monthly" ? "monthly" : "daily") as "daily" | "monthly",
      interestRate: Number(schoolSettingsObj.interestRate ?? 0.33),
      graceDays: Number(schoolSettingsObj.graceDays ?? 3),
      autoUpdateInvoice: schoolSettingsObj.autoUpdateInvoice !== 0,
      showFeeBreakdown: schoolSettingsObj.showFeeBreakdown !== 0,
      earlyDiscountEnabled: Boolean(schoolSettingsObj.earlyDiscountEnabled),
      earlyDiscountType: (schoolSettingsObj.earlyDiscountType === "fixed" ? "fixed" : "percentage") as "fixed" | "percentage",
      earlyDiscountValue: Number(schoolSettingsObj.earlyDiscountValue ?? 5.0),
      earlyDiscountDays: Number(schoolSettingsObj.earlyDiscountDays ?? 0),
    };
  }

  /**
   * Função pura de cálculo de mensalidade.
   * Não altera o banco nem realiza I/O.
   */
  public static computeInvoiceAmounts(
    invoice: {
      id: number;
      amount: string | number;
      originalAmount?: string | number | null;
      dueDate: string | Date;
      status: string;
      paidAt?: string | Date | null;
    },
    schoolSettings: SchoolBillingSettings,
    targetDate: Date = new Date()
  ): CalculationResult {
    const rawOriginal = invoice.originalAmount ?? invoice.amount;
    const originalAmount = Math.round(Number(rawOriginal) * 100) / 100;

    // Se já estiver pago, mantém o valor registrado e zerados juros/multa futuros
    if (invoice.status === "pago") {
      const finalPaidAmount = Math.round(Number(invoice.amount) * 100) / 100;
      return {
        invoiceId: invoice.id,
        originalAmount,
        updatedAmount: finalPaidAmount,
        lateFeeAmount: 0,
        interestAmount: 0,
        earlyDiscountAmount: 0,
        daysOverdue: 0,
        graceDays: schoolSettings.graceDays,
        totalDiscount: 0,
        calculationDate: targetDate,
        schoolSettingsUsed: schoolSettings,
      };
    }

    // Normaliza datas para comparar início do dia local sem interferência de fuso horário
    const parseLocalDate = (d: string | Date): Date => {
      if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dateStr = String(d).slice(0, 10);
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      const parsed = new Date(d);
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    const dueZero = parseLocalDate(invoice.dueDate);
    const nowZero = parseLocalDate(targetDate);

    const diffTime = nowZero.getTime() - dueZero.getTime();
    const elapsedDays = Math.floor(diffTime / (1000 * 3600 * 24));

    let daysOverdue = 0;
    let lateFeeAmount = 0;
    let interestAmount = 0;
    let earlyDiscountAmount = 0;

    // Se estiver vencido e além da carência
    if (elapsedDays > 0) {
      if (elapsedDays > schoolSettings.graceDays) {
        daysOverdue = elapsedDays;

        // Multa
        if (schoolSettings.lateFeeEnabled) {
          if (schoolSettings.lateFeeType === "percentage") {
            lateFeeAmount = (originalAmount * schoolSettings.lateFeeValue) / 100;
          } else {
            lateFeeAmount = schoolSettings.lateFeeValue;
          }
        }

        // Juros
        if (schoolSettings.interestEnabled) {
          if (schoolSettings.interestType === "daily") {
            interestAmount = (originalAmount * (schoolSettings.interestRate / 100)) * daysOverdue;
          } else if (schoolSettings.interestType === "monthly") {
            interestAmount = (originalAmount * (schoolSettings.interestRate / 100)) * (daysOverdue / 30);
          }
        }
      }
    } else if (schoolSettings.earlyDiscountEnabled) {
      // Se estiver em dia (pagamento antecipado ou no próprio vencimento)
      const daysBeforeDueDate = Math.abs(elapsedDays);
      if (daysBeforeDueDate >= schoolSettings.earlyDiscountDays) {
        if (schoolSettings.earlyDiscountType === "percentage") {
          earlyDiscountAmount = (originalAmount * schoolSettings.earlyDiscountValue) / 100;
        } else {
          earlyDiscountAmount = schoolSettings.earlyDiscountValue;
        }
      }
    }

    // Arredondamento monetário para 2 casas
    lateFeeAmount = Math.round(lateFeeAmount * 100) / 100;
    interestAmount = Math.round(interestAmount * 100) / 100;
    earlyDiscountAmount = Math.round(earlyDiscountAmount * 100) / 100;
    const totalDiscount = earlyDiscountAmount;

    const updatedAmount = Math.max(0, Math.round((originalAmount + lateFeeAmount + interestAmount - totalDiscount) * 100) / 100);

    return {
      invoiceId: invoice.id,
      originalAmount,
      updatedAmount,
      lateFeeAmount,
      interestAmount,
      earlyDiscountAmount,
      daysOverdue,
      graceDays: schoolSettings.graceDays,
      totalDiscount,
      calculationDate: targetDate,
      schoolSettingsUsed: schoolSettings,
    };
  }

  /**
   * Calcula o valor da cobrança buscando no banco de dados e aplicando regras da escola
   */
  public static async calculateInvoice(
    invoiceId: number,
    options: CalculateInvoiceOptions = {}
  ): Promise<CalculationResult> {
    const cacheKey = `${invoiceId}_${options.targetDate ? options.targetDate.toISOString().slice(0, 10) : "today"}`;

    if (!options.forceRecalculate) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.result;
      }
    }

    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível");

    // 1. Buscar cobrança
    const [invoice] = await db
      .select()
      .from(paymentDues)
      .where(eq(paymentDues.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new Error(`Cobrança com ID ${invoiceId} não encontrada.`);
    }

    // 2. Buscar configurações da escola (por organizationId ou userId)
    let schoolSettingsObj: any = null;
    if (invoice.organizationId) {
      const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.organizationId, invoice.organizationId))
        .limit(1);
      schoolSettingsObj = setting;
    }

    if (!schoolSettingsObj && invoice.userId) {
      const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, invoice.userId))
        .limit(1);
      schoolSettingsObj = setting;
    }

    const schoolSettings = this.extractSchoolSettings(schoolSettingsObj);
    const result = this.computeInvoiceAmounts(invoice, schoolSettings, options.targetDate);

    // Salvar cache em memória
    cache.set(cacheKey, { result, timestamp: Date.now() });

    // Salvar Log de Auditoria se informado a origem
    if (options.origin) {
      try {
        await db.insert(billingAuditLogs).values({
          organizationId: invoice.organizationId ?? null,
          invoiceId: invoice.id,
          originalAmount: result.originalAmount.toFixed(2),
          lateFeeAmount: result.lateFeeAmount.toFixed(2),
          interestAmount: result.interestAmount.toFixed(2),
          daysOverdue: result.daysOverdue,
          updatedAmount: result.updatedAmount.toFixed(2),
          userId: options.userId ?? null,
          origin: options.origin,
        });
      } catch (err) {
        console.error("[BillingEngine] Erro ao registrar log de auditoria:", err);
      }
    }

    return result;
  }

  /**
   * Enriquece uma lista de cobranças em lote com os cálculos do BillingEngine
   */
  public static async enrichInvoicesList(
    invoicesList: any[],
    schoolSettingsObj?: any
  ): Promise<Array<any & { calculation: CalculationResult }>> {
    if (!invoicesList || invoicesList.length === 0) return [];

    const db = await getDb();
    const schoolSettings = this.extractSchoolSettings(schoolSettingsObj);

    return invoicesList.map((inv) => {
      const calculation = this.computeInvoiceAmounts(inv, schoolSettings);
      return {
        ...inv,
        amount: calculation.updatedAmount.toFixed(2), // Garante que a propriedade amount do objeto retornado seja atualizada
        calculation,
      };
    });
  }

  /**
   * Limpa o cache interno do BillingEngine
   */
  public static clearCache(): void {
    cache.clear();
  }
}
