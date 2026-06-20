export interface CurrencyArgs {
    amount: number;
    from_currency: string;
    to_currency: string;
}

// Mock exchange rates relative to USD
const MOCK_RATES: Record<string, number> = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 150.5,
    'INR': 83.2
};

export function convertCurrency(args: CurrencyArgs): string {
    // throw/return an error if the currency is BLORP (for testing error handling)
    // if (args.to_currency === "BLORP") {
    //     throw new Error("Unknown currency: BLORP");
    //     // return JSON.stringify({ error: "Unknown currency: BLORP", from: args.from_currency, to: args.to_currency });
    // }

    try {
        const { amount, from_currency, to_currency } = args;
        const from = from_currency.toUpperCase();
        const to = to_currency.toUpperCase();

        const fromRate = MOCK_RATES[from];
        const toRate = MOCK_RATES[to];

        if (!fromRate || !toRate) {
            return JSON.stringify({
                error: `Exchange rate not found for ${!fromRate ? from : to}. Supported currencies: USD, EUR, GBP, JPY, INR.`
            });
        }

        // Convert to USD first, then to target currency
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
