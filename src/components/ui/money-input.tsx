"use client";

import { NumericFormat, NumericFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MoneyInputProps
  extends Omit<NumericFormatProps, "customInput" | "thousandSeparator" | "decimalSeparator" | "onValueChange"> {
  value: string | number;
  onValueChange: (value: string) => void;
  className?: string;
}

export function MoneyInput({ value, onValueChange, className, ...props }: MoneyInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      thousandSeparator="."
      decimalSeparator=","
      allowNegative={false}
      value={value}
      onValueChange={(values) => onValueChange(values.value)}
      className={cn(className)}
      {...props}
    />
  );
}
