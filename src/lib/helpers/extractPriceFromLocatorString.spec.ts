import { extractPriceFromLocatorString } from './extractPriceFromLocatorString';

const useCases = [
  { raw: '2.250.000 €', expected: 2250000 },
  { raw: '1000 €', expected: 1000 },
  { raw: '7.500 €', expected: 7500 },
  { raw: '265.000.000 €', expected: 265000000 },
  { raw: '700.000.000.000 €', expected: 700000000000 },
  { raw: '485.000 €', expected: 485000 },
  { raw: '1.157.000 €', expected: 1157000 },
  { raw: '6.500.000 €', expected: 6500000 },
  { raw: '99.800 €', expected: 99800 },
  { raw: '1.350.000 € / 5.500 €', expected: 1350000 },
  { raw: '2.000.000 € / 7.200 €', expected: 2000000 },
];
describe('extractPriceFromLocatorString', () => {
  it.each(useCases)('should parse $raw as $expected', ({ raw, expected }) => {
    expect(extractPriceFromLocatorString(raw)).toStrictEqual(expected);
  });
});
