import { forwardRef, type InputHTMLAttributes } from 'react';

/** Amount input: decimal keypad on phones, "R" prefix, any common way of typing rands accepted (parseZAR). */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function MoneyInput(props, ref) {
  return (
    <div className="money-input">
      <span aria-hidden="true">R</span>
      <input ref={ref} className="input" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" {...props} />
    </div>
  );
});
