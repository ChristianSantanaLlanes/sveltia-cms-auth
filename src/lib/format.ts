const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('en-US');

export const money = (n: number) => USD.format(Math.round(n));
export const moneyCents = (n: number) => USD_CENTS.format(n);
export const num = (n: number) => NUM.format(n);
export const signedMoney = (n: number) => (n === 0 ? 'Included' : `${n > 0 ? '+' : '−'}${USD.format(Math.abs(n))}`);
export const miles = (n: number) => `${NUM.format(Math.round(n))} mi`;
export const monthly = (n: number) => `${USD.format(Math.round(n))}/mo`;
