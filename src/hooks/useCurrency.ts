/**
 * Hook to format currency values
 * 
 * Usage:
 * const { formatCurrency } = useCurrency();
 * const price = formatCurrency(1234.56); // "$1,234.56"
 */
export function useCurrency() {
  // TODO: Connect to your actual currency context
  // For now, using USD as default
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return {
    formatCurrency,
  };
}
