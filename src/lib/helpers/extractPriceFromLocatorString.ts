export const extractPriceFromLocatorString = (priceStr: string) => {
  // parses the numeric values but we need to take into account "buy/rent" pricing use-case
  // where the string is something like "1.350.000 € / 5.500 €" therefore we only want the first value
  const prices = priceStr.split('/').map(price => {
    return parseFloat(price.replace(/[^0-9.]/g, '').replace(/\./g, ''));
  });

  // Return only the first price which represents "buy price"
  return prices[0];
};
