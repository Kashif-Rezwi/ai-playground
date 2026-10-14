import { z } from "zod";

// The arguments the model will try to provide (validated with Zod before execution)
export const CurrencyArgsSchema = z.object({
    amount: z.number().min(0, "amount must be non-negative"),
    from_currency: z.string().min(1, "from_currency is required"),
    to_currency: z.string().min(1, "to_currency is required"),
});

export type CurrencyArgs = z.infer<typeof CurrencyArgsSchema>;

// Mock exchange rates relative to USD
const MOCK_RATES: Record<string, number> = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 150.5,
    'INR': 83.2
};

// Mock implementation
export function convertCurrency(args: CurrencyArgs): string {
    try {
        const { amount, from_currency, to_currency } = args;
        const from = from_currency.toUpperCase();
        const to = to_currency.toUpperCase();

        const fromRate = MOCK_RATES[from];
        const toRate = MOCK_RATES[to];

        if (fromRate === undefined || toRate === undefined) {
            return JSON.stringify({
                error: `Exchange rate not found for ${!fromRate ? from : to}. Supported currencies: USD, EUR, GBP, JPY, INR.`
            });
        }

        // Convert the amount to USD first, then to the target currency
        const amountInUSD = amount / fromRate;
        const resultAmount = amountInUSD * toRate;

        return JSON.stringify({
            amount_provided: amount,
            from_currency: from,
            to_currency: to,
            converted_amount: Number(resultAmount.toFixed(2))
        });
    } catch (error) {
        return JSON.stringify({ error: "An unexpected error occurred while converting currency." });
    }
}
