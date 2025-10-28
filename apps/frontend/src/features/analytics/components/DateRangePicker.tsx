import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange as DayPickerDateRange } from 'react-day-picker';

interface DateRangePickerProps {
  value?: DayPickerDateRange;
  onChange: (range: DayPickerDateRange | undefined) => void;
  placeholder?: string;
}

export function DateRangePicker({ value, onChange, placeholder = 'Select date range' }: DateRangePickerProps) {
  const [date, setDate] = useState<DayPickerDateRange | undefined>(value);

  const handleSelect = (range: DayPickerDateRange | undefined) => {
    setDate(range);
    onChange(range);
  };

  const displayValue = date?.from ? (
    date.to ? (
      <>
        {format(date.from, 'PPP')} - {format(date.to, 'PPP')}
      </>
    ) : (
      format(date.from, 'PPP')
    )
  ) : (
    <span>{placeholder}</span>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className="w-[280px] justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}